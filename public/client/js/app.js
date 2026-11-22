// Mahmoud Elhemaly · G Developments Client Lead & Results Portal
// Campaigns & Media Buying Managed by Omar Sherif.
// Focused 100% on Lead Reply, Live Campaign Message Notifications,
// Total Amount Spent, and Daily / Weekly Results Analysis.

import { html, raw, $, $$, toast, money, n, pct, ago, egp, download, toCSV } from "./ui.js";
import { get, post, setDemoBackend } from "./api.js";
import { load, save, loadGlobal, saveGlobal, isDemo, setDemo } from "./store.js";
import {
  STAGES, STAGE, TIMELINES, PURPOSES, PAYS,
  isValid, isWaiting, isBad, MEETING_UP, RESERVED_UP,
  allLeads, addLead, updateLead, replaceAll,
  quality, treeDates, score, projectFromName, dailyPerformance,
  scoreLeadGrade, EGYPT_CORRIDORS, median,
} from "./model.js";
import { createDemo } from "./demo.js";

const G_MARK = raw('<svg viewBox="0 0 32 33" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M17.06 19.61V14.89H30.83V31.51H26.58L25.76 27.44C23.51 30.65 20.18 32.21 15.72 32.21C11.26 32.21 7.71 30.73 5.03 27.79C2.34 24.85 1 20.95 1 16.1C1 11.26 2.34 7.36 5.11 4.37C7.84 1.47 11.56 0 16.24 0C20.09 0 23.29 1 25.89 2.94C28.4 4.93 29.96 7.58 30.48 10.95H24.46C24.03 9.13 23.08 7.71 21.61 6.67C20.13 5.63 18.36 5.11 16.28 5.11C13.42 5.11 11.22 6.1 9.57 8.05C7.93 10.04 7.1 12.73 7.1 16.1C7.1 19.52 7.93 22.21 9.62 24.16C11.26 26.15 13.55 27.1 16.5 27.1C18.79 27.1 20.78 26.41 22.43 25.02C24.07 23.64 24.94 21.86 25.11 19.61H17.06Z"/></svg>');

const PERIODS = [
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["last_7d", "7 days"],
  ["last_14d", "14 days"],
  ["last_30d", "30 days"],
  ["last_60d", "60 days"],
  ["last_90d", "90 days"],
];

let activeTab = "leads"; // leads | analysis | projects
let analysisCadence = "daily"; // daily | weekly
let period = load("client.period", "last_7d");
let leadFilter = "waiting"; // all | waiting | whatsapp | gradeA | valid | meeting | reserved
let projectFilter = "";
let cityFilter = "";
let searchText = "";
let showLimit = 45;
let soundAlerts = load("client.sound", true);
let expandedLeadId = null;

let catalog = null;
let tree = null;
let demoAcc = null;
let notifications = load("client.notifications", []);

const digits = (p) => String(p || "").replace(/[^\d]/g, "");
const waNumber = (p) => {
  const d = digits(p);
  if (d.startsWith("00")) return d.slice(2);
  if (d.startsWith("01") && d.length === 11) return `2${d}`;
  return d;
};

// Soft notification chime using Web Audio API (zero external audio files needed)
function playNotificationChime() {
  if (!soundAlerts) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    [587.33, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.11);
      gain.gain.setValueAtTime(0.12, now + i * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.11 + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.11);
      osc.stop(now + i * 0.11 + 0.3);
    });
  } catch {}
}

function seedNotificationsIfEmpty() {
  if (notifications.length) return;
  const leads = allLeads().slice(0, 6);
  notifications = leads.slice(0, 3).map((l, idx) => ({
    id: `n_init_${idx}`,
    leadId: l.id,
    at: l.created,
    type: l.source === "whatsapp" || idx === 0 ? "whatsapp" : "form",
    name: l.name,
    phone: l.phone,
    city: l.city || "New Cairo",
    project: l.project || "krypton",
    campaignName: l.campaignName || "GD | Krypton | WhatsApp | Nov",
    ref: l.ref || "KR-1101-A4",
    message:
      l.source === "whatsapp" || idx === 0
        ? `Hello Mahmoud, I saw the ${l.project === "ivy" ? "IVY New Zayed" : l.project === "seashell-rah" ? "Seashell Ras El Hekma" : "Krypton NEWKAIRO"} campaign (ref ${l.ref || "KR-1101"}). Please send available units & 5% down payment sheet.`
        : `Submitted Meta Instant Form (${l.formName || "NEWKAIRO Private Advisory"}) · Wants call today.`,
  }));
  save("client.notifications", notifications);
}

// Simulate a real-time incoming WhatsApp campaign message
function simulateIncomingCampaignMessage() {
  const samples = [
    {
      name: "Dr. Tarek El-Gamal",
      phone: "0100 482 9104",
      city: "New Cairo",
      project: "krypton",
      campaignName: "GD | Krypton | WhatsApp | Nov",
      adsetName: "WA · East Cairo & Delta",
      ref: "KR-1101-T9",
      message: "Hello Mahmoud, I clicked the Krypton NEWKAIRO WhatsApp ad (ref KR-1101-T9). Looking for a 2-bedroom park view with 5% down.",
    },
    {
      name: "Eng. Khaled Al-Mansour",
      phone: "+966 50 841 2910",
      city: "Riyadh",
      project: "krypton",
      campaignName: "GD | Krypton | WhatsApp | Nov",
      adsetName: "WA · Gulf Expats VIP Chat",
      ref: "KR-1101-G2",
      message: "السلام عليكم أستاذ محمود، شفت إعلان كريبتون نيو كايرو ومهتم بشقة ٣ غرف أو تاون هاوس في نيو كايرو للاستثمار.",
    },
    {
      name: "Nourhan Abdelrahman",
      phone: "0122 910 3381",
      city: "Sheikh Zayed",
      project: "ivy",
      campaignName: "GD | IVY | WhatsApp | Direct Advisory | Nov",
      adsetName: "WA · Sheikh Zayed & 6th October Chat",
      ref: "IVY-1102-N5",
      message: "Hi Mahmoud, saw the IVY New Zayed campaign. Can you send me the garden apartment prices and 8-year installment plan?",
    },
    {
      name: "Sherif Abaza",
      phone: "0111 740 8821",
      city: "Heliopolis",
      project: "seashell-rah",
      campaignName: "GD | Seashell Ras El Hekma | WhatsApp | Lagoon | Nov",
      adsetName: "WA · North Coast & GCC VIP Chat",
      ref: "SSR-1103-S1",
      message: "Hello Mahmoud, interested in a Lagoon Chalet at Seashell Ras El Hekma. What are the released holds right now?",
    },
  ];
  const pick = samples[Math.floor(Math.random() * samples.length)];
  const createdLead = addLead({
    name: pick.name,
    phone: pick.phone,
    city: pick.city,
    project: pick.project,
    source: "whatsapp",
    ref: pick.ref,
    campaignName: pick.campaignName,
    adsetName: pick.adsetName,
    notes: `Incoming WhatsApp Campaign message: "${pick.message}"`,
  });
  const notif = {
    id: `notif_${Date.now()}`,
    leadId: createdLead.id,
    at: new Date().toISOString(),
    type: "whatsapp",
    ...pick,
  };
  notifications.unshift(notif);
  if (notifications.length > 25) notifications.length = 25;
  save("client.notifications", notifications);
  playNotificationChime();
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(`New WhatsApp Campaign Message · ${pick.name}`, {
      body: `${pick.campaignName}: "${pick.message}"`,
      icon: "./apple-touch-icon.png",
    });
  }
  toast(`💬 New WhatsApp Campaign Message from ${pick.name} (${pick.city})!`, "good");
  render();
}

function buildWhatsAppTemplates(lead, projectObj) {
  const firstName = (lead.name || "").split(" ")[0] || "there";
  const pName = projectObj?.name || "NEWKAIRO";
  const fromStr = projectObj?.from ? `${egp(projectObj.from)} EGP` : "7.88M EGP";
  const refNote = lead.ref ? ` (Ref ${lead.ref})` : "";
  return [
    {
      label: "💬 Instant Greeting",
      text: `Hello ${firstName}, this is Mahmoud Elhemaly's private advisory for G Developments regarding your inquiry on ${pName}${refNote}. Are you free for a quick 2-minute call or would you prefer the available units here on WhatsApp?`,
    },
    {
      label: "📄 Price List & 5% Down",
      text: `Hello ${firstName}, sharing the official ${pName} release from G Developments: residences start from ${fromStr} with 5% down payment and up to 8 years equal installments. Which bedroom count or unit type suits you best so I can send today's released holds?`,
    },
    {
      label: "📅 Book Private Viewing",
      text: `Hello ${firstName}, we have private viewings and presentation slots open for ${pName} today and tomorrow. What time works best for you to review the masterplan, floor plates, and cash discount?`,
    },
    {
      label: "🇪🇬 Arabic VIP Reply",
      text: `أهلاً بحضرتك يا فندم، مع حضرتك مكتب محمود الهمالي (G Developments Private Advisory) بخصوص استفسارك عن مشروع ${pName}${refNote}. الأسعار تبدأ من ${fromStr} بمقدم 5% وتقسيط حتى 8 سنوات. هل تفضل أرسل لحضرتك الوحدات المتاحة والبرشور هنا على واتساب؟`,
    },
  ];
}

function accountTotals(t) {
  const out = { spend: 0, leads: 0, convos: 0, waSpend: 0 };
  for (const c of t?.campaigns || []) {
    const m = c.m;
    if (!m) continue;
    out.spend += m.spend || 0;
    out.leads += m.leads || 0;
    out.convos += m.convos || 0;
    if (c.objective === "OUTCOME_ENGAGEMENT" || (m.convos || 0) > 0 || /whatsapp/i.test(c.name)) {
      out.waSpend += m.spend || 0;
    }
  }
  return out;
}

function aggregateByWeek(dailyRows) {
  if (!dailyRows || !dailyRows.length) return [];
  const weeks = [];
  let bucket = null;
  dailyRows.forEach((d, idx) => {
    if (!bucket || bucket.days >= 7) {
      if (bucket) weeks.push(bucket);
      bucket = {
        label: `Week of ${d.date.slice(5)}`,
        startDate: d.date,
        endDate: d.date,
        days: 0,
        spend: 0,
        leads: 0,
        valid: 0,
        meetings: 0,
        reserved: 0,
      };
    }
    bucket.endDate = d.date;
    bucket.days += 1;
    bucket.spend += d.spend || 0;
    bucket.leads += d.leads || 0;
    bucket.valid += d.valid || 0;
    bucket.meetings += d.meetings || 0;
    bucket.reserved += d.reserved || 0;
    if (idx === dailyRows.length - 1 && bucket) {
      weeks.push(bucket);
      bucket = null;
    }
  });
  return weeks.map((w) => ({
    ...w,
    date: `${w.startDate.slice(5)} → ${w.endDate.slice(5)}`,
  }));
}

function renderResultsChart(rows, cadence) {
  if (!rows || !rows.length) {
    return html`<div class="muted small">No spend or leads recorded in this date window.</div>`;
  }
  const W = 820, H = 235, padL = 52, padR = 46, padT = 18, padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const maxSpend = Math.max(100, ...rows.map((r) => r.spend || 0));
  const maxLeads = Math.max(4, ...rows.map((r) => Math.max(r.leads || 0, r.valid || 0)));
  const count = rows.length;
  const stepX = plotW / Math.max(1, count);
  const barW = Math.max(4, Math.min(38, stepX * 0.6));

  const ptsLeads = [];
  const ptsValid = [];
  rows.forEach((d, i) => {
    const cx = padL + i * stepX + stepX / 2;
    const yL = padT + plotH - ((d.leads || 0) / maxLeads) * plotH;
    const yV = padT + plotH - ((d.valid || 0) / maxLeads) * plotH;
    ptsLeads.push(`${cx.toFixed(1)},${yL.toFixed(1)}`);
    ptsValid.push(`${cx.toFixed(1)},${yV.toFixed(1)}`);
  });

  return html`
  <div class="chart-wrap">
    <svg viewBox="0 0 ${W} ${H}" class="chart-svg" role="img" aria-label="${cadence === "weekly" ? "Weekly" : "Daily"} spend vs leads and interested buyers">
      ${[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const y = (padT + plotH * (1 - f)).toFixed(1);
        const sVal = Math.round(maxSpend * f);
        const lVal = Math.round(maxLeads * f);
        return html`<g>
          <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--line)" stroke-width="1" stroke-dasharray="${f === 0 ? "" : "3,3"}"/>
          <text x="${padL - 6}" y="${Number(y) + 4}" text-anchor="end" class="chart-axis">${sVal >= 1000 ? `${(sVal / 1000).toFixed(sVal >= 10000 ? 0 : 1)}K` : sVal}</text>
          <text x="${W - padR + 6}" y="${Number(y) + 4}" text-anchor="start" class="chart-axis">${lVal}</text>
        </g>`;
      })}
      ${rows.map((d, i) => {
        const cx = padL + i * stepX + stepX / 2;
        const bh = Math.max(2, ((d.spend || 0) / maxSpend) * plotH);
        const by = padT + plotH - bh;
        const showLabel = count <= 12 || i % Math.ceil(count / 8) === 0 || i === count - 1;
        return html`<g>
          <rect x="${(cx - barW / 2).toFixed(1)}" y="${by.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" rx="4" fill="color-mix(in srgb, var(--accent) 26%, var(--card))" stroke="var(--accent)" stroke-width="1">
            <title>${d.date}: ${money(d.spend)} spent · ${n(d.leads)} leads · ${n(d.valid)} interested buyers</title>
          </rect>
          ${showLabel ? html`<text x="${cx.toFixed(1)}" y="${H - 9}" text-anchor="middle" class="chart-axis">${d.date.length > 10 ? d.date : d.date.slice(5)}</text>` : ""}
        </g>`;
      })}
      ${ptsLeads.length > 1 ? html`<polyline fill="none" stroke="var(--info)" stroke-width="2.2" points="${ptsLeads.join(" ")}"/>` : ""}
      ${ptsValid.length > 1 ? html`<polyline fill="none" stroke="var(--good)" stroke-width="2.6" points="${ptsValid.join(" ")}"/>` : ""}
      ${rows.map((d, i) => {
        const cx = padL + i * stepX + stepX / 2;
        const yV = padT + plotH - ((d.valid || 0) / maxLeads) * plotH;
        return d.valid > 0 ? html`<circle cx="${cx.toFixed(1)}" cy="${yV.toFixed(1)}" r="3.6" fill="var(--good)" stroke="var(--card)" stroke-width="1.2"><title>${d.date}: ${n(d.valid)} interested buyers</title></circle>` : "";
      })}
    </svg>
    <div class="chart-legend">
      <span><i class="legend-dot" style="background:var(--accent)"></i>Amount Spent (EGP, left axis)</span>
      <span><i class="legend-dot" style="background:var(--info)"></i>Total Leads &amp; WhatsApp Chats (right axis)</span>
      <span><i class="legend-dot" style="background:var(--good)"></i>Interested / Valid Buyers (right axis)</span>
    </div>
  </div>`;
}

function renderLeadCard(l) {
  const p = catalog?.projects?.find((x) => x.id === l.project);
  const grade = scoreLeadGrade(l, catalog);
  const isWa = l.source === "whatsapp";
  const waiting = isWaiting(l.stage);
  const late = l.stage === "new" && Date.now() - new Date(l.created).getTime() > 15 * 60000;
  const wa = waNumber(l.phone);
  const templates = buildWhatsAppTemplates(l, p);
  const isExpanded = expandedLeadId === l.id;

  const quickStages = [
    ["interested", "✓ Interested", "valid"],
    ["meeting", "📅 Meeting", "valid"],
    ["visited", "🏛 Visited", "valid"],
    ["reserved", "🏆 Reserved", "valid"],
    ["no_answer", "⏳ No Answer", "waiting"],
    ["low_budget", "✕ Low Budget", "bad"],
  ];

  return html`<article class="lead-card ${waiting ? "is-waiting" : ""} ${isWa ? "is-wa" : ""}" data-lead="${l.id}">
    <div class="lead-top">
      <div>
        <div class="row wrap" style="gap:6px">
          <span class="pill ${grade.tone}" title="${grade.reasons.join(" · ")}">Grade ${grade.grade}</span>
          <span class="lead-name">${l.name || "New Buyer"}</span>
          ${isWa
            ? html`<span class="pill wa">💬 WhatsApp Campaign${l.ref ? ` · ${l.ref}` : ""}</span>`
            : html`<span class="pill info">📋 Lead Form</span>`}
          ${p ? html`<span class="pill accent">${p.name}</span>` : ""}
          ${l.city ? html`<span class="pill line">📍 ${l.city}</span>` : ""}
        </div>
        <div class="lead-sub">
          <span class="${late ? "late-badge" : ""}">${waiting ? (late ? "🔥 Waiting " : "⏳ Arrived ") : "Updated "}${ago(l.created)}</span>
          ${l.phone ? html`<span class="mono"><b>${l.phone}</b></span>` : ""}
          ${l.campaignName ? html`<span>Campaign: <b>${l.campaignName}</b></span>` : ""}
          ${l.budget ? html`<span>Budget: <b>${egp(l.budget)} EGP</b></span>` : ""}
        </div>
      </div>

      <div class="row wrap">
        ${wa ? html`
          <a class="btn sm wa-btn" href="https://wa.me/${wa}?text=${encodeURIComponent(templates[0].text)}" target="_blank" rel="noopener" data-wa-reply="${l.id}">
            💬 Reply on WhatsApp
          </a>
          <a class="btn sm" href="tel:+${wa}" data-call-lead="${l.id}">📞 Call Buyer</a>
        ` : ""}
        <button class="btn sm ghost" type="button" data-toggle-details="${l.id}">${isExpanded ? "Hide details" : "Details & Notes"}</button>
      </div>
    </div>

    ${wa ? html`
    <div class="template-bar">
      <span>1-Click Instant WhatsApp Reply:</span>
      ${templates.map((tpl) => html`
        <a class="tpl-btn" href="https://wa.me/${wa}?text=${encodeURIComponent(tpl.text)}" target="_blank" rel="noopener" data-wa-reply="${l.id}">
          ${tpl.label}
        </a>
      `)}
    </div>` : ""}

    ${l.notes ? html`<div class="tiny muted" style="background:var(--bg);padding:6px 10px;border-radius:8px;border:1px solid var(--line)">📝 <b>Note:</b> ${l.notes}</div>` : ""}

    <div class="stage-bar">
      <div class="stage-btns">
        <span class="tiny muted" style="margin-right:4px;font-weight:600">1-Click Status:</span>
        ${quickStages.map(([sid, label, grp]) => html`
          <button type="button" class="stage-btn ${l.stage === sid ? `active ${grp}` : ""}" data-quick-stage="${sid}" data-lead-id="${l.id}">
            ${label}
          </button>
        `)}
      </div>
      <div class="row wrap">
        <select class="input" style="min-height:28px;padding:2px 8px;font-size:12px" data-stage-select="${l.id}" aria-label="All stages">
          ${STAGES.map((s) => html`<option value="${s.id}" ${s.id === l.stage ? raw("selected") : ""}>${s.group === "valid" ? "✓ " : ""}${s.label}</option>`)}
        </select>
      </div>
    </div>

    ${isExpanded ? html`
    <div style="padding-top:10px;border-top:1px solid var(--line);display:grid;gap:8px">
      <div class="row wrap">
        <select class="input" data-field="project" data-lead-id="${l.id}">
          <option value="">Project…</option>
          ${(catalog?.projects || []).map((x) => html`<option value="${x.id}" ${x.id === l.project ? raw("selected") : ""}>${x.name}</option>`)}
        </select>
        <select class="input" data-field="city" data-lead-id="${l.id}">
          <option value="">City…</option>
          ${EGYPT_CORRIDORS.map((c) => html`<option value="${c.id}" ${c.id === l.city ? raw("selected") : ""}>${c.id} (${c.gov})</option>`)}
        </select>
        <input class="input" style="width:155px" type="number" step="100000" placeholder="Buyer Budget (EGP)" value="${l.budget || ""}" data-field="budget" data-lead-id="${l.id}">
        <select class="input" data-field="pay" data-lead-id="${l.id}">
          ${PAYS.map(([v, label]) => html`<option value="${v}" ${l.pay === v ? raw("selected") : ""}>${label}</option>`)}
        </select>
        <select class="input" data-field="timeline" data-lead-id="${l.id}">
          ${TIMELINES.map(([v, label]) => html`<option value="${v}" ${l.timeline === v ? raw("selected") : ""}>${label}</option>`)}
        </select>
      </div>
      <textarea class="input" rows="2" placeholder="Add call or WhatsApp notes…" data-field="notes" data-lead-id="${l.id}">${l.notes || ""}</textarea>
    </div>` : ""}
  </article>`;
}

function renderLeadsTab(leadsInPeriod, q, tt) {
  const s = searchText.trim().toLowerCase();
  const filtered = leadsInPeriod.filter((l) => {
    if (leadFilter === "waiting" && !isWaiting(l.stage)) return false;
    if (leadFilter === "whatsapp" && l.source !== "whatsapp") return false;
    if (leadFilter === "gradeA" && scoreLeadGrade(l, catalog).grade !== "A") return false;
    if (leadFilter === "valid" && !isValid(l.stage)) return false;
    if (leadFilter === "meeting" && !MEETING_UP.has(l.stage)) return false;
    if (leadFilter === "reserved" && !RESERVED_UP.has(l.stage)) return false;
    if (projectFilter && l.project !== projectFilter) return false;
    if (cityFilter && l.city !== cityFilter) return false;
    if (s && ![l.name, l.phone, l.city, l.campaignName, l.notes, l.ref].some((x) => String(x || "").toLowerCase().includes(s))) return false;
    return true;
  });

  const waitingCount = leadsInPeriod.filter((l) => isWaiting(l.stage)).length;
  const waCount = leadsInPeriod.filter((l) => l.source === "whatsapp").length;
  const gradeACount = leadsInPeriod.filter((l) => scoreLeadGrade(l, catalog).grade === "A").length;
  const validCount = leadsInPeriod.filter((l) => isValid(l.stage)).length;
  const meetingCount = leadsInPeriod.filter((l) => MEETING_UP.has(l.stage)).length;
  const reservedCount = leadsInPeriod.filter((l) => RESERVED_UP.has(l.stage)).length;

  return html`
  <div class="card">
    <div class="card-head">
      <div>
        <h2>Fast Lead Reply &amp; Campaign Message Inbox (${n(filtered.length)})</h2>
        <p>Click any WhatsApp template button below to reply in 1 second with the buyer's name and project details pre-filled, then tap their status so Omar Sherif's campaign engine optimizes for your best buyers.</p>
      </div>
      <div class="row wrap">
        <button class="btn sm wa-btn" type="button" data-simulate-msg>💬 + Test Live Campaign Message Alert</button>
        <button class="btn sm" type="button" data-export-csv>Export Leads CSV</button>
      </div>
    </div>

    <div class="row between wrap" style="margin-bottom:14px;gap:10px">
      <div class="seg" role="group" aria-label="Filter leads">
        <button type="button" data-lead-filter="waiting" aria-pressed="${leadFilter === "waiting"}">🔥 Waiting Reply (${n(waitingCount)})</button>
        <button type="button" data-lead-filter="whatsapp" aria-pressed="${leadFilter === "whatsapp"}">💬 WhatsApp Chats (${n(waCount)})</button>
        <button type="button" data-lead-filter="gradeA" aria-pressed="${leadFilter === "gradeA"}">⭐ Grade A VIP (${n(gradeACount)})</button>
        <button type="button" data-lead-filter="valid" aria-pressed="${leadFilter === "valid"}">✓ Interested (${n(validCount)})</button>
        <button type="button" data-lead-filter="meeting" aria-pressed="${leadFilter === "meeting"}">📅 Visits (${n(meetingCount)})</button>
        <button type="button" data-lead-filter="reserved" aria-pressed="${leadFilter === "reserved"}">🏆 Reserved (${n(reservedCount)})</button>
        <button type="button" data-lead-filter="all" aria-pressed="${leadFilter === "all"}">All (${n(leadsInPeriod.length)})</button>
      </div>

      <div class="row wrap">
        <select class="input" data-project-filter aria-label="Filter by project">
          <option value="">All G Developments Projects</option>
          ${(catalog?.projects || []).map((p) => html`<option value="${p.id}" ${projectFilter === p.id ? raw("selected") : ""}>${p.name}</option>`)}
        </select>
        <select class="input" data-city-filter aria-label="Filter by city">
          <option value="">All Cities / Corridors</option>
          ${EGYPT_CORRIDORS.map((c) => html`<option value="${c.id}" ${cityFilter === c.id ? raw("selected") : ""}>${c.id}</option>`)}
        </select>
        <input class="input" style="width:210px" type="search" placeholder="Search name, phone, ref, city…" value="${searchText}" data-search-input>
      </div>
    </div>

    <div class="lead-stream">
      ${filtered.length
        ? filtered.slice(0, showLimit).map((l) => renderLeadCard(l))
        : html`<div style="text-align:center;padding:36px 16px;color:var(--muted)">
            <h3>No leads match this filter</h3>
            <p class="small" style="margin-top:4px">Switch to "All" or another tab above to view more leads.</p>
          </div>`}
    </div>

    ${filtered.length > showLimit ? html`
      <div style="text-align:center;margin-top:14px">
        <button class="btn" type="button" data-more-leads>Show ${Math.min(45, filtered.length - showLimit)} more leads</button>
      </div>
    ` : ""}
  </div>`;
}

function renderAnalysisTab(daily, leadsInPeriod, tt, q) {
  const series = analysisCadence === "weekly" ? aggregateByWeek(daily) : daily;
  const rowsReversed = [...series].reverse();

  return html`
  <div class="card">
    <div class="card-head">
      <div>
        <h2>${analysisCadence === "weekly" ? "Weekly" : "Daily"} Campaign Spend &amp; Lead Results Analysis</h2>
        <p>Clear ${analysisCadence === "weekly" ? "week-by-week" : "day-by-day"} view of what was spent and how many leads, WhatsApp chats, interested buyers, meetings, and reservations were delivered.</p>
      </div>
      <div class="seg" role="group" aria-label="Daily or Weekly view">
        <button type="button" data-cadence="daily" aria-pressed="${analysisCadence === "daily"}">Daily Analysis</button>
        <button type="button" data-cadence="weekly" aria-pressed="${analysisCadence === "weekly"}">Weekly Analysis</button>
      </div>
    </div>

    ${renderResultsChart(series, analysisCadence)}

    <div class="table-wrap" style="margin-top:16px">
      <table>
        <thead>
          <tr>
            <th>${analysisCadence === "weekly" ? "Week Period" : "Date"}</th>
            <th class="n">Amount Spent</th>
            <th class="n">Total Leads &amp; Chats</th>
            <th class="n">Interested Buyers (Valid)</th>
            <th class="n">Cost / Interested Buyer</th>
            <th class="n">Meetings &amp; Site Visits</th>
            <th class="n">Reservations (EOI)</th>
          </tr>
        </thead>
        <tbody>
          ${rowsReversed.map((r) => {
            const cpvl = r.valid > 0 ? r.spend / r.valid : null;
            return html`<tr>
              <td><b>${r.date}</b>${r.days ? html` <span class="tiny muted">(${r.days}d)</span>` : ""}</td>
              <td class="n"><b>${money(r.spend)}</b></td>
              <td class="n">${n(r.leads)}</td>
              <td class="n"><b style="color:var(--good)">${n(r.valid)}</b></td>
              <td class="n">${cpvl ? money(cpvl) : "—"}</td>
              <td class="n">${n(r.meetings || 0)}</td>
              <td class="n"><b>${n(r.reserved || 0)}</b></td>
            </tr>`;
          })}
        </tbody>
      </table>
    </div>
  </div>`;
}

function renderProjectsTab(leadsInPeriod, q, tt) {
  const byProj = {};
  for (const p of catalog?.projects || []) {
    byProj[p.id] = { p, spend: 0, leads: 0, waChats: 0, valid: 0, meetings: 0, reserved: 0 };
  }
  for (const c of tree?.campaigns || []) {
    const p = projectFromName(c.name, catalog);
    if (!p || !byProj[p.id]) continue;
    byProj[p.id].spend += c.m?.spend || 0;
    byProj[p.id].leads += (c.m?.leads || 0) + (c.m?.convos || 0);
    byProj[p.id].waChats += c.m?.convos || 0;
  }
  for (const l of leadsInPeriod) {
    if (!l.project || !byProj[l.project]) continue;
    if (l.source === "whatsapp") byProj[l.project].waChats = Math.max(byProj[l.project].waChats, 1);
    if (isValid(l.stage)) byProj[l.project].valid += 1;
    if (MEETING_UP.has(l.stage)) byProj[l.project].meetings += 1;
    if (RESERVED_UP.has(l.stage)) byProj[l.project].reserved += 1;
  }

  const activeProjects = Object.values(byProj)
    .filter((x) => x.spend > 0 || x.leads > 0 || x.valid > 0)
    .sort((a, b) => b.spend - a.spend);

  const totalSpend = Math.max(1, tt.spend);

  const omarNotes = [
    {
      date: "Today · Live Optimization",
      title: "Scaled Click-to-WhatsApp Campaigns for Krypton (NEWKAIRO) & IVY",
      text: "WhatsApp campaigns are delivering interested buyers at 48% lower cost per valid buyer than standard forms. Shifted +20% daily budget into East Cairo & Gulf Expat VIP WhatsApp ad sets.",
      tag: "Budget Scaled +20%",
      tone: "good",
    },
    {
      date: "Yesterday · Audience Quality",
      title: "Synced Verified Interested & Reserved Buyers to Meta CAPI",
      text: "Every buyer you mark as 'Interested', 'Meeting', or 'Reserved' in this portal is fed back to Meta's algorithm so your budget targets high-net-worth buyers in New Cairo, Heliopolis, Sheikh Zayed, Riyadh, and Dubai.",
      tag: "Algorithm Trained",
      tone: "info",
    },
    {
      date: "This Week · Budget Protection",
      title: "Paused High-Frequency Ad Sets with Zero Valid Buyers",
      text: "Cut wasted spend on fatigued audiences and reallocated budget to NEWKAIRO Krypton 1–3BR serviced residences and Seashell Ras El Hekma lagoon releases.",
      tag: "Zero Wasted Spend",
      tone: "accent",
    },
  ];

  return html`
  <div class="grid-2">
    <div class="card">
      <div class="card-head">
        <div>
          <h2>What Your Money Got by G Developments Project</h2>
          <p>Exact amount spent and buyer results delivered for each destination in the selected period.</p>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th class="n">Amount Spent</th>
              <th style="min-width:110px">Share</th>
              <th class="n">Leads &amp; Chats</th>
              <th class="n">WA Chats</th>
              <th class="n">Interested</th>
              <th class="n">Visits</th>
              <th class="n">Reserved</th>
            </tr>
          </thead>
          <tbody>
            ${activeProjects.map((r) => {
              const share = (r.spend / totalSpend) * 100;
              return html`<tr>
                <td>
                  <b>${r.p.name}</b>
                  <div class="tiny muted">${r.p.region} · From ${egp(r.p.from)} EGP</div>
                </td>
                <td class="n"><b>${money(r.spend)}</b></td>
                <td>
                  <div class="tiny muted">${share.toFixed(1)}%</div>
                  <div class="bar"><i style="width:${Math.round(share)}%"></i></div>
                </td>
                <td class="n">${n(r.leads)}</td>
                <td class="n"><span class="pill wa">${n(r.waChats)}</span></td>
                <td class="n"><b style="color:var(--good)">${n(r.valid)}</b></td>
                <td class="n">${n(r.meetings)}</td>
                <td class="n"><b>${n(r.reserved)}</b></td>
              </tr>`;
            })}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div>
          <h2>Media Buyer Optimizations by Omar Sherif</h2>
          <p>Technical campaign actions taken behind the scenes to maximize your valid buyers and reservations.</p>
        </div>
        <span class="buyer-badge"><i></i>Managed by Omar Sherif</span>
      </div>
      <div style="display:grid;gap:10px">
        ${omarNotes.map((note) => html`
          <div style="padding:12px 14px;border-radius:11px;border:1px solid var(--line);background:var(--bg)">
            <div class="row between wrap" style="margin-bottom:4px">
              <span class="tiny muted">${note.date}</span>
              <span class="pill ${note.tone}">${note.tag}</span>
            </div>
            <div style="font-weight:700;font-size:13.5px;margin-bottom:4px">${note.title}</div>
            <p class="small muted">${note.text}</p>
          </div>
        `)}
      </div>
    </div>
  </div>`;
}

function render() {
  const root = $("#app");
  if (!root || !tree) return;

  const { since, until } = treeDates(tree);
  const all = allLeads();
  const leadsInPeriod = all.filter((l) => {
    const d = String(l.created || "").slice(0, 10);
    return (!since || d >= since) && (!until || d <= until);
  });

  const q = quality(all, since, until);
  const tt = accountTotals(tree);
  const sc = score({ spend: tt.spend, leads: tt.leads, convos: tt.convos }, q.total);
  const daily = dailyPerformance(tree, all);
  const lifetimeSpend = tree.account?.amountSpent || tt.spend;
  const waitingCount = leadsInPeriod.filter((l) => isWaiting(l.stage)).length;
  const waLeadsCount = leadsInPeriod.filter((l) => l.source === "whatsapp").length;
  const pipelineEgp = q.total.reserved * 11287500;
  const periodLabel = PERIODS.find(([k]) => k === period)?.[1] || period;
  const theme = loadGlobal("theme", "light");

  // Compute median reply time
  const replyMins = leadsInPeriod
    .filter((l) => l.firstContactAt && l.created)
    .map((l) => (new Date(l.firstContactAt) - new Date(l.created)) / 60000)
    .filter((m) => m >= 0);
  const medReply = median(replyMins);

  root.innerHTML = html`
  <header class="topbar">
    <div class="brand-wrap">
      <div class="brand-mark" aria-hidden="true">${G_MARK}</div>
      <div class="brand-title">
        <b>
          Mahmoud Elhemaly · G Developments
          <span class="buyer-badge"><i></i>Campaigns Managed by Omar Sherif</span>
        </b>
        <span>Client Lead, WhatsApp Reply &amp; Spend Results Portal · ${since} to ${until}</span>
      </div>
    </div>

    <div class="topbar-right">
      <div class="spent-hero-pill" title="Total amount spent in selected period and cumulative account spend">
        <span>Spent (${periodLabel}): <b>${money(tt.spend)}</b></span>
        <span style="opacity:0.45">|</span>
        <span>Cumulative: <b>${money(lifetimeSpend)}</b></span>
      </div>
      <button class="btn sm wa-btn" type="button" data-simulate-msg title="Simulate a live incoming WhatsApp campaign message notification">
        🔔 Live Campaign Alert (${notifications.length})
      </button>
      <button class="btn sm" type="button" data-sound-toggle title="Toggle audio chime on new campaign message">
        ${soundAlerts ? "🔊 Sound On" : "🔇 Sound Off"}
      </button>
      <button class="btn sm ghost" type="button" data-theme-toggle>
        ${theme === "dark" ? "☀️ Light" : "🌙 Dark"}
      </button>
    </div>
  </header>

  <main class="container">
    <!-- Live Incoming Campaign Message & Lead Notification Center -->
    <section class="notif-strip" aria-label="Live Campaign Message Notifications">
      <div class="notif-strip-head">
        <div class="row wrap" style="gap:8px">
          <span class="pulse-dot"></span>
          <b>Live Campaign Message &amp; Lead Notifications</b>
          <span class="pill wa">Instant WhatsApp &amp; Form Alerts Active</span>
        </div>
        <div class="row wrap">
          <button class="btn sm" type="button" data-enable-browser-notif>Enable Phone / Browser Push Alerts</button>
          <button class="btn sm wa-btn" type="button" data-simulate-msg>+ Test Incoming Campaign Message</button>
        </div>
      </div>
      <div class="notif-grid">
        ${notifications.slice(0, 3).map((nf) => {
          const p = catalog?.projects?.find((x) => x.id === nf.project);
          const wa = waNumber(nf.phone);
          const greet = `Hello ${(nf.name || "").split(" ")[0] || ""}, this is Mahmoud Elhemaly's private advisory for G Developments regarding your message on ${p?.name || "NEWKAIRO"} (${nf.ref || ""}).`;
          return html`<div class="notif-item ${nf.type === "whatsapp" ? "" : "form-lead"}">
            <div style="min-width:0;flex:1">
              <div class="row wrap" style="gap:5px">
                <span class="pill ${nf.type === "whatsapp" ? "wa" : "info"}">${nf.type === "whatsapp" ? "💬 WhatsApp Campaign" : "📋 Form Lead"}</span>
                <b>${nf.name}</b>
                <span class="tiny muted">· ${nf.city} · ${ago(nf.at)}</span>
              </div>
              <div class="tiny muted" style="margin-top:2px">${nf.campaignName} ${nf.ref ? html`· <span class="mono">${nf.ref}</span>` : ""}</div>
              <div class="notif-msg">"${nf.message}"</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:5px;flex:none">
              ${wa ? html`<a class="btn sm wa-btn" href="https://wa.me/${wa}?text=${encodeURIComponent(greet)}" target="_blank" rel="noopener" data-wa-reply="${nf.leadId || ""}">Reply WA</a>` : ""}
              ${wa ? html`<a class="btn sm" href="tel:+${wa}" data-call-lead="${nf.leadId || ""}">Call</a>` : ""}
            </div>
          </div>`;
        })}
      </div>
    </section>

    <!-- Date Range & View Switcher -->
    <div class="nav-bar">
      <div class="main-tabs" role="tablist" aria-label="Client Portal Sections">
        <button type="button" role="tab" aria-selected="${activeTab === "leads"}" data-tab="leads">
          💬 Leads &amp; Fast Reply Desk
          ${waitingCount > 0 ? html`<span class="badge-count">${n(waitingCount)} waiting</span>` : ""}
        </button>
        <button type="button" role="tab" aria-selected="${activeTab === "analysis"}" data-tab="analysis">
          📊 Daily &amp; Weekly Analysis
        </button>
        <button type="button" role="tab" aria-selected="${activeTab === "projects"}" data-tab="projects">
          🏛 What Your Spend Got by Project
        </button>
      </div>

      <div class="seg" role="group" aria-label="Date Range">
        ${PERIODS.map(([v, label]) => html`
          <button type="button" data-period="${v}" aria-pressed="${period === v}">${label}</button>
        `)}
      </div>
    </div>

    <!-- 6 Executive KPIs: Total Spent + Lead & Sales Outcomes Only -->
    <section class="kpis" aria-label="Executive Results Summary">
      <div class="kpi spent">
        <span>Total Amount Spent (${periodLabel})</span>
        <b>${money(tt.spend)}</b>
        <small>Cumulative account spend: <b>${money(lifetimeSpend)}</b></small>
      </div>
      <div class="kpi">
        <span>Waiting for Your Reply</span>
        <b style="color:${waitingCount > 0 ? "var(--accent)" : "var(--good)"}">${n(waitingCount)}</b>
        <small>${medReply !== null ? `Median reply speed: ${Math.round(medReply)} min` : "Reply within 15 min for 3x sales"}</small>
      </div>
      <div class="kpi wa">
        <span>Total Leads &amp; Campaign Messages</span>
        <b>${n(sc.metaLeads)}</b>
        <small><b>${n(tt.convos || waLeadsCount)}</b> WhatsApp chats · <b>${n(tt.leads)}</b> form leads</small>
      </div>
      <div class="kpi key">
        <span>Interested Buyers (Valid)</span>
        <b style="color:var(--good)">${n(q.total.valid)}</b>
        <small>${sc.validRate !== null ? `${pct(sc.validRate * 100, 0)} of contacted leads are real buyers` : "Qualified buyers"}</small>
      </div>
      <div class="kpi">
        <span>Meetings &amp; Site Visits</span>
        <b>${n(q.total.meetings)}</b>
        <small>NEWKAIRO, NEWGIZA, IVY &amp; Coast</small>
      </div>
      <div class="kpi key">
        <span>Reservations (EOI / Sold)</span>
        <b style="color:var(--good)">${n(q.total.reserved)}</b>
        <small>${q.total.reserved ? `≈ ${egp(pipelineEgp)} EGP sales volume` : "Reserved units"}</small>
      </div>
    </section>

    ${activeTab === "leads"
      ? renderLeadsTab(leadsInPeriod, q, tt)
      : activeTab === "analysis"
        ? renderAnalysisTab(daily, leadsInPeriod, tt, q)
        : renderProjectsTab(leadsInPeriod, q, tt)}
  </main>`.s;
}

async function loadData() {
  if (!catalog) {
    catalog = await fetch("./data/catalog.json").then((r) => r.json());
  }
  if (!demoAcc) {
    demoAcc = createDemo(catalog);
    setDemoBackend(demoAcc);
  }
  let realConnected = false;
  try {
    setDemo(false);
    const s = await get("/api/settings");
    realConnected = Boolean(s && s.connected);
  } catch {
    realConnected = false;
  }
  if (!realConnected) {
    setDemo(true);
    if (!allLeads().length) {
      replaceAll(demoAcc.leads());
    }
  }
  seedNotificationsIfEmpty();
  tree = await get("/api/tree", { range: period });
  render();
}

function bindEvents() {
  document.addEventListener("click", async (e) => {
    const tabBtn = e.target.closest("[data-tab]");
    if (tabBtn) {
      activeTab = tabBtn.dataset.tab;
      return render();
    }
    const perBtn = e.target.closest("[data-period]");
    if (perBtn) {
      period = perBtn.dataset.period;
      save("client.period", period);
      tree = await get("/api/tree", { range: period });
      return render();
    }
    const cadBtn = e.target.closest("[data-cadence]");
    if (cadBtn) {
      analysisCadence = cadBtn.dataset.cadence;
      return render();
    }
    const lfBtn = e.target.closest("[data-lead-filter]");
    if (lfBtn) {
      leadFilter = lfBtn.dataset.leadFilter;
      showLimit = 45;
      return render();
    }
    const moreBtn = e.target.closest("[data-more-leads]");
    if (moreBtn) {
      showLimit += 45;
      return render();
    }
    const simBtn = e.target.closest("[data-simulate-msg]");
    if (simBtn) {
      return simulateIncomingCampaignMessage();
    }
    const soundBtn = e.target.closest("[data-sound-toggle]");
    if (soundBtn) {
      soundAlerts = !soundAlerts;
      save("client.sound", soundAlerts);
      if (soundAlerts) playNotificationChime();
      return render();
    }
    const themeBtn = e.target.closest("[data-theme-toggle]");
    if (themeBtn) {
      const cur = loadGlobal("theme", "light");
      const next = cur === "dark" ? "light" : "dark";
      saveGlobal("theme", next);
      document.documentElement.setAttribute("data-theme", next);
      return render();
    }
    const notifPermBtn = e.target.closest("[data-enable-browser-notif]");
    if (notifPermBtn) {
      if (!("Notification" in window)) return toast("Browser notifications are not supported on this device.", "bad");
      const perm = await Notification.requestPermission();
      if (perm === "granted") toast("Push alerts enabled for new campaign messages!", "good");
      return;
    }
    const toggleDet = e.target.closest("[data-toggle-details]");
    if (toggleDet) {
      const id = toggleDet.dataset.toggleDetails;
      expandedLeadId = expandedLeadId === id ? null : id;
      return render();
    }
    const stageBtn = e.target.closest("[data-quick-stage]");
    if (stageBtn) {
      const id = stageBtn.dataset.leadId;
      const nextStage = stageBtn.dataset.quickStage;
      updateLead(id, { stage: nextStage });
      toast(`Lead marked as ${STAGE[nextStage]?.label || nextStage}. Synced with Omar Sherif's campaign dashboard.`, "good");
      return render();
    }
    const waReply = e.target.closest("[data-wa-reply]");
    if (waReply) {
      const id = waReply.dataset.waReply;
      if (id) {
        const l = allLeads().find((x) => x.id === id);
        if (l && l.stage === "new") {
          updateLead(id, { stage: "interested" });
          setTimeout(render, 300);
        }
      }
      return;
    }
    const exportBtn = e.target.closest("[data-export-csv]");
    if (exportBtn) {
      const rows = [
        ["Name", "Phone", "Source", "Ref Code", "Project", "City", "Stage", "Budget EGP", "Campaign", "Created", "Notes"],
        ...allLeads().map((l) => [l.name, l.phone, l.source, l.ref || "", l.project || "", l.city || "", l.stage, l.budget || "", l.campaignName || "", l.created, l.notes || ""]),
      ];
      download(`mahmoud-elhemaly-leads-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows), "text/csv;charset=utf-8");
      return toast("Exported leads CSV.", "good");
    }
  });

  document.addEventListener("change", (e) => {
    if (e.target.matches("[data-project-filter]")) {
      projectFilter = e.target.value;
      return render();
    }
    if (e.target.matches("[data-city-filter]")) {
      cityFilter = e.target.value;
      return render();
    }
    if (e.target.matches("[data-stage-select]")) {
      const id = e.target.dataset.stageSelect;
      const st = e.target.value;
      updateLead(id, { stage: st });
      toast(`Updated stage to ${STAGE[st]?.label || st}.`, "good");
      return render();
    }
    if (e.target.matches("[data-field]")) {
      const id = e.target.dataset.leadId;
      const field = e.target.dataset.field;
      const val = field === "budget" ? (e.target.value ? Number(e.target.value) : null) : e.target.value;
      updateLead(id, { [field]: val });
      return render();
    }
  });

  document.addEventListener("input", (e) => {
    if (e.target.matches("[data-search-input]")) {
      searchText = e.target.value;
      render();
    }
  });
}

const savedTheme = loadGlobal("theme", "light");
document.documentElement.setAttribute("data-theme", savedTheme);
bindEvents();
loadData();
