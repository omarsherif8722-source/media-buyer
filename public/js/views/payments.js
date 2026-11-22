// Payments: what Meta shows about money on the ad account (amount owed now,
// spend against the spending limit, the payment method), spend month by month,
// this month by campaign and project, and an end-of-month forecast against your
// monthly budget. Read-only: receipts and invoices open in Meta's Billing.
import { html, raw, money, n, pct, toast } from "../ui.js";
import { get } from "../api.js";
import { load, save } from "../store.js";
import { projectFromName } from "../model.js";
import { connectCard, loadingCard, kpi } from "./common.js";

let data = null;
let loading = false;
let mode = null;

function fetchData(ctx, force = false) {
  if (loading || (data && !force)) return;
  loading = true;
  get("/api/payments", force ? { fresh: 1 } : {})
    .then((d) => (data = d))
    .catch((e) => (data = { error: e.message }))
    .finally(() => {
      loading = false;
      ctx.render();
    });
}

const monthName = (ym) => new Date(`${ym}-01T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });

export function forecast(d, now = new Date()) {
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const spent = d.months.find((m) => m.month === ym)?.spend || 0;
  const days = d.last7.length || 1;
  const perDay = d.last7.reduce((t, x) => t + x.spend, 0) / days;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const left = Math.max(0, daysInMonth - now.getDate() + 1);
  return { ym, spent, perDay, left, total: spent + perDay * left, daysInMonth };
}

export function render(ctx) {
  if (ctx.settings && mode !== Boolean(ctx.settings.demo)) {
    mode = Boolean(ctx.settings.demo);
    data = null;
  }
  const top = html`<div class="top"><div><h1>Payments</h1><p class="sub">What the ad account has spent and owes, the spending limit and payment method, spend by month and by campaign, and where this month will land.</p></div>
    <div class="top-actions"><button class="btn icon" type="button" data-prefresh title="Refresh" aria-label="Refresh">↻</button></div></div>`;
  if (!ctx.settings) return html`${top}${loadingCard()}`;
  if (!ctx.settings.connected) return html`${top}${connectCard(ctx.settings)}`;
  fetchData(ctx);
  if (!data) return html`${top}${loadingCard()}`;
  if (data.error) return html`${top}<div class="note bad"><b>Could not read the payment details from Meta.</b> ${data.error}</div>`;
  const a = data.account;
  const f = forecast(data);
  const budget = load("monthlyBudget", null);
  const capLeft = a.spendCap ? a.spendCap - (a.amountSpent || 0) : null;
  const prev = data.months.length > 1 ? data.months[data.months.length - 2] : null;
  const maxM = Math.max(1, ...data.months.map((m) => m.spend));
  const projects = {};
  for (const c of data.thisMonth) {
    const p = projectFromName(c.name, ctx.catalog)?.name || "Other";
    projects[p] = (projects[p] || 0) + c.spend;
  }
  const projRows = Object.entries(projects).sort((x, y) => y[1] - x[1]);
  const monthTotal = data.thisMonth.reduce((t, c) => t + c.spend, 0);
  const pace = budget ? f.total / budget : null;
  const notes = [];
  if (budget && pace > 1.05) notes.push({ tone: "warn", title: `On course for ${money(f.total)} this month: ${pct((pace - 1) * 100, 0)} over your ${money(budget)} budget`, text: `At about ${money(f.perDay)} a day. Lower daily budgets by about ${money((f.total - budget) / Math.max(1, f.left))} a day in total to land on budget.` });
  else if (budget && pace < 0.9) notes.push({ tone: "info", title: `On course for ${money(f.total)}: ${pct((1 - pace) * 100, 0)} under your ${money(budget)} budget`, text: `There is room for about ${money((budget - f.total) / Math.max(1, f.left))} a day more. Put it behind the ad sets with the lowest cost per valid lead.` });
  if (capLeft !== null && capLeft < f.perDay * 7) notes.push({ tone: "bad", title: "The spending limit runs out within a week", text: `${money(Math.max(0, capLeft))} left at about ${money(f.perDay)} a day. Raise it in Meta's Billing, or all ads stop.` });
  if (a.owed && a.owed > 0) notes.push({ tone: "info", title: `${money(a.owed)} to be charged`, text: "This is the bill amount due on the account. Meta charges it at your billing threshold or billing date." });

  return html`${top}
  ${data.demo ? "" : html`<div class="note" style="margin-bottom:12px">Read-only. Receipts, invoices and every individual charge are in <a href="${data.billingUrl}" target="_blank" rel="noopener">Meta Billing ↗</a>.</div>`}
  ${notes.length ? html`<div class="card"><div class="alerts">${notes.map((x) => html`<div class="alert ${x.tone}"><span class="dot"></span><div class="grow"><b>${x.title}</b><p>${x.text}</p></div></div>`)}</div></div>` : ""}
  <div class="kpis" style="margin-bottom:14px">
    ${kpi("To be charged (owed now)", money(a.owed), "bill amount due")}
    ${kpi("Spent this month", money(f.spent), prev ? `last month ${money(prev.spend)}` : "", true)}
    ${kpi("Forecast this month", money(f.total), `at ${money(f.perDay)} a day`)}
    ${kpi("Lifetime spend", money(a.amountSpent), a.spendCap ? "against the limit" : "")}
    ${kpi("Spending limit", a.spendCap ? money(a.spendCap) : "none", capLeft !== null ? `${money(Math.max(0, capLeft))} left` : "no limit set")}
    ${kpi("Payment method", a.method?.display || "—", [a.method?.type, a.prepay === true ? "prepaid" : a.prepay === false ? "pay after" : ""].filter(Boolean).join(" · "))}
  </div>
  <div class="card"><div class="card-head"><div><h2>Monthly budget</h2><p>Your budget for G Developments' ads this month. The forecast is compared against it.</p></div></div>
    <form class="row wrap" data-budgetform><label class="field"><span>Monthly budget (${data.currency})</span><input class="input" name="b" type="number" min="0" step="1000" inputmode="numeric" value="${budget ?? ""}" placeholder="e.g. 150000"></label><button class="btn" type="submit" style="align-self:end">Save</button>
    ${budget ? html`<div class="grow" style="align-self:end;min-width:200px"><div class="bar" style="height:10px"><i style="width:${Math.min(100, (f.spent / budget) * 100)}%"></i></div><div class="tiny muted" style="margin-top:4px">${money(f.spent)} of ${money(budget)} spent (${pct((f.spent / budget) * 100, 0)}), day ${f.daysInMonth - f.left + 1} of ${f.daysInMonth}</div></div>` : ""}</form>
  </div>
  <div class="grid g2">
    <div class="card viz"><div class="card-head"><div><h2>Spend by month</h2><p>Last 12 months. The current month is so far.</p></div></div>
      ${data.months.length ? html`<div class="mbars">${data.months.map((m) => html`<div class="mbar" title="${monthName(m.month)}: ${money(m.spend)}"><span class="mval">${money(m.spend, { short: true })}</span><i style="height:${Math.max(2, (m.spend / maxM) * 100)}%" class="${m.month === f.ym ? "cur" : ""}"></i><span class="mlab">${monthName(m.month)}</span></div>`)}</div>` : html`<p class="muted">No spend yet.</p>`}
    </div>
    <div class="card viz"><div class="card-head"><div><h2>This month by project</h2><p>${money(monthTotal)} so far.</p></div></div>
      ${projRows.length ? html`<div class="hbars">${projRows.map(([p, v]) => html`<div class="hbar"><span class="hbar-name">${p}</span><span class="hbar-track"><i style="width:${(v / projRows[0][1]) * 100}%"></i></span><span class="hbar-val">${money(v, { short: true })}</span><span class="hbar-sub">${pct(monthTotal ? (v / monthTotal) * 100 : null, 0)} of this month</span></div>`)}</div>` : html`<p class="muted">No spend this month.</p>`}
    </div>
  </div>
  <div class="card"><div class="card-head"><div><h2>This month by campaign</h2></div></div>
    ${data.thisMonth.length ? html`<div class="table-wrap"><table><thead><tr><th>Campaign</th><th class="n">Spend</th><th class="n">Share</th></tr></thead><tbody>${data.thisMonth.map((c) => html`<tr><td class="name">${c.name}</td><td class="n">${money(c.spend)}</td><td class="n">${pct(monthTotal ? (c.spend / monthTotal) * 100 : null, 1)}</td></tr>`)}</tbody></table></div>` : html`<p class="muted">No spend this month.</p>`}
  </div>`;
}

export function mount(root, ctx) {
  root.onsubmit = (e) => {
    const f = e.target.closest("[data-budgetform]");
    if (!f) return;
    e.preventDefault();
    const v = new FormData(f).get("b");
    save("monthlyBudget", v === "" ? null : Number(v));
    toast("Monthly budget saved.", "good");
    ctx.render();
  };
  root.onclick = (e) => {
    if (e.target.closest("[data-prefresh]")) {
      data = null;
      fetchData(ctx, true);
      ctx.render();
    }
  };
}

export const _raw = raw;
export const _n = n;
