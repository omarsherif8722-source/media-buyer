// Command Center (Overview): executive KPI pulse, dual-axis SVG daily time-series
// chart (Spend vs. Valid Buyers & CPVL), full-funnel conversion waterfall,
// 1-click decision & action engine, project spend-vs-yield matrix, and
// Grade-A priority speed-to-lead queue.
import { html, raw, money, n, pct, egp, ago, toast, confirmDialog } from "../ui.js";
import { post } from "../api.js";
import { targets, saveTargets, DEFAULT_TARGETS } from "../store.js";
import {
  allLeads, quality, treeDates, score, alerts, isWaiting, isValid, MEETING_UP, RESERVED_UP,
  dailyPerformance, scoreLeadGrade, projectFromName, geoBreakdown,
} from "../model.js";
import { kpi, connectCard, loadingCard } from "./common.js";

function totals(tree) {
  const t = { spend: 0, impressions: 0, leads: 0, convos: 0, linkClicks: 0, landingViews: 0, on: 0, campaigns: tree?.campaigns.length || 0 };
  for (const c of tree?.campaigns || []) {
    const m = c.m;
    if (c.effectiveStatus === "ACTIVE") t.on += 1;
    if (!m) continue;
    t.spend += m.spend;
    t.impressions += m.impressions;
    t.leads += m.leads;
    t.convos += m.convos;
    t.linkClicks += m.linkClicks;
    t.landingViews += m.landingViews || Math.round((m.linkClicks || 0) * 0.78);
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

function renderDailyChart(daily, t) {
  if (!daily || !daily.length) {
    return html`<div class="empty"><p>Daily trend chart appears once campaigns have spend in the selected dates.</p></div>`;
  }
  const W = 720, H = 220, padL = 48, padR = 44, padT = 18, padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const maxSpend = Math.max(100, ...daily.map((d) => d.spend || 0));
  const maxValid = Math.max(4, ...daily.map((d) => Math.max(d.valid || 0, d.leads || 0)));
  const count = daily.length;
  const stepX = plotW / Math.max(1, count);
  const barW = Math.max(6, Math.min(28, stepX * 0.58));

  const ptsLeads = [];
  const ptsValid = [];
  daily.forEach((d, i) => {
    const cx = padL + i * stepX + stepX / 2;
    const yL = padT + plotH - ((d.leads || 0) / maxValid) * plotH;
    const yV = padT + plotH - ((d.valid || 0) / maxValid) * plotH;
    ptsLeads.push(`${cx.toFixed(1)},${yL.toFixed(1)}`);
    ptsValid.push(`${cx.toFixed(1)},${yV.toFixed(1)}`);
  });

  return html`
  <div class="chart-wrap">
    <svg viewBox="0 0 ${W} ${H}" class="chart-svg" role="img" aria-label="Daily spend versus leads and valid buyers">
      <!-- Horizontal grid lines -->
      ${[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const y = (padT + plotH * (1 - f)).toFixed(1);
        const sVal = Math.round(maxSpend * f);
        const vVal = Math.round(maxValid * f);
        return html`<g>
          <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--line)" stroke-width="1" stroke-dasharray="${f === 0 ? "" : "3,3"}"/>
          <text x="${padL - 6}" y="${Number(y) + 4}" text-anchor="end" class="chart-axis">${sVal >= 1000 ? `${(sVal / 1000).toFixed(sVal >= 10000 ? 0 : 1)}K` : sVal}</text>
          <text x="${W - padR + 6}" y="${Number(y) + 4}" text-anchor="start" class="chart-axis chart-axis-right">${vVal}</text>
        </g>`;
      })}
      <!-- Spend bars -->
      ${daily.map((d, i) => {
        const cx = padL + i * stepX + stepX / 2;
        const bh = Math.max(2, ((d.spend || 0) / maxSpend) * plotH);
        const by = padT + plotH - bh;
        const showLabel = count <= 10 || i % Math.ceil(count / 8) === 0 || i === count - 1;
        return html`<g class="chart-bar-group">
          <rect x="${(cx - barW / 2).toFixed(1)}" y="${by.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="color-mix(in srgb, var(--accent) 28%, var(--card))" stroke="var(--accent)" stroke-width="1">
            <title>${d.date}: ${money(d.spend)} spend · ${n(d.leads)} leads · ${n(d.valid)} valid buyers${d.cpvl ? ` · CPVL ${money(d.cpvl)}` : ""}</title>
          </rect>
          ${showLabel ? html`<text x="${cx.toFixed(1)}" y="${H - 8}" text-anchor="middle" class="chart-axis">${d.date.slice(5)}</text>` : ""}
        </g>`;
      })}
      <!-- Total Leads line -->
      ${ptsLeads.length > 1 ? html`<polyline fill="none" stroke="var(--info)" stroke-width="1.75" stroke-dasharray="3,2" points="${ptsLeads.join(" ")}"/>` : ""}
      <!-- Valid Buyers line -->
      ${ptsValid.length > 1 ? html`<polyline fill="none" stroke="var(--good)" stroke-width="2.6" points="${ptsValid.join(" ")}"/>` : ""}
      ${daily.map((d, i) => {
        const cx = padL + i * stepX + stepX / 2;
        const yV = padT + plotH - ((d.valid || 0) / maxValid) * plotH;
        return html`<circle cx="${cx.toFixed(1)}" cy="${yV.toFixed(1)}" r="3.4" fill="var(--good)" stroke="var(--card)" stroke-width="1.5">
          <title>${d.date}: ${n(d.valid)} valid buyers (${n(d.reserved)} reserved)</title>
        </circle>`;
      })}
    </svg>
    <div class="row between wrap small muted" style="margin-top:6px">
      <div class="row wrap" style="gap:14px">
        <span><i class="legend-swatch" style="background:color-mix(in srgb, var(--accent) 45%, var(--card));border:1px solid var(--accent)"></i> Daily Ad Spend (left axis, EGP)</span>
        <span><i class="legend-swatch" style="background:var(--info)"></i> Total Leads (right axis)</span>
        <span><i class="legend-swatch" style="background:var(--good)"></i> Valid Buyers (right axis)</span>
      </div>
      <span>Target CPVL: <b>${t.cpvl ? money(t.cpvl) : "900 EGP"}</b></span>
    </div>
  </div>`;
}

function renderWaterfall(tt, q) {
  const metaLeads = tt.leads + tt.convos || q.total.leads;
  const steps = [
    ["Impressions", tt.impressions, "Ad reach delivery", 100],
    ["Link Clicks", tt.linkClicks, tt.impressions ? `${pct((tt.linkClicks / tt.impressions) * 100, 2)} CTR` : "Ad clicks", 76],
    ["Website LPVs", tt.landingViews, tt.linkClicks ? `${pct((tt.landingViews / tt.linkClicks) * 100, 0)} page load` : "Site visits", 58],
    ["Total Leads", metaLeads, `${n(tt.leads)} forms · ${n(tt.convos)} WhatsApp`, 42],
    ["Valid Buyers", q.total.valid, q.total.contacted ? `${pct((q.total.valid / q.total.contacted) * 100, 0)} of contacted` : "Qualified", 26, true],
    ["Site Visits / Meetings", q.total.meetings, q.total.valid ? `${pct((q.total.meetings / q.total.valid) * 100, 0)} of valid` : "Booked", 16],
    ["Reservations (EOI)", q.total.reserved, q.total.meetings ? `${pct((q.total.reserved / q.total.meetings) * 100, 0)} close rate` : "Signed", 10, true],
  ];
  return html`
  <div class="waterfall">
    ${steps.map(([label, val, sub, w, isKey]) => html`<div class="wf-row ${isKey ? "is-key" : ""}">
      <div class="wf-meta">
        <span class="wf-label">${label}</span>
        <span class="wf-sub">${sub}</span>
      </div>
      <div class="wf-bar-wrap">
        <div class="wf-bar" style="width:${w}%"></div>
      </div>
      <b class="wf-val">${n(val)}</b>
    </div>`)}
  </div>`;
}

function renderProjectMatrix(ctx, leads, since, until, t) {
  const byProj = {};
  for (const p of ctx.catalog?.projects || []) {
    byProj[p.id] = { p, spend: 0, metaLeads: 0, logged: 0, valid: 0, meetings: 0, reserved: 0 };
  }
  for (const c of ctx.tree?.campaigns || []) {
    const p = projectFromName(c.name, ctx.catalog);
    if (!p || !byProj[p.id] || !c.m) continue;
    byProj[p.id].spend += c.m.spend || 0;
    byProj[p.id].metaLeads += (c.m.leads || 0) + (c.m.convos || 0);
  }
  for (const l of leads) {
    const d = String(l.created || "").slice(0, 10);
    if (since && d < since) continue;
    if (until && d > until) continue;
    const pid = l.project || projectFromName(l.campaignName, ctx.catalog)?.id;
    if (!pid || !byProj[pid]) continue;
    byProj[pid].logged += 1;
    if (isValid(l.stage)) byProj[pid].valid += 1;
    if (MEETING_UP.has(l.stage)) byProj[pid].meetings += 1;
    if (RESERVED_UP.has(l.stage)) byProj[pid].reserved += 1;
  }
  const active = Object.values(byProj).filter((r) => r.spend > 0 || r.logged > 0 || (r.p.inventory?.available || 0) >= 50).sort((a, b) => b.spend - a.spend || b.valid - a.valid);
  const maxSpend = Math.max(1, ...active.map((r) => r.spend));

  return html`
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>G Developments Project</th>
          <th>Starting Price &amp; Plan</th>
          <th class="n">ATS Stock</th>
          <th style="min-width:150px">Ad Spend Share</th>
          <th class="n">Leads</th>
          <th class="n">Valid Buyers</th>
          <th class="n">Cost / Valid</th>
          <th class="n">Meetings</th>
          <th class="n">Reserved</th>
          <th>Media Signal</th>
        </tr>
      </thead>
      <tbody>
        ${active.map((r) => {
          const cpvl = r.valid > 0 ? r.spend / r.valid : null;
          const stock = r.p.inventory?.available ?? r.p.inventory?.released ?? null;
          const pctBar = Math.round((r.spend / maxSpend) * 100);
          let sig = ["Steady", "info"];
          if (cpvl && t.cpvl && cpvl <= t.cpvl * 0.9 && r.valid >= 2) sig = ["Scale +20%", "good"];
          else if (r.spend === 0 && stock >= 50) sig = ["High stock · Unspent", "warn"];
          else if (cpvl && t.cpvl && cpvl > t.cpvl * 1.35) sig = ["High CPVL · Optimize", "warn"];
          return html`<tr>
            <td>
              <div class="name">${r.p.name} ${r.p.parent ? html`<span class="tiny muted">· ${r.p.parent}</span>` : ""}</div>
              <div class="tiny muted">${r.p.regionName}</div>
            </td>
            <td>
              <div>From <b>${egp(r.p.from)}</b></div>
              <div class="tiny muted">${r.p.cashOnly ? "Cash only" : "5% down · up to 8 yrs"}</div>
            </td>
            <td class="n">${stock !== null ? html`<b>${n(stock)}</b> <span class="tiny muted">units</span>` : "—"}</td>
            <td>
              <div class="row between small"><b>${money(r.spend)}</b><span class="tiny muted">${pctBar}%</span></div>
              <div class="bar"><i style="width:${pctBar}%"></i></div>
            </td>
            <td class="n">${n(r.metaLeads || r.logged)}</td>
            <td class="n"><b>${n(r.valid)}</b></td>
            <td class="n"><b class="${cpvl && t.cpvl && cpvl <= t.cpvl ? "stage-valid" : ""}">${money(cpvl)}</b></td>
            <td class="n">${n(r.meetings)}</td>
            <td class="n"><b>${n(r.reserved)}</b></td>
            <td><span class="pill ${sig[1]}">${sig[0]}</span></td>
          </tr>`;
        })}
      </tbody>
    </table>
  </div>`;
}

function targetsForm() {
  const t = targets();
  const f = (key, label, hint, step = "any") => html`<label class="field"><span>${label}</span><input class="input" type="number" min="0" step="${step}" inputmode="decimal" name="${key}" value="${t[key] ?? ""}" placeholder="${DEFAULT_TARGETS[key] ?? "not set"}"><small class="faint">${hint}</small></label>`;
  return html`<form class="fields" data-targets>
    ${f("cpl", "Target cost per lead", "Benchmark: 250 EGP")}
    ${f("cpvl", "Target cost per valid lead", "The #1 metric (Benchmark: 900 EGP)")}
    ${f("maxFrequency", "Max frequency", "Above this, creative fatigues", "0.1")}
    ${f("minCtr", "Min link CTR %", "Below this, hook is weak", "0.1")}
    ${f("speedToLead", "Call new leads within (min)", "Speed wins real estate buyers", "1")}
    ${f("zeroValidAfter", "Flag after N leads with 0 valid", "Lead quality alarm", "1")}
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
  const daily = tree ? dailyPerformance(tree, leads) : [];
  const geo = tree ? geoBreakdown(tree, leads, ctx.catalog) : null;
  const topCorridors = geo ? geo.corridors.filter((c) => c.spend > 0 || c.valid > 0).slice(0, 5) : [];

  const recent = Date.now() - 14 * 86400000;
  const waiting = leads
    .filter((l) => isWaiting(l.stage) && new Date(l.created).getTime() >= recent)
    .map((l) => ({ l, g: scoreLeadGrade(l, ctx.catalog) }))
    .sort((a, b) => (a.l.stage === "new" ? 0 : 1) - (b.l.stage === "new" ? 0 : 1) || b.g.points - a.g.points || String(a.l.created).localeCompare(String(b.l.created)));
  const rank = tree ? ranking(tree, q) : null;
  const t = targets();

  // Estimated pipeline sales value from reservations
  const pipelineEgp = q.total.reserved * 11287500;

  return html`
  <div class="top">
    <div>
      <h1>Media Buying Command Center</h1>
      <p class="sub">${tree ? html`<b>${tree.account.name}</b> · ${since || "?"} to ${until || "?"} · <b>${tt.on}</b> of ${tt.campaigns} campaigns active` : "Judge every campaign by valid buyers, site visits, and reservations across the G Developments portfolio."}</p>
    </div>
    <div class="top-actions">
      <a class="btn" href="#/geo">Egypt &amp; GCC Geo Map</a>
      <a class="btn" href="#/website">Website Funnel</a>
      ${connected ? html`${ctx.periodSwitch()}${ctx.refreshButton()}` : ""}
    </div>
  </div>

  ${connected === false ? connectCard(ctx.settings) : ""}
  ${connected && !tree && !ctx.treeError ? loadingCard() : ""}
  ${ctx.treeError ? html`<div class="note bad" style="margin-bottom:14px"><b>Could not load Meta results.</b> ${ctx.treeError}</div>` : ""}

  <div class="kpis" style="margin:${connected === false ? "14px" : "0"} 0 14px">
    ${tree ? kpi("Total Ad Spend", money(tt.spend), `${tt.on} active campaigns`) : ""}
    ${tree ? kpi("Leads (Meta)", n(sc.metaLeads), tt.convos ? `${n(tt.leads)} forms · ${n(tt.convos)} WhatsApp` : "Instant forms") : kpi("Leads in Log", n(q.total.leads), "all time")}
    ${tree ? kpi("Cost per Lead", money(sc.cpl), t.cpl ? `Target ${money(t.cpl)}` : "") : ""}
    ${kpi("Valid Buyers", n(q.total.valid), tree ? "Verified real interest+" : "all time", true)}
    ${kpi("Valid Buyer Rate", pct(sc.validRate === null ? null : sc.validRate * 100, 0), "Of contacted leads", true)}
    ${tree ? kpi("Cost / Valid Buyer", money(sc.cpvl), t.cpvl ? `Target ${money(t.cpvl)}` : "Set target below", true) : ""}
    ${kpi("Meetings & Site Visits", n(q.total.meetings), sc.meetings && tt.spend ? `${money(tt.spend / sc.meetings)}/visit` : "NEWKAIRO & West Cairo")}
    ${kpi("Reservations (EOI)", n(q.total.reserved), q.total.reserved ? `≈ ${egp(pipelineEgp)} sales volume` : "5% EOI / Contract", true)}
  </div>

  ${tree ? html`
  <div class="grid g2" style="margin-bottom:14px">
    <div class="card">
      <div class="card-head">
        <div>
          <h2>Daily Ad Spend vs. Valid Buyers Trend</h2>
          <p>Hover any bar or point to inspect daily spend, total leads, and verified valid buyers.</p>
        </div>
      </div>
      ${renderDailyChart(daily, t)}
    </div>
    <div class="card">
      <div class="card-head">
        <div>
          <h2>Full-Funnel Conversion Waterfall</h2>
          <p>From Meta impression to website visit, sales contact, valid qualification, and EOI reservation.</p>
        </div>
        <a class="btn sm" href="#/website">Website Breakdown</a>
      </div>
      ${renderWaterfall(tt, q)}
    </div>
  </div>` : ""}

  <div class="grid g2" style="margin-bottom:14px">
    <div class="card">
      <div class="card-head">
        <div>
          <h2>1-Click Decision &amp; Action Engine (${list.length})</h2>
          <p>Live recommendations based on your CPVL target, frequency fatigue, CTR hook strength, and sales speed-to-lead.</p>
        </div>
      </div>
      ${list.length
        ? html`<div class="alerts">${list.slice(0, 10).map((a) => html`<div class="alert ${a.tone}">
            <span class="dot"></span>
            <div class="grow">
              <b>${a.title}</b>${a.name ? html` <span class="muted small">· ${a.name}</span>` : ""}
              <p>${a.text}</p>
            </div>
            <div class="row wrap" style="flex:none">
              ${a.action === "scale_20" && a.adsetId && a.dailyBudget ? html`<button class="btn sm primary" type="button" data-quick-scale="${a.adsetId}" data-budget="${a.dailyBudget}" data-pct="20" data-name="${a.name}">Scale +20%</button>` : ""}
              ${a.action === "scale_15" && a.adsetId && a.dailyBudget ? html`<button class="btn sm" type="button" data-quick-scale="${a.adsetId}" data-budget="${a.dailyBudget}" data-pct="15" data-name="${a.name}">Boost +15%</button>` : ""}
              ${a.action === "pause" && a.adsetId ? html`<button class="btn sm danger" type="button" data-quick-pause="${a.adsetId}" data-name="${a.name}">Pause Ad Set</button>` : ""}
              ${a.lead ? html`<a class="btn sm primary" href="#/leads">Call Now</a>` : a.campaignId ? html`<a class="btn sm" href="#/campaigns/${a.campaignId}">Open</a>` : ""}
            </div>
          </div>`)}</div>`
        : html`<div class="empty"><h3>All systems optimal</h3><p>${tree ? "Every active ad set is within target CPVL and frequency thresholds." : "Alerts activate once campaigns and leads are loaded."}</p></div>`}
    </div>

    <div class="card">
      <div class="card-head">
        <div>
          <h2>Priority Speed-to-Lead Queue (Graded A/B/C)</h2>
          <p>Highest-grade untouched buyers first. Calling within ${t.speedToLead} min triples reservation conversion.</p>
        </div>
        <a class="btn sm" href="#/leads">All Leads (${n(leads.length)})</a>
      </div>
      ${waiting.length
        ? html`<div class="table-wrap"><table>
            <thead><tr><th>Grade</th><th>Buyer &amp; Corridor</th><th>Project &amp; Campaign</th><th class="n">Waiting</th><th>Quick Call</th></tr></thead>
            <tbody>${waiting.slice(0, 8).map(({ l, g }) => {
              const p = ctx.catalog?.projects?.find((x) => x.id === l.project);
              const digits = String(l.phone || "").replace(/[^\d]/g, "");
              const wa = digits.startsWith("01") && digits.length === 11 ? `2${digits}` : digits;
              return html`<tr>
                <td><span class="pill ${g.tone}">Grade ${g.grade}</span></td>
                <td>
                  <div class="name">${l.name || l.phone || "No name"}</div>
                  <div class="tiny muted">${l.city || "New Cairo"} · ${l.phone || ""}</div>
                </td>
                <td>
                  <div>${p ? html`<span class="pill accent">${p.name}</span>` : ""}</div>
                  <div class="tiny muted">${l.adsetName || l.campaignName || l.source || ""}</div>
                </td>
                <td class="n ${l.stage === "new" && Date.now() - new Date(l.created) > t.speedToLead * 60000 ? "late" : ""}">${ago(l.created)}</td>
                <td class="n">
                  ${wa ? html`<a class="btn sm" href="https://wa.me/${wa}" target="_blank" rel="noopener">WA</a> <a class="btn sm ghost" href="tel:+${wa}">Call</a>` : ""}
                </td>
              </tr>`;
            })}</tbody>
          </table></div>`
        : html`<div class="empty"><h3>Zero leads waiting</h3><p>Every lead has been contacted on time.</p></div>`}
    </div>
  </div>

  ${tree ? html`
  <div class="card" style="margin-bottom:14px">
    <div class="card-head">
      <div>
        <h2>G Developments Portfolio: Spend vs. Valid Buyers &amp; ATS Stock</h2>
        <p>Align your media budget with actual available inventory from the developer's Primary ATS sheets (1,787 units).</p>
      </div>
      <a class="btn sm" href="#/inventory">Full ATS Stock</a>
    </div>
    ${renderProjectMatrix(ctx, leads, since, until, t)}
  </div>` : ""}

  ${rank ? html`<div class="grid g3" style="margin-bottom:14px">
    <div class="card">
      <div class="card-head"><div><h2>Top Winning Ad Sets</h2><p>Lowest cost per valid buyer. Scale +15–20% every 3 days.</p></div></div>
      ${rank.best.length ? html`<div class="table-wrap"><table><thead><tr><th>Ad Set</th><th class="n">Valid</th><th class="n">CPVL</th></tr></thead><tbody>${rank.best.map((r) => html`<tr><td><a href="#/campaigns/${r.c.id}" class="name">${r.a.name}</a><div class="tiny muted">${r.c.name}</div></td><td class="n">${n(r.s.valid)}</td><td class="n"><b class="stage-valid">${money(r.s.cpvl)}</b></td></tr>`)}</tbody></table></div>` : html`<p class="muted small">Mark valid leads in Leads to rank ad sets.</p>`}
    </div>
    <div class="card">
      <div class="card-head"><div><h2>Top Geo Buyer Corridors</h2><p>Where valid buyers live right now across Egypt &amp; GCC.</p></div><a class="btn sm" href="#/geo">Open Map</a></div>
      ${topCorridors.length ? html`<div class="table-wrap"><table><thead><tr><th>Corridor</th><th class="n">Spend</th><th class="n">Valid</th><th class="n">CPVL</th></tr></thead><tbody>${topCorridors.map((c) => html`<tr><td><a href="#/geo" class="name">${c.id}</a><div class="tiny muted">${c.gov}</div></td><td class="n">${money(c.spend, { short: true })}</td><td class="n"><b>${n(c.valid)}</b></td><td class="n"><b>${money(c.cpvl, { short: true })}</b></td></tr>`)}</tbody></table></div>` : html`<p class="muted small">No geo data yet.</p>`}
    </div>
    <div class="card">
      <div class="card-head"><div><h2>Spending With 0 Valid Buyers</h2><p>Tighten geo/budget filter or pause immediately.</p></div></div>
      ${rank.waste.length ? html`<div class="table-wrap"><table><thead><tr><th>Ad Set</th><th class="n">Spend</th><th class="n">Leads</th></tr></thead><tbody>${rank.waste.map((r) => html`<tr><td><a href="#/campaigns/${r.c.id}" class="name">${r.a.name}</a><div class="tiny muted">${r.c.name}</div></td><td class="n">${money(r.s.spend)}</td><td class="n">${n(r.s.metaLeads)}</td></tr>`)}</tbody></table></div>` : html`<div class="empty"><p>Zero wasted ad sets — every spending ad set has generated valid buyers!</p></div>`}
    </div>
  </div>` : ""}

  <div class="card">
    <div class="card-head"><div><h2>Decision Engine Thresholds &amp; Targets</h2><p>Controls when the dashboard flags an ad set to Scale +20%, Fix Hook, or Pause Waste.</p></div></div>
    ${targetsForm()}
  </div>`;
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
  root.onclick = async (e) => {
    const scaleBtn = e.target.closest("[data-quick-scale]");
    if (scaleBtn) {
      const id = scaleBtn.dataset.quickScale;
      const cur = Number(scaleBtn.dataset.budget);
      const pctStep = Number(scaleBtn.dataset.pct) || 20;
      const name = scaleBtn.dataset.name;
      const next = Math.round(cur * (1 + pctStep / 100));
      const ok = await confirmDialog({
        title: `Scale ${name} by +${pctStep}%?`,
        body: html`Daily budget: <b>${money(cur)}/day → ${money(next)}/day</b> (+${pctStep}%).<br><span class="small muted">Keeps the ad set inside Meta's safe scaling window without resetting learning.</span>`,
        ok: `Scale to ${money(next)}/day`,
      });
      if (!ok) return;
      try {
        await post("/api/budget", { id, field: "daily_budget", amount: next });
        toast(`Scaled ${name} to ${money(next)}/day.`, "good");
        ctx.loadTree(true);
      } catch (err) {
        toast(err.message, "bad");
      }
      return;
    }
    const pauseBtn = e.target.closest("[data-quick-pause]");
    if (pauseBtn) {
      const id = pauseBtn.dataset.quickPause;
      const name = pauseBtn.dataset.name;
      const ok = await confirmDialog({
        title: `Pause ${name}?`,
        body: html`Stops budget drain immediately while preserving historical data.`,
        ok: "Pause Ad Set",
        danger: true,
      });
      if (!ok) return;
      try {
        await post("/api/status", { id, status: "PAUSED", kind: "ad set" });
        toast(`Paused ${name}.`, "good");
        ctx.loadTree(true);
      } catch (err) {
        toast(err.message, "bad");
      }
    }
  };
}

export const _raw = raw;
