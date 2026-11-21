// Budget planner: from a monthly budget to valid leads, meetings and
// reservations, or back from a reservation goal to the budget it needs.
// Starts with example rates (clearly marked); "Use my real rates" swaps in
// the rates from your own leads and Meta results.
import { html, raw, money, n, egp, toast } from "../ui.js";
import { load, save } from "../store.js";
import { allLeads, isValid, MEETING_UP, RESERVED_UP } from "../model.js";

const EXAMPLE = { cpl: 300, valid: 20, meeting: 30, reserve: 15 };
let st = load("planner", { mode: "budget", budget: 150000, goal: 3, project: "krypton", price: null, commission: null, ...EXAMPLE, source: "example" });

function realRates(ctx) {
  const leads = allLeads();
  const contacted = leads.filter((l) => l.stage !== "new" && l.stage !== "no_answer");
  const valid = leads.filter((l) => isValid(l.stage));
  const meet = leads.filter((l) => MEETING_UP.has(l.stage));
  const res = leads.filter((l) => RESERVED_UP.has(l.stage));
  const out = {};
  const notes = [];
  if (contacted.length >= 20) out.valid = +((valid.length / contacted.length) * 100).toFixed(1);
  else notes.push(`valid rate needs 20+ contacted leads (${contacted.length} now)`);
  if (valid.length >= 10) out.meeting = +((meet.length / valid.length) * 100).toFixed(1);
  else notes.push(`meeting rate needs 10+ valid leads (${valid.length} now)`);
  if (meet.length >= 5) out.reserve = +((res.length / meet.length) * 100).toFixed(1);
  else notes.push(`reservation rate needs 5+ meetings (${meet.length} now)`);
  if (ctx.tree) {
    let spend = 0;
    let ml = 0;
    for (const c of ctx.tree.campaigns) {
      spend += c.m?.spend || 0;
      ml += (c.m?.leads || 0) + (c.m?.convos || 0);
    }
    if (ml >= 10) out.cpl = Math.round(spend / ml);
    else notes.push("cost per lead needs 10+ Meta leads in the chosen dates");
  } else notes.push("connect Meta for the real cost per lead");
  return { out, notes };
}

function calc() {
  const v = st.valid / 100;
  const m = st.meeting / 100;
  const r = st.reserve / 100;
  const perRes = v && m && r ? 1 / (v * m * r) : null; // leads per reservation
  let budget = Number(st.budget) || 0;
  let leads;
  if (st.mode === "goal") {
    leads = perRes ? Math.ceil(Number(st.goal) * perRes) : 0;
    budget = leads * st.cpl;
  } else leads = st.cpl ? budget / st.cpl : 0;
  const valid = leads * v;
  const meetings = valid * m;
  const reservations = meetings * r;
  const price = Number(st.price) || 0;
  const value = reservations * price;
  return { budget, leads, valid, meetings, reservations, perRes, cpvl: valid ? budget / valid : null, cpr: reservations ? budget / reservations : null, value, commission: st.commission ? (value * st.commission) / 100 : null, daily: budget / 30 };
}

export function render(ctx) {
  const p = ctx.catalog?.projects?.find((x) => x.id === st.project);
  if (!st.price && p?.from) st.price = p.from;
  const r = calc();
  const field = (k, label, suffix, step = "any") => html`<label class="field"><span>${label}</span><div class="row"><input class="input" type="number" min="0" step="${step}" inputmode="decimal" name="${k}" value="${st[k] ?? ""}"><span class="small muted">${suffix}</span></div></label>`;
  return html`
  <div class="top"><div><h1>Budget planner</h1><p class="sub">How much to spend for the meetings and reservations you need, and what each valid lead may cost.</p></div></div>
  <div class="grid g2">
    <form class="card" data-planner>
      <div class="card-head"><h2>Inputs</h2>${st.source === "example" ? html`<span class="pill warn">Example rates, not market data</span>` : html`<span class="pill good">Your own rates</span>`}</div>
      <div class="seg" role="group" aria-label="Plan from" style="margin-bottom:12px"><button type="button" data-mode="budget" aria-pressed="${st.mode === "budget"}">From a budget</button><button type="button" data-mode="goal" aria-pressed="${st.mode === "goal"}">From a reservation goal</button></div>
      <div class="fields">
        ${st.mode === "budget" ? field("budget", "Monthly budget", "EGP", "1000") : field("goal", "Reservations wanted per month", "", "1")}
        ${field("cpl", "Cost per lead", "EGP", "10")}
        ${field("valid", "Leads that are valid", "%", "1")}
        ${field("meeting", "Valid leads that meet or visit", "%", "1")}
        ${field("reserve", "Meetings that reserve", "%", "1")}
        <label class="field"><span>Project (sets the deal value)</span><select class="input" name="project">${(ctx.catalog?.projects || []).map((x) => html`<option value="${x.id}" ${x.id === st.project ? raw("selected") : ""}>${x.name} · from ${egp(x.from)}</option>`)}</select></label>
        ${field("price", "Average deal value", "EGP", "100000")}
        ${field("commission", "Commission (optional)", "%", "0.1")}
      </div>
      <div class="row wrap" style="margin-top:12px"><button class="btn" type="button" data-real>Use my real rates</button><button class="btn ghost" type="button" data-example>Back to example rates</button></div>
      <p class="small muted" style="margin-top:8px">Rates move with the message and the form. Re-check them every two weeks.</p>
    </form>
    <div class="card">
      <h2>Result per month</h2>
      <div class="kpis" style="margin-top:12px">
        <div class="kpi"><span>Budget</span><b>${money(r.budget, { currency: "EGP" })}</b><small>about ${money(r.daily, { currency: "EGP" })} a day</small></div>
        <div class="kpi"><span>Leads</span><b>${n(r.leads)}</b></div>
        <div class="kpi key"><span>Valid leads</span><b>${n(r.valid, 1)}</b><small>${r.cpvl ? `${money(r.cpvl, { currency: "EGP" })} each` : ""}</small></div>
        <div class="kpi"><span>Meetings / visits</span><b>${n(r.meetings, 1)}</b></div>
        <div class="kpi key"><span>Reservations</span><b>${n(r.reservations, 1)}</b><small>${r.cpr ? `${money(r.cpr, { currency: "EGP" })} each` : ""}</small></div>
        <div class="kpi"><span>Leads per reservation</span><b>${r.perRes ? n(r.perRes) : "—"}</b></div>
        <div class="kpi"><span>Sales value</span><b>${egp(r.value)}</b><small>reservations × deal value</small></div>
        ${r.commission !== null ? html`<div class="kpi"><span>Commission</span><b>${egp(r.commission)}</b><small>before costs; not profit</small></div>` : ""}
      </div>
      <hr class="hr">
      <p class="small muted">With these rates, every reservation needs about <b>${r.perRes ? n(r.perRes) : "—"}</b> leads. Raising the valid rate (price in the ad, budget question in the form) lowers the budget more than cutting the cost per lead does.</p>
      <p class="small muted" style="margin-top:6px">Meta needs about 50 results a week per ad set to finish learning. At ${money(st.cpl, { currency: "EGP" })} per lead, that is about ${money(st.cpl * 50, { currency: "EGP" })} a week per ad set; with less, use fewer ad sets.</p>
    </div>
  </div>`;
}

export function mount(root, ctx) {
  const persist = () => save("planner", st);
  root.onchange = (e) => {
    const f = e.target.closest("[data-planner]");
    if (!f || !e.target.name) return;
    const k = e.target.name;
    if (k === "project") {
      st.project = e.target.value;
      st.price = ctx.catalog?.projects?.find((x) => x.id === st.project)?.from || null;
    } else {
      st[k] = e.target.value === "" ? null : Number(e.target.value);
      if (["cpl", "valid", "meeting", "reserve"].includes(k)) st.source = "mine";
    }
    persist();
    ctx.render();
  };
  root.onclick = (e) => {
    const m = e.target.closest("[data-mode]");
    if (m) {
      st.mode = m.dataset.mode;
      persist();
      return ctx.render();
    }
    if (e.target.closest("[data-example]")) {
      st = { ...st, ...EXAMPLE, source: "example" };
      persist();
      return ctx.render();
    }
    if (e.target.closest("[data-real]")) {
      const { out, notes } = realRates(ctx);
      if (!Object.keys(out).length) return toast(`Not enough data yet: ${notes.join("; ")}.`, "bad");
      st = { ...st, ...out, source: "mine" };
      persist();
      toast(`Used your ${Object.keys(out).join(", ")}${notes.length ? `. Kept the rest: ${notes.join("; ")}` : ""}.`, "good");
      ctx.render();
    }
  };
}
