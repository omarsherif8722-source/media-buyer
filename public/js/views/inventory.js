// What to sell: availability and prices from the website's Primary ATS data,
// so money goes to projects that have homes to sell.
import { html, egp, n, day } from "../ui.js";
import { PLAYBOOK, PRIORITY, tokens, mainPlan } from "../playbook.js";

let open = null;

function advise(p) {
  const inv = p.inventory;
  if (p.status === "Delivered" || p.id === "ein-bay") return ["Check with sales first", "bad"];
  if (inv?.available === 0) return ["Nothing available", "bad"];
  if (!inv) return ["Not in the sheet: ask sales", "warn"];
  if (p.cashOnly) return ["Cash buyers only", "warn"];
  return ["Has stock", "good"];
}

export function render(ctx) {
  const c = ctx.catalog;
  const ps = [...(c?.projects || [])].sort((a, b) => (PLAYBOOK[a.id]?.priority || 9) - (PLAYBOOK[b.id]?.priority || 9));
  return html`
  <div class="top"><div><h1>What to sell</h1><p class="sub">Spend on projects that have homes to sell, at prices your audience can reach. Figures come from the website's data (${c?.source?.inventory || "inventory"}; ${c?.source?.payment || "payment plans"}).</p></div><div class="small muted">Website data copied ${day(c?.generated)}</div></div>
  <div class="card"><div class="table-wrap"><table>
    <thead><tr><th>Project</th><th>Area</th><th>Status</th><th class="n">From</th><th class="n">Available</th><th class="n">On hold</th><th>Plan</th><th>Cash</th><th>Signal</th><th></th></tr></thead>
    <tbody>${ps.map((p) => {
      const inv = p.inventory;
      const plan = mainPlan(p);
      const [sig, tone] = advise(p);
      const pr = PLAYBOOK[p.id] ? PRIORITY[PLAYBOOK[p.id].priority] : null;
      const types = inv?.byType || [];
      return html`<tr>
        <td><div class="name">${p.name}</div>${pr ? html`<span class="pill ${pr[1]}">${pr[0]}</span>` : ""}</td>
        <td>${p.regionName}</td><td>${p.status}</td>
        <td class="n">${egp(p.from)}</td>
        <td class="n">${inv?.available != null ? n(inv.available) : inv?.released ? html`${n(inv.released)} <span class="tiny faint">released</span>` : "—"}</td>
        <td class="n">${inv?.hold != null ? n(inv.hold) : "—"}</td>
        <td>${plan ? (plan.cashOnly ? "Cash" : `${(plan.down || []).join("+")}% · ${plan.years} yrs`) : "—"}</td>
        <td>${tokens(p).cash || "—"}</td>
        <td><span class="pill ${tone}">${sig}</span></td>
        <td class="n">${types.length ? html`<button class="btn sm ghost" type="button" data-open="${p.id}" aria-expanded="${open === p.id}">${open === p.id ? "Hide" : "Types"}</button>` : ""}</td>
      </tr>${open === p.id ? types.map((t) => html`<tr class="sub"><td colspan="3">${t.type}${t.beds?.length ? html` <span class="faint small">· ${t.beds.join(", ")} bed</span>` : ""}</td><td class="n">${egp(t.from)}</td><td class="n">${n(t.available)}</td><td colspan="5" class="small faint">as of ${inv.asOf}</td></tr>`) : ""}`;
    })}</tbody>
  </table></div>
  <p class="small muted" style="margin-top:8px">Krypton's released units come from the Blocks 1–2 floor plates. "From" is the cheapest available unit or the website's homes list, whichever is lower. Update this by running <code>node scripts/sync-website.mjs</code> after the website data changes.</p></div>`;
}

export function mount(root, ctx) {
  root.onclick = (e) => {
    const b = e.target.closest("[data-open]");
    if (b) {
      open = open === b.dataset.open ? null : b.dataset.open;
      ctx.render();
    }
  };
}
