// Website: what the ads' visitors do on the website, and whether the tracking
// that feeds Meta works: the Pixel in the browser, the Conversions API from
// this server (/collect, lib/collect.mjs) and the ref code at the end of every
// WhatsApp message (refcode.js). The website's side is js/site.js in the
// website's repository.
import { html, money, n, pct, egp, copy, dateTime, ago } from "../ui.js";
import { get } from "../api.js";
import { load, save } from "../store.js";
import { allLeads, websiteFunnel, treeDates } from "../model.js";
import { resolveRef } from "../refcode.js";
import { META_PARAMS } from "./links.js";
import { kpi } from "./common.js";

let data = null;
let loading = false;
let mode = null;

// The server keeps events in memory only (the free plan restarts it after it
// sleeps), so every time this screen loads them they are added to this
// browser's copy. They hold no names or phone numbers.
const KEEP_DAYS = 90;
const KEEP_MAX = 5000;
export function keep(events, have = load("webEvents", [])) {
  const ids = new Set(have.map((e) => e.id));
  const cutoff = new Date(Date.now() - KEEP_DAYS * 864e5).toISOString();
  return [...events.filter((e) => e && e.id && !ids.has(e.id)), ...have]
    .filter((e) => String(e.at) >= cutoff)
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, KEEP_MAX);
}

function fetchData(ctx, force = false) {
  if (loading || (data && !force)) return;
  loading = true;
  get("/api/tracking", force ? { fresh: 1 } : {})
    .then((d) => {
      data = d;
      save("webEvents", keep(d.events || []));
    })
    .catch((e) => (data = { error: e.message }))
    .finally(() => {
      loading = false;
      ctx.render();
    });
}

// Website event → Meta event (js/site.js, META_EVENT).
const META_EVENTS = [
  ["PageView", "Every page"],
  ["ViewContent", "A project page, a project picked on the home page, a Krypton layout, the film"],
  ["CustomizeProduct", "A payment plan opened"],
  ["Contact", "The WhatsApp or call button"],
  ["Lead", "The brief sent (it opens WhatsApp with their answers)"],
  ["BrochureDownload", "A brochure downloaded (custom event)"],
];

/** Pass/fail lines for the tracking card. */
export function checks(d, events, siteUrl, origin) {
  const c = d.capi;
  const out = [];
  out.push(
    c.received
      ? { tone: "good", title: "Website events arrive here", text: `${n(c.received)} since the server started ${ago(c.since)}${c.queued ? `; ${n(c.queued)} about to go to Meta` : ""}.` }
      : { tone: "warn", title: "No website events yet", text: `None since the server started ${ago(c.since)}. The website sends them to ${origin}/collect: check collectUrl in its data/site_config.json, and that WEBSITE_ORIGINS here includes the website (now ${c.origins.join(", ") || "nothing"}). A new visit to the website should show here within a minute.` },
  );
  if (c.off) out.push({ tone: "warn", title: "Conversions API is switched off", text: "META_CAPI is 0 on Render, so events stay in this dashboard. Remove it to pass them to Meta." });
  else if (!c.datasetSet) out.push({ tone: "warn", title: "Conversions API not set up", text: "Set META_DATASET_ID (the Pixel ID) on Render. Until then events stay in this dashboard and Meta learns only from the browser Pixel, which ad blockers and iPhones often stop." });
  else if (c.failed && !c.sent) out.push({ tone: "bad", title: "Meta refuses the website events", text: `${n(c.failed)} refused. Meta said: ${c.lastError}` });
  else if (c.sent) out.push({ tone: c.failed ? "warn" : "good", title: "Passed to Meta's Conversions API", text: `${n(c.sent)} sent${c.test ? ` (${n(c.test)} as test events)` : ""}, the last ${ago(c.lastSentAt)}.${c.failed ? ` ${n(c.failed)} refused, ${ago(c.lastErrorAt)}: ${c.lastError}` : ""}` });
  else out.push({ tone: "info", title: "Conversions API is on", text: "Nothing sent yet: it starts with the next website visit." });
  if (d.pixelError) out.push({ tone: "bad", title: "Could not read the Pixel", text: `${d.pixelError} Check META_DATASET_ID and that the Pixel is assigned to the system user.` });
  else if (d.pixel) {
    const total = Object.values(d.pixel.byEvent || {}).reduce((t, v) => t + v, 0);
    out.push(
      d.pixel.lastFired
        ? { tone: total ? "good" : "warn", title: `Meta Pixel: ${d.pixel.name || d.pixel.id}`, text: `Last event ${ago(d.pixel.lastFired)}; ${n(total)} events in the last ${d.pixel.days} days, browser and server together.${d.pixel.statsError ? ` (Counts unavailable: ${d.pixel.statsError})` : ""}` }
        : { tone: "warn", title: `Meta Pixel: ${d.pixel.name || d.pixel.id}`, text: "Meta has not received any event yet. Put this Pixel ID in the website's data/site_config.json (metaPixelId) too." },
    );
  }
  // Do ads carry ad_id, so the WhatsApp ref code names the ad?
  const week = new Date(Date.now() - 7 * 864e5).toISOString();
  const fromAds = events.filter((e) => e.at >= week && !e.test && /^(fb|ig|facebook|instagram|meta|an|msg)$/i.test(e.utmSource || ""));
  if (fromAds.length >= 5) {
    const tagged = fromAds.filter((e) => e.adId).length / fromAds.length;
    out.push(
      tagged >= 0.9
        ? { tone: "good", title: "Ads tag their links", text: `${pct(tagged * 100, 0)} of visits from ads this week carry the ad id, so their WhatsApp messages name the ad.` }
        : { tone: "warn", title: "Some ads do not tag their links", text: `Only ${pct(tagged * 100, 0)} of visits from ads this week carry the ad id. Paste the URL parameters below into every ad that sends people to ${siteUrl.replace(/^https?:\/\//, "")}.` },
    );
  }
  return out;
}

function pageDiagnosis(r, hasEvents) {
  if (!r.spend && !r.landingViews) return { tone: "line", label: "No paid traffic", tip: "No campaign sends people to this page in this period." };
  if (r.lpvRate !== null && r.lpvRate < 70) return { tone: "warn", label: "Clicks leave before the page loads", tip: `Only ${pct(r.lpvRate, 0)} of link clicks wait for the page. Check the page's speed on a phone (film and image sizes).` };
  if (!hasEvents) return { tone: "line", label: "No website events yet", tip: "See Tracking above." };
  if (r.onsiteCvr !== null && r.onsiteCvr >= 16 && r.validLeads >= 2) return { tone: "good", label: "Converts well", tip: `${pct(r.onsiteCvr, 1)} of visitors tap WhatsApp, call or send a brief. Give its ad sets more budget, about 20% at a time.` };
  if (r.landingViews >= 100 && r.validLeads === 0) return { tone: "bad", label: "Visitors, no buyers", tip: "People land but do not qualify. Put the down payment and starting price in the ad itself, so the wrong people do not click." };
  return { tone: "info", label: "Normal", tip: `${n(r.layoutViews)} layout views and ${n(r.paymentViews)} payment plans opened. Retarget the last 30 days of visitors.` };
}

function sourceOf(e, ctx) {
  const r = resolveRef(e.ref, { tree: ctx.tree, links: load("links", []) });
  if (r.kind === "ad" && r.adName) return `${r.adName} · ${r.campaignName}`;
  if (r.kind === "ad") return `Ad ${r.adId}`;
  if (r.kind === "link") return `Tracked link ${r.code}`;
  if (e.utmSource) return [e.utmSource, e.utmCampaign].filter(Boolean).join(" · ");
  return "Direct or search";
}

export function render(ctx) {
  if (ctx.settings && mode !== Boolean(ctx.settings.demo)) {
    mode = Boolean(ctx.settings.demo);
    data = null;
  }
  const demo = Boolean(ctx.settings?.demo);
  fetchData(ctx);
  const siteUrl = ctx.catalog?.site?.url || "https://mahmoud-elhemaly.onrender.com";
  const events = load("webEvents", []);
  const { since, until } = ctx.tree ? treeDates(ctx.tree) : { since: null, until: null };
  const inPeriod = events.filter((e) => !e.test && (!since || String(e.at).slice(0, 10) >= since) && (!until || String(e.at).slice(0, 10) <= until));
  const hasEvents = demo || inPeriod.length > 0;
  const rows = websiteFunnel(ctx.tree, allLeads(), ctx.catalog, events, { estimate: demo });
  const tot = rows.reduce(
    (a, r) => ({ spend: a.spend + r.spend, clicks: a.clicks + r.linkClicks, lpv: a.lpv + r.landingViews, layouts: a.layouts + r.layoutViews, payments: a.payments + r.paymentViews, wa: a.wa + r.waClicks, calls: a.calls + r.callClicks, briefs: a.briefs + r.briefs, valid: a.valid + r.validLeads }),
    { spend: 0, clicks: 0, lpv: 0, layouts: 0, payments: 0, wa: 0, calls: 0, briefs: 0, valid: 0 },
  );
  const lpvRate = tot.clicks > 0 ? (tot.lpv / tot.clicks) * 100 : null;
  const actions = tot.wa + tot.calls + tot.briefs;
  const cvr = tot.lpv > 0 && hasEvents ? (actions / tot.lpv) * 100 : null;
  const dash = (v) => (hasEvents ? n(v) : "—");
  const steps = [
    ["Link clicks", tot.clicks, "From Meta", 100],
    ["Landing page views", tot.lpv, lpvRate !== null ? `${pct(lpvRate, 0)} of clicks wait for the page` : "From Meta", tot.clicks ? Math.round((tot.lpv / tot.clicks) * 100) : 0],
    ["Layouts and payment plans", hasEvents ? tot.layouts + tot.payments : null, "Looking closely", tot.lpv && hasEvents ? Math.min(100, Math.round(((tot.layouts + tot.payments) / tot.lpv) * 100)) : 0],
    ["WhatsApp, calls and briefs", hasEvents ? actions : null, cvr !== null ? `${pct(cvr, 1)} of page views` : "Asking", tot.lpv && hasEvents ? Math.min(100, Math.round((actions / tot.lpv) * 100)) : 0],
    ["Valid buyers", tot.valid, "After the sales call", actions ? Math.min(100, Math.round((tot.valid / actions) * 100)) : 0],
  ];
  const first = events.length ? events[events.length - 1].at : null;

  const top = html`<div class="top">
    <div><h1>Website</h1><p class="sub">What people from the ads do on <a href="${siteUrl}" target="_blank" rel="noopener" class="linkish">${siteUrl.replace(/^https?:\/\//, "")}</a>, and whether Meta hears about it.${since ? ` ${since} to ${until}.` : ""}</p></div>
    <div class="top-actions"><a class="btn" href="${siteUrl}" target="_blank" rel="noopener">Open the website ↗</a>${ctx.settings?.connected ? html`${ctx.periodSwitch()}${ctx.refreshButton()}` : html`<button class="btn icon" type="button" data-trefresh title="Refresh" aria-label="Refresh">↻</button>`}</div>
  </div>`;

  let tracking;
  if (!data) tracking = html`<div class="card"><p class="muted"><span class="spin"></span> Checking the tracking…</p></div>`;
  else if (data.error) tracking = html`<div class="note bad"><b>Could not read the tracking.</b> ${data.error}</div>`;
  else {
    const list = checks(data, events, siteUrl, location.origin);
    tracking = html`<div class="card">
      <div class="card-head"><div><h2>Tracking</h2><p>${demo ? "Demo: made-up tracking. " : ""}Meta learns who your buyers are from these events. Without them it optimises for clicks, not for people who message.</p></div></div>
      <div class="alerts">${list.map((x) => html`<div class="alert ${x.tone}"><span class="dot"></span><div class="grow"><b>${x.title}</b><p>${x.text}</p></div></div>`)}</div>
      <div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Meta event</th><th>Sent when</th><th class="n">Meta counted (7 days)</th><th class="n">Passed on by this server</th></tr></thead><tbody>
        ${META_EVENTS.map(([ev, when]) => html`<tr><td style="white-space:nowrap"><code>${ev}</code></td><td class="small" style="min-width:200px">${when}</td><td class="n">${data.pixel ? n(data.pixel.byEvent?.[ev] || 0) : "—"}</td><td class="n">${n(data.capi.byEvent?.[ev] || 0)}</td></tr>`)}
      </tbody></table></div>
      <p class="tiny muted" style="margin-top:6px">"Passed on" counts since the server started ${ago(data.capi.since)}; Meta's column is the full count.</p>
    </div>`;
  }

  return html`${top}
  ${tracking}
  <div class="card">
    <div class="card-head"><div><h2>Set it up once</h2><p>Four steps. The website's part is already built.</p></div></div>
    <ol class="steps">
      <li><div><b>The Pixel ID.</b> Events Manager → Data sources → the G Developments Pixel → copy its ID. Put it on Render as <code>META_DATASET_ID</code>, and in the website's <code>data/site_config.json</code> as <code>metaPixelId</code>. In Business settings, assign the Pixel to the system user.</div></li>
      <li><div><b>Tag every ad.</b> Ads Manager → the ad → Tracking → URL parameters, paste:
        <div class="row" style="margin-top:6px;align-items:flex-start"><code class="grow" style="word-break:break-all">${META_PARAMS}</code><button class="btn sm" type="button" data-tcopy="${META_PARAMS}" data-what="URL parameters copied">Copy</button></div>
        The website then ends every WhatsApp message with a code like <code>(Ref W-1J3TB5W4QGVK)</code>. Paste that message under Leads → Add a lead and the ad fills in by itself.</div></li>
      <li><div><b>Test it.</b> Events Manager → Test events → copy the test code to Render as <code>META_TEST_EVENT_CODE</code>. Open <a class="linkish" href="${siteUrl}/?track=test" target="_blank" rel="noopener">${siteUrl.replace(/^https?:\/\//, "")}/?track=test</a> and tap WhatsApp: the events show in Test events within a minute. Delete the code afterwards.</div></li>
      <li><div><b>Optimise for it.</b> In website ad sets, pick <code>Contact</code> as the conversion event once it happens about 50 times a week (Meta needs that many to finish learning). Until then use landing page views.</div></li>
    </ol>
  </div>
  <div class="kpis" style="margin:14px 0">
    ${kpi("Link clicks", n(tot.clicks), "from Meta")}
    ${kpi("Landing page views", n(tot.lpv), lpvRate !== null ? `${pct(lpvRate, 0)} of clicks` : "from Meta")}
    ${kpi("WhatsApp taps", dash(tot.wa), "on the website", true)}
    ${kpi("Call taps", dash(tot.calls), "on the website")}
    ${kpi("Briefs sent", dash(tot.briefs), "the website form")}
    ${kpi("Page views that ask", cvr !== null ? pct(cvr, 1) : "—", "WhatsApp, calls and briefs ÷ page views", true)}
    ${kpi("Cost per website ask", actions > 0 && hasEvents ? money(tot.spend / actions) : "—", `${n(tot.valid)} valid buyers`, true)}
  </div>
  <div class="card">
    <div class="card-head"><div><h2>From ad click to valid buyer</h2><p>${demo ? "Demo: the website steps are estimates from landing page views." : hasEvents ? `Website steps: the events this browser has kept${first ? ` since ${dateTime(first)}` : ""}.` : "The website steps fill in once website events arrive (see Tracking)."}</p></div></div>
    <div class="funnel">
      ${steps.map(([label, val, sub, bar], i) => html`<div class="${i >= 3 ? "key" : ""}"><span>${i + 1}. ${label}</span><b>${val === null ? "—" : n(val)}</b><small>${sub}</small><div class="bar"><i style="width:${bar}%"></i></div></div>`)}
    </div>
  </div>
  <div class="card">
    <div class="card-head"><div><h2>Project pages</h2><p>Send each ad to its project's page, not the home page.</p></div></div>
    <div class="table-wrap"><table>
      <thead><tr><th>Page</th><th class="n">Spend</th><th class="n">Link clicks</th><th class="n">Page views</th><th class="n">Layouts / payment</th><th class="n">WhatsApp / calls</th><th class="n">Ask rate</th><th class="n">Valid buyers</th><th>What it says</th></tr></thead>
      <tbody>${rows.map((r) => {
        const dg = pageDiagnosis(r, hasEvents);
        return html`<tr>
          <td><div class="name"><a href="${r.project.url}" target="_blank" rel="noopener" class="linkish">${r.project.name}</a></div><div class="tiny muted"><code>/${r.project.slug}/</code>${r.project.from ? ` · from ${egp(r.project.from)}` : ""}</div></td>
          <td class="n">${money(r.spend)}</td>
          <td class="n">${n(r.linkClicks)}</td>
          <td class="n">${n(r.landingViews)}${r.lpvRate !== null ? html` <span class="tiny muted">(${pct(r.lpvRate, 0)})</span>` : ""}</td>
          <td class="n">${hasEvents ? `${n(r.layoutViews)} / ${n(r.paymentViews)}` : "—"}</td>
          <td class="n">${hasEvents ? `${n(r.waClicks)} / ${n(r.callClicks)}` : "—"}</td>
          <td class="n">${hasEvents && r.onsiteCvr !== null ? pct(r.onsiteCvr, 1) : "—"}</td>
          <td class="n"><b class="stage-valid">${n(r.validLeads)}</b></td>
          <td style="min-width:220px"><span class="pill ${dg.tone}">${dg.label}</span><div class="tiny muted" style="margin-top:3px">${dg.tip}</div></td>
        </tr>`;
      })}</tbody>
    </table></div>
  </div>
  <div class="card">
    <div class="card-head"><div><h2>Latest website events</h2><p>${events.length ? `${n(events.length)} kept in this browser.` : "None yet."} The source comes from the visit's ref code.</p></div></div>
    ${events.length ? html`<div class="table-wrap" style="max-height:420px"><table>
      <thead><tr><th>When</th><th>Event</th><th>Page</th><th>Source</th><th>Ref</th><th>Meta</th></tr></thead>
      <tbody>${events.slice(0, 40).map((e) => html`<tr>
        <td class="tiny muted">${dateTime(e.at)}</td>
        <td><b>${e.event}</b>${e.metaEvent ? html`<div class="tiny muted">${e.metaEvent}</div>` : ""}${e.place ? html`<div class="tiny muted">${e.place}</div>` : ""}</td>
        <td class="tiny mono">${e.page || "/"}</td>
        <td class="small">${sourceOf(e, ctx)}</td>
        <td class="tiny mono">${e.ref || ""}</td>
        <td>${!e.sent ? html`<span class="pill line">Kept here</span>` : e.test ? html`<span class="pill info">Test event</span>` : html`<span class="pill good">Sent</span>`}</td>
      </tr>`)}</tbody>
    </table></div>` : html`<p class="muted small">They show here once people visit the website.</p>`}
  </div>`;
}

export function mount(root, ctx) {
  root.onclick = (e) => {
    const c = e.target.closest("[data-tcopy]");
    if (c) return copy(c.dataset.tcopy, c.dataset.what || "Copied");
    // The page's refresh button (Meta) refreshes the tracking too.
    if (e.target.closest("[data-trefresh], [data-refresh]")) {
      data = null;
      fetchData(ctx, true);
      ctx.render();
    }
  };
}
