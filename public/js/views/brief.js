// Morning brief: the first screen of the day. Yesterday against the 7-day
// average, what to fix first, who to call now, what the automatic rules did
// overnight, and a short list for today that can be ticked off. Copy it to
// WhatsApp to send to yourself or the sales team.
import { html, raw, money, n, pct, copy, localDay } from "../ui.js";
import { get } from "../api.js";
import { load, save, targets, isDemo } from "../store.js";
import { allLeads, alerts, isValid, isWaiting } from "../model.js";
import { connectCard, loadingCard } from "./common.js";

let data = null;
let loadingFor = "";
let mode = null;

function fetchData(ctx) {
  const key = localDay();
  if (loadingFor === key || data?.key === key) return;
  loadingFor = key;
  Promise.all([
    get("/api/tree", { range: "yesterday" }),
    get("/api/tree", { range: "last_7d" }),
    get("/api/rules/history").catch(() => []),
    get("/api/payments").catch(() => null),
  ])
    .then(([y, w, rh, pay]) => (data = { key, y, w, rh, pay }))
    .catch((e) => (data = { key, error: e.message }))
    .finally(() => {
      loadingFor = "";
      ctx.render();
    });
}

const sum = (tree) => {
  const t = { spend: 0, leads: 0, impressions: 0, clicks: 0 };
  for (const c of tree?.campaigns || []) {
    if (!c.m) continue;
    t.spend += c.m.spend || 0;
    t.leads += (c.m.leads || 0) + (c.m.convos || 0);
    t.impressions += c.m.impressions || 0;
    t.clicks += c.m.linkClicks || 0;
  }
  t.cpl = t.leads ? t.spend / t.leads : null;
  t.ctr = t.impressions ? (t.clicks / t.impressions) * 100 : null;
  return t;
};

function cmp(y, avg, lowerIsBetter, neutral) {
  if (y === null || avg === null || !avg) return html``;
  const ch = (y - avg) / avg;
  if (Math.abs(ch) < 0.05) return html`<small class="faint">about average</small>`;
  const good = neutral ? null : lowerIsBetter ? ch < 0 : ch > 0;
  return html`<small class="${good === null ? "faint" : good ? "tc good" : "tc bad"}">${ch > 0 ? "▲" : "▼"} ${Math.abs(ch * 100).toFixed(0)}% vs 7-day average</small>`;
}

export function buildBrief(d, leads, health, t = targets()) {
  const y = sum(d.y);
  const w = sum(d.w);
  const days = 7;
  const avg = { spend: w.spend / days, leads: w.leads / days, cpl: w.cpl, ctr: w.ctr };
  const yDay = (() => {
    const x = new Date();
    x.setDate(x.getDate() - 1);
    return localDay(x);
  })();
  const yLeads = leads.filter((l) => String(l.created).slice(0, 10) === yDay);
  const yValid = yLeads.filter((l) => isValid(l.stage)).length;
  const unmarked = yLeads.filter((l) => l.stage === "new" || l.stage === "no_answer").length;
  const recent = Date.now() - 2 * 86400000;
  const call = leads.filter((l) => isWaiting(l.stage) && new Date(l.created).getTime() >= recent).sort((a, b) => (a.stage === "new" ? 0 : 1) - (b.stage === "new" ? 0 : 1) || String(b.created).localeCompare(String(a.created)));
  const fix = [
    ...(health?.items || []).filter((x) => x.tone === "bad").map((x) => ({ tone: "bad", title: x.problem + (x.level !== "account" ? ` · ${x.name}` : ""), text: x.fix, href: "#/health" })),
    ...alerts(d.w, leads)
      .filter((a) => a.tone === "bad" || a.tone === "warn")
      .filter((a) => !a.lead)
      .slice(0, 5)
      .map((a) => ({ tone: a.tone, title: `${a.title}${a.name ? ` · ${a.name}` : ""}`, text: a.text, href: a.campaignId ? `#/campaigns/${a.campaignId}` : null })),
  ];
  const tired = [];
  for (const c of d.w?.campaigns || []) for (const s of c.adsets) for (const a of s.ads) if (a.status === "ACTIVE" && a.m && a.m.frequency > t.maxFrequency && a.m.ctr > 0 && a.m.ctr < t.minCtr) tired.push(a.name);
  const since = Date.now() - 26 * 3600000;
  const overnight = (d.rh || []).filter((e) => new Date(e.timestamp || e.time || 0).getTime() >= since);
  const pace = (() => {
    const budget = load("monthlyBudget", null);
    const p = d.pay;
    if (!budget || !p?.months) return null;
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const spent = p.months.find((m) => m.month === ym)?.spend || 0;
    const perDay = (p.last7 || []).reduce((s, x) => s + x.spend, 0) / Math.max(1, (p.last7 || []).length);
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const total = spent + perDay * (dim - now.getDate() + 1);
    return { budget, total, ratio: total / budget };
  })();
  const todo = [];
  if (call.length) todo.push(`Call or WhatsApp ${call.length} waiting lead${call.length > 1 ? "s" : ""}, newest first.`);
  if (unmarked) todo.push(`Give a stage to ${unmarked} of yesterday's lead${unmarked > 1 ? "s" : ""} after the call.`);
  for (const f of fix.filter((x) => x.tone === "bad").slice(0, 2)) todo.push(`Fix: ${f.title}.`);
  if (tired.length) todo.push(`Make new versions for tired ads: ${tired.slice(0, 3).join(", ")}${tired.length > 3 ? "…" : ""}.`);
  if (pace && pace.ratio > 1.05) todo.push(`Spend is heading ${pct((pace.ratio - 1) * 100, 0)} over the monthly budget: trim daily budgets.`);
  if (pace && pace.ratio < 0.9) todo.push(`Spend is heading ${pct((1 - pace.ratio) * 100, 0)} under budget: raise the best ad set 15–20%.`);
  if (!todo.length) todo.push("All clear: check the A/B tests and plan the next creative.");
  return { y, avg, yDay, yLeads: yLeads.length, yValid, call, fix, tired, overnight, pace, todo };
}

function whatsappText(b) {
  const lines = [
    `${isDemo() ? "[DEMO DATA, NOT REAL] " : ""}Morning brief · ${new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`,
    "",
    `Yesterday: ${money(b.y.spend)} spent, ${n(b.y.leads)} leads${b.y.cpl ? ` at ${money(b.y.cpl)}` : ""}, ${n(b.yValid)} valid so far`,
    `7-day average: ${money(b.avg.spend)} a day, ${n(b.avg.leads, 1)} leads${b.avg.cpl ? ` at ${money(b.avg.cpl)}` : ""}`,
  ];
  if (b.fix.length) lines.push("", "Fix first:", ...b.fix.slice(0, 4).map((f) => `• ${f.title}`));
  lines.push("", "Today:", ...b.todo.map((x) => `• ${x}`));
  return lines.join("\n");
}

export function render(ctx) {
  if (ctx.settings && mode !== Boolean(ctx.settings.demo)) {
    mode = Boolean(ctx.settings.demo);
    data = null;
  }
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const top = html`<div class="top"><div><h1>Good morning</h1><p class="sub">${today}. Yesterday in one screen, what to fix, who to call, and today's list.</p></div>
    <div class="top-actions">${data && !data.error ? html`<button class="btn" type="button" data-bwa>Copy for WhatsApp</button>` : ""}</div></div>`;
  if (!ctx.settings) return html`${top}${loadingCard()}`;
  if (!ctx.settings.connected) return html`${top}${connectCard(ctx.settings)}`;
  fetchData(ctx);
  if (!data || data.key !== localDay()) return html`${top}${loadingCard()}`;
  if (data.error) return html`${top}<div class="note bad"><b>Could not load yesterday from Meta.</b> ${data.error}</div>`;
  const b = buildBrief(data, allLeads(), ctx.health);
  const done = load(`brief:${localDay()}`, []);
  const waNum = (p) => {
    const d = String(p || "").replace(/[^\d]/g, "");
    return d.startsWith("01") && d.length === 11 ? `2${d}` : d.replace(/^00/, "");
  };
  return html`${top}
  <div class="kpis" style="margin-bottom:14px">
    <div class="kpi"><span>Spent yesterday</span><b>${money(b.y.spend)}</b>${cmp(b.y.spend, b.avg.spend, false, true)}</div>
    <div class="kpi"><span>Leads yesterday</span><b>${n(b.y.leads)}</b>${cmp(b.y.leads, b.avg.leads)}</div>
    <div class="kpi"><span>Cost per lead</span><b>${money(b.y.cpl)}</b>${cmp(b.y.cpl, b.avg.cpl, true)}</div>
    <div class="kpi key"><span>Valid so far (yesterday's leads)</span><b>${n(b.yValid)}</b><small>${n(b.yLeads)} leads logged</small></div>
    <div class="kpi"><span>Link CTR</span><b>${pct(b.y.ctr, 2)}</b>${cmp(b.y.ctr, b.avg.ctr)}</div>
    ${b.pace ? html`<div class="kpi"><span>Month forecast</span><b>${money(b.pace.total, { short: true })}</b><small class="${b.pace.ratio > 1.05 ? "tc bad" : "faint"}">budget ${money(b.pace.budget, { short: true })}</small></div>` : ""}
  </div>
  <div class="grid g2">
    <div class="card"><div class="card-head"><div><h2>Today</h2><p>Tick them off as you go.</p></div></div>
      <div class="stack">${b.todo.map((x, i) => html`<label class="row" style="align-items:flex-start;gap:10px"><input type="checkbox" data-todo="${i}" ${done.includes(i) ? raw("checked") : ""} style="margin-top:3px"><span class="${done.includes(i) ? "faint" : ""}" style="${done.includes(i) ? "text-decoration:line-through" : ""}">${x}</span></label>`)}</div>
    </div>
    <div class="card"><div class="card-head"><div><h2>Call now</h2><p>New and unanswered leads from the last 2 days.</p></div><a class="btn sm" href="#/leads">All leads</a></div>
      ${b.call.length ? html`<div class="table-wrap"><table><tbody>${b.call.slice(0, 8).map((l) => html`<tr><td><div class="name">${l.name || l.phone || "No name"}</div><div class="tiny muted">${l.campaignName || l.source || ""}</div></td><td class="n">${waNum(l.phone) ? html`<a class="btn sm" href="https://wa.me/${waNum(l.phone)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}</td></tr>`)}</tbody></table></div>` : html`<p class="muted">No one waiting. Nice.</p>`}
    </div>
  </div>
  <div class="card"><div class="card-head"><div><h2>Fix first</h2><p>Problems that stop delivery, and ad sets the alerts flagged over the last 7 days.</p></div></div>
    ${b.fix.length ? html`<div class="alerts">${b.fix.map((f) => html`<div class="alert ${f.tone}"><span class="dot"></span><div class="grow"><b>${f.title}</b><p>${f.text}</p></div>${f.href ? html`<a class="btn sm" href="${f.href}">Open</a>` : ""}</div>`)}</div>` : html`<p class="muted">Nothing to fix this morning.</p>`}
  </div>
  <div class="card"><div class="card-head"><div><h2>Overnight</h2><p>What the automatic rules did in the last day.</p></div><a class="btn sm" href="#/rules">Rules</a></div>
    ${b.overnight.length ? html`<ul class="list">${b.overnight.slice(0, 8).map((e) => html`<li><b>${e.rule_name || e.rule_id || "Rule"}</b>: ${(e.results || []).length ? (e.results || []).map((r) => `${r.action || "acted on"} ${r.object_name || r.object_id || ""}`).join(", ") : "ran, nothing matched"}</li>`)}</ul>` : html`<p class="muted">No rule acted in the last day.</p>`}
  </div>`;
}

export function mount(root, ctx) {
  root.onchange = (e) => {
    const c = e.target.closest("[data-todo]");
    if (!c) return;
    const key = `brief:${localDay()}`;
    const done = new Set(load(key, []));
    const i = Number(c.dataset.todo);
    c.checked ? done.add(i) : done.delete(i);
    save(key, [...done]);
    ctx.render();
  };
  root.onclick = (e) => {
    if (e.target.closest("[data-bwa]") && data && !data.error) copy(whatsappText(buildBrief(data, allLeads(), ctx.health)), "Brief copied. Paste it into WhatsApp");
  };
}

export const _test = { buildBrief, whatsappText };
