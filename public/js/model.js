// Leads, lead stages and the "valid lead" measure, plus the rules that flag
// what needs attention. A valid lead is a person who showed real interest:
// they answered, the budget and the project fit, and they talked about buying.
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
  const l = { id: uid("l"), created: now, stage: "new", history: [{ stage: "new", at: now }], source: "other", ...data };
  leads = [l, ...leads];
  commit();
  return l;
}
export function updateLead(id, patch) {
  leads = leads.map((l) => {
    if (l.id !== id) return l;
    const next = { ...l, ...patch };
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
export function replaceAll(list) {
  leads = Array.isArray(list) ? list : [];
  commit();
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
    fresh.push({
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
      answers: Object.fromEntries(Object.entries(f).filter(([k]) => !["full_name", "name", "first_name", "last_name", "phone_number", "phone", "email"].includes(k))),
      stage: "new",
      history: [{ stage: "new", at: r.created || new Date().toISOString() }],
    });
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
  return {
    metaId: /^\d{5,25}$/.test(metaId) ? metaId : null,
    created: get("createdtime", "created", "date") || new Date().toISOString(),
    name: get("fullname", "name"),
    phone: get("phonenumber", "phone", "mobile").replace(/^p:/, ""),
    email: get("email"),
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
        const where = { campaignId: c.id, adsetId: s.id, name: s.name, campaign: c.name };
        if (t.cpl && sc.metaLeads === 0 && m.spend >= t.cpl * t.noLeadSpendX)
          out.push({ tone: "bad", ...where, title: `No leads after ${Math.round(m.spend)} spent`, text: `Spend is ${t.noLeadSpendX}× your target cost per lead with no leads. Check the form or WhatsApp link, then turn it off or change the ad.` });
        if (t.cpl && sc.cpl && sc.cpl > t.cpl * 1.5 && sc.metaLeads >= 3)
          out.push({ tone: "warn", ...where, title: "Cost per lead is high", text: `About ${Math.round(sc.cpl)} per lead against a target of ${t.cpl}. Try a new hook or a tighter audience.` });
        if (m.frequency > t.maxFrequency)
          out.push({ tone: "warn", ...where, title: `Frequency ${m.frequency.toFixed(1)}`, text: `People are seeing these ads more than ${t.maxFrequency} times. Add fresh creative or widen the audience.` });
        if (m.impressions >= t.minImpressions && m.ctr > 0 && m.ctr < t.minCtr)
          out.push({ tone: "warn", ...where, title: `Low link CTR (${m.ctr.toFixed(2)}%)`, text: `Below ${t.minCtr}% after ${m.impressions.toLocaleString()} impressions: the first line or first 3 seconds are not stopping people.` });
        const qs = q.adset[s.id];
        if (qs && qs.leads - qs.waiting >= t.zeroValidAfter && qs.valid === 0)
          out.push({ tone: "bad", ...where, title: `${qs.leads} leads, none valid`, text: "Leads are coming but none show real interest. Put the starting price in the ad, add a budget question to the form, or switch to a Higher intent form." });
        if (t.cpvl && sc.cpvl && sc.valid >= 2 && sc.cpvl <= t.cpvl * 0.8)
          out.push({ tone: "good", ...where, title: "Good cost per valid lead", text: `About ${Math.round(sc.cpvl)} per valid lead. Raise the budget by 15–20% and watch it for 2–3 days.` });
        if (s.learning === "FAIL")
          out.push({ tone: "warn", ...where, title: "Learning limited", text: "The ad set is not getting enough results to learn. Combine ad sets, widen the audience or raise the budget." });
      }
    }
  }
  const late = list.filter((l) => l.stage === "new" && Date.now() - new Date(l.created).getTime() > t.speedToLead * 60000 && Date.now() - new Date(l.created).getTime() < 7 * 86400000);
  if (late.length)
    out.unshift({ tone: "bad", lead: true, title: `${late.length} lead${late.length > 1 ? "s" : ""} waiting more than ${t.speedToLead} min`, text: "The first person to call wins most real buyers. Call or WhatsApp them now." });
  const rank = { bad: 0, warn: 1, info: 2, good: 3 };
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]);
}
