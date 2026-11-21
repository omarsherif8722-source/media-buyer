// Overview: the numbers that matter for the chosen dates (spend, valid leads,
// cost per valid lead, meetings, reservations), what needs attention now,
// and the targets the alerts use.
import { html, raw, money, n, pct, ago, toast } from "../ui.js";
import { targets, saveTargets, DEFAULT_TARGETS } from "../store.js";
import { allLeads, quality, treeDates, score, alerts, isWaiting } from "../model.js";
import { kpi, connectCard, loadingCard } from "./common.js";

function totals(tree) {
  const t = { spend: 0, impressions: 0, leads: 0, convos: 0, linkClicks: 0, on: 0, campaigns: tree?.campaigns.length || 0 };
  for (const c of tree?.campaigns || []) {
    const m = c.m;
    if (c.effectiveStatus === "ACTIVE") t.on += 1;
    if (!m) continue;
    t.spend += m.spend;
    t.impressions += m.impressions;
    t.leads += m.leads;
    t.convos += m.convos;
    t.linkClicks += m.linkClicks;
  }
  return t;
}

function ranking(tree, q) {
  const rows = [];
  for (const c of tree?.campaigns || []) for (const a of c.adsets) if (a.m?.spend) rows.push({ c, a, s: score(a.m, q.adset[a.id]) });
  const withValid = rows.filter((r) => r.s.valid > 0).sort((x, y) => x.s.cpvl - y.s.cpvl);
  const noValid = rows.filter((r) => r.s.valid === 0 && r.s.spend > 0).sort((x, y) => y.s.spend - x.s.spend);
  return { best: withValid.slice(0, 5), waste: noValid.slice(0, 5) };
}

function targetsForm() {
  const t = targets();
  const f = (key, label, hint, step = "any") => html`<label class="field"><span>${label}</span><input class="input" type="number" min="0" step="${step}" inputmode="decimal" name="${key}" value="${t[key] ?? ""}" placeholder="${DEFAULT_TARGETS[key] ?? "not set"}"><small class="faint">${hint}</small></label>`;
  return html`<form class="fields" data-targets>
    ${f("cpl", "Target cost per lead", "Leave empty until you have a week of results")}
    ${f("cpvl", "Target cost per valid lead", "The number that matters")}
    ${f("maxFrequency", "Max frequency", "Above this, ads look tired", "0.1")}
    ${f("minCtr", "Min link CTR %", "Below this, the hook is weak", "0.1")}
    ${f("speedToLead", "Call new leads within (min)", "Speed wins real buyers", "1")}
    ${f("zeroValidAfter", "Flag after this many leads with none valid", "Lead quality alarm", "1")}
    <div class="field" style="align-self:end"><button class="btn primary" type="submit">Save targets</button></div>
  </form>`;
}

export function render(ctx) {
  const leads = allLeads();
  const tree = ctx.tree;
  const connected = ctx.settings?.connected;
  const { since, until } = tree ? treeDates(tree) : { since: null, until: null };
  const q = quality(leads, since, until);
  const tt = totals(tree);
  const sc = score({ spend: tt.spend, leads: tt.leads, convos: tt.convos }, q.total);
  const list = alerts(tree, leads);
  const waiting = leads.filter((l) => isWaiting(l.stage)).sort((a, b) => String(a.created).localeCompare(String(b.created)));
  const rank = tree ? ranking(tree, q) : null;
  const t = targets();

  return html`
  <div class="top"><div><h1>Overview</h1><p class="sub">${tree ? html`${tree.account.name} · ${since || "?"} to ${until || "?"} · ${tt.on} of ${tt.campaigns} campaigns on` : "Judge every campaign by valid leads: people who answered, can afford the project and want to talk about buying."}</p></div>
    <div class="top-actions">${connected ? html`${ctx.periodSwitch()}${ctx.refreshButton()}` : ""}</div></div>

  ${connected === false ? connectCard(ctx.settings) : ""}
  ${connected && !tree && !ctx.treeError ? loadingCard() : ""}
  ${ctx.treeError ? html`<div class="note bad" style="margin-bottom:14px"><b>Could not load Meta results.</b> ${ctx.treeError}</div>` : ""}

  <div class="kpis" style="margin:${connected === false ? "14px" : "0"} 0 14px">
    ${tree ? kpi("Spend", money(tt.spend)) : ""}
    ${tree ? kpi("Leads (Meta)", n(sc.metaLeads), tt.convos ? `${n(tt.leads)} form · ${n(tt.convos)} chats` : "") : kpi("Leads in your log", n(q.total.leads), "all time")}
    ${tree ? kpi("Cost per lead", money(sc.cpl), t.cpl ? `target ${money(t.cpl)}` : "") : ""}
    ${kpi("Valid leads", n(q.total.valid), tree ? "in these dates" : "all time", true)}
    ${kpi("Valid rate", pct(sc.validRate === null ? null : sc.validRate * 100, 0), "of contacted", true)}
    ${tree ? kpi("Cost per valid lead", money(sc.cpvl), t.cpvl ? `target ${money(t.cpvl)}` : "set a target below", true) : ""}
    ${kpi("Meetings / visits", n(q.total.meetings))}
    ${kpi("Reservations", n(q.total.reserved), tree && sc.cpr ? `${money(sc.cpr)} each` : "")}
  </div>

  <div class="grid g2">
    <div class="card"><div class="card-head"><div><h2>Needs attention</h2><p>From Meta results, your lead stages and the targets below.</p></div></div>
      ${list.length ? html`<div class="alerts">${list.slice(0, 12).map((a) => html`<div class="alert ${a.tone}"><span class="dot"></span><div class="grow"><b>${a.title}</b>${a.name ? html` <span class="muted small">· ${a.name}</span>` : ""}<p>${a.text}</p></div>${a.lead ? html`<a class="btn sm" href="#/leads">Open leads</a>` : a.campaignId ? html`<a class="btn sm" href="#/campaigns/${a.campaignId}">Open</a>` : ""}</div>`)}</div>` : html`<div class="empty"><h3>Nothing urgent</h3><p>${tree ? "No rule is triggered for these dates." : "Alerts start once Meta is connected and leads come in."}</p></div>`}
    </div>
    <div class="card"><div class="card-head"><div><h2>Call these first</h2><p>New and unanswered leads, oldest first.</p></div><a class="btn sm" href="#/leads">All leads</a></div>
      ${waiting.length ? html`<div class="table-wrap"><table><tbody>${waiting.slice(0, 8).map((l) => html`<tr><td><div class="name">${l.name || l.phone || "No name"}</div><div class="tiny muted">${l.campaignName || l.source || ""}</div></td><td class="n ${l.stage === "new" && Date.now() - new Date(l.created) > t.speedToLead * 60000 ? "late" : ""}">${ago(l.created)}</td></tr>`)}</tbody></table></div>` : html`<div class="empty"><h3>No one waiting</h3><p>Every lead has been contacted.</p></div>`}
    </div>
  </div>

  ${rank ? html`<div class="grid g2" style="margin-top:14px">
    <div class="card"><div class="card-head"><div><h2>Best ad sets</h2><p>Lowest cost per valid lead in these dates. Scale these slowly.</p></div></div>
      ${rank.best.length ? html`<div class="table-wrap"><table><thead><tr><th>Ad set</th><th class="n">Valid</th><th class="n">Cost/valid</th></tr></thead><tbody>${rank.best.map((r) => html`<tr><td><a href="#/campaigns/${r.c.id}" class="name">${r.a.name}</a><div class="tiny muted">${r.c.name}</div></td><td class="n">${n(r.s.valid)}</td><td class="n"><b>${money(r.s.cpvl)}</b></td></tr>`)}</tbody></table></div>` : html`<p class="muted small">No valid leads marked in these dates yet. Mark lead stages in Leads to see this.</p>`}
    </div>
    <div class="card"><div class="card-head"><div><h2>Spending with no valid leads</h2><p>Check the audience and message, or turn them off.</p></div></div>
      ${rank.waste.length ? html`<div class="table-wrap"><table><thead><tr><th>Ad set</th><th class="n">Spend</th><th class="n">Leads</th></tr></thead><tbody>${rank.waste.map((r) => html`<tr><td><a href="#/campaigns/${r.c.id}" class="name">${r.a.name}</a><div class="tiny muted">${r.c.name}</div></td><td class="n">${money(r.s.spend)}</td><td class="n">${n(r.s.metaLeads)}</td></tr>`)}</tbody></table></div>` : html`<p class="muted small">None.</p>`}
    </div>
  </div>` : ""}

  <div class="card" style="margin-top:14px"><div class="card-head"><div><h2>Your targets</h2><p>Rules of thumb to start with. Replace them with your own numbers after the first two weeks.</p></div></div>${targetsForm()}</div>`;
}

export function mount(root, ctx) {
  root.onsubmit = (e) => {
    const form = e.target.closest("[data-targets]");
    if (!form) return;
    e.preventDefault();
    const out = {};
    for (const [k, v] of new FormData(form)) out[k] = v === "" ? null : Number(v);
    for (const k of Object.keys(out)) if (out[k] === null && DEFAULT_TARGETS[k] !== null) delete out[k];
    saveTargets(out);
    toast("Targets saved.", "good");
    ctx.render();
  };
}

export const _raw = raw;
