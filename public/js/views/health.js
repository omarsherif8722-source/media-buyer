// Account health: anything that silently stops ads from delivering (account
// disabled or unpaid, spending limit nearly reached, rejected ads, items with
// issues), each with the fix. A banner on every screen points here.
import { html, money, dateTime } from "../ui.js";
import { connectCard, loadingCard } from "./common.js";
import { openVersion } from "./copydialog.js";

function findAd(tree, id) {
  for (const c of tree?.campaigns || []) for (const s of c.adsets) for (const a of s.ads) if (a.id === id) return { a, c };
  return null;
}

export function render(ctx) {
  const top = html`<div class="top"><div><h1>Account health</h1><p class="sub">What could be stopping your ads right now: the account, billing, the spending limit, rejected ads and items with issues. Checked each time the dashboard loads Meta.</p></div>
    <div class="top-actions">${ctx.settings?.connected ? ctx.refreshButton() : ""}</div></div>`;
  if (!ctx.settings) return html`${top}${loadingCard()}`;
  if (!ctx.settings.connected) return html`${top}${connectCard(ctx.settings)}`;
  if (!ctx.health) return html`${top}${ctx.treeLoading || !ctx.tree ? loadingCard() : html`<div class="note warn">The health check could not be read from Meta. Refresh to try again.</div>`}`;
  const h = ctx.health;
  const items = h.items || [];
  const ro = ctx.tree?.readOnly;
  const checks = [
    ["Ad account active", !items.some((x) => x.level === "account" && /disabled|closed|unpaid|settlement|review|grace/i.test(x.problem))],
    ["Spending limit has room", !items.some((x) => /spending limit/i.test(x.problem))],
    ["No rejected ads", !items.some((x) => x.status === "DISAPPROVED")],
    ["No items with issues", !items.some((x) => x.status === "WITH_ISSUES")],
    ["Payment details complete", !items.some((x) => x.status === "PENDING_BILLING_INFO")],
  ];
  return html`${top}
  <div class="card"><div class="card-head"><div><h2>${items.length ? `${items.length} thing${items.length > 1 ? "s" : ""} to fix` : "All clear"}</h2><p>${h.account?.name || ""} · checked ${dateTime(h.checkedAt)}${h.account?.spendCap ? ` · spending limit ${money(h.account.spendCap)} (${money(h.account.amountSpent)} spent)` : ""}</p></div></div>
    <div class="chips">${checks.map(([label, ok]) => html`<span class="pill ${ok ? "good" : "bad"}">${ok ? "✓" : "✕"} ${label}</span>`)}</div>
  </div>
  ${items.length ? html`<div class="stack">${items.map((x) => {
    const found = x.level === "ad" ? findAd(ctx.tree, x.id) : null;
    return html`<div class="alert ${x.tone}"><span class="dot"></span><div class="grow">
      <b>${x.problem}</b> <span class="muted small">· ${x.level}${x.level !== "account" ? `: ${x.name}` : ""}</span>
      ${x.reason ? html`<p><b>Meta says:</b> ${x.reason}</p>` : ""}
      <p><b>Fix:</b> ${x.fix || "Open it in Ads Manager to see what Meta needs."}</p>
      <div class="row wrap" style="margin-top:6px">
        ${x.campaignId ? html`<a class="btn sm" href="#/campaigns/${x.campaignId}">Open campaign</a>` : ""}
        ${found && !ro ? html`<button class="btn sm primary" type="button" data-fixver="${x.id}">Make a fixed version</button>` : ""}
      </div>
    </div></div>`;
  })}</div>` : html`<div class="card"><p class="muted">Nothing is blocking delivery. Rejected ads, billing problems and the spending limit are checked every time the dashboard loads.</p></div>`}
  <div class="card"><h2>Avoid rejections on property ads</h2><ul class="list" style="margin-top:8px">
    <li>No promised returns, rental income or "guaranteed" profit.</li>
    <li>Prices and plans must match the developer's official sheet; say "from" for starting prices.</li>
    <li>No before/after or personal attributes ("Are you struggling to…").</li>
    <li>If any ad set reaches the US, Canada or Europe, the campaign needs the Housing special ad category.</li>
    <li>Use G Developments' name and renders only with their written permission, from the Page they approved.</li>
  </ul></div>`;
}

export function mount(root, ctx) {
  root.onclick = (e) => {
    const b = e.target.closest("[data-fixver]");
    if (!b) return;
    const found = findAd(ctx.tree, b.dataset.fixver);
    if (found) openVersion(found.a, found.c, ctx);
  };
}
