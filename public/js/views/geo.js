// Egypt & GCC Geo-Intelligence Map & 1-Click Retargeting Studio.
// Visualizes ad spend, targeted audiences, valid buyers, cost per valid lead
// (CPVL), and reservations across Egypt's 27 governorates, Greater Cairo &
// Nile Delta corridors, and GCC expat hubs, with 1-click retargeting actions.
import { html, raw, money, n, pct, egp, toast, confirmDialog, download, toCSV } from "../ui.js";
import { get, post } from "../api.js";
import { targets } from "../store.js";
import { allLeads, geoBreakdown, EGYPT_CORRIDORS, CITY_TO_GOV, isValid, treeDates } from "../model.js";
import { CITY } from "../demo.js";
import { kpi, connectCard, loadingCard } from "./common.js";
import { openTargeting } from "./targeting.js";
import { actualByPlace } from "../places.js";

let egyptMap = null;
let mapLoading = false;
let mapMode = "delta"; // "delta" (Greater Cairo & Delta zoom) | "egypt" (All Egypt 27 governorates) | "gcc" (GCC Expat Hubs)
let metric = "spend"; // "spend" | "valid" | "cpvl" | "validRate" | "reserved"
let selectedGov = "Cairo";
let selectedCorridor = "New Cairo";

const METRICS = [
  ["spend", "Ad Spend"],
  ["valid", "Valid Buyers"],
  ["cpvl", "Cost / Valid"],
  ["validRate", "Valid Rate %"],
  ["reserved", "Reservations"],
];

// Governorate label centers for the full Egypt map
const EGYPT_CENTERS = {
  Cairo: [345, 96],
  Giza: [292, 132],
  Alexandria: [254, 48],
  Matrouh: [140, 110],
  "Red Sea": [455, 310],
  Suez: [374, 112],
  Ismailia: [374, 68],
  "Port Said": [378, 38],
  Dakahlia: [342, 42],
  Gharbia: [314, 52],
  "Al Sharqia": [348, 62],
  Monufia: [305, 68],
  Beheira: [275, 64],
  Qalyubia: [328, 82],
  "Kafr el-Sheikh": [314, 28],
  Damietta: [348, 22],
  Faiyum: [288, 134],
  "Beni Suef": [306, 156],
  Minya: [305, 198],
  Asyut: [338, 232],
  Sohag: [358, 268],
  Qena: [398, 304],
  Luxor: [392, 330],
  Aswan: [380, 440],
  "North Sinai": [440, 75],
  "South Sinai": [448, 155],
  "New Valley": [180, 370],
};

// G Developments project destination markers on the maps
const PROJECT_PINS = [
  { id: "newkairo", name: "NEWKAIRO & Krypton", sub: "New Heliopolis · East Cairo", egypt: [352, 92], delta: [446, 316], color: "#ce3927" },
  { id: "newgiza", name: "NEWGIZA & Artlife", sub: "KM 22 Cairo–Alex Rd", egypt: [316, 102], delta: [352, 366], color: "#421115" },
  { id: "ivy", name: "IVY New Zayed", sub: "New Zayed · West Cairo", egypt: [302, 95], delta: [324, 340], color: "#146c3c" },
  { id: "seashell-rah", name: "Seashell & Playa RAH", sub: "Ras El Hekma KM 194–204", egypt: [175, 38], delta: [34, 185], color: "#2a5db0" },
  { id: "playa", name: "Playa Ghazala Bay", sub: "Ghazala Bay KM 141", egypt: [212, 46], delta: [52, 225], color: "#8a5300" },
  { id: "ein-bay", name: "Ein Bay Sokhna", sub: "Ain Sokhna · Red Sea", egypt: [382, 132], delta: [518, 435], color: "#b3301f" },
];

async function ensureMap(ctx) {
  if (egyptMap || mapLoading) return;
  mapLoading = true;
  try {
    const r = await fetch("./data/egypt-map.json", { credentials: "same-origin" });
    egyptMap = await r.json();
  } catch (e) {
    console.error("Could not load egypt-map.json", e);
  } finally {
    mapLoading = false;
    ctx.render();
  }
}

function heatColor(g, maxVal, targetCpvl) {
  if (!g || (!g.spend && !g.leads)) return "var(--bg-2)";
  if (metric === "cpvl") {
    if (!g.cpvl) return "color-mix(in srgb, var(--warn-soft) 70%, var(--bg-2))";
    const ratio = g.cpvl / (targetCpvl || 900);
    if (ratio <= 0.85) return "color-mix(in srgb, var(--good) 72%, var(--card))";
    if (ratio <= 1.15) return "color-mix(in srgb, var(--good) 42%, var(--card))";
    if (ratio <= 1.45) return "color-mix(in srgb, var(--warn) 55%, var(--card))";
    return "color-mix(in srgb, var(--bad) 68%, var(--card))";
  }
  const val = metric === "spend" ? g.spend : metric === "valid" ? g.valid : metric === "validRate" ? (g.validRate || 0) : g.reserved;
  if (!val || maxVal <= 0) return "var(--bg-2)";
  const p = Math.min(1, Math.max(0.14, Math.pow(val / maxVal, 0.55)));
  const pctMix = Math.round(p * 86);
  const base = metric === "valid" || metric === "validRate" || metric === "reserved" ? "var(--good)" : "var(--accent)";
  return `color-mix(in srgb, ${base} ${pctMix}%, var(--card))`;
}

function fmtMetric(g) {
  if (!g) return "—";
  if (metric === "spend") return money(g.spend, { short: true });
  if (metric === "valid") return `${n(g.valid)} valid`;
  if (metric === "cpvl") return g.cpvl ? money(g.cpvl, { short: true }) : "—";
  if (metric === "validRate") return pct(g.validRate, 0);
  return `${n(g.reserved)} EOI`;
}

function renderSvgMap(geo, t) {
  if (!egyptMap) {
    return html`<div class="skeleton" style="height:460px"></div>`;
  }
  const view = mapMode === "delta" ? egyptMap.delta : egyptMap.egypt;
  const paths = view.paths || {};
  const govList = Object.keys(paths).map((k) => geo.govs[k]).filter(Boolean);
  const maxVal = Math.max(
    1,
    ...govList.map((g) => (metric === "spend" ? g.spend : metric === "valid" ? g.valid : metric === "validRate" ? (g.validRate || 0) : g.reserved)),
  );

  // Skip governorate text labels where a corridor pin already labels that exact spot in delta mode
  const SKIP_DELTA_GOV_LABELS = new Set(["Alexandria", "Dakahlia", "Gharbia", "Al Sharqia", "Ismailia", "Suez", "Cairo", "Giza"]);

  const corridorDots = EGYPT_CORRIDORS.filter((c) => !c.gcc && c.coords?.[mapMode]).map((c) => {
    const cr = geo.corridors.find((x) => x.id === c.id) || c;
    const [cx, cy] = c.coords[mapMode];
    const isSel = selectedCorridor === c.id;
    const r = Math.max(5, Math.min(13, 5 + Math.sqrt((cr.spend || 0) / 1100)));
    const labelY = c.labelPos === "below" ? cy + r + 12 : cy - r - 5;
    return html`<g class="geo-corridor-pin ${isSel ? "is-selected" : ""}" data-corridor="${c.id}" tabindex="0" role="button" aria-label="${c.label}: ${money(cr.spend)} spent, ${n(cr.valid)} valid leads">
      <circle cx="${cx}" cy="${cy}" r="${r + 4}" fill="rgba(206,57,39,0.18)" class="pin-pulse"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${isSel ? "#ce3927" : "#421115"}" stroke="#ffffff" stroke-width="1.8"/>
      <text x="${cx}" y="${labelY}" text-anchor="middle" class="geo-pin-label">${c.id}${cr.spend ? ` · ${money(cr.spend, { short: true }).replace("EGP ", "")}` : ""}</text>
    </g>`;
  });

  const projectBadges = PROJECT_PINS.map((p) => {
    const [px, py] = p[mapMode];
    return html`<g class="geo-proj-pin" transform="translate(${px},${py})">
      <rect x="-4" y="-4" width="8" height="8" rx="2" fill="${p.color}" stroke="#fff" stroke-width="1.5" transform="rotate(45)"/>
    </g>`;
  });

  return html`
  <div class="geo-stage">
    <svg viewBox="0 0 ${view.w} ${view.h}" class="geo-svg" role="img" aria-label="Egypt media buying performance map">
      <defs>
        <pattern id="geo-grid" width="30" height="30" patternUnits="userSpaceOnUse">
          <path d="M 30 0 L 0 0 0 30" fill="none" stroke="var(--line)" stroke-width="0.5" stroke-dasharray="2,2"/>
        </pattern>
      </defs>
      <rect width="${view.w}" height="${view.h}" fill="url(#geo-grid)" rx="10"/>
      <g class="geo-regions">
        ${Object.entries(paths).map(([govName, d]) => {
          const g = geo.govs[govName];
          const isSel = selectedGov === govName;
          const fill = heatColor(g, maxVal, t.cpvl);
          return html`<path d="${d}" fill="${fill}" class="geo-path ${isSel ? "is-selected" : ""}" data-gov="${govName}">
            <title>${govName}: ${money(g?.spend || 0)} spend · ${n(g?.valid || 0)} valid leads · CPVL ${money(g?.cpvl)}</title>
          </path>`;
        })}
      </g>
      <g class="geo-labels">
        ${Object.keys(paths).map((govName) => {
          if (mapMode === "delta" && SKIP_DELTA_GOV_LABELS.has(govName)) return "";
          const pt = mapMode === "delta" ? egyptMap.delta.labels?.[govName] : EGYPT_CENTERS[govName];
          if (!pt) return "";
          const g = geo.govs[govName];
          const hasData = g && (g.spend > 0 || g.leads > 0);
          return html`<g transform="translate(${pt[0]},${pt[1]})" class="geo-gov-label ${hasData ? "has-data" : ""}" data-gov="${govName}">
            <text y="0" text-anchor="middle" class="gov-name">${govName}</text>
            ${hasData ? html`<text y="11" text-anchor="middle" class="gov-val">${fmtMetric(g)}</text>` : ""}
          </g>`;
        })}
      </g>
      <g class="geo-projects">${projectBadges}</g>
      <g class="geo-pins">${corridorDots}</g>
    </svg>
    <div class="geo-legend">
      <div class="row wrap small">
        <span class="geo-dot" style="background:#421115"></span><span>Targeted Buyer Corridor (click pin to inspect &amp; retarget)</span>
        <span class="geo-diamond" style="background:#ce3927"></span><span>G Developments Destination</span>
      </div>
      <div class="row small muted">
        <span>Low ${METRICS.find((m) => m[0] === metric)?.[1]}</span>
        <span class="geo-scale-bar ${metric === "cpvl" ? "is-cpvl" : ""}"></span>
        <span>High ${METRICS.find((m) => m[0] === metric)?.[1]}</span>
      </div>
    </div>
  </div>`;
}

function renderGccHubs(geo, t) {
  const gccCorridors = geo.corridors.filter((c) => c.gcc);
  return html`
  <div class="geo-gcc-grid">
    ${gccCorridors.map((c) => {
      const isSel = selectedCorridor === c.id;
      const ratio = c.cpvl && t.cpvl ? c.cpvl / t.cpvl : null;
      const tone = ratio === null ? "line" : ratio <= 1.1 ? "good" : ratio <= 1.45 ? "warn" : "bad";
      return html`<article class="card geo-gcc-card ${isSel ? "is-selected" : ""}" data-corridor="${c.id}">
        <div class="card-head">
          <div>
            <span class="pill accent">${c.gov.replace("GCC · ", "")}</span>
            <h3 style="margin-top:4px">${c.label}</h3>
          </div>
          <span class="pill ${tone}">${c.cpvl ? `${money(c.cpvl, { short: true })}/valid` : "No valid yet"}</span>
        </div>
        <div class="kpis" style="grid-template-columns:repeat(3,1fr);margin:8px 0">
          <div class="kpi"><span>Spend</span><b>${money(c.spend, { short: true })}</b></div>
          <div class="kpi"><span>Leads</span><b>${n(c.leads || c.metaLeads)}</b></div>
          <div class="kpi key"><span>Valid</span><b>${n(c.valid)}</b><small>${pct(c.validRate, 0)} rate</small></div>
        </div>
        <div class="row between small muted">
          <span>${c.adsets.length} active ad set${c.adsets.length === 1 ? "" : "s"}</span>
          <span>${n(c.reserved)} reservations · ${n(c.meetings)} meetings</span>
        </div>
      </article>`;
    })}
  </div>`;
}

function renderInspector(ctx, geo, t) {
  const cr = geo.corridors.find((c) => c.id === selectedCorridor) || geo.corridors[0];
  const gov = geo.govs[selectedGov] || geo.govs[cr?.gov] || geo.govs.Cairo;
  const active = cr || gov;
  if (!active) return "";

  const recProjects = (cr?.projects || ["krypton", "ivy", "seashell-rah"])
    .map((pid) => ctx.catalog?.projects?.find((p) => p.id === pid))
    .filter(Boolean);

  const ratio = active.cpvl && t.cpvl ? active.cpvl / t.cpvl : null;
  const diagnosis =
    active.valid >= 3 && ratio && ratio <= 0.9
      ? { tone: "good", title: "High-Yield Buyer Corridor · Scale & Build Lookalike", text: `${active.label || active.name} is producing valid buyers at ${money(active.cpvl)} (${Math.round((1 - ratio) * 100)}% below your target CPVL). Scale ad sets here by +20% and export valid leads as a 1% Lookalike seed.` }
      : active.spend > (t.cpl || 250) * 3 && active.valid === 0
      ? { tone: "bad", title: "Spend Leakage · Retarget Warm Only or Exclude", text: `${money(active.spend)} spent in ${active.label || active.name} with 0 valid buyers. Switch this location to Warm Website/Video Retargeting only, or exclude it from broad ad sets.` }
      : { tone: "info", title: "Active Corridor · Add Warm Retargeting Layer", text: `Buyers in ${active.label || active.name} respond best when paired with starting price in the headline and a dedicated Warm Retargeting ad set (Website visitors 30d + 50% Video viewers).` };

  return html`
  <div class="card geo-inspector">
    <div class="card-head">
      <div>
        <div class="row wrap" style="gap:6px">
          <span class="pill accent">${cr ? cr.region : "Governorate"}</span>
          <span class="pill line">Gov: ${cr ? cr.gov : active.name}</span>
        </div>
        <h2 style="margin-top:6px;font-size:18px">${cr ? cr.label : `${active.name} Governorate`}</h2>
      </div>
      <div class="row wrap">
        <button class="btn sm primary" type="button" data-geo-retarget="${cr ? cr.id : "Cairo"}">Retarget ${cr ? cr.id : active.name}</button>
        <button class="btn sm" type="button" data-geo-export="${cr ? cr.id : active.name}">Export Buyers CSV</button>
      </div>
    </div>

    <div class="note ${diagnosis.tone}" style="margin-bottom:12px">
      <b>${diagnosis.title}</b>
      <p style="margin-top:2px">${diagnosis.text}</p>
    </div>

    <div class="kpis" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-bottom:14px">
      ${kpi("Region Spend", money(active.spend))}
      ${kpi("Leads (Meta / Log)", `${n(active.metaLeads)} / ${n(active.leads)}`)}
      ${kpi("Valid Buyers", n(active.valid), pct(active.validRate, 0) + " valid rate", true)}
      ${kpi("Cost / Valid Lead", money(active.cpvl), t.cpvl ? `Target ${money(t.cpvl)}` : "", true)}
      ${kpi("Meetings / Visits", n(active.meetings))}
      ${kpi("Reservations (EOI)", n(active.reserved))}
    </div>

    <h3>1-Click Geo &amp; Retargeting Actions</h3>
    <p class="small muted" style="margin:2px 0 8px">Execute location optimizations directly on your campaigns or audience lists:</p>
    <div class="geo-action-grid">
      <button class="btn" type="button" data-geo-retarget="${cr ? cr.id : "Cairo"}">
        <span>Add ${cr ? cr.id : active.name} + Warm Retargeting to Ad Set</span>
      </button>
      <button class="btn" type="button" data-geo-scale="${cr ? cr.id : active.name}">
        <span>Scale Winning Ad Sets in ${cr ? cr.id : active.name} (+20%)</span>
      </button>
      <button class="btn" type="button" data-geo-exclude="${cr ? cr.id : "Cairo"}">
        <span>Exclude ${cr ? cr.id : active.name} from an Ad Set</span>
      </button>
      <button class="btn" type="button" data-geo-export="${cr ? cr.id : active.name}">
        <span>Download ${cr ? cr.id : active.name} Valid Buyers for 1% LAL</span>
      </button>
    </div>

    <hr class="hr">
    <h3>Best Projects to Push in ${cr ? cr.id : active.name}</h3>
    <div class="stack" style="margin-top:8px">
      ${recProjects.map((p) => html`<div class="row between wrap" style="padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg)">
        <div>
          <b>${p.name}</b> ${p.parent ? html`<span class="tiny muted">· ${p.parent}</span>` : ""}
          <div class="tiny muted">From ${egp(p.from)} · ${p.inventory?.available != null ? `${n(p.inventory.available)} units available` : `${n(p.inventory?.released || 72)} released`}</div>
        </div>
        <div class="row">
          <a class="btn sm ghost" href="#/messages" data-jump-project="${p.id}">Ad Copy</a>
          <a class="btn sm" href="#/links" data-jump-project="${p.id}">UTM Link</a>
        </div>
      </div>`)}
    </div>

    <hr class="hr">
    <h3>Ad Sets Targeting ${cr ? cr.id : active.name} (${active.adsets.length})</h3>
    ${active.adsets.length
      ? html`<div class="table-wrap" style="margin-top:8px"><table>
          <thead><tr><th>Ad Set</th><th class="n">Daily Budget</th><th></th></tr></thead>
          <tbody>${active.adsets.map((s) => html`<tr>
            <td><a href="#/campaigns/${s.campaignId}" class="name">${s.name}</a><div class="tiny muted">${s.campaignName}</div></td>
            <td class="n">${s.dailyBudget ? `${money(s.dailyBudget)}/day` : "Campaign"}</td>
            <td class="n"><button class="btn sm" type="button" data-open-targeting="${s.id}">Targeting</button></td>
          </tr>`)}</tbody>
        </table></div>`
      : html`<p class="small muted" style="margin-top:6px">No active ad sets explicitly target ${cr ? cr.id : active.name} yet. Click "Retarget ${cr ? cr.id : active.name}" above to add it.</p>`}
  </div>`;
}

export function render(ctx) {
  ensureMap(ctx);
  const top = html`<div class="top">
    <div>
      <h1>Egypt &amp; GCC Geo-Intelligence</h1>
      <p class="sub">See where every pound is spent, which Egyptian governorates and corridors bring valid real-estate buyers, and retarget high-intent zones in one click.</p>
    </div>
    <div class="top-actions">${ctx.settings?.connected ? html`${ctx.periodSwitch()}${ctx.refreshButton()}` : ""}</div>
  </div>`;

  if (!ctx.settings) return html`${top}${loadingCard()}`;
  if (!ctx.settings.connected) return html`${top}${connectCard(ctx.settings)}`;
  if (!ctx.tree) return html`${top}${loadingCard()}`;

  const leads = allLeads();
  const t = targets();
  const geo = geoBreakdown(ctx.tree, leads, ctx.catalog, actualByPlace(ctx.breakdowns));
  const { since, until } = treeDates(ctx.tree);

  const egyptSpend = geo.corridors.filter((c) => !c.gcc).reduce((s, c) => s + c.spend, 0);
  const gccSpend = geo.corridors.filter((c) => c.gcc).reduce((s, c) => s + c.spend, 0);
  const egyptValid = geo.corridors.filter((c) => !c.gcc).reduce((s, c) => s + c.valid, 0);
  const gccValid = geo.corridors.filter((c) => c.gcc).reduce((s, c) => s + c.valid, 0);
  const bestCorridor = [...geo.corridors].filter((c) => c.valid >= 2 && c.cpvl).sort((a, b) => a.cpvl - b.cpvl)[0];

  return html`${top}
  ${geo.source === "meta" ? html`<div class="note good" style="margin-bottom:12px"><b>Spend by governorate is Meta's own delivery report</b> for these dates. Areas inside a governorate are split by targeting.</div>` : html`<div class="note warn" style="margin-bottom:12px"><b>Spend by governorate is estimated</b> by splitting each ad set's spend across the places it targets. ${ctx.breakdownsError ? `Meta's delivery report could not be loaded: ${ctx.breakdownsError}` : "Meta's delivery report replaces it as soon as it loads."}</div>`}
  <div class="kpis kpis-5" style="margin-bottom:14px">
    ${kpi("Egypt Corridors Spend", money(egyptSpend), `${n(egyptValid)} valid buyers in Egypt`)}
    ${kpi("Egypt Cost / Valid", egyptValid ? money(egyptSpend / egyptValid) : "—", "Cairo, Giza, Alex, Delta & Coast", true)}
    ${kpi("GCC Expat Hubs Spend", money(gccSpend), `${n(gccValid)} valid expat buyers`)}
    ${kpi("GCC Cost / Valid", gccValid ? money(gccSpend / gccValid) : "—", "KSA, UAE, Kuwait & Qatar", true)}
    ${kpi("Best Buyer Corridor", bestCorridor ? bestCorridor.id : "New Cairo", bestCorridor ? `${money(bestCorridor.cpvl)}/valid (${n(bestCorridor.valid)} valid)` : "Select a pin below", true)}
  </div>

  <div class="card" style="margin-bottom:14px">
    <div class="card-head">
      <div class="row wrap" style="gap:10px">
        <div class="seg" role="group" aria-label="Map Region">
          <button type="button" data-map-mode="delta" aria-pressed="${mapMode === "delta"}">Greater Cairo, Delta &amp; Corridors</button>
          <button type="button" data-map-mode="egypt" aria-pressed="${mapMode === "egypt"}">All Egypt (27 Governorates)</button>
          <button type="button" data-map-mode="gcc" aria-pressed="${mapMode === "gcc"}">GCC Expat Hubs (KSA · UAE · KW · QA)</button>
        </div>
      </div>
      <div class="row wrap" style="gap:8px">
        <span class="small muted">Color map by:</span>
        <div class="seg" role="group" aria-label="Metric">
          ${METRICS.map(([k, label]) => html`<button type="button" data-map-metric="${k}" aria-pressed="${metric === k}">${label}</button>`)}
        </div>
      </div>
    </div>

    <div class="geo-layout">
      <div>
        ${mapMode === "gcc" ? renderGccHubs(geo, t) : renderSvgMap(geo, t)}
      </div>
      <div>
        ${renderInspector(ctx, geo, t)}
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-head">
      <div>
        <h2>All Targeted Corridors &amp; Governorates (${since || "period"} to ${until || "now"})</h2>
        <p>Click any corridor row to inspect its ad sets on the map and trigger 1-click retargeting or budget scaling.</p>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Corridor / City</th>
            <th>Governorate / Region</th>
            <th class="n">Ad Sets</th>
            <th class="n">Spend</th>
            <th class="n">Leads</th>
            <th class="n">Valid Buyers</th>
            <th class="n">Valid Rate</th>
            <th class="n">Cost / Valid</th>
            <th class="n">Meetings</th>
            <th class="n">Reserved</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${geo.corridors.filter((c) => c.spend > 0 || c.leads > 0).map((c) => {
            const isSel = selectedCorridor === c.id;
            const good = c.cpvl && t.cpvl && c.cpvl <= t.cpvl;
            return html`<tr class="${isSel ? "row-selected" : ""}" data-corridor="${c.id}" style="cursor:pointer">
              <td><div class="name">${c.label}</div></td>
              <td><span class="pill ${c.gcc ? "accent" : "line"}">${c.gov}</span></td>
              <td class="n">${n(c.adsets.length)}</td>
              <td class="n">${money(c.spend)}</td>
              <td class="n">${n(c.leads || c.metaLeads)}</td>
              <td class="n"><b>${n(c.valid)}</b></td>
              <td class="n">${pct(c.validRate, 0)}</td>
              <td class="n"><b class="${good ? "stage-valid" : ""}">${money(c.cpvl)}</b></td>
              <td class="n">${n(c.meetings)}</td>
              <td class="n">${n(c.reserved)}</td>
              <td class="n">
                <button class="btn sm" type="button" data-geo-retarget="${c.id}">Retarget</button>
              </td>
            </tr>`;
          })}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- Geo Actions
async function retargetCorridor(cityId, ctx) {
  const allSets = [];
  for (const c of ctx.tree?.campaigns || []) {
    for (const s of c.adsets || []) allSets.push({ s, c });
  }
  if (!allSets.length) return toast("No ad sets loaded.", "bad");
  const cityKey = CITY[cityId] || "1528";
  const targetSet = allSets.find(({ s }) => /warm|visitor|broad/i.test(s.name)) || allSets[0];

  const d = document.createElement("dialog");
  d.innerHTML = html`<form method="dialog" class="dlg">
    <h2>Retarget ${cityId} Buyers</h2>
    <p class="muted small">Push <b>${cityId} (+15 km radius)</b> + Warm Website Visitors &amp; 50% Video Viewers directly to an ad set's Meta targeting.</p>
    <label class="field"><span>Target Ad Set</span>
      <select class="input" name="adsetId">
        ${allSets.map(({ s, c }) => html`<option value="${s.id}" ${s.id === targetSet.s.id ? raw("selected") : ""}>${s.name} (${c.name})</option>`)}
      </select>
    </label>
    <label class="field"><span>Radius (km)</span>
      <input class="input" type="number" name="radius" min="5" max="50" value="15">
    </label>
    <label class="row small"><input type="checkbox" name="includeWarm" checked> Include Warm Website Visitors (30d) &amp; Video Viewers (50%)</label>
    <label class="row small"><input type="checkbox" name="excludeLeads" checked> Exclude existing converted leads (prevent wasted impressions)</label>
    <div class="acts">
      <button class="btn" value="no" formnovalidate>Cancel</button>
      <button class="btn primary" value="yes">Apply Geo Retargeting</button>
    </div>
  </form>`.s;
  document.body.append(d);
  d.addEventListener("close", async () => {
    if (d.returnValue === "yes") {
      const f = new FormData(d.querySelector("form"));
      const adsetId = String(f.get("adsetId"));
      const radius = Number(f.get("radius")) || 15;
      const includeWarm = f.get("includeWarm") === "on";
      const excludeLeads = f.get("excludeLeads") === "on";
      try {
        const cur = await get("/api/targeting", { id: adsetId });
        const orig = cur.targeting || {};
        const geo = orig.geo_locations || {};
        const cities = [...(geo.cities || [])];
        if (!cities.some((c) => c.key === cityKey || c.name === cityId)) {
          cities.push({ key: cityKey, name: cityId, radius, distance_unit: "kilometer" });
        }
        const patch = {
          geo_locations: { ...geo, cities, location_types: ["home", "recent"] },
        };
        if (includeWarm) {
          const auds = await get("/api/audiences").catch(() => []);
          const warm = auds.filter((a) => /visitor|film|viewer|opener|payment/i.test(a.name)).map((a) => ({ id: a.id, name: a.name }));
          if (warm.length) patch.custom_audiences = warm;
        }
        if (excludeLeads) {
          const auds = await get("/api/audiences").catch(() => []);
          const ex = auds.filter((a) => /exclude|all leads/i.test(a.name)).map((a) => ({ id: a.id, name: a.name }));
          if (ex.length) patch.excluded_custom_audiences = ex;
        }
        await post("/api/targeting", { id: adsetId, patch });
        toast(`Applied ${cityId} (+${radius}km) retargeting to ad set.`, "good");
        ctx.loadTree(true);
      } catch (err) {
        toast(err.message, "bad");
      }
    }
    d.remove();
  });
  d.showModal();
}

async function excludeCorridor(cityId, ctx) {
  const allSets = [];
  for (const c of ctx.tree?.campaigns || []) {
    for (const s of c.adsets || []) allSets.push({ s, c });
  }
  if (!allSets.length) return toast("No ad sets loaded.", "bad");
  const cityKey = CITY[cityId] || "1528";
  const ok = await confirmDialog({
    title: `Exclude ${cityId} from targeting?`,
    body: html`Adds <b>${cityId}</b> to <code>excluded_geo_locations</code> on the active broad ad set so budget stops flowing to low-converting traffic in this zone.`,
    ok: `Exclude ${cityId}`,
    danger: true,
  });
  if (!ok) return;
  try {
    const targetId = allSets[0].s.id;
    const cur = await get("/api/targeting", { id: targetId });
    const orig = cur.targeting || {};
    const exGeo = orig.excluded_geo_locations || {};
    const exCities = [...(exGeo.cities || []), { key: cityKey, name: cityId }];
    await post("/api/targeting", { id: targetId, patch: { excluded_geo_locations: { ...exGeo, cities: exCities } } });
    toast(`Excluded ${cityId} from ${allSets[0].s.name}.`, "good");
    ctx.loadTree(true);
  } catch (err) {
    toast(err.message, "bad");
  }
}

async function scaleCorridor(cityId, ctx, geo) {
  const cr = geo.corridors.find((c) => c.id === cityId);
  const sets = (cr?.adsets || []).filter((s) => s.dailyBudget > 0);
  if (!sets.length) return toast(`No ad sets with daily budgets found for ${cityId}.`, "bad");
  const s = sets[0];
  const nextBudget = Math.round(s.dailyBudget * 1.2);
  const ok = await confirmDialog({
    title: `Scale ${cityId} ad set by +20%?`,
    body: html`<b>${s.name}</b><div class="diff" style="margin-top:8px">${money(s.dailyBudget)}/day → <b>${money(nextBudget)}/day (+20%)</b></div><p class="small muted" style="margin-top:6px">A 20% step increases volume in ${cityId} without resetting Meta's learning phase.</p>`,
    ok: "Scale +20%",
  });
  if (!ok) return;
  try {
    await post("/api/budget", { id: s.id, field: "daily_budget", amount: nextBudget });
    toast(`Scaled ${s.name} to ${money(nextBudget)}/day.`, "good");
    ctx.loadTree(true);
  } catch (err) {
    toast(err.message, "bad");
  }
}

function exportGeoBuyers(regionName) {
  const leads = allLeads().filter((l) => isValid(l.stage) && (l.city === regionName || l.governorate === regionName || (CITY_TO_GOV[l.city] && CITY_TO_GOV[l.city] === regionName)));
  const pool = leads.length ? leads : allLeads().filter((l) => isValid(l.stage));
  if (!pool.length) return toast("No valid leads available to export yet.", "bad");
  const rows = pool.map((l) => {
    const [fn, ...rest] = String(l.name || "").trim().split(/\s+/);
    const digits = String(l.phone || "").replace(/[^\d+]/g, "");
    const e164 = digits.startsWith("+") ? digits : digits.startsWith("01") ? `+2${digits}` : `+${digits}`;
    return [e164, String(l.email || "").toLowerCase(), fn || "", rest.join(" "), l.city || regionName, "EG", l.budget || ""];
  });
  download(`meta-lookalike-${regionName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`, toCSV([["phone", "email", "fn", "ln", "city", "country", "value"], ...rows]));
  toast(`Exported ${rows.length} valid buyers for ${regionName} Meta Custom Audience / 1% Lookalike.`, "good");
}

export function mount(root, ctx) {
  root.onclick = (e) => {
    const modeBtn = e.target.closest("[data-map-mode]");
    if (modeBtn) {
      mapMode = modeBtn.dataset.mapMode;
      if (mapMode === "gcc" && !["Riyadh", "Dubai", "Kuwait City", "Doha"].includes(selectedCorridor)) {
        selectedCorridor = "Riyadh";
      } else if (mapMode !== "gcc" && ["Riyadh", "Dubai", "Kuwait City", "Doha"].includes(selectedCorridor)) {
        selectedCorridor = "New Cairo";
      }
      return ctx.render();
    }
    const metricBtn = e.target.closest("[data-map-metric]");
    if (metricBtn) {
      metric = metricBtn.dataset.mapMetric;
      return ctx.render();
    }
    const retargetBtn = e.target.closest("[data-geo-retarget]");
    if (retargetBtn) {
      e.stopPropagation();
      return retargetCorridor(retargetBtn.dataset.geoRetarget, ctx);
    }
    const excludeBtn = e.target.closest("[data-geo-exclude]");
    if (excludeBtn) {
      e.stopPropagation();
      return excludeCorridor(excludeBtn.dataset.geoExclude, ctx);
    }
    const scaleBtn = e.target.closest("[data-geo-scale]");
    if (scaleBtn) {
      e.stopPropagation();
      const geo = geoBreakdown(ctx.tree, allLeads(), ctx.catalog, actualByPlace(ctx.breakdowns));
      return scaleCorridor(scaleBtn.dataset.geoScale, ctx, geo);
    }
    const exportBtn = e.target.closest("[data-geo-export]");
    if (exportBtn) {
      e.stopPropagation();
      return exportGeoBuyers(exportBtn.dataset.geoExport);
    }
    const openTg = e.target.closest("[data-open-targeting]");
    if (openTg) {
      e.stopPropagation();
      for (const c of ctx.tree?.campaigns || []) {
        const s = c.adsets.find((a) => a.id === openTg.dataset.openTargeting);
        if (s) return openTargeting(s, ctx);
      }
    }
    const corrEl = e.target.closest("[data-corridor]");
    if (corrEl) {
      selectedCorridor = corrEl.dataset.corridor;
      const cMeta = EGYPT_CORRIDORS.find((c) => c.id === selectedCorridor);
      if (cMeta) selectedGov = cMeta.gov;
      return ctx.render();
    }
    const govEl = e.target.closest("[data-gov]");
    if (govEl) {
      selectedGov = govEl.dataset.gov;
      const matchCorr = EGYPT_CORRIDORS.find((c) => c.gov === selectedGov);
      if (matchCorr) selectedCorridor = matchCorr.id;
      return ctx.render();
    }
  };
}
