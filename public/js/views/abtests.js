// A/B tests: compare the ads in one ad set (creative test) or the ad sets in
// one campaign (audience test), judge them by cost per valid lead, say how sure
// the result is, and keep a log of what worked.
//
// How sure: valid leads (or Meta leads) arrive roughly like a Poisson count per
// pound spent. Given the total, the leader's share follows a binomial with the
// leader's share of spend; the two-sided p-value of that test gives the
// confidence that the leader really is cheaper per valid lead than the runner-up.
import { html, raw, money, n, pct, toast, confirmDialog, dateTime } from "../ui.js";
import { post } from "../api.js";
import { load, save, targets } from "../store.js";
import { allLeads, quality, treeDates, score } from "../model.js";
import { connectCard, loadingCard, statusPill } from "./common.js";

let campaignId = "";
let mode = "ads"; // ads (creative test inside one ad set) | adsets (audience test inside one campaign)
let adsetId = "";
let basis = "valid"; // valid | leads
// Retargeting ad sets (people who already know the project) always look cheapest.
const WARM = /warm|retarget|remarket|visitor|viewer|engager|lookalike of leads|re-?engage/i;

// ---------------------------------------------------------------- statistics
/** Two-sided p-value: is x out of k unlikely if each event had chance p? (exact for small k, normal approximation above 300) */
export function binomTwoSided(x, k, p) {
  if (k <= 0 || p <= 0 || p >= 1) return 1;
  if (k > 300) {
    const mu = k * p;
    const sd = Math.sqrt(k * p * (1 - p));
    const z = Math.abs(x - mu) / sd;
    return Math.min(1, 2 * (1 - normCdf(z)));
  }
  const pmf = [];
  let v = Math.pow(1 - p, k);
  for (let i = 0; i <= k; i += 1) {
    pmf.push(v);
    v = (v * (k - i) * p) / ((i + 1) * (1 - p));
  }
  const px = pmf[x];
  let total = 0;
  for (const q of pmf) if (q <= px * (1 + 1e-9)) total += q;
  return Math.min(1, total);
}
function normCdf(z) {
  // Abramowitz & Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * (z / Math.SQRT2));
  const e = 1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) * Math.exp(-(z * z) / 2);
  return 0.5 * (1 + e);
}

/** Leader vs runner-up on results per pound. */
export function verdict(variants, key) {
  const live = variants.filter((v) => v.spend > 0);
  if (live.length < 2) return { kind: "none", text: "A test needs at least two variants with spend." };
  const rate = (v) => v[key] / v.spend;
  const sorted = [...live].sort((a, b) => rate(b) - rate(a) || b[key] - a[key]);
  const [lead, second] = sorted;
  const k = lead[key] + second[key];
  const p0 = lead.spend / (lead.spend + second.spend);
  const pv = binomTwoSided(lead[key], k, p0);
  const conf = rate(lead) > rate(second) ? 1 - pv : 0;
  const need = 15; // results across the two before calling it
  const pooledRate = (lead[key] + second[key]) / (lead.spend + second.spend);
  const moreSpend = k >= need ? 0 : pooledRate > 0 ? (need - k) / pooledRate : null;
  let kind;
  if (k < need && conf < 0.95) kind = "early";
  else if (conf >= 0.95) kind = "winner";
  else if (conf >= 0.8) kind = "leaning";
  else kind = "tie";
  return { kind, lead, second, conf, k, moreSpend, sorted };
}

// ---------------------------------------------------------------- data
function variantsFor(ctx) {
  const { since, until } = treeDates(ctx.tree);
  const q = quality(allLeads(), since, until);
  const c = ctx.tree.campaigns.find((x) => x.id === campaignId);
  if (!c) return { c: null, list: [] };
  const toV = (o, qq, kind) => {
    const s = score(o.m, qq);
    return { id: o.id, kind, name: o.name, status: o.status, effective: o.effectiveStatus, dailyBudget: o.dailyBudget, spend: s.spend, impressions: o.m?.impressions || 0, ctr: o.m?.ctr ?? null, leads: s.metaLeads, cpl: s.cpl, logged: s.logged, valid: s.valid, validRate: s.validRate, cpvl: s.cpvl, meetings: s.meetings, thumb: o.creative?.thumb || null };
  };
  if (mode === "adsets") return { c, list: c.adsets.map((a) => toV(a, q.adset[a.id], "ad set")) };
  const s = c.adsets.find((x) => x.id === adsetId) || c.adsets.find((x) => x.ads.length > 1) || c.adsets[0];
  if (!s) return { c, list: [] };
  adsetId = s.id;
  return { c, s, list: s.ads.map((a) => toV(a, q.ad[a.id], "ad")) };
}

// ---------------------------------------------------------------- screen
const VERDICT = {
  winner: ["good", "Winner"],
  leaning: ["info", "Leaning"],
  tie: ["", "No clear difference"],
  early: ["warn", "Too early"],
  none: ["", "Not a test yet"],
};

function verdictCard(v, key, t) {
  if (v.kind === "none") return html`<div class="note">${v.text}</div>`;
  const warmLead = mode === "adsets" && WARM.test(v.lead.name);
  const what = key === "valid" ? "valid lead" : "lead";
  const costL = v.lead.spend / Math.max(1, v.lead[key]);
  const costS = v.second[key] ? v.second.spend / v.second[key] : null;
  const [tone, label] = VERDICT[v.kind];
  const body = {
    winner: html`<b>${v.lead.name}</b> brings a ${what} for ${money(costL)}${costS ? html` against ${money(costS)} for ${v.second.name}` : ""}. ${pct(v.conf * 100, 0)} sure it is really cheaper, not luck. ${warmLead ? "Keep it running as a small always-on ad set." : "Keep it, turn the others off, and raise its budget 15–20%."}`,
    leaning: html`<b>${v.lead.name}</b> is ahead (${money(costL)} per ${what}${costS ? html` against ${money(costS)}` : ""}), ${pct(v.conf * 100, 0)} sure. Keep both running a few more days before deciding.`,
    tie: html`<b>${v.lead.name}</b> and <b>${v.second.name}</b> perform about the same per ${what} (${pct(v.conf * 100, 0)} sure of a difference). Keep the cheaper one to run, or test a bigger change next.`,
    early: html`${n(v.k)} ${what}s so far between the top two. About 15 are needed before judging${v.moreSpend ? html`, roughly <b>${money(v.moreSpend)}</b> more spend at the current rate` : ""}. ${v.lead.name} is ahead for now.`,
  }[v.kind];
  return html`<div class="alert ${tone || "info"}" style="margin-bottom:12px"><span class="dot"></span><div class="grow"><b>${label}</b> <span class="pill ${tone || "line"}">${key === "valid" ? "judged on valid leads" : "judged on Meta leads"}</span><p style="margin-top:4px">${body}</p>${t.cpvl && key === "valid" ? html`<p class="tiny faint">Your target cost per valid lead: ${money(t.cpvl)}.</p>` : ""}${warmLead ? html`<p class="small" style="margin-top:6px"><b>Careful:</b> ${v.lead.name} is a warm audience (people who already saw the project). Warm audiences are almost always cheapest, and they are filled by the broad ad sets. Do not turn the broad ones off; compare broad audiences with each other instead, and keep warm as a small always-on ad set.</p>` : ""}</div></div>`;
}

function variantRows(list, v, key) {
  const per = (x) => (x[key] ? x.spend / x[key] : null);
  const max = Math.max(1, ...list.map((x) => per(x) || 0));
  const leadId = v.lead?.id;
  return html`<div class="table-wrap"><table><thead><tr><th>Variant</th><th>Cost per ${key === "valid" ? "valid lead" : "lead"} (shorter is better)</th><th class="n">Spend</th><th class="n">CTR</th><th class="n">Leads</th><th class="n">CPL</th><th class="n">Valid</th><th class="n">Valid rate</th><th class="n">Meet.</th></tr></thead><tbody>
  ${list.map((x) => {
    const c = per(x);
    return html`<tr>
      <td style="min-width:180px"><div class="row" style="gap:8px">${x.thumb ? html`<img class="thumb" src="${x.thumb}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ""}<div><div class="name">${x.name}</div><div class="row wrap" style="gap:4px">${x.id === leadId && v.kind !== "none" ? html`<span class="pill ${v.kind === "winner" ? "good" : "info"}">${v.kind === "winner" ? "✓ Winner" : "Ahead"}</span>` : ""}${x.effective !== "ACTIVE" ? statusPill(x.effective) : ""}</div></div></div></td>
      <td style="min-width:160px"><div class="abbar"><i class="${x.id === leadId ? "lead" : ""}" style="width:${c ? Math.max(3, (c / max) * 100) : 0}%"></i><span>${c ? money(c) : x.spend ? "no results yet" : "—"}</span></div></td>
      <td class="n">${money(x.spend)}</td><td class="n">${pct(x.ctr, 2)}</td><td class="n">${n(x.leads)}</td><td class="n">${money(x.cpl)}</td><td class="n"><b>${n(x.valid)}</b></td><td class="n">${pct(x.validRate === null ? null : x.validRate * 100, 0)}</td><td class="n">${n(x.meetings)}</td>
    </tr>`;
  })}</tbody></table></div>`;
}

export function render(ctx) {
  const top = html`<div class="top"><div><h1>A/B tests</h1><p class="sub">Change one thing at a time, give each version the same budget, and let the numbers decide. Winners are judged on cost per valid lead, the people who really want to buy.</p></div>
    <div class="top-actions">${ctx.settings?.connected ? html`${ctx.periodSwitch()}${ctx.refreshButton()}` : ""}</div></div>`;
  if (!ctx.settings) return html`${top}${loadingCard()}`;
  if (!ctx.settings.connected) return html`${top}${connectCard(ctx.settings)}`;
  if (!ctx.tree) return html`${top}${loadingCard()}`;
  const camps = ctx.tree.campaigns.filter((c) => c.adsets.length);
  if (!camps.some((c) => c.id === campaignId)) campaignId = (camps.find((c) => c.status === "ACTIVE") || camps[0])?.id || "";
  const { c, s, list } = variantsFor(ctx);
  const t = targets();
  const anyValid = list.some((x) => x.valid > 0);
  const key = basis === "valid" && anyValid ? "valid" : "leads";
  const v = verdict(list, key);
  const log = load("abResults", []);
  const ro = ctx.tree.readOnly;
  const losers = v.kind === "winner" && !(mode === "adsets" && WARM.test(v.lead.name)) ? list.filter((x) => x.id !== v.lead.id && x.status === "ACTIVE") : [];

  return html`${top}
  <div class="card">
    <div class="row wrap" style="gap:10px">
      <label class="field"><span>Campaign</span><select class="input" data-ab="campaign">${camps.map((x) => html`<option value="${x.id}" ${x.id === campaignId ? raw("selected") : ""}>${x.name}</option>`)}</select></label>
      <div class="field"><span>Test</span><div class="seg"><button type="button" data-abmode="ads" aria-pressed="${mode === "ads"}">Creative: ads in an ad set</button><button type="button" data-abmode="adsets" aria-pressed="${mode === "adsets"}">Audience: ad sets</button></div></div>
      ${mode === "ads" && c ? html`<label class="field"><span>Ad set</span><select class="input" data-ab="adset">${c.adsets.map((a) => html`<option value="${a.id}" ${a.id === adsetId ? raw("selected") : ""}>${a.name} (${a.ads.length} ads)</option>`)}</select></label>` : ""}
      <div class="field"><span>Judge on</span><div class="seg"><button type="button" data-abbasis="valid" aria-pressed="${basis === "valid"}">Valid leads</button><button type="button" data-abbasis="leads" aria-pressed="${basis === "leads"}">Meta leads</button></div></div>
    </div>
    ${basis === "valid" && !anyValid ? html`<div class="note warn" style="margin-top:10px">No valid leads marked for these variants yet, so this uses Meta leads. Mark lead stages in Leads &amp; CRM to judge on real buyers.</div>` : ""}
  </div>
  <div class="card">
    <div class="card-head"><div><h2>${mode === "ads" ? `Creative test · ${s?.name || ""}` : `Audience test · ${c?.name || ""}`}</h2><p>${mode === "ads" ? "The ads share one audience, so the difference is the creative." : "Each ad set is a different audience. For a clean split with no overlap, use Meta's A/B test tool (Experiments)."}</p></div></div>
    ${verdictCard(v, key, t)}
    ${list.length ? variantRows(list, v, key) : html`<p class="muted">No variants here.</p>`}
    <div class="row wrap" style="margin-top:12px">
      ${losers.length && !ro ? html`<button class="btn" type="button" data-ab-off>Turn off the other ${losers.length}</button>` : ""}
      ${v.kind === "winner" && v.lead.kind === "ad set" && v.lead.dailyBudget && !ro ? html`<button class="btn" type="button" data-ab-raise>Raise ${v.lead.name} budget 20%</button>` : ""}
      ${v.kind !== "none" ? html`<button class="btn primary" type="button" data-ab-save>Save this result to your log</button>` : ""}
    </div>
  </div>
  <div class="grid g2">
    <div class="card"><h2>What you have learned</h2><p class="small muted" style="margin:2px 0 10px">Saved results, newest first. Kept in this browser (included in Backup).</p>
      ${log.length ? html`<div class="stack">${log.slice(0, 20).map((r, i) => html`<div class="lead"><div class="row between wrap"><b>${r.winner}</b><span class="pill ${r.kind === "winner" ? "good" : r.kind === "leaning" ? "info" : "line"}">${VERDICT[r.kind]?.[1] || r.kind} · ${pct(r.conf * 100, 0)}</span></div><div class="small muted">${r.test} · ${r.scope} · beat ${r.runnerUp} · ${money(r.costWinner)} vs ${money(r.costRunner)} per ${r.basis === "valid" ? "valid lead" : "lead"} · ${dateTime(r.at)}</div>${r.note ? html`<div class="small">${r.note}</div>` : ""}<div class="row" style="justify-content:flex-end"><button class="btn sm ghost danger" type="button" data-ab-del="${i}">Remove</button></div></div>`)}</div>` : html`<p class="muted small">No results saved yet. When a test has a winner, save it here so you remember what works for each project.</p>`}
    </div>
    <div class="card"><h2>How to run a clean test</h2><ul class="list" style="margin-top:8px">
      <li>Change one thing only: the hook, the video or image, the headline, the offer line, or the audience.</li>
      <li>Same budget and same dates for every version. Do not edit them while the test runs.</li>
      <li>Name ads by what they test, e.g. <code>hook-price</code> vs <code>hook-golf</code>, so the log reads clearly.</li>
      <li>Wait for about 15 valid leads across the top two, or at least 2× your target cost per valid lead each, before deciding.</li>
      <li>CTR and cost per lead show early which hook stops people; valid leads decide the winner.</li>
      <li>After a winner: turn the others off, raise the winner 15–20%, and start the next test against it.</li>
    </ul></div>
  </div>`;
}

export function mount(root, ctx) {
  root.onchange = (e) => {
    const s = e.target.closest("[data-ab]");
    if (!s) return;
    if (s.dataset.ab === "campaign") {
      campaignId = s.value;
      adsetId = "";
    } else adsetId = s.value;
    ctx.render();
  };
  root.onclick = async (e) => {
    const m = e.target.closest("[data-abmode]");
    if (m) {
      mode = m.dataset.abmode;
      return ctx.render();
    }
    const b = e.target.closest("[data-abbasis]");
    if (b) {
      basis = b.dataset.abbasis;
      return ctx.render();
    }
    const { c, s, list } = variantsFor(ctx);
    const anyValid = list.some((x) => x.valid > 0);
    const key = basis === "valid" && anyValid ? "valid" : "leads";
    const v = verdict(list, key);
    if (e.target.closest("[data-ab-off]")) {
      const losers = list.filter((x) => x.id !== v.lead.id && x.status === "ACTIVE");
      const ok = await confirmDialog({ title: `Turn off ${losers.length} losing ${losers[0]?.kind}${losers.length > 1 ? "s" : ""}?`, body: html`Keeps <b>${v.lead.name}</b> running. Turns off: ${losers.map((x) => x.name).join(", ")}.`, ok: "Turn them off", danger: true });
      if (!ok) return;
      for (const x of losers) {
        try {
          await post("/api/status", { id: x.id, status: "PAUSED", kind: x.kind });
        } catch (err) {
          toast(`${x.name}: ${err.message}`, "bad");
        }
      }
      toast("Done. The losers are off.", "good");
      return ctx.loadTree(true);
    }
    if (e.target.closest("[data-ab-raise]")) {
      const to = Math.round(v.lead.dailyBudget * 1.2);
      const ok = await confirmDialog({ title: "Raise the winner's budget?", body: html`<b>${v.lead.name}</b>: ${money(v.lead.dailyBudget)} → <b>${money(to)}</b> per day (+20%).`, ok: "Raise budget" });
      if (!ok) return;
      try {
        await post("/api/budget", { id: v.lead.id, field: "daily_budget", amount: to });
        toast(`Budget is now ${money(to)} a day.`, "good");
        return ctx.loadTree(true);
      } catch (err) {
        return toast(err.message, "bad");
      }
    }
    if (e.target.closest("[data-ab-save]")) {
      const note = window.prompt("What did this test change? (optional, e.g. 'price in first 3 seconds')", "") || "";
      const log = load("abResults", []);
      log.unshift({
        at: new Date().toISOString(),
        test: mode === "ads" ? "Creative" : "Audience",
        scope: mode === "ads" ? `${c?.name} › ${s?.name}` : c?.name,
        winner: v.lead.name,
        runnerUp: v.second.name,
        kind: v.kind,
        conf: v.conf,
        basis: key,
        costWinner: v.lead.spend / Math.max(1, v.lead[key]),
        costRunner: v.second[key] ? v.second.spend / v.second[key] : null,
        note: note.slice(0, 200),
      });
      save("abResults", log.slice(0, 100));
      toast("Saved to your test log.", "good");
      return ctx.render();
    }
    const d = e.target.closest("[data-ab-del]");
    if (d) {
      const log = load("abResults", []);
      log.splice(Number(d.dataset.abDel), 1);
      save("abResults", log);
      ctx.render();
    }
  };
}
