// The control room: every campaign in one list, switch between them in one
// click, turn things on or off, change budgets, open the targeting editor,
// execute 1-click verdict actions (Scale +20%, Pause waste, Widen geo),
// and read results next to lead quality (valid leads, cost per valid lead).
import { html, raw, money, n, pct, $, toast, confirmDialog, promptDialog, currency, dateTime } from "../ui.js";
import { post, get } from "../api.js";
import { targets } from "../store.js";
import { allLeads, quality, treeDates, score, projectFromName, verdict } from "../model.js";
import { kpi, statusPill, objective, switchBtn, connectCard, loadingCard, targetingLine } from "./common.js";
import { openTargeting } from "./targeting.js";

let search = "";
let filter = "all"; // all | on | off
let sort = "spend";
const open = new Set(); // ad sets showing their ads
let auditRows = null;

const merge = (a, b) => {
  if (!a) return b;
  if (!b) return a;
  const out = { ...a };
  for (const k of Object.keys(b)) if (typeof b[k] === "number") out[k] = (a[k] || 0) + b[k];
  out.responseMin = [...(a.responseMin || []), ...(b.responseMin || [])];
  return out;
};

function rows(ctx) {
  const { since, until } = treeDates(ctx.tree);
  const q = quality(allLeads(), since, until);
  const t = targets();
  const list = ctx.tree.campaigns.map((c) => {
    const s = score(c.m, merge(q.campaign[c.id], q.byName[`c:${c.name}`]));
    return {
      c,
      s,
      v: verdict(c.m, s, t, null, c.effectiveStatus),
      p: projectFromName(c.name, ctx.catalog),
    };
  });
  return { q, list, since, until };
}

function sorted(list) {
  const s = search.trim().toLowerCase();
  let out = list.filter(({ c }) => (!s || c.name.toLowerCase().includes(s)) && (filter === "all" || (filter === "on" ? c.status === "ACTIVE" : c.status !== "ACTIVE")));
  const by = {
    spend: (a, b) => b.s.spend - a.s.spend,
    valid: (a, b) => b.s.valid - a.s.valid || b.s.spend - a.s.spend,
    cpvl: (a, b) => (a.s.cpvl ?? Infinity) - (b.s.cpvl ?? Infinity),
    name: (a, b) => a.c.name.localeCompare(b.c.name),
  };
  out = out.sort(by[sort] || by.spend);
  return out.sort((a, b) => (b.c.status === "ACTIVE") - (a.c.status === "ACTIVE"));
}

function listItem({ c, s, v, p }, selected, readOnly, maxSpend) {
  const barW = maxSpend > 0 ? Math.min(100, Math.round((s.spend / maxSpend) * 100)) : 0;
  return html`<div class="citem" role="option" aria-selected="${selected}" data-pick="${c.id}" tabindex="0">
    ${switchBtn("campaign", c, readOnly)}
    <div>
      <div class="t">${c.name}</div>
      <div class="row wrap" style="gap:4px;margin-top:4px">
        ${p ? html`<span class="pill accent">${p.name}</span>` : ""}
        <span class="pill ${v.tone}">${v.label}</span>
      </div>
      <div class="s">
        <span><b>${money(s.spend, { short: true })}</b> spent</span>
        <span><b>${n(s.metaLeads)}</b> leads</span>
        <span><b>${n(s.valid)}</b> valid</span>
        ${s.cpvl ? html`<span><b>${money(s.cpvl, { short: true })}</b>/valid</span>` : ""}
      </div>
      <div class="bar" style="height:4px;margin-top:5px"><i style="width:${barW}%"></i></div>
    </div>
  </div>`;
}

function flagsFor(m, t, best) {
  const f = [];
  if (best) f.push(html`<span class="flag good">Best cost per valid lead</span>`);
  if (m && m.frequency > t.maxFrequency) f.push(html`<span class="flag">Tired (freq ${m.frequency.toFixed(1)})</span>`);
  if (m && m.impressions >= t.minImpressions && m.ctr > 0 && m.ctr < t.minCtr) f.push(html`<span class="flag">Weak hook (CTR ${m.ctr.toFixed(2)}%)</span>`);
  if (m && t.cpl && m.spend >= t.cpl * t.noLeadSpendX && !(m.leads + m.convos)) f.push(html`<span class="flag bad">No leads</span>`);
  return f;
}

function budgetButton(o, kind) {
  const field = o.dailyBudget ? "daily_budget" : o.lifetimeBudget ? "lifetime_budget" : null;
  if (!field) return html`<span class="faint small">${kind === "adset" ? "Campaign budget" : "Set on ad sets"}</span>`;
  const v = o.dailyBudget || o.lifetimeBudget;
  return html`<button type="button" class="budget-btn" data-budget="${o.id}" data-field="${field}" data-value="${v}" data-name="${o.name}">${money(v)}${field === "daily_budget" ? "/day" : " total"}</button>`;
}

function renderCampaignSparkline(daily) {
  if (!daily || daily.length < 2) return "";
  const W = 560, H = 96, padL = 36, padR = 24, padT = 10, padB = 20;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const maxSpend = Math.max(50, ...daily.map((d) => d.spend || 0));
  const stepX = plotW / Math.max(1, daily.length);
  const barW = Math.max(4, Math.min(20, stepX * 0.62));
  return html`
  <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line)">
    <div class="row between small muted" style="margin-bottom:4px">
      <span>Daily Campaign Spend &amp; Lead Pulse</span>
      <span>Peak day: <b>${money(maxSpend)}</b></span>
    </div>
    <svg viewBox="0 0 ${W} ${H}" class="chart-svg" style="max-height:96px">
      ${daily.map((d, i) => {
        const cx = padL + i * stepX + stepX / 2;
        const bh = Math.max(2, ((d.spend || 0) / maxSpend) * plotH);
        const by = padT + plotH - bh;
        const showDate = daily.length <= 10 || i === 0 || i === daily.length - 1 || i === Math.floor(daily.length / 2);
        return html`<g>
          <rect x="${(cx - barW / 2).toFixed(1)}" y="${by.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" rx="2" fill="color-mix(in srgb, var(--accent) 42%, var(--card))">
            <title>${d.date}: ${money(d.spend)} · ${n(d.leads)} leads</title>
          </rect>
          ${showDate ? html`<text x="${cx.toFixed(1)}" y="${H - 4}" text-anchor="middle" class="chart-axis">${d.date.slice(5)}</text>` : ""}
        </g>`;
      })}
    </svg>
  </div>`;
}

function detail(ctx, item, q) {
  const { c, s, v, p } = item;
  const t = targets();
  const ro = ctx.tree.readOnly;
  const m = c.m || {};
  const setRows = c.adsets.map((a) => {
    const sc = score(a.m, q.adset[a.id]);
    return { a, s: sc, v: verdict(a.m, sc, t, a.learning, a.effectiveStatus) };
  });
  return html`
  <div class="card">
    <div class="card-head">
      <div class="row" style="align-items:flex-start;gap:12px">${switchBtn("campaign", c, ro)}
        <div><h2>${c.name}</h2>
          <div class="row wrap small muted" style="margin-top:4px">
            ${statusPill(c.effectiveStatus)}
            <span class="pill ${v.tone}">${v.label}</span>
            <span>${objective(c.objective)}</span>
            ${p ? html`<span class="pill accent">${p.name}</span>` : html`<span class="pill line" title="Put the project name in the campaign name, e.g. GD | Krypton | Leads | ...">No project in name</span>`}
            ${c.specialCategories?.length ? html`<span class="pill line">Special category: ${c.specialCategories.join(", ").toLowerCase()}</span>` : ""}
            ${c.bidStrategy ? html`<span>${c.bidStrategy.toLowerCase().replace(/_/g, " ")}</span>` : ""}
          </div>
        </div>
      </div>
      <div class="row wrap">
        ${p ? html`<a class="btn sm ghost" href="${p.url}" target="_blank" rel="noopener">Landing Page ↗</a>` : ""}
        ${budgetButton(c, "campaign")}
      </div>
    </div>
    <div class="note ${v.tone === "line" ? "" : v.tone}" style="margin-bottom:12px">
      <b>Media Buyer Verdict: ${v.label}.</b> ${v.why}
    </div>
    <div class="kpis">
      ${kpi("Spend", money(s.spend))}
      ${kpi("Leads (Meta)", n(s.metaLeads), m.convos ? `${n(m.leads)} form · ${n(m.convos)} chats` : "")}
      ${kpi("Cost per lead", money(s.cpl), t.cpl ? `target ${money(t.cpl)}` : "")}
      ${kpi("Valid leads", n(s.valid), s.logged ? `${n(s.logged)} in your lead log` : "Mark leads in Leads", true)}
      ${kpi("Valid rate", pct(s.validRate === null ? null : s.validRate * 100, 0), "of contacted leads", true)}
      ${kpi("Cost per valid lead", money(s.cpvl), t.cpvl ? `target ${money(t.cpvl)}` : "", true)}
      ${kpi("Meetings / visits", n(s.meetings))}
      ${kpi("Reservations", n(s.reserved), s.cpr ? `${money(s.cpr)} each` : "")}
      ${kpi("Reach", n(m.reach), "people, not added up")}
      ${kpi("Frequency", m.frequency ? m.frequency.toFixed(2) : "—")}
      ${kpi("Link CTR", pct(m.ctr, 2))}
      ${kpi("CPM", money(m.cpm))}
    </div>
    ${renderCampaignSparkline(c.daily)}
  </div>
  <div class="card">
    <div class="card-head"><div><h2>Ad sets &amp; 1-Click Actions (${setRows.length})</h2><p>Who sees the ads, automated verdict per audience, and how much each costs per valid buyer. Open Targeting to edit locations, ages, interests or custom audiences.</p></div></div>
    ${setRows.length ? adsetTable(setRows, q, t, ro) : html`<p class="muted">No ad sets in this campaign.</p>`}
  </div>`;
}

function adsetTable(setRows, q, t, ro) {
  const head = html`<tr><th></th><th>Ad set / ad</th><th>Verdict</th><th>Budget</th><th class="n">Spend</th><th class="n">Leads</th><th class="n">CPL</th><th class="n">Valid</th><th class="n">Cost/valid</th><th class="n">Meet.</th><th class="n">Freq.</th><th class="n">CTR</th><th>Actions</th></tr>`;
  const body = setRows.map(({ a, s, v }) => {
    const adRows = a.ads.map((ad) => ({ ad, s: score(ad.m, q.ad[ad.id]) }));
    const bestCpvl = Math.min(...adRows.filter((r) => r.s.valid >= 2 && r.s.cpvl).map((r) => r.s.cpvl));
    const tl = targetingLine(a.targeting);
    return html`<tr>
      <td>${switchBtn("adset", a, ro)}</td>
      <td style="min-width:210px"><div class="name">${a.name}</div><div class="tiny muted">${a.effectiveStatus !== "ACTIVE" ? statusPill(a.effectiveStatus) : ""} ${a.learning === "LEARNING" ? html`<span class="pill info">Learning</span>` : a.learning === "FAIL" ? html`<span class="pill warn">Learning limited</span>` : ""} ${a.optimization ? a.optimization.toLowerCase().replace(/_/g, " ") : ""}</div>${tl ? html`<div class="tiny faint">${tl}</div>` : ""}<div class="row wrap" style="margin-top:3px">${flagsFor(a.m, t, false)}</div></td>
      <td><span class="pill ${v.tone}" title="${v.why}">${v.label}</span></td>
      <td>${budgetButton(a, "adset")}</td>
      <td class="n">${money(s.spend)}</td><td class="n">${n(s.metaLeads)}</td><td class="n">${money(s.cpl)}</td>
      <td class="n"><b>${n(s.valid)}</b></td><td class="n"><b class="${s.cpvl && t.cpvl && s.cpvl <= t.cpvl ? "stage-valid" : ""}">${money(s.cpvl)}</b></td><td class="n">${n(s.meetings)}</td>
      <td class="n">${a.m?.frequency ? a.m.frequency.toFixed(1) : "—"}</td><td class="n">${pct(a.m?.ctr, 2)}</td>
      <td class="n">
        <div class="row" style="justify-content:flex-end">
          ${!ro && a.dailyBudget && v.code === "scale" ? html`<button class="btn sm primary" type="button" data-quick-scale="${a.id}" data-value="${a.dailyBudget}" data-name="${a.name}" title="${v.why}">+20%</button>` : ""}
          <button class="btn sm" type="button" data-targeting="${a.id}">Targeting</button>
          <button class="btn sm ghost" type="button" data-expand="${a.id}" aria-expanded="${open.has(a.id)}">${open.has(a.id) ? "Hide" : `Ads (${a.ads.length})`}</button>
        </div>
      </td>
    </tr>
    ${open.has(a.id)
      ? adRows.map(
          ({ ad, s: as }) => html`<tr class="sub">
          <td>${switchBtn("ad", ad, ro)}</td>
          <td colspan="2"><div class="adrow">${ad.creative?.thumb ? html`<img class="thumb" src="${ad.creative.thumb}" alt="" loading="lazy" referrerpolicy="no-referrer">` : html`<span class="thumb"></span>`}<div><div class="name">${ad.name}</div><div class="row wrap">${ad.effectiveStatus !== "ACTIVE" ? statusPill(ad.effectiveStatus) : ""}${flagsFor(ad.m, t, as.cpvl && as.cpvl === bestCpvl && adRows.length > 1)}</div></div></div></td>
          <td></td>
          <td class="n">${money(as.spend)}</td><td class="n">${n(as.metaLeads)}</td><td class="n">${money(as.cpl)}</td>
          <td class="n"><b>${n(as.valid)}</b></td><td class="n"><b>${money(as.cpvl)}</b></td><td class="n">${n(as.meetings)}</td>
          <td class="n">${ad.m?.frequency ? ad.m.frequency.toFixed(1) : "—"}</td><td class="n">${pct(ad.m?.ctr, 2)}</td><td></td>
        </tr>`,
        )
      : ""}`;
  });
  return html`<div class="table-wrap"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

export function render(ctx) {
  const top = html`<div class="top"><div><h1>Campaigns Control Room</h1><p class="sub">Pick a campaign, switch things on or off, execute 1-click budget scales, and edit geo/interest targeting. Every ad set is judged by cost per valid buyer.</p></div>
    <div class="top-actions">${ctx.settings?.connected ? html`${ctx.periodSwitch()}${ctx.refreshButton()}` : ""}</div></div>`;
  if (!ctx.settings) return html`${top}${loadingCard()}`;
  if (!ctx.settings.connected) return html`${top}${connectCard(ctx.settings)}`;
  if (!ctx.tree) return html`${top}${ctx.treeError ? html`<div class="note bad"><b>Could not load campaigns.</b> ${ctx.treeError}</div>` : loadingCard()}`;

  const { q, list, since, until } = rows(ctx);
  const shown = sorted(list);
  const maxSpend = Math.max(1, ...list.map((x) => x.s.spend));
  const selId = ctx.params[0] && list.some((x) => x.c.id === ctx.params[0]) ? ctx.params[0] : shown[0]?.c.id;
  const sel = list.find((x) => x.c.id === selId);
  const ro = ctx.tree.readOnly;
  return html`${top}
  ${ctx.treeError ? html`<div class="note bad" style="margin-bottom:12px"><b>Last refresh failed.</b> ${ctx.treeError}</div>` : ""}
  ${ro ? html`<div class="note warn" style="margin-bottom:12px"><b>Read-only mode.</b> Switches and budgets are locked (META_READ_ONLY is on).</div>` : ""}
  <div class="control">
    <section class="card clist" aria-label="Campaign list">
      <div class="clist-head">
        <input class="input" type="search" placeholder="Find a campaign or project" value="${search}" data-search aria-label="Find a campaign">
        <div class="row between wrap">
          <div class="seg" role="group" aria-label="Show">${[["all", "All"], ["on", "On"], ["off", "Off"]].map(([v, l]) => html`<button type="button" data-filter="${v}" aria-pressed="${filter === v}">${l}</button>`)}</div>
          <select class="input" style="width:auto;min-height:30px;padding:3px 8px" data-sort aria-label="Sort">${[["spend", "Most spend"], ["valid", "Most valid leads"], ["cpvl", "Lowest cost/valid"], ["name", "Name"]].map(([v, l]) => html`<option value="${v}" ${sort === v ? raw("selected") : ""}>${l}</option>`)}</select>
        </div>
        <div class="tiny faint">${ctx.tree.account.name} · ${since || "?"} to ${until || "?"} · updated ${dateTime(ctx.tree.fetchedAt)}${ctx.tree.cached ? " (cached)" : ""}</div>
      </div>
      <div class="clist-body" role="listbox" aria-label="Campaigns">${shown.length ? shown.map((x) => listItem(x, x.c.id === selId, ro, maxSpend)) : html`<div class="empty"><h3>No campaigns</h3><p>${list.length ? "Nothing matches this filter." : "This ad account has no campaigns yet."}</p></div>`}</div>
    </section>
    <section aria-label="Campaign detail">${sel ? detail(ctx, sel, q) : html`<div class="card empty"><h3>Pick a campaign</h3></div>`}
      <div class="card"><div class="card-head"><div><h2>Changes made from this dashboard</h2><p>Since the server last started. Render's log keeps the full history.</p></div><button class="btn sm" type="button" data-audit>Show</button></div>
        ${auditRows ? (auditRows.length ? html`<div class="table-wrap"><table><thead><tr><th>When</th><th>What</th><th>Item</th><th>Before</th><th>After</th></tr></thead><tbody>${auditRows.map((r) => html`<tr><td>${dateTime(r.at)}</td><td>${r.action}${r.kind ? ` (${r.kind})` : ""}</td><td>${r.name}</td><td class="small">${fmtAudit(r.from)}</td><td class="small">${fmtAudit(r.to)}</td></tr>`)}</tbody></table></div>` : html`<p class="muted small">No changes yet.</p>`) : ""}
      </div>
    </section>
  </div>`;
}

const fmtAudit = (v) => (v === null || v === undefined ? "—" : typeof v === "object" ? [v.places?.join(", "), v.ageMin ? `${v.ageMin}–${v.ageMax ?? "65+"}` : "", v.interests?.length ? `${v.interests.length} interests` : ""].filter(Boolean).join(" · ") : String(v));

// ---------------------------------------------------------------- actions
function findObj(tree, id) {
  for (const c of tree.campaigns) {
    if (c.id === id) return { obj: c, kind: "campaign" };
    for (const a of c.adsets) {
      if (a.id === id) return { obj: a, kind: "ad set", parent: c };
      for (const ad of a.ads) if (ad.id === id) return { obj: ad, kind: "ad", parent: a, grand: c };
    }
  }
  return null;
}

async function toggle(btn, ctx) {
  const id = btn.dataset.id;
  const found = findObj(ctx.tree, id);
  if (!found) return;
  const { obj, kind, parent, grand } = found;
  const on = obj.status === "ACTIVE";
  const parentOff = (parent && parent.status !== "ACTIVE") || (grand && grand.status !== "ACTIVE");
  const ok = await confirmDialog({
    title: on ? `Turn off this ${kind}?` : `Turn on this ${kind}?`,
    body: html`<b>${obj.name}</b><br>${on ? "It stops spending within a few minutes. Its results and learning are kept." : "It starts spending again on its budget."}${!on && parentOff ? html`<br><span class="late">Its ${parent?.status !== "ACTIVE" ? (kind === "ad" ? "ad set" : "campaign") : "campaign"} is off, so it will not deliver until that is on too.</span>` : ""}`,
    ok: on ? "Turn off" : "Turn on",
    danger: on,
  });
  if (!ok) return;
  btn.disabled = true;
  btn.classList.add("busy");
  try {
    await post("/api/status", { id, status: on ? "PAUSED" : "ACTIVE", kind });
    obj.status = on ? "PAUSED" : "ACTIVE";
    toast(`${obj.name} is ${on ? "off" : "on"}.`, "good");
    ctx.render();
    setTimeout(() => ctx.loadTree(true), 2500);
  } catch (e) {
    toast(e.message, "bad");
    btn.disabled = false;
    btn.classList.remove("busy");
  }
}

async function changeBudget(btn, ctx) {
  const { budget: id, field, name } = btn.dataset;
  const cur = Number(btn.dataset.value);
  const daily = field === "daily_budget";
  const v = await promptDialog({
    title: daily ? "Change daily budget" : "Change total budget",
    body: name,
    label: `${daily ? "Daily" : "Total"} budget (${currency()})`,
    value: String(cur),
    type: "number",
    inputmode: "decimal",
    ok: "Next",
    hint: (x) => {
      const nv = Number(x);
      if (!nv || !cur) return "";
      const ch = ((nv - cur) / cur) * 100;
      return html`${ch >= 0 ? "+" : ""}${ch.toFixed(0)}% ${Math.abs(ch) > 20 ? html`<br><span class="late">A jump above about 20% at once can restart learning. Raising 15–20% every 2–3 days is safer.</span>` : ""}`;
    },
  });
  if (v === null) return;
  const nv = Number(v);
  if (!(nv > 0)) return toast("Enter a budget above zero.", "bad");
  const ok = await confirmDialog({ title: "Change the budget?", body: html`<b>${name}</b><div class="diff" style="margin-top:8px"><div>${money(cur)} → <b>${money(nv)}</b>${daily ? " per day" : " in total"}</div></div>`, ok: "Change budget" });
  if (!ok) return;
  try {
    const r = await post("/api/budget", { id, field, amount: nv });
    const f = findObj(ctx.tree, id);
    if (f) f.obj[daily ? "dailyBudget" : "lifetimeBudget"] = r.to;
    toast(`Budget is now ${money(r.to)}.`, "good");
    ctx.render();
  } catch (e) {
    toast(e.message, "bad");
  }
}

async function quickScale(btn, ctx) {
  const id = btn.dataset.quickScale;
  const cur = Number(btn.dataset.value);
  const name = btn.dataset.name;
  const nv = Math.round(cur * 1.2);
  const ok = await confirmDialog({
    title: "Scale winning ad set by +20%?",
    body: html`<b>${name}</b><div class="diff" style="margin-top:8px"><div>${money(cur)}/day → <b>${money(nv)}/day (+20%)</b></div></div>`,
    ok: "Scale +20%",
  });
  if (!ok) return;
  try {
    const r = await post("/api/budget", { id, field: "daily_budget", amount: nv });
    const f = findObj(ctx.tree, id);
    if (f) f.obj.dailyBudget = r.to;
    toast(`Scaled ${name} to ${money(r.to)}/day.`, "good");
    ctx.render();
  } catch (e) {
    toast(e.message, "bad");
  }
}

export function mount(root, ctx) {
  const s = $("[data-search]", root);
  if (s && document.activeElement === document.body && search) {
    s.focus();
    s.setSelectionRange(search.length, search.length);
  }
  root.oninput = (e) => {
    if (e.target.matches("[data-search]")) {
      search = e.target.value;
      ctx.render();
      const again = $("[data-search]", root);
      again?.focus();
      again?.setSelectionRange(search.length, search.length);
    }
  };
  root.onchange = (e) => {
    if (e.target.matches("[data-sort]")) {
      sort = e.target.value;
      ctx.render();
    }
  };
  root.onclick = async (e) => {
    const sw = e.target.closest("[data-toggle]");
    if (sw) {
      e.stopPropagation();
      return toggle(sw, ctx);
    }
    const qs = e.target.closest("[data-quick-scale]");
    if (qs) return quickScale(qs, ctx);
    const b = e.target.closest("[data-budget]");
    if (b) return changeBudget(b, ctx);
    const f = e.target.closest("[data-filter]");
    if (f) {
      filter = f.dataset.filter;
      return ctx.render();
    }
    const tg = e.target.closest("[data-targeting]");
    if (tg) {
      const found = findObj(ctx.tree, tg.dataset.targeting);
      return openTargeting(found.obj, ctx);
    }
    const ex = e.target.closest("[data-expand]");
    if (ex) {
      const id = ex.dataset.expand;
      open.has(id) ? open.delete(id) : open.add(id);
      return ctx.render();
    }
    if (e.target.closest("[data-audit]")) {
      try {
        auditRows = await get("/api/audit");
      } catch (err) {
        toast(err.message, "bad");
      }
      return ctx.render();
    }
    const pick = e.target.closest("[data-pick]");
    if (pick) {
      ctx.go(`campaigns/${pick.dataset.pick}`);
      if (window.matchMedia("(max-width: 1100px)").matches) setTimeout(() => $("[aria-label='Campaign detail']")?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  };
  root.onkeydown = (e) => {
    const pick = e.target.closest?.("[data-pick]");
    if (pick && (e.key === "Enter" || e.key === " ") && !e.target.closest("[data-toggle]")) {
      e.preventDefault();
      ctx.go(`campaigns/${pick.dataset.pick}`);
    }
  };
}
