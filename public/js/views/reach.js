// Who & where: Meta's delivery report split by age × gender, by country and by
// governorate, with your own leads placed by their phone's country code.
// Answers three questions: who answers the ads (and at what cost), where the
// money went, and where overseas demand comes from. Each chart comes with
// plain findings that say what to change.
import { html, raw, money, n, pct, $ } from "../ui.js";
import { get } from "../api.js";
import { allLeads, isValid, treeDates } from "../model.js";
import { govName, iso3, countryName, phoneCountry, GULF } from "../places.js";
import { connectCard, loadingCard } from "./common.js";

let campaign = ""; // "" = all campaigns
let ageMetric = "leads"; // leads | spend | cpl
let worldMetric = "leads"; // leads | spend | cpl | mine
let world = null;
const filtered = new Map(); // `${period}|${campaign}` -> breakdowns for one campaign
let loadingKey = "";

const AGES = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
const res = (r) => (r.leads || 0) + (r.convos || 0);
const cpl = (spend, leads) => (leads > 0 ? spend / leads : null);

async function ensureWorld(ctx) {
  if (world) return;
  world = "loading";
  try {
    world = await fetch("/data/world-map.json", { credentials: "same-origin" }).then((r) => r.json());
  } catch {
    world = null;
  }
  ctx.render();
}

function dataFor(ctx) {
  if (!campaign) return { bd: ctx.breakdowns, error: ctx.breakdownsError };
  const key = `${ctx.period}|${campaign}`;
  if (filtered.has(key)) return { bd: filtered.get(key) };
  if (loadingKey !== key) {
    loadingKey = key;
    get("/api/breakdowns", { range: ctx.period, campaign })
      .then((v) => filtered.set(key, v))
      .catch((e) => filtered.set(key, { error: e.message }))
      .finally(() => {
        loadingKey = "";
        ctx.render();
      });
  }
  return { bd: null, loading: true };
}

// ---------------------------------------------------------------- shaping the numbers
function audience(bd) {
  const rows = {};
  for (const a of AGES) rows[a] = { male: { spend: 0, leads: 0, impressions: 0 }, female: { spend: 0, leads: 0, impressions: 0 } };
  let unknown = 0;
  for (const r of bd?.ageGender || []) {
    if (!rows[r.age]) continue;
    if (r.gender !== "male" && r.gender !== "female") {
      unknown += r.spend || 0;
      continue;
    }
    const c = rows[r.age][r.gender];
    c.spend += r.spend || 0;
    c.leads += res(r);
    c.impressions += r.impressions || 0;
  }
  return { rows, unknown };
}

function countries(bd, leadsIn) {
  const out = {};
  const get2 = (iso2) => (out[iso2] ??= { iso2, spend: 0, leads: 0, impressions: 0, mine: 0, valid: 0 });
  for (const r of bd?.country || []) {
    const c = get2(String(r.country || "").toUpperCase());
    c.spend += r.spend || 0;
    c.leads += res(r);
    c.impressions += r.impressions || 0;
  }
  for (const l of leadsIn) {
    const iso2 = phoneCountry(l.phone);
    if (!iso2) continue;
    const c = get2(iso2);
    c.mine += 1;
    if (isValid(l.stage)) c.valid += 1;
  }
  return Object.values(out);
}

function governorates(bd) {
  const out = {};
  for (const r of bd?.region || []) {
    const g = govName(r.region);
    if (!g) continue;
    const o = (out[g] ??= { name: g, spend: 0, leads: 0 });
    o.spend += r.spend || 0;
    o.leads += res(r);
  }
  return Object.values(out).sort((a, b) => b.spend - a.spend);
}

// ---------------------------------------------------------------- findings
function findings(aud, ctry, govs) {
  const out = [];
  // Ages: cost per lead by age group (both genders), only groups with enough leads.
  const byAge = AGES.map((a) => {
    const s = aud.rows[a].male.spend + aud.rows[a].female.spend;
    const l = aud.rows[a].male.leads + aud.rows[a].female.leads;
    return { a, s, l, c: cpl(s, l) };
  }).filter((x) => x.l >= 5);
  if (byAge.length >= 2) {
    const best = [...byAge].sort((x, y) => x.c - y.c)[0];
    const worst = [...byAge].sort((x, y) => y.c - x.c)[0];
    if (worst.c > best.c * 1.3)
      out.push({ tone: "good", title: `Ages ${best.a} bring the cheapest leads`, text: `${money(best.c)} per lead against ${money(worst.c)} for ${worst.a}. If ${worst.a} also brings few valid leads in your Leads list, narrow the ages or move budget toward ${best.a}. Cheap leads only count if they turn valid, so check both.` });
  }
  // Gender
  const sum = (g, k) => AGES.reduce((t, a) => t + aud.rows[a][g][k], 0);
  const cm = cpl(sum("male", "spend"), sum("male", "leads"));
  const cf = cpl(sum("female", "spend"), sum("female", "leads"));
  if (cm && cf && sum("male", "leads") >= 5 && sum("female", "leads") >= 5) {
    const [lo, hi, loC, hiC] = cm < cf ? ["Men", "women", cm, cf] : ["Women", "men", cf, cm];
    if (hiC > loC * 1.2) out.push({ tone: "info", title: `${lo} answer for less`, text: `${money(loC)} per lead against ${money(hiC)} for ${hi}. Keep both genders unless ${hi} also turn valid less often. Buying decisions are often made together.` });
  }
  // Overseas
  const total = ctry.reduce((t, c) => t + c.spend, 0);
  const eg = ctry.find((c) => c.iso2 === "EG");
  const abroad = ctry.filter((c) => c.iso2 !== "EG");
  const abroadSpend = abroad.reduce((t, c) => t + c.spend, 0);
  const abroadLeads = abroad.reduce((t, c) => t + c.leads, 0);
  if (total > 0 && abroadSpend > 0) {
    const cA = cpl(abroadSpend, abroadLeads);
    const cE = eg ? cpl(eg.spend, eg.leads) : null;
    out.push({ tone: cA && cE && cA > cE * 1.5 ? "warn" : "info", title: `${pct((abroadSpend / total) * 100, 0)} of spend went abroad`, text: `${money(abroadSpend)} outside Egypt for ${n(abroadLeads)} leads${cA ? ` (${money(cA)} each` : ""}${cE ? `, against ${money(cE)} in Egypt)` : cA ? ")" : ""}. Gulf leads cost more but often have bigger budgets. Judge them by valid leads and reservations, not cost per lead.` });
  }
  const mineAbroad = abroad.filter((c) => c.mine > 0).sort((a, b) => b.mine - a.mine);
  if (mineAbroad.length) {
    const top = mineAbroad[0];
    const validAbroad = abroad.reduce((t, c) => t + c.valid, 0);
    const mineA = abroad.reduce((t, c) => t + c.mine, 0);
    out.push({ tone: "info", title: `${n(mineA)} of your leads have foreign numbers`, text: `Most from ${countryName(top.iso2)} (${n(top.mine)}). ${n(validAbroad)} of them are valid (${pct(mineA ? (validAbroad / mineA) * 100 : null, 0)}). Call them at a time that suits their time zone, and offer a video call of the show unit.` });
  }
  // Governorates where spend share is far above lead share
  const gTotalS = govs.reduce((t, g) => t + g.spend, 0);
  const gTotalL = govs.reduce((t, g) => t + g.leads, 0);
  if (gTotalS > 0 && gTotalL >= 10) {
    const waste = govs.filter((g) => g.spend / gTotalS >= 0.05 && g.leads / gTotalL < (g.spend / gTotalS) * 0.5).sort((a, b) => b.spend - a.spend)[0];
    if (waste) out.push({ tone: "warn", title: `${waste.name} takes ${pct((waste.spend / gTotalS) * 100, 0)} of spend but gives ${pct((waste.leads / gTotalL) * 100, 0)} of leads`, text: `Check which ad sets reach ${waste.name} (Egypt & GCC map), then tighten the radius or exclude it if those leads are not valid.` });
    const top = govs[0];
    if (top) out.push({ tone: "info", title: `Most money went to ${top.name}`, text: `${money(top.spend)} (${pct((top.spend / gTotalS) * 100, 0)} of spend in Egypt) for ${n(top.leads)} leads.` });
  }
  return out;
}

// ---------------------------------------------------------------- charts
const metricOf = (c, m) => (m === "spend" ? c.spend : m === "cpl" ? cpl(c.spend, c.leads) : c.leads);
const fmtOf = (v, m) => (v === null || v === undefined ? "—" : m === "leads" || m === "mine" ? n(v) : money(v, { short: true }));

function pyramid(aud) {
  const vals = AGES.flatMap((a) => [metricOf(aud.rows[a].male, ageMetric), metricOf(aud.rows[a].female, ageMetric)]).filter((v) => v !== null);
  const max = Math.max(1, ...vals);
  const row = (a) => {
    const m = aud.rows[a].male;
    const f = aud.rows[a].female;
    const mv = metricOf(m, ageMetric);
    const fv = metricOf(f, ageMetric);
    const tip = (g, c) => `${g}, ${a}\nSpend ${money(c.spend)}\nLeads ${n(c.leads)}\nCost per lead ${money(cpl(c.spend, c.leads))}`;
    return html`<div class="pyr-row">
      <div class="pyr-side left"><span class="pyr-val">${fmtOf(mv, ageMetric)}</span><i class="pyr-bar men" style="width:${mv ? Math.max(2, (mv / max) * 100) : 0}%" data-tip="${tip("Men", m)}" tabindex="0"></i></div>
      <div class="pyr-age">${a}</div>
      <div class="pyr-side right"><i class="pyr-bar women" style="width:${fv ? Math.max(2, (fv / max) * 100) : 0}%" data-tip="${tip("Women", f)}" tabindex="0"></i><span class="pyr-val">${fmtOf(fv, ageMetric)}</span></div>
    </div>`;
  };
  return html`<div class="pyramid" role="img" aria-label="Results by age group: men on the left, women on the right">
    <div class="pyr-head"><span class="legend"><i class="sw men"></i>Men</span><span class="muted small">Age</span><span class="legend"><i class="sw women"></i>Women</span></div>
    ${[...AGES].reverse().map(row)}
  </div>`;
}

function audienceTable(aud) {
  return html`<div class="table-wrap" style="margin-top:10px"><table><thead><tr><th>Age</th><th class="n">Men · spend</th><th class="n">Men · leads</th><th class="n">Men · CPL</th><th class="n">Women · spend</th><th class="n">Women · leads</th><th class="n">Women · CPL</th></tr></thead><tbody>
    ${AGES.map((a) => {
      const m = aud.rows[a].male;
      const f = aud.rows[a].female;
      return html`<tr><td class="name">${a}</td><td class="n">${money(m.spend)}</td><td class="n">${n(m.leads)}</td><td class="n">${money(cpl(m.spend, m.leads))}</td><td class="n">${money(f.spend)}</td><td class="n">${n(f.leads)}</td><td class="n">${money(cpl(f.spend, f.leads))}</td></tr>`;
    })}</tbody></table></div>`;
}

// Five light-to-dark steps of one hue; Egypt (the home market) is drawn apart so it does not flatten the overseas scale.
function worldMap(ctry, zoom) {
  if (!world || world === "loading") return html`<div class="skeleton" style="height:220px"></div>`;
  const byIso3 = {};
  for (const c of ctry) {
    const i3 = iso3(c.iso2);
    if (i3) byIso3[i3] = c;
  }
  const mineVal = (c) => (worldMetric === "mine" ? c.mine : metricOf(c, worldMetric));
  const pos = ctry.filter((c) => c.iso2 !== "EG").map(mineVal).filter((v) => v > 0).sort((a, b) => a - b);
  const step = (v) => {
    if (!(v > 0) || !pos.length) return 0;
    const q = pos.findIndex((x) => x >= v);
    return 1 + Math.min(4, Math.floor(((q < 0 ? pos.length - 1 : q) / Math.max(1, pos.length)) * 5));
  };
  const ys = world.yScale;
  let vb = world.viewBox;
  if (zoom) {
    // Egypt, the Gulf and the Levant.
    vb = [418.7, 78.1, 81.1, 64.5];
  }
  const shapes = world.countries.map((c) => {
    const d = byIso3[c.i];
    const home = c.i === "EGY";
    const v = d ? mineVal(d) : 0;
    const s = home ? "home" : step(v);
    const tip = d
      ? `${c.n}\nSpend ${money(d.spend)}\nMeta leads ${n(d.leads)}\nCost per lead ${money(cpl(d.spend, d.leads))}\nYour leads (phone) ${n(d.mine)} · valid ${n(d.valid)}`
      : `${c.n}\nNo spend or leads`;
    return html`<path d="${c.d}" class="wm s${s}" data-tip="${tip}" ${d || home ? raw('tabindex="0"') : ""}></path>`;
  });
  return html`<svg class="worldmap" viewBox="${vb.join(" ")}" role="img" aria-label="${zoom ? "Middle East and Gulf" : "World"} map of overseas results" preserveAspectRatio="xMidYMid meet"><g transform="scale(1 ${ys})">${shapes}</g></svg>`;
}

function countryTable(ctry) {
  const rows = [...ctry].sort((a, b) => b.spend - a.spend || b.mine - a.mine).slice(0, 12);
  if (!rows.length) return html`<p class="muted small">No country data for these dates.</p>`;
  return html`<div class="table-wrap"><table><thead><tr><th>Country</th><th class="n">Spend</th><th class="n">Meta leads</th><th class="n">CPL</th><th class="n">Your leads</th><th class="n">Valid</th></tr></thead><tbody>
  ${rows.map((c) => html`<tr><td class="name">${countryName(c.iso2)}${GULF.has(c.iso2) ? html` <span class="pill line">Gulf</span>` : ""}</td><td class="n">${money(c.spend)}</td><td class="n">${n(c.leads)}</td><td class="n">${money(cpl(c.spend, c.leads))}</td><td class="n">${n(c.mine)}</td><td class="n"><b>${n(c.valid)}</b></td></tr>`)}
  </tbody></table></div>`;
}

function govBars(govs) {
  if (!govs.length) return html`<p class="muted small">Meta returned no governorate split for these dates.</p>`;
  const max = Math.max(...govs.map((g) => g.spend));
  const total = govs.reduce((t, g) => t + g.spend, 0);
  return html`<div class="hbars">${govs.slice(0, 12).map(
    (g) => html`<div class="hbar" data-tip="${g.name}\nSpend ${money(g.spend)} (${pct((g.spend / total) * 100, 1)})\nLeads ${n(g.leads)}\nCost per lead ${money(cpl(g.spend, g.leads))}" tabindex="0">
      <span class="hbar-name">${g.name}</span><span class="hbar-track"><i style="width:${Math.max(1.5, (g.spend / max) * 100)}%"></i></span><span class="hbar-val">${money(g.spend, { short: true })}</span><span class="hbar-sub">${n(g.leads)} leads · ${money(cpl(g.spend, g.leads), { short: true })}</span>
    </div>`,
  )}</div>`;
}

// ---------------------------------------------------------------- screen
export function render(ctx) {
  ensureWorld(ctx);
  const camps = ctx.tree?.campaigns || [];
  const top = html`<div class="top"><div><h1>Who &amp; where</h1><p class="sub">Who answers your ads by age and gender, where the money went in Egypt, and where overseas demand comes from. From Meta's own delivery report; your leads are placed by their phone's country code.</p></div>
    <div class="top-actions">${ctx.settings?.connected ? html`${ctx.periodSwitch()}${ctx.refreshButton()}` : ""}</div></div>`;
  if (!ctx.settings) return html`${top}${loadingCard()}`;
  if (!ctx.settings.connected) return html`${top}${connectCard(ctx.settings)}`;
  if (!ctx.tree) return html`${top}${loadingCard()}`;

  const { bd, error, loading } = dataFor(ctx);
  const filter = html`<div class="row wrap" style="margin-bottom:12px"><label class="row small"><span class="muted">Campaign</span>
    <select class="input" style="width:auto;min-height:32px" data-campaign><option value="">All campaigns</option>${camps.map((c) => html`<option value="${c.id}" ${c.id === campaign ? raw("selected") : ""}>${c.name}</option>`)}</select></label></div>`;
  if (loading || (!bd && !error && !ctx.breakdownsError)) return html`${top}${filter}${loadingCard()}`;
  if (error || bd?.error) return html`${top}${filter}<div class="note bad"><b>Meta's delivery report could not be loaded.</b> ${error || bd.error}</div>`;

  const { since, until } = treeDates(ctx.tree);
  const leadsIn = allLeads().filter((l) => {
    const d = String(l.created || "").slice(0, 10);
    if (campaign && l.campaignId !== campaign) return false;
    return (!since || d >= since) && (!until || d <= until);
  });
  const aud = audience(bd);
  const ctry = countries(bd, leadsIn);
  const govs = governorates(bd);
  const tips = findings(aud, ctry, govs);
  const seg = (name, cur, opts) => html`<div class="seg" role="group" aria-label="${name}">${opts.map(([v, l]) => html`<button type="button" data-${raw(name)}="${v}" aria-pressed="${cur === v}">${l}</button>`)}</div>`;

  return html`${top}${filter}
  <div class="card"><div class="card-head"><div><h2>What this tells you</h2><p>${since || ""} to ${until || ""}${campaign ? " · one campaign" : " · all campaigns"}. Check against valid leads before moving money.</p></div></div>
    ${tips.length ? html`<div class="alerts">${tips.map((a) => html`<div class="alert ${a.tone}"><span class="dot"></span><div class="grow"><b>${a.title}</b><p>${a.text}</p></div></div>`)}</div>` : html`<p class="muted small">Not enough results in these dates to draw conclusions yet.</p>`}
  </div>
  <div class="grid g2">
    <div class="card viz"><div class="card-head"><div><h2>Who answers: age and gender</h2><p>Meta's results by age group, men on the left and women on the right.</p></div>${seg("agemetric", ageMetric, [["leads", "Leads"], ["spend", "Spend"], ["cpl", "Cost per lead"]])}</div>
      ${pyramid(aud)}
      ${aud.unknown > 0 ? html`<p class="tiny faint" style="margin-top:6px">${money(aud.unknown)} went to people whose gender Meta does not know. It is left out of the chart.</p>` : ""}
      <details style="margin-top:8px"><summary class="small muted">Show as a table</summary>${audienceTable(aud)}</details>
    </div>
    <div class="card viz"><div class="card-head"><div><h2>Where the money went in Egypt</h2><p>Spend by governorate from Meta. The full map is on <a href="#/geo">Egypt &amp; GCC Map</a>.</p></div></div>
      ${govBars(govs)}
    </div>
  </div>
  <div class="card viz"><div class="card-head"><div><h2>Overseas leads and requests</h2><p>Darker means more. Egypt, your home market, is shown apart so the other countries can be compared. "Your leads" counts the leads in your list by phone country.</p></div>${seg("worldmetric", worldMetric, [["leads", "Meta leads"], ["spend", "Spend"], ["cpl", "Cost per lead"], ["mine", "Your leads"]])}</div>
    <div class="maps2"><div><div class="tiny muted" style="margin-bottom:4px">World</div>${worldMap(ctry, false)}</div><div><div class="tiny muted" style="margin-bottom:4px">Middle East &amp; Gulf</div>${worldMap(ctry, true)}</div></div>
    <div class="row wrap small muted" style="margin:8px 0 12px;gap:12px"><span class="legend"><i class="sw home"></i>Egypt (home market)</span><span class="legend"><i class="sw s1"></i>Less</span><span class="legend"><i class="sw s3"></i></span><span class="legend"><i class="sw s5"></i>More</span><span class="legend"><i class="sw s0"></i>None</span></div>
    ${countryTable(ctry)}
  </div>
  <div class="viztip" role="tooltip" hidden></div>`;
}

export function mount(root, ctx) {
  const tip = $(".viztip", root);
  const show = (el, x, y) => {
    if (!tip) return;
    tip.textContent = el.dataset.tip;
    tip.hidden = false;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    tip.style.left = `${Math.min(window.innerWidth - w - 8, Math.max(8, x + 14))}px`;
    tip.style.top = `${Math.max(8, y - h - 12)}px`;
  };
  root.onpointermove = (e) => {
    const el = e.target.closest?.("[data-tip]");
    if (el) show(el, e.clientX, e.clientY);
    else if (tip) tip.hidden = true;
  };
  root.onpointerleave = () => tip && (tip.hidden = true);
  root.onfocusin = (e) => {
    const el = e.target.closest?.("[data-tip]");
    if (!el) return;
    const b = el.getBoundingClientRect();
    show(el, b.left + b.width / 2, b.top);
  };
  root.onfocusout = () => tip && (tip.hidden = true);
  root.onchange = (e) => {
    if (e.target.matches("[data-campaign]")) {
      campaign = e.target.value;
      ctx.render();
    }
  };
  root.onclick = (e) => {
    const a = e.target.closest("[data-agemetric]");
    if (a) {
      ageMetric = a.dataset.agemetric;
      return ctx.render();
    }
    const w = e.target.closest("[data-worldmetric]");
    if (w) {
      worldMetric = w.dataset.worldmetric;
      return ctx.render();
    }
  };
}

export const _test = { audience, countries, governorates, findings };
