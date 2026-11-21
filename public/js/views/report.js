// Weekly client report: one page for G Developments with the week's results
// next to the week before, by project, what worked and what did not, where the
// money went, tests, changes made, and the plan for next week. Print it to PDF
// or copy a short version for WhatsApp.
import { html, raw, money, n, pct, copy, toast, localDay } from "../ui.js";
import { get } from "../api.js";
import { load, save, loadGlobal, saveGlobal, isDemo } from "../store.js";
import { allLeads, quality, score, projectFromName } from "../model.js";
import { connectCard, loadingCard } from "./common.js";
import { _test as reach } from "./reach.js";
import { countryName } from "../places.js";

let weekEnd = ""; // YYYY-MM-DD, last day of the report week (default: yesterday)
const cache = new Map(); // `${since}|${until}` -> { cur, prev, bd, audit } or { error }
let pending = "";

const addDays = (ymd, d) => {
  const x = new Date(`${ymd}T00:00:00`);
  x.setDate(x.getDate() + d);
  return localDay(x);
};
const yesterday = () => addDays(localDay(), -1);
const nice = (ymd) => new Date(`${ymd}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const niceRange = (a, b) => `${nice(a)} – ${nice(b)} ${b.slice(0, 4)}`;

function weeks() {
  const until = weekEnd || yesterday();
  const since = addDays(until, -6);
  return { since, until, pSince: addDays(since, -7), pUntil: addDays(since, -1) };
}

function fetchWeek(ctx, w) {
  const key = `${w.since}|${w.until}`;
  if (cache.has(key) || pending === key) return cache.get(key);
  pending = key;
  Promise.all([
    get("/api/tree", { range: "custom", since: w.since, until: w.until }),
    get("/api/tree", { range: "custom", since: w.pSince, until: w.pUntil }),
    get("/api/breakdowns", { range: "custom", since: w.since, until: w.until }).catch(() => null),
    get("/api/audit").catch(() => []),
  ])
    .then(([cur, prev, bd, audit]) => cache.set(key, { cur, prev, bd, audit }))
    .catch((e) => cache.set(key, { error: e.message }))
    .finally(() => {
      pending = "";
      ctx.render();
    });
  return null;
}

// ---------------------------------------------------------------- numbers
function totals(tree, list, since, until) {
  const q = quality(list, since, until);
  const t = { spend: 0, leads: 0, impressions: 0, clicks: 0 };
  for (const c of tree?.campaigns || []) {
    if (!c.m) continue;
    t.spend += c.m.spend || 0;
    t.leads += (c.m.leads || 0) + (c.m.convos || 0);
    t.impressions += c.m.impressions || 0;
    t.clicks += c.m.linkClicks || 0;
  }
  const v = q.total;
  return {
    ...t,
    valid: v.valid,
    contacted: v.contacted,
    meetings: v.meetings,
    reserved: v.reserved,
    cpl: t.leads ? t.spend / t.leads : null,
    cpvl: v.valid ? t.spend / v.valid : null,
    cpr: v.reserved ? t.spend / v.reserved : null,
    validRate: v.contacted ? (v.valid / v.contacted) * 100 : null,
    ctr: t.impressions ? (t.clicks / t.impressions) * 100 : null,
    q,
  };
}

function byProject(tree, q, catalog) {
  const rows = {};
  const merge = (a, b) => {
    if (!a) return b;
    if (!b) return a;
    const o = { ...a };
    for (const k of Object.keys(b)) if (typeof b[k] === "number") o[k] = (a[k] || 0) + b[k];
    return o;
  };
  for (const c of tree?.campaigns || []) {
    const p = projectFromName(c.name, catalog);
    const key = p?.name || "Other campaigns";
    const r = (rows[key] ??= { name: key, spend: 0, leads: 0, valid: 0, meetings: 0, reserved: 0 });
    const s = score(c.m, merge(q.campaign[c.id], q.byName[`c:${c.name}`]));
    r.spend += s.spend;
    r.leads += s.metaLeads;
    r.valid += s.valid;
    r.meetings += s.meetings;
    r.reserved += s.reserved;
  }
  return Object.values(rows)
    .filter((r) => r.spend > 0 || r.valid > 0)
    .sort((a, b) => b.spend - a.spend);
}

function adsetRanks(tree, q) {
  const rows = [];
  for (const c of tree?.campaigns || []) for (const a of c.adsets) if (a.m?.spend) rows.push({ c, a, s: score(a.m, q.adset[a.id]) });
  return {
    best: rows.filter((r) => r.s.valid >= 2).sort((x, y) => x.s.cpvl - y.s.cpvl).slice(0, 3),
    waste: rows.filter((r) => r.s.valid === 0 && r.s.spend > 0).sort((x, y) => y.s.spend - x.s.spend).slice(0, 3),
  };
}

/** "▲ 12%" with a tone: good when the change is in the wanted direction. */
function delta(cur, prev, lowerIsBetter = false, neutral = false) {
  if (cur === null || cur === undefined || prev === null || prev === undefined) return { text: "", tone: "" };
  if (!prev) return { text: cur ? "new" : "", tone: "" };
  const ch = ((cur - prev) / Math.abs(prev)) * 100;
  if (Math.abs(ch) < 0.5) return { text: "same", tone: "" };
  const up = ch > 0;
  const good = neutral ? null : lowerIsBetter ? !up : up;
  return { text: `${up ? "▲" : "▼"} ${Math.abs(ch).toFixed(0)}%`, tone: good === null ? "" : good ? "good" : "bad" };
}

// Retargeting ad sets are small: more budget mostly shows the same people the ads again.
const WARM = /warm|retarget|remarket|visitor|viewer|engager|re-?engage/i;

function suggestions(cur, prev, ranks, bd) {
  const out = [];
  const scale = ranks.best.find((r) => !WARM.test(r.a.name));
  if (scale) out.push(`Raise the budget of ${scale.a.name} (${scale.c.name}) by 15–20%: it brought valid leads at ${money(scale.s.cpvl)} each.`);
  if (ranks.best[0] && WARM.test(ranks.best[0].a.name)) out.push(`Keep ${ranks.best[0].a.name} on at a small budget: warm audiences are cheapest (${money(ranks.best[0].s.cpvl)} per valid lead) but run out fast.`);
  if (ranks.waste[0]) out.push(`Fix or pause ${ranks.waste[0].a.name}: ${money(ranks.waste[0].s.spend)} spent with no valid leads.`);
  if (cur.validRate !== null && prev.validRate !== null && cur.validRate < prev.validRate - 5) out.push(`Tighten the lead form (budget and timing questions): the valid rate fell from ${pct(prev.validRate, 0)} to ${pct(cur.validRate, 0)}.`);
  if (cur.cpvl && prev.cpvl && cur.cpvl > prev.cpvl * 1.15) out.push(`Refresh the creative on the biggest campaign: cost per valid lead rose ${pct(((cur.cpvl - prev.cpvl) / prev.cpvl) * 100, 0)}.`);
  if (bd) {
    const ctry = reach.countries(bd, []);
    const total = ctry.reduce((t, c) => t + c.spend, 0);
    const abroad = ctry.filter((c) => c.iso2 !== "EG").reduce((t, c) => t + c.spend, 0);
    if (total && abroad / total > 0.25) out.push(`Review the Gulf ad sets: ${pct((abroad / total) * 100, 0)} of spend went abroad. Keep them only if those leads turn valid.`);
  }
  out.push("Start one new A/B test on the main project's opening hook.");
  return out;
}

// ---------------------------------------------------------------- text for WhatsApp / email
function whatsappText(w, cur, prev, projects, ranks, plan, who) {
  const d = (a, b, lower, neutral) => {
    const x = delta(a, b, lower, neutral).text;
    return x && x !== "same" ? ` (${x} vs last week)` : "";
  };
  const lines = [
    `${isDemo() ? "[DEMO DATA, NOT REAL] " : ""}G Developments · Weekly media report`,
    niceRange(w.since, w.until),
    "",
    `Spend: ${money(cur.spend)}${d(cur.spend, prev.spend, false, true)}`,
    `Leads: ${n(cur.leads)}${d(cur.leads, prev.leads)}`,
    `Valid leads: ${n(cur.valid)}${d(cur.valid, prev.valid)} · ${pct(cur.validRate, 0)} of contacted`,
    `Cost per valid lead: ${money(cur.cpvl)}${d(cur.cpvl, prev.cpvl, true)}`,
    `Meetings / visits: ${n(cur.meetings)} · Reservations: ${n(cur.reserved)}`,
    "",
    "By project:",
    ...projects.slice(0, 6).map((p) => `• ${p.name}: ${money(p.spend)}, ${n(p.valid)} valid${p.valid ? ` (${money(p.spend / p.valid)} each)` : ""}, ${n(p.reserved)} reserved`),
  ];
  if (ranks.best[0]) lines.push("", `Working best: ${ranks.best[0].a.name} · ${money(ranks.best[0].s.cpvl)} per valid lead`);
  if (ranks.waste[0]) lines.push(`Being fixed: ${ranks.waste[0].a.name} · ${money(ranks.waste[0].s.spend)} with no valid leads`);
  const planLines = String(plan || "").split("\n").map((x) => x.trim()).filter(Boolean);
  if (planLines.length) lines.push("", "Next week:", ...planLines.map((x) => `• ${x.replace(/^[-•]\s*/, "")}`));
  if (who) lines.push("", `— ${who}`);
  return lines.join("\n");
}

// ---------------------------------------------------------------- screen
export function render(ctx) {
  const w = weeks();
  const top = html`<div class="top noprint"><div><h1>Weekly client report</h1><p class="sub">One page for G Developments: this week against last week, by project, what worked, where the money went, and next week's plan. Print it as a PDF or copy the short version for WhatsApp.</p></div></div>`;
  if (!ctx.settings) return html`${top}${loadingCard()}`;
  if (!ctx.settings.connected) return html`${top}${connectCard(ctx.settings)}`;
  const data = fetchWeek(ctx, w);
  const controls = html`<div class="card noprint"><div class="row wrap" style="gap:10px;align-items:flex-end">
    <label class="field"><span>Week ending</span><input class="input" type="date" data-weekend value="${w.until}" max="${localDay()}"></label>
    <div class="field"><span>Quick pick</span><div class="seg"><button type="button" data-week="0" aria-pressed="${!weekEnd || weekEnd === yesterday()}">Last 7 days</button><button type="button" data-week="-7" aria-pressed="${weekEnd === addDays(yesterday(), -7)}">The week before</button></div></div>
    <label class="field"><span>Prepared by</span><input class="input" data-who value="${loadGlobal("reportBy", "")}" placeholder="Your name"></label>
    <div class="row wrap" style="margin-left:auto">${data && !data.error ? html`<button class="btn" type="button" data-wa>Copy for WhatsApp</button><button class="btn primary" type="button" data-print>Print / Save PDF</button>` : ""}</div>
  </div></div>`;
  if (!data) return html`${top}${controls}${loadingCard()}`;
  if (data.error) return html`${top}${controls}<div class="note bad"><b>Could not load the week from Meta.</b> ${data.error}</div>`;

  const list = allLeads();
  const cur = totals(data.cur, list, w.since, w.until);
  const prev = totals(data.prev, list, w.pSince, w.pUntil);
  const projects = byProject(data.cur, cur.q, ctx.catalog);
  const ranks = adsetRanks(data.cur, cur.q);
  const notes = load(`report:${w.until}`, {});
  const plan = notes.next ?? suggestions(cur, prev, ranks, data.bd).map((x) => `- ${x}`).join("\n");
  const changes = (data.audit || []).filter((a) => {
    const d = String(a.at || "").slice(0, 10);
    return d >= w.since && d <= addDays(w.until, 1);
  });
  const tests = load("abResults", []).filter((r) => {
    const d = String(r.at || "").slice(0, 10);
    return d >= w.since && d <= addDays(w.until, 1);
  });
  const aud = data.bd ? reach.audience(data.bd) : null;
  const govs = data.bd ? reach.governorates(data.bd) : [];
  const ctry = data.bd ? reach.countries(data.bd, list.filter((l) => String(l.created).slice(0, 10) >= w.since && String(l.created).slice(0, 10) <= w.until)) : [];
  const gTotal = govs.reduce((t, g) => t + g.spend, 0);
  const cTotal = ctry.reduce((t, c) => t + c.spend, 0);
  const abroad = ctry.filter((c) => c.iso2 !== "EG");
  const abroadSpend = abroad.reduce((t, c) => t + c.spend, 0);
  const ages = aud
    ? ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"]
        .map((a) => ({ a, s: aud.rows[a].male.spend + aud.rows[a].female.spend, l: aud.rows[a].male.leads + aud.rows[a].female.leads }))
        .filter((x) => x.l >= 5)
        .sort((x, y) => x.s / x.l - y.s / y.l)
    : [];
  const who = loadGlobal("reportBy", "");

  const stat = (label, c, p, fmt, lower = false, neutral = false) => {
    const d = delta(c, p, lower, neutral);
    return html`<div class="rstat"><span>${label}</span><b>${fmt(c)}</b><small class="${d.tone}">${d.text}${d.text && d.text !== "same" && d.text !== "new" ? " vs last week" : ""}</small><small class="faint">last week ${fmt(p)}</small></div>`;
  };

  return html`${top}${controls}
  <article class="report-sheet">
    <header class="r-head">
      <div><div class="r-brand"><span class="brand-mark" aria-hidden="true">G</span><b>G Developments</b></div><h2>Weekly media report</h2><p>${niceRange(w.since, w.until)} · compared with ${niceRange(w.pSince, w.pUntil)}</p></div>
      <div class="r-meta">${isDemo() ? html`<div class="r-demo">DEMO DATA · NOT REAL</div>` : ""}${who ? html`<div>Prepared by <b>${who}</b></div>` : ""}<div class="faint">Meta Ads · ${data.cur.account?.name || ""}</div></div>
    </header>

    <section class="rstats">
      ${stat("Spend", cur.spend, prev.spend, (v) => money(v), false, true)}
      ${stat("Leads", cur.leads, prev.leads, (v) => n(v))}
      ${stat("Valid leads", cur.valid, prev.valid, (v) => n(v))}
      ${stat("Valid rate", cur.validRate, prev.validRate, (v) => pct(v, 0))}
      ${stat("Cost per valid lead", cur.cpvl, prev.cpvl, (v) => money(v), true)}
      ${stat("Meetings / visits", cur.meetings, prev.meetings, (v) => n(v))}
      ${stat("Reservations", cur.reserved, prev.reserved, (v) => n(v))}
      ${stat("Cost per lead", cur.cpl, prev.cpl, (v) => money(v), true)}
    </section>

    <section><h3>By project</h3>
      ${projects.length ? html`<table class="rtable"><thead><tr><th>Project</th><th class="n">Spend</th><th class="n">Leads</th><th class="n">Valid</th><th class="n">Cost / valid</th><th class="n">Meetings</th><th class="n">Reserved</th></tr></thead><tbody>${projects.map((p) => html`<tr><td>${p.name}</td><td class="n">${money(p.spend)}</td><td class="n">${n(p.leads)}</td><td class="n"><b>${n(p.valid)}</b></td><td class="n">${money(p.valid ? p.spend / p.valid : null)}</td><td class="n">${n(p.meetings)}</td><td class="n">${n(p.reserved)}</td></tr>`)}</tbody></table>` : html`<p class="muted">No spend this week.</p>`}
    </section>

    <section class="r2">
      <div><h3>Working best</h3>${ranks.best.length ? html`<ol class="list">${ranks.best.map((r) => html`<li><b>${r.a.name}</b> <span class="muted">· ${r.c.name}</span><br>${n(r.s.valid)} valid leads at ${money(r.s.cpvl)} each</li>`)}</ol>` : html`<p class="muted small">Not enough valid leads marked yet to rank.</p>`}</div>
      <div><h3>Being fixed</h3>${ranks.waste.length ? html`<ol class="list">${ranks.waste.map((r) => html`<li><b>${r.a.name}</b> <span class="muted">· ${r.c.name}</span><br>${money(r.s.spend)} spent, ${n(r.s.metaLeads)} leads, none valid yet</li>`)}</ol>` : html`<p class="muted small">Every ad set with spend brought valid leads.</p>`}</div>
    </section>

    ${data.bd ? html`<section class="r2">
      <div><h3>Where the money went</h3><ul class="list">${govs.slice(0, 4).map((g) => html`<li>${g.name}: ${money(g.spend)} (${pct(gTotal ? (g.spend / gTotal) * 100 : null, 0)}), ${n(g.leads)} leads</li>`)}${cTotal ? html`<li>Outside Egypt: ${money(abroadSpend)} (${pct((abroadSpend / cTotal) * 100, 0)})${abroad.length ? `, mostly ${countryName([...abroad].sort((a, b) => b.spend - a.spend)[0].iso2)}` : ""}</li>` : ""}</ul></div>
      <div><h3>Who answered</h3>${ages.length ? html`<ul class="list"><li>Cheapest leads: ages ${ages[0].a} (${money(ages[0].s / ages[0].l)} per lead)</li>${ages.length > 1 ? html`<li>Most expensive: ages ${ages[ages.length - 1].a} (${money(ages[ages.length - 1].s / ages[ages.length - 1].l)} per lead)</li>` : ""}${abroad.some((c) => c.mine) ? html`<li>${n(abroad.reduce((t, c) => t + c.mine, 0))} leads with foreign phone numbers, ${n(abroad.reduce((t, c) => t + c.valid, 0))} valid</li>` : ""}</ul>` : html`<p class="muted small">Not enough leads by age this week.</p>`}</div>
    </section>` : ""}

    <section class="r2">
      <div><h3>Tests this week</h3>${tests.length ? html`<ul class="list">${tests.map((t) => html`<li><b>${t.winner}</b> beat ${t.runnerUp} (${t.test.toLowerCase()} test, ${pct(t.conf * 100, 0)} sure)${t.note ? ` · ${t.note}` : ""}</li>`)}</ul>` : html`<p class="muted small">No test results saved this week.</p>`}</div>
      <div><h3>Changes made</h3>
        ${changes.length ? html`<ul class="list">${changes.slice(0, 8).map((c) => html`<li>${c.action === "status" ? `${c.to === "PAUSED" ? "Turned off" : "Turned on"} ${c.kind || ""} ${c.name}` : c.action === "budget" ? `Budget of ${c.name}: ${money(c.from)} → ${money(c.to)}` : c.action === "targeting" ? `Targeting updated: ${c.name}` : `${c.action}: ${c.name}`}</li>`)}</ul>` : ""}
        <textarea class="input r-edit" data-note="did" rows="3" placeholder="Anything else done this week (new creative, new form, calls with sales…)">${notes.did || ""}</textarea>
        <div class="r-print-text">${notes.did || ""}</div>
      </div>
    </section>

    <section><h3>Next week</h3>
      <textarea class="input r-edit" data-note="next" rows="5">${plan}</textarea>
      <div class="r-print-text">${plan}</div>
    </section>

    <footer class="r-foot">Spend, leads and reach come from Meta Ads. Valid leads, meetings and reservations come from the lead log after each call. A valid lead answered, can afford the project and wants to talk about buying.${isDemo() ? " This report uses made-up demo data." : ""}</footer>
  </article>`;
}

export function mount(root, ctx) {
  const w = () => weeks();
  root.onchange = (e) => {
    const el = e.target;
    if (el.matches("[data-weekend]")) {
      weekEnd = el.value || "";
      return ctx.render();
    }
    if (el.matches("[data-who]")) {
      saveGlobal("reportBy", el.value.trim().slice(0, 60));
      return ctx.render();
    }
    const k = el.dataset.note;
    if (k) {
      const key = `report:${w().until}`;
      save(key, { ...load(key, {}), [k]: el.value });
      ctx.render();
    }
  };
  root.onclick = async (e) => {
    const q = e.target.closest("[data-week]");
    if (q) {
      weekEnd = addDays(yesterday(), Number(q.dataset.week));
      return ctx.render();
    }
    if (e.target.closest("[data-print]")) {
      // Save any note being typed before printing.
      document.activeElement?.blur?.();
      setTimeout(() => window.print(), 150);
      return;
    }
    if (e.target.closest("[data-wa]")) {
      const ww = w();
      const data = cache.get(`${ww.since}|${ww.until}`);
      if (!data || data.error) return toast("The report is still loading.");
      const list = allLeads();
      const cur = totals(data.cur, list, ww.since, ww.until);
      const prev = totals(data.prev, list, ww.pSince, ww.pUntil);
      const notes = load(`report:${ww.until}`, {});
      const ranks = adsetRanks(data.cur, cur.q);
      const plan = notes.next ?? suggestions(cur, prev, ranks, data.bd).map((x) => `- ${x}`).join("\n");
      copy(whatsappText(ww, cur, prev, byProject(data.cur, cur.q, ctx.catalog), ranks, plan, loadGlobal("reportBy", "")), "Report copied. Paste it into WhatsApp");
    }
  };
}

export const _test = { delta, totals, whatsappText, weeks: () => weeks(), addDays };
export const _raw = raw;
