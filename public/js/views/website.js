// Website & Landing Page Funnel Analytics: connects the G Developments website
// (mahmoud-elhemaly.onrender.com / gdvelepomets-hemaly-) directly to running
// Meta campaigns, showing Ad Click → Landing Page View → On-Site Micro-Events
// (Residences tab, Payment Finder, 4K Film, Brochures) → WhatsApp/Call/Brief
// Conversions → Valid Buyers.
import { html, raw, money, n, pct, egp, copy, toast, dateTime } from "../ui.js";
import { get, post } from "../api.js";
import { load, save } from "../store.js";
import { allLeads, websiteFunnel, treeDates } from "../model.js";
import { kpi } from "./common.js";

let liveWebEvents = [];
let loadedWebEvents = false;

const EVENT_MAP = [
  ["Visits / Landing Page View", "PageView", "Fires on every project landing page (/krypton/, /ivy/, /golf-views/, etc.)", "Top of funnel"],
  ["WhatsApp click", "Contact (channel: whatsapp)", "Any WhatsApp button + floating advisor button with section location", "Macro conversion"],
  ["Call click", "Contact (channel: phone)", "Any 'Call a salesperson' (+20 122 727 5122) click with page placement", "Macro conversion"],
  ["Brief sent", "Lead", "Enquiry form submission with project interest, budget band & payment preference", "Macro conversion"],
  ["Krypton / Residences layout viewed", "ViewContent", "Visitor switches bedrooms (1BR / 2BR / 3BR) or zooms a floor plan", "High-intent signal"],
  ["Future Home / Payment plan opened", "CustomizeProduct", "Visitor filters by destination, home type or bedrooms in the payment finder", "High-intent signal"],
  ["Brochure request", "Schedule / Lead", "Visitor requests Krypton Blocks 1–2, Golf Views or Neon Views PDF dossier", "High-intent signal"],
  ["4K Film play", "ViewContent (video)", "Visitor opens the full NEWKAIRO or Krypton architectural film", "Engagement signal"],
];

async function fetchEvents(ctx) {
  let localEvts = [];
  try {
    localEvts = JSON.parse(localStorage.getItem("gmb.webEvents") || "[]");
  } catch {}
  if (loadedWebEvents) {
    if (localEvts.length > liveWebEvents.length) liveWebEvents = localEvts;
    return;
  }
  loadedWebEvents = true;
  try {
    const r = await get("/api/web-events");
    liveWebEvents = [...(r.events || []), ...localEvts].slice(0, 200);
    ctx.render();
  } catch {
    liveWebEvents = localEvts;
  }
}

function pageDiagnosis(r) {
  if (!r.spend && !r.landingViews) {
    return { tone: "line", label: "No paid traffic", tip: "No active campaign points to this page yet. Launch a campaign or use Tracked Links." };
  }
  if (r.lpvRate !== null && r.lpvRate < 70) {
    return { tone: "warn", label: "High click drop-off", tip: `Only ${pct(r.lpvRate, 0)} of link clicks wait for the page to load. Check mobile video size or use Instant Forms + WhatsApp.` };
  }
  if (r.onsiteCvr !== null && r.onsiteCvr >= 16 && r.validLeads >= 2) {
    return { tone: "good", label: "High-converting page", tip: `${pct(r.onsiteCvr, 1)} of visitors click WhatsApp/Call/Brief. Scale traffic to /${r.project.slug}/ by +20%.` };
  }
  if (r.landingViews >= 100 && r.validLeads === 0) {
    return { tone: "bad", label: "Low buyer qualification", tip: "Visitors land but don't qualify. Anchor the 5% down entry & starting price in the ad headline." };
  }
  return { tone: "info", label: "Healthy engagement", tip: `${n(r.layoutViews)} residence views & ${n(r.paymentViews)} payment explorations. Retarget 30-day visitors.` };
}

export function render(ctx) {
  fetchEvents(ctx);
  const leads = allLeads();
  const rows = websiteFunnel(ctx.tree, leads, ctx.catalog, liveWebEvents);
  const { since, until } = ctx.tree ? treeDates(ctx.tree) : { since: null, until: null };
  const siteUrl = ctx.catalog?.site?.url || "https://mahmoud-elhemaly.onrender.com";
  const webCfg = load("websiteTracking", { pixelId: "", umamiShareUrl: "" });

  const tot = rows.reduce(
    (a, r) => ({
      spend: a.spend + r.spend,
      clicks: a.clicks + r.linkClicks,
      lpv: a.lpv + r.landingViews,
      layouts: a.layouts + r.layoutViews,
      payments: a.payments + r.paymentViews,
      films: a.films + r.filmPlays,
      brochures: a.brochures + r.brochures,
      wa: a.wa + r.waClicks,
      calls: a.calls + r.callClicks,
      briefs: a.briefs + r.briefs,
      valid: a.valid + r.validLeads,
    }),
    { spend: 0, clicks: 0, lpv: 0, layouts: 0, payments: 0, films: 0, brochures: 0, wa: 0, calls: 0, briefs: 0, valid: 0 },
  );

  const lpvRate = tot.clicks > 0 ? (tot.lpv / tot.clicks) * 100 : null;
  const microTotal = tot.layouts + tot.payments + tot.films + tot.brochures;
  const macroTotal = tot.wa + tot.calls + tot.briefs;
  const onsiteCvr = tot.lpv > 0 ? (macroTotal / tot.lpv) * 100 : null;

  const funnelSteps = [
    ["Ad Link Clicks", tot.clicks, "From Meta Ads", 100],
    ["Landing Page Views", tot.lpv, lpvRate ? `${pct(lpvRate, 0)} load rate` : "Website loads", tot.clicks ? Math.round((tot.lpv / tot.clicks) * 100) : 0],
    ["Residences & Payment Views", tot.layouts + tot.payments, "High-intent exploration", tot.lpv ? Math.min(100, Math.round(((tot.layouts + tot.payments) / tot.lpv) * 100)) : 0],
    ["WhatsApp, Calls & Briefs", macroTotal, onsiteCvr ? `${pct(onsiteCvr, 1)} page CVR` : "Direct enquiries", tot.lpv ? Math.min(100, Math.round((macroTotal / tot.lpv) * 100)) : 0],
    ["Verified Valid Buyers", tot.valid, "Qualified by sales", macroTotal ? Math.min(100, Math.round((tot.valid / Math.max(1, macroTotal)) * 100)) : 0],
  ];

  return html`
  <div class="top">
    <div>
      <h1>Website &amp; Landing Page Funnel</h1>
      <p class="sub">Live bridge between your paid campaigns and <a href="${siteUrl}" target="_blank" rel="noopener" class="linkish">${siteUrl.replace(/^https?:\/\//, "")}</a> (${since || "active period"} to ${until || "today"}).</p>
    </div>
    <div class="top-actions">
      <a class="btn" href="${siteUrl}" target="_blank" rel="noopener">Open Live Website ↗</a>
      <button class="btn" type="button" data-test-webevent>Simulate Website Conversion</button>
      ${ctx.settings?.connected ? html`${ctx.periodSwitch()}${ctx.refreshButton()}` : ""}
    </div>
  </div>

  <div class="kpis" style="margin-bottom:14px">
    ${kpi("Ad Link Clicks", n(tot.clicks), "Traffic sent to site")}
    ${kpi("Landing Page Views", n(tot.lpv), lpvRate ? `${pct(lpvRate, 1)} click-to-LPV rate` : "")}
    ${kpi("On-Site Micro-Events", n(microTotal), `${n(tot.layouts)} layouts · ${n(tot.payments)} payment plans`)}
    ${kpi("WhatsApp Enquiries", n(tot.wa), "From hero, project & float CTA", true)}
    ${kpi("Salesperson Calls", n(tot.calls), "+20 122 727 5122 clicks", true)}
    ${kpi("Website Briefs Sent", n(tot.briefs), "Pre-filled WhatsApp briefs")}
    ${kpi("On-Site Conversion Rate", pct(onsiteCvr, 1), "Macro actions ÷ LPV", true)}
    ${kpi("Cost / Website Action", macroTotal > 0 ? money(tot.spend / macroTotal) : "—", `${n(tot.valid)} valid buyers converted`, true)}
  </div>

  <div class="card" style="margin-bottom:14px">
    <div class="card-head">
      <div>
        <h2>Ad-to-Website-to-Valid-Buyer Waterfall</h2>
        <p>Tracks where traffic drops off between the Meta ad click, the project landing page, on-site floor-plan/payment tools, and sales qualification.</p>
      </div>
    </div>
    <div class="funnel">
      ${funnelSteps.map(([label, val, sub, barPct], idx) => html`<div class="${idx >= 3 ? "key" : ""}">
        <span>${idx + 1}. ${label}</span>
        <b>${n(val)}</b>
        <small>${sub}</small>
        <div class="bar"><i style="width:${barPct}%"></i></div>
      </div>`)}
    </div>
  </div>

  <div class="card" style="margin-bottom:14px">
    <div class="card-head">
      <div>
        <h2>Project Landing Pages Performance (13 Themed Pages)</h2>
        <p>Every project on the website has its own themed URL, Residences tab, and "Choose your future home" payment finder. Send ad traffic directly to the project slug, never the generic home page.</p>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Project Landing Page</th>
            <th class="n">Ad Spend</th>
            <th class="n">Link Clicks</th>
            <th class="n">LPV (Load %)</th>
            <th class="n">Layouts / Payment</th>
            <th class="n">Film / PDF</th>
            <th class="n">WhatsApp / Calls</th>
            <th class="n">Page CVR</th>
            <th class="n">Valid Buyers</th>
            <th>CRO &amp; Media Diagnosis</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => {
            const diag = pageDiagnosis(r);
            return html`<tr>
              <td>
                <div class="name"><a href="${r.project.url}" target="_blank" rel="noopener" class="linkish">${r.project.name}</a></div>
                <div class="tiny muted"><code>/${r.project.slug}/</code> · From ${egp(r.project.from)}</div>
              </td>
              <td class="n">${money(r.spend)}</td>
              <td class="n">${n(r.linkClicks)}</td>
              <td class="n">${n(r.landingViews)} ${r.lpvRate ? html`<span class="tiny muted">(${pct(r.lpvRate, 0)})</span>` : ""}</td>
              <td class="n">${n(r.layoutViews)} / ${n(r.paymentViews)}</td>
              <td class="n">${n(r.filmPlays)} / ${n(r.brochures)}</td>
              <td class="n"><b>${n(r.waClicks)} WA · ${n(r.callClicks)} Call</b></td>
              <td class="n"><b>${pct(r.onsiteCvr, 1)}</b></td>
              <td class="n"><b class="stage-valid">${n(r.validLeads)}</b></td>
              <td style="min-width:230px">
                <span class="pill ${diag.tone}">${diag.label}</span>
                <div class="tiny muted" style="margin-top:3px">${diag.tip}</div>
              </td>
            </tr>`;
          })}
        </tbody>
      </table>
    </div>
  </div>

  <div class="grid g2">
    <div class="card">
      <div class="card-head">
        <div>
          <h2>Meta Pixel, Conversions API &amp; Umami Bridge</h2>
          <p>The website already tracks all 8 buyer intent events and forwards them to Umami, Meta Pixel (<code>fbq</code>), and this dashboard's webhook.</p>
        </div>
      </div>
      <form class="stack" data-web-cfg>
        <label class="field">
          <span>Meta Pixel / Dataset ID (fires PageView, ViewContent, CustomizeProduct, Contact, Lead)</span>
          <input class="input mono" name="pixelId" value="${webCfg.pixelId || ""}" placeholder="e.g. 123456789012345">
        </label>
        <label class="field">
          <span>Umami Cloud Share URL (optional live embed)</span>
          <input class="input" name="umamiShareUrl" value="${webCfg.umamiShareUrl || ""}" placeholder="https://cloud.umami.is/share/...">
        </label>
        <div class="row wrap">
          <button class="btn primary" type="submit">Save Tracking Config</button>
          <button class="btn" type="button" data-copy-siteconfig>Copy site_config.json Snippet</button>
        </div>
      </form>
      ${webCfg.umamiShareUrl ? html`<div style="margin-top:12px;border:1px solid var(--line);border-radius:10px;overflow:hidden"><iframe src="${webCfg.umamiShareUrl}" title="Umami Live Analytics" style="width:100%;height:380px;border:0" loading="lazy"></iframe></div>` : ""}
    </div>

    <div class="card">
      <div class="card-head">
        <div>
          <h2>Tracked Website Events → Meta Optimization</h2>
          <p>How every visitor click on the G Developments website trains Meta's algorithm.</p>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Website Event</th><th>Meta Pixel / CAPI Event</th><th>Role</th></tr></thead>
          <tbody>
            ${EVENT_MAP.map(([w, m, desc, role]) => html`<tr>
              <td><div class="name">${w}</div><div class="tiny muted">${desc}</div></td>
              <td><code>${m}</code></td>
              <td><span class="pill ${role.includes("Macro") ? "good" : "info"}">${role}</span></td>
            </tr>`)}
          </tbody>
        </table>
      </div>
      ${liveWebEvents.length ? html`
        <hr class="hr">
        <h3>Recent Live Webhook Events (${liveWebEvents.length})</h3>
        <div class="table-wrap" style="margin-top:6px;max-height:180px">
          <table>
            <thead><tr><th>Time</th><th>Event</th><th>Project / Page</th><th>Campaign / Ref</th></tr></thead>
            <tbody>
              ${liveWebEvents.slice(0, 12).map((e) => html`<tr>
                <td class="tiny muted">${dateTime(e.at)}</td>
                <td><b>${e.event}</b></td>
                <td>${e.project || e.page}</td>
                <td class="tiny mono">${e.ref || e.utmCampaign || "direct"}</td>
              </tr>`)}
            </tbody>
          </table>
        </div>` : ""}
    </div>
  </div>`;
}

export function mount(root, ctx) {
  root.onsubmit = (e) => {
    const form = e.target.closest("[data-web-cfg]");
    if (!form) return;
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    save("websiteTracking", d);
    toast("Website tracking configuration saved.", "good");
    ctx.render();
  };
  root.onclick = async (e) => {
    if (e.target.closest("[data-copy-siteconfig]")) {
      const cfg = load("websiteTracking", { pixelId: "", umamiShareUrl: "" });
      const snippet = JSON.stringify(
        {
          metaPixelId: cfg.pixelId || "YOUR_META_PIXEL_ID",
          mediaDashboardWebhook: `${location.origin}/api/web-event`,
          umamiShareUrl: cfg.umamiShareUrl || "",
        },
        null,
        2,
      );
      return copy(snippet, "Copied site_config.json analytics snippet");
    }
    if (e.target.closest("[data-test-webevent]")) {
      const sample = {
        event: "WhatsApp click",
        project: "krypton",
        page: "/krypton/",
        place: "Krypton Residences 5% Entry CTA",
        utm_source: "meta",
        utm_campaign: "gd-krypton-leads-broad-nov",
        ref: "KR-1121-A1",
      };
      try {
        await post("/api/web-event", sample);
      } catch {
        /* local fallback */
      }
      liveWebEvents.unshift({ ...sample, at: new Date().toISOString(), utmCampaign: sample.utm_campaign });
      toast("Simulated website WhatsApp conversion received from /krypton/.", "good");
      ctx.render();
    }
  };
}
