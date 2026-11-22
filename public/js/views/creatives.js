// Creative library: every ad with its hook, headline, format and results,
// tagged by angle (what the ad sells: price, payment plan, lifestyle…). The
// angle table shows which kinds of message bring valid leads cheapest, per
// project. Tags are suggested from the words in the ad and can be corrected.
import { html, raw, money, n, pct } from "../ui.js";
import { load, save } from "../store.js";
import { allLeads, quality, treeDates, projectFromName } from "../model.js";
import { connectCard, loadingCard, statusPill } from "./common.js";

export const ANGLES = [
  ["price", "Price", /\bfrom\b|\begp\b|price|مليون|جنيه|تبدأ/i],
  ["plan", "Payment plan", /\d+\s?%\s?(down|مقدم)|down payment|installment|years? to pay|\b\d+ years\b|تقسيط|مقدم|سنين/i],
  ["cash", "Cash discount", /\bcash\b|كاش|% off/i],
  ["lifestyle", "Lifestyle", /\blife\b|living|famil|quiet|garden|pool|beach|summer|walk|calm/i],
  ["location", "Location", /boulevard|new ?cairo|newkairo|zayed|ras el hekma|ghazala|location|minutes from|tram/i],
  ["view", "View", /\bviews?\b|golf|fairway|lagoon|sea\b|lake/i],
  ["service", "Hotel service", /serviced|hotel|concierge|housekeeping|managed|looked after|فندقية/i],
  ["school", "Schools & clubs", /school|club|مدرسة|نادي/i],
  ["homes", "Homes & finishing", /bedroom|fully finished|finishing|layout|townhouse|villa|chalet|apartment|duplex|penthouse|شقة|فيلا|شاليه|متشطب/i],
  ["ready", "Ready to move", /ready|delivered|handover|move in|استلام فوري/i],
  ["abroad", "For expats", /abroad|gulf|expat|while you('|’)re away|from riyadh|from dubai/i],
  ["urgency", "Urgency", /\blast\b|limited|this month|launch|only \d|still thinking/i],
];
const ANGLE = Object.fromEntries(ANGLES.map(([k, l]) => [k, l]));

let project = "";
let sortBy = "cpvl";

export function suggestAngles(text) {
  return ANGLES.filter(([, , re]) => re.test(text || "")).map(([k]) => k);
}
export function formatOf(ad) {
  const t = `${ad.name} ${ad.creative?.type || ""}`.toLowerCase();
  if (/carousel/.test(t)) return "Carousel";
  if (/film|video|reel|tour|\b\d+s\b/.test(t) || ad.creative?.type === "VIDEO") return "Video";
  return "Image";
}

/** One row per ad name (the same creative running in several ad sets is added up). */
export function library(tree, leads, catalog) {
  const { since, until } = treeDates(tree);
  const q = quality(leads, since, until);
  const tags = load("creativeTags", {});
  const rows = {};
  for (const c of tree?.campaigns || []) {
    const p = projectFromName(c.name, catalog);
    for (const s of c.adsets)
      for (const a of s.ads) {
        const r = (rows[a.name] ??= { name: a.name, project: p?.id || "", projectName: p?.name || "Other", body: a.creative?.body || "", title: a.creative?.title || "", thumb: a.creative?.thumb || null, format: formatOf(a), spend: 0, impressions: 0, clicks: 0, leads: 0, valid: 0, meetings: 0, places: 0, on: 0, statuses: new Set() });
        const m = a.m || {};
        r.spend += m.spend || 0;
        r.impressions += m.impressions || 0;
        r.clicks += m.linkClicks || 0;
        r.leads += (m.leads || 0) + (m.convos || 0);
        r.valid += q.ad[a.id]?.valid || 0;
        r.meetings += q.ad[a.id]?.meetings || 0;
        r.places += 1;
        if (a.status === "ACTIVE") r.on += 1;
        r.statuses.add(a.effectiveStatus);
      }
  }
  return Object.values(rows).map((r) => {
    const auto = suggestAngles(`${r.name.replace(/[-_]/g, " ")} ${r.body} ${r.title}`);
    const angles = tags[r.name] || auto;
    return { ...r, auto, angles, edited: Boolean(tags[r.name]), cpl: r.leads ? r.spend / r.leads : null, cpvl: r.valid ? r.spend / r.valid : null, ctr: r.impressions ? (r.clicks / r.impressions) * 100 : null };
  });
}

export function byGroup(rows, keyOf) {
  const g = {};
  for (const r of rows) {
    for (const k of keyOf(r)) {
      const x = (g[k] ??= { key: k, ads: 0, spend: 0, impressions: 0, clicks: 0, leads: 0, valid: 0 });
      x.ads += 1;
      x.spend += r.spend;
      x.impressions += r.impressions;
      x.clicks += r.clicks;
      x.leads += r.leads;
      x.valid += r.valid;
    }
  }
  return Object.values(g)
    .map((x) => ({ ...x, cpl: x.leads ? x.spend / x.leads : null, cpvl: x.valid ? x.spend / x.valid : null, ctr: x.impressions ? (x.clicks / x.impressions) * 100 : null }))
    .filter((x) => x.spend > 0);
}

function groupTable(list, label, nameOf) {
  const ranked = [...list].sort((a, b) => (a.cpvl ?? Infinity) - (b.cpvl ?? Infinity) || (a.cpl ?? Infinity) - (b.cpl ?? Infinity));
  const max = Math.max(1, ...ranked.map((x) => x.cpvl || 0));
  const best = ranked.find((x) => x.valid >= 2 && x.ads >= 2);
  return html`<div class="table-wrap"><table><thead><tr><th>${label}</th><th>Cost per valid lead (shorter is better)</th><th class="n">Ads</th><th class="n">Spend</th><th class="n">CTR</th><th class="n">Leads</th><th class="n">CPL</th><th class="n">Valid</th></tr></thead><tbody>
    ${ranked.map((x) => html`<tr><td class="name">${nameOf(x.key)}${best && x.key === best.key ? html` <span class="pill good">Best</span>` : ""}</td><td style="min-width:150px"><div class="abbar"><i class="${best && x.key === best.key ? "lead" : ""}" style="width:${x.cpvl ? Math.max(3, (x.cpvl / max) * 100) : 0}%"></i><span>${x.cpvl ? money(x.cpvl) : "no valid leads yet"}</span></div></td><td class="n">${n(x.ads)}</td><td class="n">${money(x.spend)}</td><td class="n">${pct(x.ctr, 2)}</td><td class="n">${n(x.leads)}</td><td class="n">${money(x.cpl)}</td><td class="n"><b>${n(x.valid)}</b></td></tr>`)}
  </tbody></table></div>`;
}

function findings(angles, formats) {
  const out = [];
  // One ad is too thin to call an angle the winner: at least 2 ads and 2 valid leads.
  const a = angles.filter((x) => x.valid >= 2 && x.ads >= 2 && x.cpvl).sort((x, y) => x.cpvl - y.cpvl);
  if (a.length >= 2 && a[a.length - 1].cpvl > a[0].cpvl * 1.25)
    out.push({ tone: "good", title: `"${ANGLE[a[0].key]}" ads bring valid leads cheapest`, text: `${money(a[0].cpvl)} per valid lead against ${money(a[a.length - 1].cpvl)} for "${ANGLE[a[a.length - 1].key]}". Make the next new versions lead with ${ANGLE[a[0].key].toLowerCase()}, and test it against your current best ad.` });
  const cheapLeads = angles.filter((x) => x.leads >= 10 && x.cpl).sort((x, y) => x.cpl - y.cpl)[0];
  if (cheapLeads && a.length && cheapLeads.key !== a[0].key && (cheapLeads.cpvl === null || cheapLeads.cpvl > a[0].cpvl * 1.25))
    out.push({ tone: "warn", title: `Cheapest leads are not the best leads`, text: `"${ANGLE[cheapLeads.key]}" ads have the lowest cost per lead (${money(cheapLeads.cpl)}) but ${cheapLeads.cpvl ? `cost ${money(cheapLeads.cpvl)} per valid lead` : "no valid leads yet"}. Judge creative on valid leads.` });
  const f = formats.filter((x) => x.valid >= 2 && x.cpvl).sort((x, y) => x.cpvl - y.cpvl);
  if (f.length >= 2 && f[f.length - 1].cpvl > f[0].cpvl * 1.2) out.push({ tone: "info", title: `${f[0].key} beats ${f[f.length - 1].key.toLowerCase()}`, text: `${money(f[0].cpvl)} against ${money(f[f.length - 1].cpvl)} per valid lead. Put more of the budget behind ${f[0].key.toLowerCase()} ads.` });
  const untagged = angles.length === 0;
  if (untagged) out.push({ tone: "info", title: "Tag your ads", text: "Add an angle to each ad below so the dashboard can compare messages." });
  return out;
}

export function render(ctx) {
  const top = html`<div class="top"><div><h1>Creative library</h1><p class="sub">Every ad with its hook and results, tagged by what it sells. Over time this is your record of which messages bring real buyers for each project.</p></div>
    <div class="top-actions">${ctx.settings?.connected ? html`${ctx.periodSwitch()}${ctx.refreshButton()}` : ""}</div></div>`;
  if (!ctx.settings) return html`${top}${loadingCard()}`;
  if (!ctx.settings.connected) return html`${top}${connectCard(ctx.settings)}`;
  if (!ctx.tree) return html`${top}${loadingCard()}`;
  const all = library(ctx.tree, allLeads(), ctx.catalog);
  const projects = [...new Set(all.map((r) => r.project).filter(Boolean))];
  const rows = all.filter((r) => !project || r.project === project);
  const angles = byGroup(rows, (r) => r.angles);
  const formats = byGroup(rows, (r) => [r.format]);
  const tips = findings(angles, formats);
  const sorted = [...rows].sort((a, b) => (sortBy === "spend" ? b.spend - a.spend : sortBy === "valid" ? b.valid - a.valid : (a.cpvl ?? Infinity) - (b.cpvl ?? Infinity) || b.spend - a.spend));
  return html`${top}
  <div class="row wrap" style="margin-bottom:12px;gap:10px">
    <label class="row small"><span class="muted">Project</span><select class="input" style="width:auto;min-height:32px" data-cproject><option value="">All projects</option>${projects.map((id) => html`<option value="${id}" ${id === project ? raw("selected") : ""}>${ctx.catalog?.projects?.find((p) => p.id === id)?.name || id}</option>`)}</select></label>
  </div>
  ${tips.length ? html`<div class="card"><div class="alerts">${tips.map((a) => html`<div class="alert ${a.tone}"><span class="dot"></span><div class="grow"><b>${a.title}</b><p>${a.text}</p></div></div>`)}</div></div>` : ""}
  <div class="grid g2">
    <div class="card viz"><div class="card-head"><div><h2>Angles that work</h2><p>An ad with two angles counts in both.</p></div></div>${angles.length ? groupTable(angles, "Angle", (k) => ANGLE[k] || k) : html`<p class="muted">No tagged ads with spend in these dates.</p>`}</div>
    <div class="card viz"><div class="card-head"><div><h2>Formats</h2><p>Video, image or carousel.</p></div></div>${formats.length ? groupTable(formats, "Format", (k) => k) : html`<p class="muted">No ads with spend.</p>`}</div>
  </div>
  <div class="card">
    <div class="card-head"><div><h2>All ads (${n(rows.length)})</h2><p>Click × to remove an angle or pick one to add. Your tags are kept in this browser.</p></div>
      <select class="input" style="width:auto;min-height:32px" data-csort aria-label="Sort"><option value="cpvl" ${sortBy === "cpvl" ? raw("selected") : ""}>Lowest cost per valid lead</option><option value="valid" ${sortBy === "valid" ? raw("selected") : ""}>Most valid leads</option><option value="spend" ${sortBy === "spend" ? raw("selected") : ""}>Most spend</option></select></div>
    <div class="cgrid">${sorted.map((r) => html`<div class="ccard">
      <div class="row" style="gap:10px;align-items:flex-start">${r.thumb ? html`<img class="cthumb" src="${r.thumb}" alt="" loading="lazy" referrerpolicy="no-referrer">` : html`<div class="cthumb ph">${r.format}</div>`}
        <div class="grow" style="min-width:0"><div class="name ell">${r.name}</div><div class="tiny muted">${r.projectName} · ${r.format} · ${r.on ? `on in ${r.on} of ${r.places}` : "off"}</div>${[...r.statuses].filter((x) => x && x !== "ACTIVE" && x !== "PAUSED").map((x) => statusPill(x))}</div></div>
      ${r.title ? html`<div class="small" style="margin-top:6px"><b>${r.title}</b></div>` : ""}
      ${r.body ? html`<div class="small muted chook" dir="auto">${r.body}</div>` : html`<div class="tiny faint" style="margin-top:4px">No text from Meta for this ad.</div>`}
      <div class="cstats"><span>${money(r.spend, { short: true })}<small>spend</small></span><span>${pct(r.ctr, 2)}<small>CTR</small></span><span>${n(r.leads)}<small>leads</small></span><span><b>${n(r.valid)}</b><small>valid</small></span><span><b>${r.cpvl ? money(r.cpvl, { short: true }) : "—"}</b><small>per valid</small></span></div>
      <div class="chips" style="margin-top:8px">${r.angles.map((k) => html`<span class="chip">${ANGLE[k] || k}<button type="button" aria-label="Remove ${ANGLE[k] || k}" data-rmtag="${r.name}" data-tag="${k}">×</button></span>`)}
        <select class="input ctag" data-addtag="${r.name}" aria-label="Add an angle"><option value="">+ angle</option>${ANGLES.filter(([k]) => !r.angles.includes(k)).map(([k, l]) => html`<option value="${k}">${l}</option>`)}</select>
        ${r.edited ? html`<button class="btn sm ghost" type="button" data-resettag="${r.name}" title="Back to the suggested angles">Reset</button>` : ""}</div>
    </div>`)}</div>
  </div>`;
}

export function mount(root, ctx) {
  const setTags = (name, list) => {
    const t = load("creativeTags", {});
    if (list === null) delete t[name];
    else t[name] = list;
    save("creativeTags", t);
    ctx.render();
  };
  const current = (name) => library(ctx.tree, allLeads(), ctx.catalog).find((r) => r.name === name)?.angles || [];
  root.onchange = (e) => {
    if (e.target.matches("[data-cproject]")) {
      project = e.target.value;
      return ctx.render();
    }
    if (e.target.matches("[data-csort]")) {
      sortBy = e.target.value;
      return ctx.render();
    }
    const add = e.target.closest("[data-addtag]");
    if (add && add.value) setTags(add.dataset.addtag, [...current(add.dataset.addtag), add.value]);
  };
  root.onclick = (e) => {
    const rm = e.target.closest("[data-rmtag]");
    if (rm) return setTags(rm.dataset.rmtag, current(rm.dataset.rmtag).filter((k) => k !== rm.dataset.tag));
    const rs = e.target.closest("[data-resettag]");
    if (rs) setTags(rs.dataset.resettag, null);
  };
}
