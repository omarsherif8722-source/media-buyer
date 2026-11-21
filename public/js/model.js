// Leads, lead stages, "valid lead" measure, automated media-buyer verdict engine,
// lead A/B/C/D grading, Egypt & GCC geo-intelligence aggregation, daily time-series,
// and website landing-page funnel analytics.
import { load, save, targets } from "./store.js";
import { uid, per, ratio } from "./ui.js";

export const STAGES = [
  { id: "new", label: "New, not contacted", group: "waiting" },
  { id: "no_answer", label: "No answer yet", group: "waiting" },
  { id: "invalid", label: "Not valid (wrong number, fake, duplicate)", group: "bad" },
  { id: "broker", label: "Broker or agent", group: "bad" },
  { id: "job", label: "Looking for a job", group: "bad" },
  { id: "low_budget", label: "Budget below the project", group: "bad" },
  { id: "not_now", label: "Just looking, not now", group: "bad" },
  { id: "interested", label: "Real interest", group: "valid" },
  { id: "meeting", label: "Meeting or visit booked", group: "valid" },
  { id: "visited", label: "Visited / met", group: "valid" },
  { id: "reserved", label: "Reserved (EOI paid)", group: "valid" },
  { id: "sold", label: "Contract signed", group: "valid" },
  { id: "lost", label: "Interested, bought elsewhere", group: "valid" },
];
export const STAGE = Object.fromEntries(STAGES.map((s) => [s.id, s]));
export const isValid = (stage) => STAGE[stage]?.group === "valid";
export const isWaiting = (stage) => STAGE[stage]?.group === "waiting";
export const isBad = (stage) => STAGE[stage]?.group === "bad";
export const MEETING_UP = new Set(["meeting", "visited", "reserved", "sold"]);
export const RESERVED_UP = new Set(["reserved", "sold"]);

export const SOURCES = [
  ["meta-form", "Meta lead form"],
  ["whatsapp", "WhatsApp"],
  ["call", "Phone call"],
  ["website", "Website brief"],
  ["messenger", "Messenger / Instagram DM"],
  ["referral", "Referral"],
  ["walk-in", "Walk-in / event"],
  ["other", "Other"],
];
export const TIMELINES = [
  ["", "When will they buy?"],
  ["now", "Ready to buy now"],
  ["3m", "Within 3 months"],
  ["6m", "3 to 6 months"],
  ["later", "Later than 6 months"],
];
export const PURPOSES = [
  ["", "Live or invest?"],
  ["live", "To live in"],
  ["invest", "Investment / rental"],
  ["second", "Second home / summer"],
  ["business", "Office or clinic"],
];
export const PAYS = [
  ["", "Cash or installments?"],
  ["installments", "Installments"],
  ["cash", "Cash"],
];

// Geographic directory mapping Egyptian cities & corridors to Egypt governorates (matching egypt-map.json)
export const CITY_TO_GOV = {
  "New Cairo": "Cairo",
  "New Heliopolis": "Cairo",
  Heliopolis: "Cairo",
  "Nasr City": "Cairo",
  Madinaty: "Cairo",
  "El Shorouk": "Cairo",
  Maadi: "Cairo",
  Zamalek: "Cairo",
  "Garden City": "Cairo",
  Cairo: "Cairo",
  "Sheikh Zayed": "Giza",
  "New Zayed": "Giza",
  "6th of October": "Giza",
  Mohandessin: "Giza",
  Dokki: "Giza",
  Haram: "Giza",
  Giza: "Giza",
  Alexandria: "Alexandria",
  "Ras El Hekma": "Matrouh",
  "Sidi Abdelrahman": "Matrouh",
  "Ghazala Bay": "Matrouh",
  "North Coast": "Matrouh",
  Matrouh: "Matrouh",
  "Ain Sokhna": "Suez",
  Suez: "Suez",
  "El Gouna": "Red Sea",
  Hurghada: "Red Sea",
  "Red Sea": "Red Sea",
  Mansoura: "Dakahlia",
  Dakahlia: "Dakahlia",
  Tanta: "Gharbia",
  Gharbia: "Gharbia",
  Zagazig: "Al Sharqia",
  "Al Sharqia": "Al Sharqia",
  Obour: "Qalyubia",
  Banha: "Qalyubia",
  Qalyubia: "Qalyubia",
  "Port Said": "Port Said",
  Ismailia: "Ismailia",
  Damietta: "Damietta",
  "Shebin El Kom": "Monufia",
  Monufia: "Monufia",
  Damanhour: "Beheira",
  Beheira: "Beheira",
  "Kafr el-Sheikh": "Kafr el-Sheikh",
  Faiyum: "Faiyum",
  "Beni Suef": "Beni Suef",
  Minya: "Minya",
  Asyut: "Asyut",
  Sohag: "Sohag",
  Qena: "Qena",
  Luxor: "Luxor",
  Aswan: "Aswan",
  "South Sinai": "South Sinai",
  "North Sinai": "North Sinai",
  "New Valley": "New Valley",
  Riyadh: "GCC · Saudi Arabia",
  Jeddah: "GCC · Saudi Arabia",
  Dammam: "GCC · Saudi Arabia",
  "Saudi Arabia": "GCC · Saudi Arabia",
  Dubai: "GCC · UAE",
  "Abu Dhabi": "GCC · UAE",
  "United Arab Emirates": "GCC · UAE",
  "Kuwait City": "GCC · Kuwait",
  Kuwait: "GCC · Kuwait",
  Doha: "GCC · Qatar",
  Qatar: "GCC · Qatar",
};

export const EGYPT_CORRIDORS = [
  { id: "New Cairo", label: "New Cairo & Fifth Settlement", gov: "Cairo", region: "East Cairo", projects: ["krypton", "golf-views", "neon-views", "urban-living"], coords: { egypt: [345, 96], delta: [435, 362] }, labelPos: "below" },
  { id: "Heliopolis", label: "Heliopolis & Nasr City", gov: "Cairo", region: "East Cairo", projects: ["krypton", "neon-views", "urban-living", "ein-bay"], coords: { egypt: [338, 86], delta: [396, 304] } },
  { id: "Madinaty", label: "Madinaty & El Shorouk", gov: "Cairo", region: "East Cairo", projects: ["krypton", "neon-views", "urban-living"], coords: { egypt: [356, 89], delta: [454, 322] } },
  { id: "Maadi", label: "Maadi, Zamalek & Central Cairo", gov: "Cairo", region: "Central Cairo", projects: ["golf-views", "krypton", "seashell-rah"], coords: { egypt: [331, 104], delta: [380, 354] }, labelPos: "below" },
  { id: "Sheikh Zayed", label: "Sheikh Zayed & New Zayed", gov: "Giza", region: "West Cairo", projects: ["ivy", "newgiza", "artlife", "meditown"], coords: { egypt: [305, 96], delta: [326, 336] } },
  { id: "6th of October", label: "6th of October & Giza Plateau", gov: "Giza", region: "West Cairo", projects: ["newgiza", "ivy", "artlife", "meditown"], coords: { egypt: [296, 110], delta: [298, 392] }, labelPos: "below" },
  { id: "Alexandria", label: "Alexandria & North Coast Gateway", gov: "Alexandria", region: "North Coast", projects: ["seashell-rah", "playa-rah", "playa", "seashell"], coords: { egypt: [255, 52], delta: [95, 165] } },
  { id: "Ras El Hekma", label: "Ras El Hekma & Ghazala Bay", gov: "Matrouh", region: "North Coast", projects: ["seashell-rah", "playa-rah", "playa", "seashell"], coords: { egypt: [175, 42], delta: [38, 215] }, labelPos: "below" },
  { id: "Mansoura", label: "Mansoura & Dakahlia", gov: "Dakahlia", region: "Nile Delta", projects: ["krypton", "seashell-rah", "urban-living"], coords: { egypt: [340, 44], delta: [401, 130] } },
  { id: "Tanta", label: "Tanta & Gharbia", gov: "Gharbia", region: "Nile Delta", projects: ["krypton", "ivy", "seashell-rah"], coords: { egypt: [315, 56], delta: [301, 170] } },
  { id: "Zagazig", label: "Zagazig & Al Sharqia", gov: "Al Sharqia", region: "East Delta", projects: ["krypton", "neon-views", "urban-living"], coords: { egypt: [346, 66], delta: [439, 204] } },
  { id: "Ismailia", label: "Ismailia & Port Said (Canal)", gov: "Ismailia", region: "Suez Canal", projects: ["krypton", "neon-views", "ein-bay"], coords: { egypt: [375, 68], delta: [498, 255] } },
  { id: "Suez", label: "Suez & Ain Sokhna Corridor", gov: "Suez", region: "Red Sea / Sokhna", projects: ["ein-bay", "golf-views", "krypton"], coords: { egypt: [378, 112], delta: [499, 412] } },
  { id: "Riyadh", label: "Riyadh & Jeddah (Saudi Arabia)", gov: "GCC · Saudi Arabia", region: "GCC Expats", projects: ["krypton", "seashell-rah", "ivy", "golf-views"], gcc: true, countryCode: "SAU" },
  { id: "Dubai", label: "Dubai & Abu Dhabi (UAE)", gov: "GCC · UAE", region: "GCC Expats", projects: ["krypton", "artlife", "seashell-rah", "playa-rah"], gcc: true, countryCode: "ARE" },
  { id: "Kuwait City", label: "Kuwait City (Kuwait)", gov: "GCC · Kuwait", region: "GCC Expats", projects: ["krypton", "ivy", "neon-views"], gcc: true, countryCode: "KWT" },
  { id: "Doha", label: "Doha (Qatar)", gov: "GCC · Qatar", region: "GCC Expats", projects: ["seashell-rah", "krypton", "golf-views"], gcc: true, countryCode: "QAT" },
];

// ---------------------------------------------------------------- store
let leads = load("leads", []);
const listeners = new Set();
export const onLeads = (fn) => (listeners.add(fn), () => listeners.delete(fn));
const commit = () => {
  if (!save("leads", leads)) alert("This browser could not save the leads (storage full or blocked). Export a backup now.");
  listeners.forEach((fn) => fn());
};
export const allLeads = () => leads;
export const getLead = (id) => leads.find((l) => l.id === id);

export function addLead(data) {
  const now = new Date().toISOString();
  const city = data.city || inferLeadCity(data);
  const governorate = data.governorate || CITY_TO_GOV[city] || "Cairo";
  const l = { id: uid("l"), created: now, stage: "new", history: [{ stage: "new", at: now }], source: "other", city, governorate, ...data };
  leads = [l, ...leads];
  commit();
  return l;
}
export function updateLead(id, patch) {
  leads = leads.map((l) => {
    if (l.id !== id) return l;
    const next = { ...l, ...patch };
    if (patch.city && !patch.governorate) next.governorate = CITY_TO_GOV[patch.city] || next.governorate || "Cairo";
    if (patch.stage && patch.stage !== l.stage) {
      const at = new Date().toISOString();
      next.history = [...(l.history || []), { stage: patch.stage, at }];
      next.stageAt = at;
      if (!l.firstContactAt && l.stage === "new") next.firstContactAt = at;
    }
    return next;
  });
  commit();
}
export function removeLead(id) {
  leads = leads.filter((l) => l.id !== id);
  commit();
}
/** Reads the lead list again (after switching between demo and real). */
export function reloadLeads() {
  leads = load("leads", []);
  listeners.forEach((fn) => fn());
}
export function replaceAll(list) {
  leads = Array.isArray(list) ? list : [];
  commit();
}

export function inferLeadCity(l) {
  if (l?.city) return l.city;
  const ans = l?.answers || {};
  for (const [k, v] of Object.entries(ans)) {
    if (/city|area|where|country|location/i.test(k) && v) {
      const found = Object.keys(CITY_TO_GOV).find((c) => String(v).toLowerCase().includes(c.toLowerCase()));
      if (found) return found;
    }
  }
  const text = `${l?.adsetName || ""} ${l?.campaignName || ""} ${l?.notes || ""}`;
  for (const c of Object.keys(CITY_TO_GOV)) {
    if (text.toLowerCase().includes(c.toLowerCase())) return c;
  }
  if (/gulf|abroad|expat/i.test(text)) return "Riyadh";
  if (/west cairo|zayed|ivy|newgiza|artlife|meditown/i.test(text)) return "Sheikh Zayed";
  if (/coast|summer|seashell|playa|hekma/i.test(text)) return "New Cairo";
  return "New Cairo";
}

/** Adds leads pulled from Meta lead forms. Leads already in the list (same Meta id) are skipped. */
export function mergeMetaLeads(rows, projectOf) {
  const seen = new Set(leads.map((l) => l.metaId).filter(Boolean));
  const fresh = [];
  for (const r of rows) {
    if (!r.metaId || seen.has(r.metaId)) continue;
    seen.add(r.metaId);
    const f = r.fields || {};
    const pick = (...keys) => keys.map((k) => f[k]).find((v) => v) || "";
    const answers = Object.fromEntries(Object.entries(f).filter(([k]) => !["full_name", "name", "first_name", "last_name", "phone_number", "phone", "email"].includes(k)));
    const draft = {
      id: uid("l"),
      metaId: r.metaId,
      created: r.created || new Date().toISOString(),
      name: pick("full_name", "name", "first_name") || [f.first_name, f.last_name].filter(Boolean).join(" "),
      phone: pick("phone_number", "phone", "mobile"),
      email: pick("email"),
      source: "meta-form",
      project: projectOf?.(r) || null,
      formName: r.formName || null,
      campaignId: r.campaignId,
      campaignName: r.campaignName,
      adsetId: r.adsetId,
      adsetName: r.adsetName,
      adId: r.adId,
      adName: r.adName,
      platform: r.platform,
      organic: r.organic,
      answers,
      stage: "new",
      history: [{ stage: "new", at: r.created || new Date().toISOString() }],
    };
    draft.city = inferLeadCity(draft);
    draft.governorate = CITY_TO_GOV[draft.city] || "Cairo";
    fresh.push(draft);
  }
  if (fresh.length) {
    leads = [...fresh, ...leads].sort((a, b) => String(b.created).localeCompare(String(a.created)));
    commit();
  }
  return fresh.length;
}

/** Maps a CSV row (Meta lead download, or this dashboard's own export) to a lead. */
export function leadFromCsv(row) {
  const get = (...names) => {
    for (const n of names) {
      const k = Object.keys(row).find((h) => h.toLowerCase().replace(/[^a-z0-9]/g, "") === n);
      if (k && row[k]) return row[k];
    }
    return "";
  };
  const metaId = get("id", "leadid", "metaid").replace(/^l:/, "");
  const draft = {
    metaId: /^\d{5,25}$/.test(metaId) ? metaId : null,
    created: get("createdtime", "created", "date") || new Date().toISOString(),
    name: get("fullname", "name"),
    phone: get("phonenumber", "phone", "mobile").replace(/^p:/, ""),
    email: get("email"),
    city: get("city", "area", "location") || null,
    source: get("source") || (get("formname", "formid") ? "meta-form" : "other"),
    campaignId: get("campaignid").replace(/^c:/, "") || null,
    campaignName: get("campaignname", "campaign") || null,
    adsetId: get("adsetid").replace(/^as:/, "") || null,
    adsetName: get("adsetname", "adset") || null,
    adId: get("adid").replace(/^ag:/, "") || null,
    adName: get("adname", "ad") || null,
    formName: get("formname") || null,
    project: get("project") || null,
    stage: STAGE[get("stage")] ? get("stage") : "new",
    notes: get("notes"),
  };
  if (!draft.city) draft.city = inferLeadCity(draft);
  draft.governorate = CITY_TO_GOV[draft.city] || "Cairo";
  return draft;
}

// ---------------------------------------------------------------- projects
/** Finds the project a campaign, ad set or ad is about, from its name (e.g. "GD | Krypton | Leads | ..."). */
export function projectFromName(name, catalog) {
  const s = ` ${String(name || "").toLowerCase().replace(/[_|\-–·]/g, " ")} `;
  let best = null;
  for (const p of catalog?.projects || []) {
    const keys = [p.name, p.slug.replace(/-/g, " "), ...(ALIASES[p.id] || [])].map((k) => k.toLowerCase());
    for (const k of keys) if (s.includes(` ${k} `) && (!best || k.length > best.k.length)) best = { p, k };
  }
  return best?.p || null;
}
const ALIASES = {
  krypton: ["kr", "kryp"],
  "golf-views": ["golf", "gv"],
  "neon-views": ["neon", "nv"],
  "urban-living": ["urban", "ul"],
  newgiza: ["new giza", "ng"],
  "seashell-rah": ["seashell rah", "seashell ras el hekma", "ss rah", "ssrah"],
  "playa-rah": ["playa rah", "playa ras el hekma"],
  playa: ["playa ghazala", "ghazala"],
  "ein-bay": ["einbay", "sokhna"],
  ivy: ["new zayed"],
  meditown: ["clinics", "clinic"],
  artlife: ["art life"],
};

/** Does the stated budget reach the project's lowest known price? */
export function budgetFit(lead, catalog) {
  const p = catalog?.projects?.find((x) => x.id === lead.project);
  if (!p?.from || !lead.budget) return null;
  return Number(lead.budget) >= p.from * 0.97;
}

/** Grades a lead A, B, C or D for sales prioritization. */
export function scoreLeadGrade(lead, catalog) {
  if (isBad(lead.stage)) return { grade: "D", points: 10, reasons: ["Disqualified"], label: "Disqualified", tone: "bad" };
  let pts = 35;
  const reasons = [];
  const fit = budgetFit(lead, catalog);
  if (fit === true) {
    pts += 30;
    reasons.push("Budget fits project");
  } else if (fit === false) {
    pts -= 25;
    reasons.push("Budget below entry");
  }
  if (lead.timeline === "now") {
    pts += 20;
    reasons.push("Buying now");
  } else if (lead.timeline === "3m") {
    pts += 15;
    reasons.push("Within 3 months");
  } else if (lead.timeline === "6m") {
    pts += 6;
  } else if (lead.timeline === "later") {
    pts -= 10;
  }
  if (lead.pay === "cash") {
    pts += 12;
    reasons.push("Cash buyer");
  } else if (lead.pay === "installments") {
    pts += 6;
  }
  if (RESERVED_UP.has(lead.stage)) {
    pts += 25;
    reasons.push("Reserved / EOI");
  } else if (MEETING_UP.has(lead.stage)) {
    pts += 18;
    reasons.push("Meeting / site visit");
  } else if (isValid(lead.stage)) {
    pts += 12;
    reasons.push("Verified interest");
  }
  const ansBudget = String(lead.answers?.["what_budget_do_you_have_in_mind?"] || "");
  if (/matches|above|\d+m/i.test(ansBudget) && !/below/i.test(ansBudget) && fit === null) {
    pts += 15;
    reasons.push("Form budget matches");
  }
  pts = Math.max(0, Math.min(100, pts));
  const grade = pts >= 75 ? "A" : pts >= 52 ? "B" : pts >= 32 ? "C" : "D";
  const tone = grade === "A" ? "good" : grade === "B" ? "info" : grade === "C" ? "warn" : "bad";
  return { grade, points: pts, reasons, tone };
}

// ---------------------------------------------------------------- quality
const blank = () => ({ leads: 0, waiting: 0, bad: 0, valid: 0, meetings: 0, reserved: 0, contacted: 0, responseMin: [] });
function count(q, l) {
  q.leads += 1;
  if (isWaiting(l.stage)) q.waiting += 1;
  if (isBad(l.stage)) q.bad += 1;
  if (isValid(l.stage)) q.valid += 1;
  if (MEETING_UP.has(l.stage)) q.meetings += 1;
  if (RESERVED_UP.has(l.stage)) q.reserved += 1;
  if (l.stage !== "new") q.contacted += 1;
  if (l.firstContactAt && l.created) {
    const m = (new Date(l.firstContactAt) - new Date(l.created)) / 60000;
    if (m >= 0 && Number.isFinite(m)) q.responseMin.push(m);
  }
}

/** Lead counts per campaign, ad set and ad id (and per name when ids are missing), for leads created between since and until (YYYY-MM-DD). */
export function quality(list, since, until) {
  const out = { campaign: {}, adset: {}, ad: {}, byName: {}, total: blank() };
  for (const l of list) {
    const d = String(l.created || "").slice(0, 10);
    if (since && d < since) continue;
    if (until && d > until) continue;
    count(out.total, l);
    if (l.campaignId) count((out.campaign[l.campaignId] ??= blank()), l);
    else if (l.campaignName) count((out.byName[`c:${l.campaignName}`] ??= blank()), l);
    if (l.adsetId) count((out.adset[l.adsetId] ??= blank()), l);
    if (l.adId) count((out.ad[l.adId] ??= blank()), l);
  }
  return out;
}
export const median = (xs) => {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

/** The dates a Meta result covers (from the insights rows). */
export function treeDates(tree) {
  let since = null;
  let until = null;
  for (const c of tree?.campaigns || []) {
    if (c.m?.dateStart && (!since || c.m.dateStart < since)) since = c.m.dateStart;
    if (c.m?.dateStop && (!until || c.m.dateStop > until)) until = c.m.dateStop;
  }
  if (tree?.range?.since) since = tree.range.since;
  if (tree?.range?.until) until = tree.range.until;
  return { since, until };
}

/** Joins Meta results with lead quality for one object. */
export function score(m, q) {
  const spend = m?.spend || 0;
  const metaLeads = (m?.leads || 0) + (m?.convos || 0);
  return {
    spend,
    metaLeads,
    cpl: per(spend, metaLeads),
    logged: q?.leads || 0,
    valid: q?.valid || 0,
    validRate: q?.leads ? ratio(q.valid, q.leads - (q.waiting || 0)) : null,
    cpvl: per(spend, q?.valid || 0),
    meetings: q?.meetings || 0,
    reserved: q?.reserved || 0,
    cpr: per(spend, q?.reserved || 0),
    waiting: q?.waiting || 0,
  };
}

// ---------------------------------------------------------------- media buyer decision verdict
export function verdict(m, sc, t = targets(), learning = null, status = "ACTIVE") {
  if (status !== "ACTIVE") {
    return { code: "paused", label: "Paused", tone: "line", why: "Currently switched off.", action: "turn_on", actionLabel: "Turn on" };
  }
  const targetCpl = t.cpl || 250;
  const targetCpvl = t.cpvl || 900;
  const contacted = (sc.logged || 0) - (sc.waiting || 0);
  if (sc.spend >= targetCpl * (t.noLeadSpendX || 2) && sc.metaLeads === 0) {
    return { code: "pause", label: "Pause · 0 leads", tone: "bad", why: `Spent ${Math.round(sc.spend)} EGP with zero leads.`, action: "pause", actionLabel: "Pause now" };
  }
  if (contacted >= (t.zeroValidAfter || 10) && sc.valid === 0) {
    return { code: "pause_invalid", label: "Fix or Pause · 0% valid", tone: "bad", why: `${contacted} contacted leads and 0 valid buyers. Add starting price to creative & budget filter to form.`, action: "pause", actionLabel: "Pause waste" };
  }
  if (sc.valid >= 2 && sc.cpvl && sc.cpvl <= targetCpvl * 0.85) {
    return { code: "scale", label: "Scale +20%", tone: "good", why: `CPVL is ${Math.round(sc.cpvl)} EGP (${Math.round((1 - sc.cpvl / targetCpvl) * 100)}% better than ${targetCpvl} target) with ${sc.valid} valid buyers.`, action: "scale_20", actionLabel: "Scale +20%" };
  }
  if (m && m.frequency > (t.maxFrequency || 3)) {
    return { code: "fatigue", label: "Creative fatigue", tone: "warn", why: `Frequency is ${m.frequency.toFixed(1)}× (above ${t.maxFrequency || 3}×). Rotate in a fresh 15s vertical film or widen geo.`, action: "targeting", actionLabel: "Widen audience" };
  }
  if (m && m.impressions >= (t.minImpressions || 2000) && m.ctr > 0 && m.ctr < (t.minCtr || 0.5)) {
    return { code: "hook", label: "Fix hook · Low CTR", tone: "warn", why: `Link CTR is ${m.ctr.toFixed(2)}% (target ≥ ${t.minCtr || 0.5}%). Put project name & 5% down payment in first 3 seconds.`, action: "messages", actionLabel: "New ad hook" };
  }
  if (learning === "FAIL") {
    return { code: "learning", label: "Learning limited", tone: "warn", why: "Not reaching ~50 leads/week. Consolidate ad sets, broaden geo, or raise daily budget.", action: "scale_15", actionLabel: "Boost +15%" };
  }
  if (sc.valid >= 2 && sc.cpvl && sc.cpvl > targetCpvl * 1.35) {
    return { code: "high_cpvl", label: "High CPVL · Tighten", tone: "warn", why: `CPVL is ${Math.round(sc.cpvl)} EGP vs ${targetCpvl} target. Narrow to higher-intent geo or Warm retargeting.`, action: "targeting", actionLabel: "Tighten geo" };
  }
  if (sc.valid >= 1 && sc.cpvl && sc.cpvl <= targetCpvl * 1.15) {
    return { code: "keep", label: "Winner · Hold", tone: "good", why: `On-target CPVL (${Math.round(sc.cpvl)} EGP) with steady valid buyer flow.`, action: null, actionLabel: null };
  }
  return { code: "early", label: "Gathering signal", tone: "info", why: "Needs more spend or sales call dispositions before scaling.", action: null, actionLabel: null };
}

// ---------------------------------------------------------------- daily time-series
export function dailyPerformance(tree, list) {
  const { since, until } = treeDates(tree);
  const byDayLeads = {};
  for (const l of list) {
    const d = String(l.created || "").slice(0, 10);
    if (since && d < since) continue;
    if (until && d > until) continue;
    const row = (byDayLeads[d] ??= { logged: 0, valid: 0, meetings: 0, reserved: 0 });
    row.logged += 1;
    if (isValid(l.stage)) row.valid += 1;
    if (MEETING_UP.has(l.stage)) row.meetings += 1;
    if (RESERVED_UP.has(l.stage)) row.reserved += 1;
  }

  if (tree?.daily?.length) {
    return tree.daily.map((d) => {
      const l = byDayLeads[d.date] || { logged: 0, valid: 0, meetings: 0, reserved: 0 };
      return {
        ...d,
        logged: l.logged,
        valid: l.valid,
        meetings: l.meetings,
        reserved: l.reserved,
        cpvl: l.valid > 0 ? Math.round(d.spend / l.valid) : null,
        cpl: d.leads > 0 ? Math.round(d.spend / d.leads) : null,
      };
    });
  }

  // Fallback when connected to live Meta without a daily breakdown array
  const days = Object.keys(byDayLeads).sort();
  const totalSpend = (tree?.campaigns || []).reduce((n, c) => n + (c.m?.spend || 0), 0);
  const perDaySpend = days.length ? totalSpend / days.length : 0;
  return days.map((date) => {
    const l = byDayLeads[date];
    return {
      date,
      spend: Math.round(perDaySpend),
      impressions: 0,
      linkClicks: 0,
      landingViews: 0,
      leads: l.logged,
      logged: l.logged,
      valid: l.valid,
      meetings: l.meetings,
      reserved: l.reserved,
      cpvl: l.valid > 0 ? Math.round(perDaySpend / l.valid) : null,
      cpl: l.logged > 0 ? Math.round(perDaySpend / l.logged) : null,
    };
  });
}

// ---------------------------------------------------------------- Egypt & GCC Geo Intelligence
export function geoBreakdown(tree, list, catalog) {
  const { since, until } = treeDates(tree);
  const govs = {};
  const corridors = {};

  const ensureGov = (name) =>
    (govs[name] ??= {
      name,
      isGcc: name.startsWith("GCC"),
      spend: 0,
      impressions: 0,
      clicks: 0,
      metaLeads: 0,
      leads: 0,
      contacted: 0,
      valid: 0,
      meetings: 0,
      reserved: 0,
      adsets: [],
      projects: {},
    });

  const ensureCorridor = (id) => {
    const meta = EGYPT_CORRIDORS.find((c) => c.id === id) || { id, label: id, gov: CITY_TO_GOV[id] || "Cairo", region: "Egypt", projects: [] };
    return (corridors[id] ??= {
      ...meta,
      spend: 0,
      impressions: 0,
      clicks: 0,
      metaLeads: 0,
      leads: 0,
      contacted: 0,
      valid: 0,
      meetings: 0,
      reserved: 0,
      adsets: [],
      byProject: {},
    });
  };

  for (const c of EGYPT_CORRIDORS) {
    ensureCorridor(c.id);
    ensureGov(c.gov);
  }

  // 1. Attribute ad set spend, impressions, clicks, and Meta leads across targeted cities/governorates
  for (const c of tree?.campaigns || []) {
    const proj = projectFromName(c.name, catalog)?.id || c.project || "krypton";
    for (const s of c.adsets || []) {
      const m = s.m;
      const rawPlaces = s.targeting?.places || [];
      const matchedCities = [];
      for (const pl of rawPlaces) {
        const clean = String(pl).replace(/\s*\+\d+.*$/, "").trim();
        const corr = EGYPT_CORRIDORS.find((x) => x.id.toLowerCase() === clean.toLowerCase())?.id || (CITY_TO_GOV[clean] ? clean : null);
        if (corr && !matchedCities.includes(corr)) matchedCities.push(corr);
      }
      if (!matchedCities.length) matchedCities.push("New Cairo");

      const share = 1 / matchedCities.length;
      for (const city of matchedCities) {
        const govName = CITY_TO_GOV[city] || "Cairo";
        const g = ensureGov(govName);
        const cr = ensureCorridor(city);
        if (!g.adsets.some((x) => x.id === s.id)) g.adsets.push({ id: s.id, name: s.name, campaignId: c.id, campaignName: c.name, status: s.effectiveStatus, dailyBudget: s.dailyBudget });
        if (!cr.adsets.some((x) => x.id === s.id)) cr.adsets.push({ id: s.id, name: s.name, campaignId: c.id, campaignName: c.name, status: s.effectiveStatus, dailyBudget: s.dailyBudget });
        if (m) {
          g.spend += (m.spend || 0) * share;
          g.impressions += (m.impressions || 0) * share;
          g.clicks += (m.linkClicks || 0) * share;
          g.metaLeads += ((m.leads || 0) + (m.convos || 0)) * share;
          g.projects[proj] = (g.projects[proj] || 0) + (m.spend || 0) * share;

          cr.spend += (m.spend || 0) * share;
          cr.impressions += (m.impressions || 0) * share;
          cr.clicks += (m.linkClicks || 0) * share;
          cr.metaLeads += ((m.leads || 0) + (m.convos || 0)) * share;
          cr.byProject[proj] = (cr.byProject[proj] || 0) + (m.spend || 0) * share;
        }
      }
    }
  }

  // 2. Attribute logged leads & sales outcomes to their city and governorate
  for (const l of list) {
    const d = String(l.created || "").slice(0, 10);
    if (since && d < since) continue;
    if (until && d > until) continue;
    const city = l.city || inferLeadCity(l);
    const govName = l.governorate || CITY_TO_GOV[city] || "Cairo";
    const g = ensureGov(govName);
    const cr = ensureCorridor(EGYPT_CORRIDORS.some((x) => x.id === city) ? city : EGYPT_CORRIDORS.find((x) => x.gov === govName)?.id || "New Cairo");
    for (const target of [g, cr]) {
      target.leads += 1;
      if (l.stage !== "new") target.contacted += 1;
      if (isValid(l.stage)) target.valid += 1;
      if (MEETING_UP.has(l.stage)) target.meetings += 1;
      if (RESERVED_UP.has(l.stage)) target.reserved += 1;
    }
    if (l.project) {
      g.projects[l.project] = (g.projects[l.project] || 0) + 1;
      cr.byProject[l.project] = (cr.byProject[l.project] || 0) + 1;
    }
  }

  const finalize = (obj) => {
    obj.spend = Math.round(obj.spend);
    obj.impressions = Math.round(obj.impressions);
    obj.clicks = Math.round(obj.clicks);
    obj.metaLeads = Math.round(obj.metaLeads);
    obj.cpl = obj.metaLeads > 0 ? Math.round(obj.spend / obj.metaLeads) : obj.leads > 0 ? Math.round(obj.spend / obj.leads) : null;
    obj.cpvl = obj.valid > 0 ? Math.round(obj.spend / obj.valid) : null;
    obj.validRate = obj.contacted > 0 ? (obj.valid / obj.contacted) * 100 : null;
    return obj;
  };

  Object.values(govs).forEach(finalize);
  Object.values(corridors).forEach(finalize);

  return {
    govs,
    corridors: Object.values(corridors).sort((a, b) => b.spend - a.spend || b.valid - a.valid),
  };
}

// ---------------------------------------------------------------- Website & Landing Page Funnel
export function websiteFunnel(tree, list, catalog, liveEvents = []) {
  const { since, until } = treeDates(tree);
  const byProject = {};

  for (const p of catalog?.projects || []) {
    byProject[p.id] = {
      project: p,
      spend: 0,
      impressions: 0,
      linkClicks: 0,
      landingViews: 0,
      layoutViews: 0,
      paymentViews: 0,
      filmPlays: 0,
      brochures: 0,
      waClicks: 0,
      callClicks: 0,
      briefs: 0,
      metaLeads: 0,
      loggedLeads: 0,
      validLeads: 0,
      meetings: 0,
      reserved: 0,
    };
  }

  for (const c of tree?.campaigns || []) {
    const p = projectFromName(c.name, catalog);
    if (!p || !byProject[p.id] || !c.m) continue;
    const row = byProject[p.id];
    row.spend += c.m.spend || 0;
    row.impressions += c.m.impressions || 0;
    row.linkClicks += c.m.linkClicks || 0;
    row.landingViews += c.m.landingViews || Math.round((c.m.linkClicks || 0) * 0.79);
    row.metaLeads += (c.m.leads || 0) + (c.m.convos || 0);
  }

  for (const l of list) {
    const d = String(l.created || "").slice(0, 10);
    if (since && d < since) continue;
    if (until && d > until) continue;
    const pid = l.project || projectFromName(l.campaignName, catalog)?.id;
    if (!pid || !byProject[pid]) continue;
    const row = byProject[pid];
    row.loggedLeads += 1;
    if (isValid(l.stage)) row.validLeads += 1;
    if (MEETING_UP.has(l.stage)) row.meetings += 1;
    if (RESERVED_UP.has(l.stage)) row.reserved += 1;
  }

  // Enrich with on-site micro-conversions (either from live webhook events or proportional to landingViews)
  for (const evt of liveEvents) {
    const pid = evt.project || catalog?.projects?.find((p) => String(evt.page || "").includes(p.slug))?.id || "krypton";
    const row = byProject[pid];
    if (!row) continue;
    if (/whatsapp/i.test(evt.event)) row.waClicks += 1;
    else if (/call/i.test(evt.event)) row.callClicks += 1;
    else if (/layout|residence/i.test(evt.event)) row.layoutViews += 1;
    else if (/payment/i.test(evt.event)) row.paymentViews += 1;
    else if (/film/i.test(evt.event)) row.filmPlays += 1;
    else if (/brochure/i.test(evt.event)) row.brochures += 1;
    else if (/brief|lead/i.test(evt.event)) row.briefs += 1;
  }

  const rows = Object.values(byProject).map((r) => {
    const lpv = r.landingViews;
    // When running in demo mode or before Umami webhook events arrive, derive realistic on-site engagement from LPVs & project properties
    if (lpv > 0 && !liveEvents.length) {
      r.layoutViews = Math.round(lpv * (r.project.id === "krypton" ? 0.48 : 0.36));
      r.paymentViews = Math.round(lpv * 0.41);
      r.filmPlays = r.project.hasFilm ? Math.round(lpv * 0.29) : 0;
      r.brochures = r.project.brochures ? Math.round(lpv * 0.14) : 0;
      r.waClicks = Math.round(lpv * 0.115);
      r.callClicks = Math.round(lpv * 0.048);
      r.briefs = Math.round(lpv * 0.032);
    }
    r.lpvRate = r.linkClicks > 0 ? (r.landingViews / r.linkClicks) * 100 : null;
    r.onsiteActions = r.waClicks + r.callClicks + r.briefs;
    r.onsiteCvr = r.landingViews > 0 ? (r.onsiteActions / r.landingViews) * 100 : null;
    r.cpvl = r.validLeads > 0 ? r.spend / r.validLeads : null;
    return r;
  });

  return rows.sort((a, b) => b.spend - a.spend || (b.project.inventory?.available || 0) - (a.project.inventory?.available || 0));
}

// ---------------------------------------------------------------- what needs attention
export function alerts(tree, list) {
  const t = targets();
  const out = [];
  if (tree) {
    const { since, until } = treeDates(tree);
    const q = quality(list, since, until);
    for (const c of tree.campaigns) {
      for (const s of c.adsets) {
        const on = s.effectiveStatus === "ACTIVE";
        const m = s.m;
        if (!m || !on) continue;
        const sc = score(m, q.adset[s.id]);
        const where = { campaignId: c.id, adsetId: s.id, name: s.name, campaign: c.name, dailyBudget: s.dailyBudget };
        if (t.cpl && sc.metaLeads === 0 && m.spend >= t.cpl * t.noLeadSpendX)
          out.push({ tone: "bad", action: "pause", ...where, title: `No leads after ${Math.round(m.spend)} spent`, text: `Spend is ${t.noLeadSpendX}× your target cost per lead with no leads. Check the form or WhatsApp link, then turn it off or change the ad.` });
        if (t.cpl && sc.cpl && sc.cpl > t.cpl * 1.5 && sc.metaLeads >= 3)
          out.push({ tone: "warn", action: "targeting", ...where, title: "Cost per lead is high", text: `About ${Math.round(sc.cpl)} per lead against a target of ${t.cpl}. Try a new hook or a tighter audience.` });
        if (m.frequency > t.maxFrequency)
          out.push({ tone: "warn", action: "targeting", ...where, title: `Frequency ${m.frequency.toFixed(1)}`, text: `People are seeing these ads more than ${t.maxFrequency} times. Add fresh creative or widen the audience.` });
        if (m.impressions >= t.minImpressions && m.ctr > 0 && m.ctr < t.minCtr)
          out.push({ tone: "warn", action: "messages", ...where, title: `Low link CTR (${m.ctr.toFixed(2)}%)`, text: `Below ${t.minCtr}% after ${m.impressions.toLocaleString()} impressions: the first line or first 3 seconds are not stopping people.` });
        const qs = q.adset[s.id];
        if (qs && qs.leads - qs.waiting >= t.zeroValidAfter && qs.valid === 0)
          out.push({ tone: "bad", action: "pause", ...where, title: `${qs.leads} leads, none valid`, text: "Leads are coming but none show real interest. Put the starting price in the ad, add a budget question to the form, or switch to a Higher intent form." });
        if (t.cpvl && sc.cpvl && sc.valid >= 2 && sc.cpvl <= t.cpvl * 0.8)
          out.push({ tone: "good", action: "scale_20", ...where, title: "Good cost per valid lead", text: `About ${Math.round(sc.cpvl)} per valid lead. Raise the budget by 15–20% and watch it for 2–3 days.` });
        if (s.learning === "FAIL")
          out.push({ tone: "warn", action: "scale_15", ...where, title: "Learning limited", text: "The ad set is not getting enough results to learn. Combine ad sets, widen the audience or raise the budget." });
      }
    }
  }
  const late = list.filter((l) => l.stage === "new" && Date.now() - new Date(l.created).getTime() > t.speedToLead * 60000 && Date.now() - new Date(l.created).getTime() < 7 * 86400000);
  if (late.length)
    out.unshift({ tone: "bad", lead: true, title: `${late.length} lead${late.length > 1 ? "s" : ""} waiting more than ${t.speedToLead} min`, text: "The first person to call wins most real buyers. Call or WhatsApp them now." });
  const rank = { bad: 0, warn: 1, info: 2, good: 3 };
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]);
}
