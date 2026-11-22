// Lead form answers: what people picked on the instant forms (budget, timing,
// payment, purpose…), per campaign, before anyone calls them, and how well
// each answer predicted a valid lead once the calls were made.
import { html, raw, n, pct } from "../ui.js";
import { allLeads, isValid, projectFromName } from "../model.js";

let range = "30";
let campaign = "";

const tidy = (k) => String(k).replace(/[_?]+/g, " ").replace(/\s+/g, " ").trim();
export function questionType(key) {
  const k = tidy(key).toLowerCase();
  if (/budget|price range|ميزاني/.test(k)) return "budget";
  if (/when|timeline|plan(ning)? to buy|متى/.test(k)) return "timing";
  if (/pay|cash|install|دفع/.test(k)) return "payment";
  if (/live in or|invest|purpose|سكن|استثمار/.test(k)) return "purpose";
  if (/city|where do you live|area|مدين/.test(k)) return "city";
  if (/home|unit|bedroom|type|وحدة/.test(k)) return "home";
  return "other";
}
const LABEL = { budget: "Budget", timing: "When they plan to buy", payment: "Payment", purpose: "Live or invest", city: "City", home: "Home type", other: "Other question" };

/** Per lead: does the form say budget fits / buying soon? (null when the question was not asked) */
export function signals(lead, catalog) {
  const out = { budgetOk: null, soon: null, cashMismatch: false };
  const p = catalog?.projects?.find((x) => x.id === lead.project);
  for (const [k, v] of Object.entries(lead.answers || {})) {
    const t = questionType(k);
    const a = String(v || "");
    if (t === "budget") out.budgetOk = !/below|less than|under|أقل/i.test(a);
    if (t === "timing") out.soon = /\bnow\b|immediately|within 3|this month|فور|خلال ?3/i.test(a) ? true : /later|more than 6|6\+|not sure|بعد/i.test(a) ? false : /3 ?(to|-) ?6/i.test(a) ? false : null;
    if (t === "payment" && p?.cashOnly && /install|no,? i need|تقسيط/i.test(a)) out.cashMismatch = true;
  }
  return out;
}
const strong = (s) => s.budgetOk !== false && s.soon !== false && !s.cashMismatch && (s.budgetOk === true || s.soon === true);

function inRange(l) {
  if (range === "all") return true;
  return Date.now() - new Date(l.created).getTime() <= Number(range) * 86400000;
}

export function byCampaign(leads, catalog) {
  const g = {};
  for (const l of leads) {
    if (!l.answers || !Object.keys(l.answers).length) continue;
    const key = l.campaignId || l.campaignName || "Unknown campaign";
    const r = (g[key] ??= { key, name: l.campaignName || key, project: projectFromName(l.campaignName, catalog)?.name || "", leads: 0, budgetAsked: 0, budgetOk: 0, timingAsked: 0, soon: 0, strong: 0, contacted: 0, valid: 0 });
    const s = signals(l, catalog);
    r.leads += 1;
    if (s.budgetOk !== null) {
      r.budgetAsked += 1;
      if (s.budgetOk) r.budgetOk += 1;
    }
    if (s.soon !== null) {
      r.timingAsked += 1;
      if (s.soon) r.soon += 1;
    }
    if (strong(s)) r.strong += 1;
    if (l.stage !== "new" && l.stage !== "no_answer") {
      r.contacted += 1;
      if (isValid(l.stage)) r.valid += 1;
    }
  }
  return Object.values(g).sort((a, b) => b.leads - a.leads);
}

/** For every question: each answer, how many picked it, and how many of those turned valid. */
export function answerTable(leads) {
  const q = {};
  for (const l of leads) {
    const contacted = l.stage !== "new" && l.stage !== "no_answer";
    for (const [k, v] of Object.entries(l.answers || {})) {
      const t = questionType(k);
      if (t === "other" && Object.keys(l.answers).length > 6) continue;
      const qq = (q[k] ??= { key: k, type: t, total: 0, answers: {} });
      const a = (qq.answers[String(v)] ??= { answer: String(v), n: 0, contacted: 0, valid: 0 });
      qq.total += 1;
      a.n += 1;
      if (contacted) {
        a.contacted += 1;
        if (isValid(l.stage)) a.valid += 1;
      }
    }
  }
  const order = ["budget", "timing", "payment", "purpose", "home", "city", "other"];
  return Object.values(q).sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
}

export function render(ctx) {
  const list = allLeads().filter((l) => inRange(l) && l.answers && Object.keys(l.answers).length);
  const camps = byCampaign(list, ctx.catalog);
  const scoped = campaign ? list.filter((l) => (l.campaignId || l.campaignName) === campaign) : list;
  const table = answerTable(scoped);
  // Does a "strong" form predict a valid lead?
  const contacted = scoped.filter((l) => l.stage !== "new" && l.stage !== "no_answer");
  const st = contacted.filter((l) => strong(signals(l, ctx.catalog)));
  const wk = contacted.filter((l) => !strong(signals(l, ctx.catalog)));
  const rate = (xs) => (xs.length ? (xs.filter((l) => isValid(l.stage)).length / xs.length) * 100 : null);
  const rs = rate(st);
  const rw = rate(wk);
  const best = [...camps].filter((c) => c.leads >= 10).sort((a, b) => b.strong / b.leads - a.strong / a.leads)[0];
  const worst = [...camps].filter((c) => c.leads >= 10).sort((a, b) => a.strong / a.leads - b.strong / b.leads)[0];
  const top = html`<div class="top"><div><h1>Lead form answers</h1><p class="sub">What people picked on your forms, before anyone called them, per campaign. A strong form says the budget fits and they plan to buy within 3 months. The right column shows how often each answer really turned into a valid lead.</p></div>
    <div class="top-actions"><div class="seg" role="group" aria-label="Dates">${[["7", "7 days"], ["30", "30 days"], ["90", "90 days"], ["all", "All time"]].map(([v, l]) => html`<button type="button" data-frange="${v}" aria-pressed="${range === v}">${l}</button>`)}</div></div></div>`;
  if (!list.length) return html`${top}<div class="card empty"><h3>No form answers yet</h3><p>Answers arrive with leads from Meta's instant forms (Leads & CRM → Get new leads from Meta, or import Meta's lead download).</p></div>`;
  const notes = [];
  if (rs !== null && rw !== null && st.length >= 10 && wk.length >= 10)
    notes.push(rs > rw * 1.3 ? { tone: "good", title: `Strong forms turn valid ${pct(rs, 0)} of the time, others ${pct(rw, 0)}`, text: "Your form questions are doing their job. Call strong-form leads first, and keep these questions." } : { tone: "warn", title: "The form answers barely predict who is valid", text: `${pct(rs, 0)} valid for strong forms against ${pct(rw, 0)} for the others. Make the budget options sharper (use the project's real starting price) and switch the form to Higher intent.` });
  if (best && worst && best.key !== worst.key && best.strong / best.leads > (worst.strong / worst.leads) * 1.4)
    notes.push({ tone: "info", title: `${best.name} brings the strongest forms`, text: `${pct((best.strong / best.leads) * 100, 0)} strong against ${pct((worst.strong / worst.leads) * 100, 0)} for ${worst.name}. If the calls confirm it, move budget toward ${best.name}.` });
  return html`${top}
  ${notes.length ? html`<div class="card"><div class="alerts">${notes.map((a) => html`<div class="alert ${a.tone}"><span class="dot"></span><div class="grow"><b>${a.title}</b><p>${a.text}</p></div></div>`)}</div></div>` : ""}
  <div class="card"><div class="card-head"><div><h2>By campaign</h2><p>${n(list.length)} leads with form answers. Click a campaign to see its answers below.</p></div></div>
    <div class="table-wrap"><table><thead><tr><th>Campaign</th><th class="n">Leads</th><th class="n">Budget fits</th><th class="n">Buying ≤ 3 months</th><th class="n">Strong form</th><th class="n">Valid after the call</th></tr></thead><tbody>
    ${camps.map((c) => html`<tr data-fcamp="${c.key}" style="cursor:pointer" ${campaign === c.key ? raw('class="sub"') : ""}><td><div class="name">${c.name}</div><div class="tiny muted">${c.project}</div></td><td class="n">${n(c.leads)}</td><td class="n">${c.budgetAsked ? pct((c.budgetOk / c.budgetAsked) * 100, 0) : "not asked"}</td><td class="n">${c.timingAsked ? pct((c.soon / c.timingAsked) * 100, 0) : "not asked"}</td><td class="n"><b>${pct((c.strong / c.leads) * 100, 0)}</b></td><td class="n">${c.contacted ? `${pct((c.valid / c.contacted) * 100, 0)} of ${n(c.contacted)}` : "not called yet"}</td></tr>`)}
    </tbody></table></div>
  </div>
  <div class="card viz"><div class="card-head"><div><h2>Answers ${campaign ? `· ${camps.find((c) => c.key === campaign)?.name || ""}` : "· all campaigns"}</h2><p>How many picked each answer, and how many of those were valid after the call.</p></div>${campaign ? html`<button class="btn sm" type="button" data-fall>All campaigns</button>` : ""}</div>
    <div class="grid g2">${table.map((q) => {
      const max = Math.max(...Object.values(q.answers).map((a) => a.n));
      return html`<div><h3 style="margin-bottom:6px">${LABEL[q.type] === "Other question" ? tidy(q.key) : LABEL[q.type]}</h3>
        <div class="hbars">${Object.values(q.answers).sort((a, b) => b.n - a.n).slice(0, 8).map((a) => html`<div class="hbar"><span class="hbar-name" title="${a.answer}" dir="auto">${a.answer}</span><span class="hbar-track"><i style="width:${(a.n / max) * 100}%"></i></span><span class="hbar-val">${n(a.n)}</span><span class="hbar-sub">${a.contacted ? `${pct((a.valid / a.contacted) * 100, 0)} valid of ${n(a.contacted)} called` : "not called yet"}</span></div>`)}</div></div>`;
    })}</div>
  </div>`;
}

export function mount(root, ctx) {
  root.onclick = (e) => {
    const r = e.target.closest("[data-frange]");
    if (r) {
      range = r.dataset.frange;
      return ctx.render();
    }
    const c = e.target.closest("[data-fcamp]");
    if (c) {
      campaign = campaign === c.dataset.fcamp ? "" : c.dataset.fcamp;
      return ctx.render();
    }
    if (e.target.closest("[data-fall]")) {
      campaign = "";
      ctx.render();
    }
  };
}
