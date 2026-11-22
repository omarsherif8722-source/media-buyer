import { buildRule, preview, PRESETS } from "./rules.js";
// Demo mode: a realistic G Developments ad account, daily time-series,
// geographic attribution across Egypt governorates & GCC hubs, website funnel
// telemetry, and 2,000+ leads so every visualization and action works live.
// NOTHING HERE IS REAL. In demo mode every /api call is answered by this file
// in the browser: no request reaches the server or Meta.

const DAYS = 95; // index 0 = 94 days ago, index 94 = today
const DEMO_SETTINGS = { connected: true, demo: true, account: "act_demo", readOnly: false, leadForms: true, stagesToMeta: true, version: "demo", maxDailyBudget: null };

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const CITY = {
  "New Cairo": "1528",
  Heliopolis: "1529",
  "Nasr City": "1530",
  Madinaty: "1531",
  "Sheikh Zayed": "1540",
  "6th of October": "1541",
  Maadi: "1532",
  Cairo: "1500",
  Giza: "1539",
  Alexandria: "1600",
  Mansoura: "1610",
  Tanta: "1620",
  Zagazig: "1630",
  "Port Said": "1640",
  Ismailia: "1650",
  Suez: "1660",
  "Ras El Hekma": "1670",
  "El Gouna": "1680",
  Riyadh: "2100",
  Jeddah: "2101",
  Dammam: "2102",
  Dubai: "2200",
  "Abu Dhabi": "2201",
  "Kuwait City": "2300",
  Doha: "2400",
};

// Maps every city/corridor to its Egypt Governorate (matching egypt-map.json) or GCC country
export const CITY_TO_GOV = {
  "New Cairo": "Cairo",
  Heliopolis: "Cairo",
  "Nasr City": "Cairo",
  Madinaty: "Cairo",
  Maadi: "Cairo",
  Cairo: "Cairo",
  "Sheikh Zayed": "Giza",
  "6th of October": "Giza",
  Giza: "Giza",
  Alexandria: "Alexandria",
  Mansoura: "Dakahlia",
  Tanta: "Gharbia",
  Zagazig: "Al Sharqia",
  "Port Said": "Port Said",
  Ismailia: "Ismailia",
  Suez: "Suez",
  "Ras El Hekma": "Matrouh",
  "El Gouna": "Red Sea",
  Riyadh: "GCC · Saudi Arabia",
  Jeddah: "GCC · Saudi Arabia",
  Dammam: "GCC · Saudi Arabia",
  Dubai: "GCC · UAE",
  "Abu Dhabi": "GCC · UAE",
  "Kuwait City": "GCC · Kuwait",
  Doha: "GCC · Qatar",
};

const AUD = {
  visitors: { id: "238400000001", name: "Krypton page visitors · 30 days", subtype: "WEBSITE", min: 3100, max: 3700 },
  film: { id: "238400000002", name: "Project film viewers 50% · 90 days", subtype: "ENGAGEMENT", min: 41000, max: 48000 },
  openers: { id: "238400000003", name: "Opened lead form, did not send · 30 days", subtype: "ENGAGEMENT", min: 2600, max: 3100 },
  leads: { id: "238400000004", name: "All leads (to exclude)", subtype: "CUSTOM", min: 1000, max: 1500 },
  lal: { id: "238400000005", name: "Lookalike 1% Egypt · valid leads", subtype: "LOOKALIKE", min: 690000, max: 810000 },
  payment: { id: "238400000006", name: "Website payment plan explorers · 30 days", subtype: "WEBSITE", min: 1850, max: 2300 },
};
let interestId = 6003000000000;
const INTEREST = {};
const interest = (name) => (INTEREST[name] ??= { id: String(++interestId), name });
function tg({ cities = [], age = [28, 65], interests = [], adv = false, include = [], exclude = ["leads"] }) {
  const t = { geo_locations: { cities: cities.map((c) => ({ key: CITY[c], name: c, radius: 15, distance_unit: "kilometer" })), location_types: ["home", "recent"] }, age_min: age[0], age_max: age[1] };
  if (interests.length) t.flexible_spec = [{ interests: interests.map(interest) }];
  if (include.length) t.custom_audiences = include.map((k) => ({ id: AUD[k].id, name: AUD[k].name }));
  if (exclude.length) t.excluded_custom_audiences = exclude.map((k) => ({ id: AUD[k].id, name: AUD[k].name }));
  if (adv) t.targeting_automation = { advantage_audience: 1 };
  return t;
}

// cpm EGP, ctr % (link), cvr % (lead per link click), valid % (of contacted), meet % (of valid), res % (of meetings), f = base frequency
const PLAN = [
  {
    name: "GD | Krypton | Leads | Broad | Nov", project: "krypton", form: "Krypton · higher intent",
    sets: [
      { name: "A · Broad East Cairo", budget: 800, cpm: 85, ctr: 1.15, cvr: 9, valid: 22, meet: 42, res: 16, f: 1.2, learning: "SUCCESS", t: tg({ cities: ["New Cairo", "Heliopolis", "Nasr City"], adv: true }), ads: [["film-15s-price", 0.55, 1.1, 1], ["carousel-homes", 0.3, 0.9, 1.1], ["static-price-plan", 0.15, 0.7, 1.3]] },
      { name: "B · Investors interests", budget: 500, cpm: 95, ctr: 0.95, cvr: 8, valid: 31, meet: 45, res: 18, f: 1.25, learning: "SUCCESS", t: tg({ cities: ["New Cairo", "Heliopolis", "Maadi"], age: [30, 65], interests: ["Real estate investing", "Luxury real estate", "Serviced apartment"] }), ads: [["film-15s-price", 0.6, 1, 1], ["carousel-homes", 0.4, 0.95, 1]] },
      { name: "C · Warm: visitors and viewers", budget: 200, cpm: 120, ctr: 1.6, cvr: 13, valid: 46, meet: 50, res: 20, f: 1.95, learning: "LEARNING", t: tg({ cities: ["Cairo", "New Cairo"], age: [25, 65], include: ["visitors", "film"] }), ads: [["reminder-price-plan", 1, 1, 1]] },
      { name: "D · Gulf expats", budget: 500, cpm: 160, ctr: 0.8, cvr: 6, valid: 27, meet: 35, res: 14, f: 1.15, learning: "FAIL", t: tg({ cities: ["Riyadh", "Jeddah", "Dubai", "Kuwait City"], age: [30, 60], interests: ["Lived in Egypt (formerly expats - Egypt)"] }), ads: [["film-15s-price-gulf", 1, 1, 1]] },
    ],
  },
  {
    name: "GD | Krypton | WhatsApp | Nov", project: "krypton", whatsapp: true, objective: "OUTCOME_ENGAGEMENT",
    sets: [
      { name: "WA · East Cairo & Delta", budget: 350, cpm: 70, ctr: 1.35, cvr: 12, valid: 26, meet: 42, res: 15, f: 1.28, learning: "SUCCESS", optimization: "CONVERSATIONS", t: tg({ cities: ["New Cairo", "Nasr City", "Madinaty", "Mansoura", "Tanta"], age: [27, 55] }), ads: [["wa-film-15s-krypton", 0.6, 1.05, 1], ["wa-static-5pct-down", 0.4, 0.9, 1.1]] },
      { name: "WA · Gulf Expats VIP Chat", budget: 250, cpm: 145, ctr: 0.95, cvr: 10, valid: 34, meet: 44, res: 18, f: 1.18, learning: "SUCCESS", optimization: "CONVERSATIONS", t: tg({ cities: ["Riyadh", "Jeddah", "Dubai", "Kuwait City"], age: [30, 58] }), ads: [["wa-gulf-serviced-15s", 1, 1, 1]] },
    ],
  },
  {
    name: "GD | IVY | WhatsApp | Direct Advisory | Nov", project: "ivy", whatsapp: true, objective: "OUTCOME_ENGAGEMENT",
    sets: [
      { name: "WA · Sheikh Zayed & October Families", budget: 300, cpm: 74, ctr: 1.22, cvr: 11.5, valid: 29, meet: 45, res: 16, f: 1.22, learning: "SUCCESS", optimization: "CONVERSATIONS", t: tg({ cities: ["Sheikh Zayed", "6th of October", "Giza"], age: [30, 55] }), ads: [["wa-ivy-lake-15s", 0.65, 1.05, 1], ["wa-kings-school-chat", 0.35, 0.95, 1.05]] },
    ],
  },
  {
    name: "GD | Seashell Ras El Hekma | WhatsApp | Lagoon | Nov", project: "seashell-rah", whatsapp: true, objective: "OUTCOME_ENGAGEMENT",
    sets: [
      { name: "WA · Cairo & Alex Lagoon Buyers", budget: 250, cpm: 78, ctr: 1.1, cvr: 10.5, valid: 22, meet: 38, res: 14, f: 1.25, learning: "SUCCESS", optimization: "CONVERSATIONS", t: tg({ cities: ["New Cairo", "Sheikh Zayed", "Alexandria"], age: [30, 60] }), ads: [["wa-lagoon-chalet-15s", 1, 1, 1]] },
    ],
  },
  {
    name: "GD | IVY | Leads | Families | Nov", project: "ivy", form: "IVY · higher intent",
    sets: [
      { name: "A · Broad West Cairo", budget: 600, cpm: 80, ctr: 1.05, cvr: 9, valid: 25, meet: 40, res: 15, f: 1.2, learning: "SUCCESS", t: tg({ cities: ["Sheikh Zayed", "6th of October", "Giza"], age: [30, 65], adv: true }), ads: [["lake-film-15s", 0.65, 1.05, 1], ["school-carousel", 0.35, 0.9, 1]] },
      { name: "B · Parents with children", budget: 400, cpm: 90, ctr: 1.0, cvr: 8.5, valid: 33, meet: 44, res: 17, f: 1.3, learning: "SUCCESS", t: tg({ cities: ["Sheikh Zayed", "6th of October"], age: [32, 52], interests: ["Parents with children (6-12 years)", "British international schools"] }), ads: [["school-carousel", 0.5, 1, 1], ["lake-film-15s", 0.5, 1, 1]] },
    ],
  },
  {
    name: "GD | Neon Views | Leads | Villas | Nov", project: "neon-views", form: "Neon Views · higher intent",
    sets: [
      { name: "A · Broad East Cairo & Canal", budget: 500, cpm: 90, ctr: 0.9, cvr: 7.5, valid: 18, meet: 40, res: 14, f: 1.2, learning: "SUCCESS", t: tg({ cities: ["New Cairo", "Heliopolis", "Madinaty", "Zagazig", "Ismailia", "Port Said"], age: [32, 65], adv: true }), ads: [["townhouse-tour-20s", 0.6, 1, 1], ["villa-carousel", 0.4, 0.9, 1.1]] },
      { name: "B · Apartment upgraders", budget: 350, cpm: 95, ctr: 0.85, cvr: 7, valid: 27, meet: 42, res: 15, f: 1.25, learning: "LEARNING", t: tg({ cities: ["Nasr City", "Heliopolis", "New Cairo"], age: [32, 50], interests: ["Interior design", "Home and garden"] }), ads: [["townhouse-tour-20s", 1, 1, 1]] },
    ],
  },
  {
    name: "GD | Seashell Ras El Hekma | Leads | Summer", project: "seashell-rah", form: "Seashell RAH · more volume",
    sets: [
      { name: "A · Cairo & Alex summer homes", budget: 600, cpm: 65, ctr: 0.42, cvr: 16, valid: 6, meet: 30, res: 10, f: 1.3, learning: "SUCCESS", t: tg({ cities: ["Cairo", "Alexandria", "Ras El Hekma", "Sheikh Zayed"], age: [25, 65], interests: ["Beach resort"] }), ads: [["lagoon-static", 0.7, 1, 1], ["beach-carousel", 0.3, 0.9, 1]] },
      { name: "D · Gulf summer homes", budget: 400, cpm: 150, ctr: 0.75, cvr: 6, valid: 21, meet: 33, res: 12, f: 1.7, learning: "FAIL", t: tg({ cities: ["Riyadh", "Jeddah", "Doha", "Dubai"], age: [30, 60], interests: ["Beach resort", "Frequent international travelers"] }), ads: [["lagoon-film-15s", 1, 1, 1.05]] },
    ],
  },
  {
    name: "GD | Golf Views | Leads | Oct", project: "golf-views", form: "Golf Views · higher intent", pausedDaysAgo: 9,
    sets: [{ name: "A · High net worth New Cairo & Red Sea", budget: 500, cpm: 140, ctr: 0.7, cvr: 6, valid: 12, meet: 45, res: 20, f: 1.3, learning: "SUCCESS", t: tg({ cities: ["New Cairo", "Heliopolis", "Suez", "El Gouna"], age: [38, 65], interests: ["Golf", "Luxury real estate"] }), ads: [["fairway-film-20s", 1, 1, 1]] }],
  },
];

const FIRST = ["Ahmed", "Mohamed", "Mahmoud", "Omar", "Youssef", "Karim", "Mostafa", "Hany", "Tarek", "Sherif", "Amr", "Hossam", "Nour", "Mariam", "Sara", "Yasmine", "Dina", "Rania", "Heba", "Laila", "Nada", "Salma", "Mona", "Aya", "Khaled", "Waleed", "Ramy", "Shady"];
const LAST = ["Hassan", "Ali", "Ibrahim", "Mansour", "El-Sayed", "Fahmy", "Saleh", "Kamel", "Abdel Aziz", "Farouk", "Naguib", "Shafik", "Gamal", "Zaki", "Ezzat", "Rashad", "Helmy", "Soliman"];
const BAD = [["invalid", 24, "Wrong number"], ["low_budget", 31, "Budget below the starting price"], ["not_now", 24, "Just looking, maybe next year"], ["broker", 11, "Broker asking about commission"], ["job", 10, "Asked about a sales job"]];
const VALID_NOTES = ["Wants a 2-bedroom, prefers the park side", "Asked for the payment schedule on WhatsApp", "Will visit with family on Friday", "Comparing with a resale unit, call back Sunday", "Interested in a ground floor with garden", "Buying to rent out, asked about the hotel service"];

const dayIso = (i) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (DAYS - 1 - i));
  return d;
};
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function build(catalog) {
  const r = rng(20261121);
  const fromOf = (pid) => catalog?.projects?.find((p) => p.id === pid)?.from || 10000000;
  const now = new Date();
  const dayFraction = Math.max(0.05, (now.getHours() * 60 + now.getMinutes()) / 1440);
  let idn = 120210000000000;
  const nid = () => String(++idn);
  const campaigns = [];
  const leads = [];
  let leadNo = 0;
  for (const cp of PLAN) {
    const c = { id: nid(), name: cp.name, project: cp.project, objective: cp.objective || "OUTCOME_LEADS", status: cp.pausedDaysAgo ? "PAUSED" : "ACTIVE", sets: [] };
    for (const sp of cp.sets) {
      const s = { id: nid(), name: sp.name, status: "ACTIVE", budget: sp.budget, sp, targeting: JSON.parse(JSON.stringify(sp.t)), ads: [] };
      const cities = (sp.t.geo_locations?.cities || []).map((x) => x.name).filter(Boolean);
      for (const [adName, share, ctrX, freqX] of sp.ads) {
        const a = { id: nid(), name: adName, status: "ACTIVE", freqX, rows: [], ...(DEMO_CREATIVE[adName] || {}) };
        if (adName === "beach-carousel") a.issue = { status: "DISAPPROVED", reason: "Ad wasn't approved: the text implies a guaranteed return on investment, which isn't allowed for property ads (demo example)." };
        let carry = r();
        for (let i = 0; i < DAYS; i += 1) {
          const active = !cp.pausedDaysAgo || i < DAYS - 1 - cp.pausedDaysAgo;
          if (!active) {
            a.rows.push(null);
            continue;
          }
          const frac = i === DAYS - 1 ? dayFraction : 1;
          const weekday = dayIso(i).getDay();
          const pace = (weekday === 5 ? 1.08 : weekday === 4 ? 1.04 : 1) * (0.86 + r() * 0.2);
          const spend = sp.budget * share * pace * frac;
          const imps = (spend / sp.cpm) * 1000 * (0.92 + r() * 0.16);
          const clicks = imps * (sp.ctr / 100) * ctrX * (0.85 + r() * 0.3) * wearOut(adName, i);
          carry += clicks * (sp.cvr / 100) * (0.8 + r() * 0.4);
          const n = Math.floor(carry);
          carry -= n;
          const lpv = Math.round(clicks * (0.74 + r() * 0.14));
          a.rows.push({ spend, imps, clicks, lpv, leads: cp.whatsapp ? 0 : n, convos: cp.whatsapp ? n : 0, video: imps * 0.31 });
          for (let k = 0; k < n; k += 1) {
            leadNo += 1;
            const day = dayIso(i);
            let created = new Date(day.getTime() + (9 + r() * 14) * 3600000);
            if (created > now) created = new Date(now.getTime() - r() * Math.max(0.2, now.getHours() - 8) * 3600000);
            if (created < day) created = new Date(day.getTime() + r() * 3600000);
            const city = cities.length ? cities[Math.floor(r() * cities.length)] : "New Cairo";
            leads.push(makeLead({ r, no: leadNo, created, now, c: cp, campaign: c, set: s, ad: a, from: fromOf(cp.project), city }));
          }
        }
        s.ads.push(a);
      }
      c.sets.push(s);
    }
    campaigns.push(c);
  }
  return { campaigns, leads: leads.sort((x, y) => y.created.localeCompare(x.created)), audit: [] };
}

function makeLead({ r, no, created, now, c, campaign, set, ad, from, city }) {
  const sp = set.sp;
  const ageH = (now - created) / 3600000;
  const name = `${FIRST[Math.floor(r() * FIRST.length)]} ${LAST[Math.floor(r() * LAST.length)]}`;
  const isGcc = ["Riyadh", "Jeddah", "Dammam", "Dubai", "Abu Dhabi", "Kuwait City", "Doha"].includes(city);
  // Gulf leads get their own country's dialling code, so the world map can place them.
  const dial = { Riyadh: "+966 50", Jeddah: "+966 55", Dammam: "+966 54", Dubai: "+971 50", "Abu Dhabi": "+971 52", "Kuwait City": "+965 5", Doha: "+974 3" }[city];
  const phone = isGcc ? `${dial}${String(100 + (no % 900))} ${String(1000 + (no % 9000))}` : `0100 000 ${String(1000 + (no % 9000)).padStart(4, "0")}`;
  let stage;
  const roll = r();
  if (ageH < 0.4) stage = "new";
  else if (ageH < 3 && roll < 0.45) stage = "new";
  else if (ageH < 24 && roll < 0.08) stage = "new";
  else if (ageH < 24 && roll < 0.35) stage = "no_answer";
  else if (ageH < 96 && roll < 0.1) stage = "no_answer";
  if (!stage) {
    if (r() * 100 < sp.valid) {
      if (r() * 100 < sp.meet) {
        if (r() * 100 < sp.res) stage = ageH > 24 * 14 && r() < 0.3 ? "sold" : "reserved";
        else stage = ageH > 72 ? "visited" : "meeting";
      } else stage = r() < 0.12 ? "lost" : "interested";
    } else {
      let x = r() * 100;
      stage = BAD.find(([, w]) => (x -= w) < 0)?.[0] || "not_now";
    }
  }
  const at = created.toISOString();
  const contactAt = stage === "new" ? null : new Date(Math.min(now.getTime(), created.getTime() + (4 + r() * r() * 160) * 60000)).toISOString();
  const valid = ["interested", "meeting", "visited", "reserved", "sold", "lost"].includes(stage);
  const gov = CITY_TO_GOV[city] || "Cairo";
  const refPrefix = { krypton: "KR", ivy: "IVY", "seashell-rah": "SSR", "cheval-dunes": "CHD", gcribs: "GC" }[c.project] || "GD";
  const lead = {
    id: `demo_${no}`,
    demo: true,
    metaId: c.whatsapp ? null : String(9100000000000000 + no),
    created: at,
    name,
    phone,
    email: "",
    city,
    governorate: gov,
    source: c.whatsapp ? "whatsapp" : "meta-form",
    project: c.project,
    formName: c.whatsapp ? null : c.form,
    ref: c.whatsapp ? `${refPrefix}-110${(no % 3) + 1}-${String.fromCharCode(65 + (no % 26))}${no % 10}` : null,
    campaignId: campaign.id,
    campaignName: campaign.name,
    adsetId: set.id,
    adsetName: set.name,
    adId: ad.id,
    adName: ad.name,
    stage,
    history: [{ stage: "new", at }, ...(contactAt ? [{ stage, at: contactAt }] : [])],
    firstContactAt: contactAt || undefined,
    stageAt: contactAt || undefined,
  };
  if (valid) {
    lead.budget = Math.round((from * (1 + r() * 0.9)) / 100000) * 100000;
    lead.timeline = ["now", "3m", "3m", "6m"][Math.floor(r() * 4)];
    lead.purpose = c.project === "seashell-rah" ? "second" : r() < 0.35 ? "invest" : "live";
    lead.pay = r() < 0.8 ? "installments" : "cash";
    lead.notes = `${city} buyer · ${VALID_NOTES[Math.floor(r() * VALID_NOTES.length)]}`;
    if (lead.metaId && ageH > 24 && r() < 0.7) lead.sentToMeta = { [stage === "interested" || stage === "lost" ? "interested" : stage]: contactAt };
  } else if (stage === "low_budget") {
    lead.budget = Math.round((from * (0.3 + r() * 0.45)) / 100000) * 100000;
    lead.notes = BAD[1][2];
  } else if (BAD.some(([s]) => s === stage)) lead.notes = BAD.find(([s]) => s === stage)[2];
  if (!c.whatsapp) {
    // What the person picked on the form. Mostly in line with what the call found, not always.
    const m = (v) => `${Number((v / 1e6).toFixed(1))}M`;
    const fits = valid ? r() < 0.88 : stage === "low_budget" ? r() < 0.15 : r() < 0.5;
    const budget = fits ? (r() < 0.6 ? `${m(from)} – ${m(from * 1.5)} EGP` : `${m(from * 1.5)} – ${m(from * 2.5)} EGP`) : `Below ${m(from)} EGP`;
    const soon = valid ? r() < 0.75 : r() < 0.3;
    const timing = soon ? (r() < 0.4 ? "Now" : "Within 3 months") : r() < 0.5 ? "3 to 6 months" : "Later than 6 months";
    lead.answers = { "what_budget_do_you_have_in_mind?": budget, "when_are_you_planning_to_buy?": timing, "how_would_you_like_to_pay?": lead.pay === "cash" ? "Cash" : "Installments", "what_city_do_you_live_in?": city };
  }
  return lead;
}

// ---------------------------------------------------------------- reading the demo account like the API does
function rangeIdx(range, since, until) {
  const today = DAYS - 1;
  if (range === "custom" && /^\d{4}-\d{2}-\d{2}$/.test(since || "") && /^\d{4}-\d{2}-\d{2}$/.test(until || "")) {
    // Exact dates (the weekly report compares two specific weeks).
    const base = dayIso(today).getTime();
    const at = (d) => today - Math.round((base - new Date(`${d}T00:00:00`).getTime()) / 86400000);
    return [Math.max(0, Math.min(today, at(since))), Math.max(0, Math.min(today, at(until)))];
  }
  if (range === "today") return [today, today];
  if (range === "yesterday") return [today - 1, today - 1];
  if (range === "last_7d") return [today - 7, today - 1];
  if (range === "last_14d") return [today - 14, today - 1];
  if (range === "last_30d") return [today - 30, today - 1];
  if (range === "last_60d") return [today - 60, today - 1];
  if (range === "last_90d") return [today - 90, today - 1];
  if (range === "this_month") return [today - (new Date().getDate() - 1), today];
  if (range === "maximum") return [0, today];
  return [today - 7, today - 1]; // last_7d (Meta's 7 days end yesterday)
}

function sumRows(rows, [a, b]) {
  const t = { spend: 0, imps: 0, clicks: 0, lpv: 0, leads: 0, convos: 0, video: 0, days: 0 };
  for (let i = a; i <= b; i += 1) {
    const x = rows[i];
    if (!x) continue;
    t.spend += x.spend;
    t.imps += x.imps;
    t.clicks += x.clicks;
    t.lpv += x.lpv || Math.round(x.clicks * 0.78);
    t.leads += x.leads;
    t.convos += x.convos;
    t.video += x.video;
    t.days += 1;
  }
  return t;
}
function toMetrics(t, f, idx) {
  if (!t.spend) return null;
  const days = Math.max(1, t.days);
  const frequency = Math.min(6.5, f * (1 + 0.55 * Math.log(days)));
  const imps = Math.round(t.imps);
  return {
    spend: Math.round(t.spend * 100) / 100,
    impressions: imps,
    reach: Math.round(imps / frequency),
    frequency: Math.round(frequency * 100) / 100,
    clicks: Math.round(t.clicks * 1.4),
    linkClicks: Math.round(t.clicks),
    ctr: imps ? Math.round((t.clicks / imps) * 10000) / 100 : 0,
    cpm: imps ? Math.round((t.spend / imps) * 100000) / 100 : 0,
    leads: t.leads,
    convos: t.convos,
    landingViews: Math.round(t.lpv || t.clicks * 0.78),
    videoViews: Math.round(t.video),
    contacts: Math.round((t.leads + t.convos) * 0.35),
    dateStart: ymd(dayIso(idx[0])),
    dateStop: ymd(dayIso(idx[1])),
  };
}
const add = (a, b) => {
  const o = { ...a };
  for (const k of Object.keys(b)) if (typeof b[k] === "number") o[k] = (o[k] || 0) + b[k];
  o.days = Math.max(a.days || 0, b.days || 0);
  return o;
};

export function describeTargeting(t) {
  const g = t.geo_locations || {};
  const places = [...(g.countries || []), ...(g.regions || []).map((x) => x.name || x.key), ...(g.cities || []).map((c) => (c.radius ? `${c.name || c.key} +${c.radius}km` : c.name || c.key))];
  const interests = (t.flexible_spec || []).flatMap((f) => [...(f.interests || []), ...(f.work_positions || [])]);
  return { places, excludedPlaces: [], ageMin: t.age_min ?? null, ageMax: t.age_max ?? null, genders: t.genders || [], interests: interests.map((i) => i.name), audiences: (t.custom_audiences || []).map((a) => a.name || a.id), excludedAudiences: (t.excluded_custom_audiences || []).map((a) => a.name || a.id), advantageAudience: t.targeting_automation?.advantage_audience === 1, locales: [] };
}

const eff = (own, parentOff, parentKind) => (own !== "ACTIVE" ? "PAUSED" : parentOff ? `${parentKind}_PAUSED` : "ACTIVE");

// ---------------------------------------------------------------- demo delivery report (region, country, age × gender)
// Meta-style spellings, so the dashboard's name matching is exercised in demo too.
const META_REGION = { Cairo: "Cairo Governorate", Giza: "Giza Governorate", Qalyubia: "Al Qalyubiyah", "Al Sharqia": "Ash Sharqiyah", Dakahlia: "Ad Daqahliyah", Alexandria: "Alexandria Governorate", Gharbia: "Al Gharbiyah", Monufia: "Al Minufiyah", Ismailia: "Ismailia Governorate", Suez: "Suez Governorate", "Port Said": "Port Said Governorate", Matrouh: "Matruh", "Red Sea": "Red Sea Governorate", Beheira: "Beheira Governorate", Faiyum: "Faiyum Governorate" };
const SPILL = ["Cairo", "Giza", "Qalyubia", "Alexandria", "Al Sharqia", "Dakahlia", "Gharbia", "Monufia"];
const GCC_ISO = { "GCC · Saudi Arabia": "SA", "GCC · UAE": "AE", "GCC · Kuwait": "KW", "GCC · Qatar": "QA" };
const AGE = [["18-24", 0.04, 0.75], ["25-34", 0.24, 0.9], ["35-44", 0.33, 1], ["45-54", 0.22, 1.12], ["55-64", 0.12, 1.35], ["65+", 0.05, 1.7]];
const bucketMin = (b) => Number(b.slice(0, 2));
const bucketMax = (b) => (b === "65+" ? 120 : Number(b.slice(3)));

// Some demo ads wear out over the last three weeks: the same people keep seeing
// them, so fewer click (over the last two weeks). Lets the fatigue check show something real in demo.
const WEAR = { "static-price-plan": 0.62, "reminder-price-plan": 0.58, "lagoon-film-15s": 0.5, "carousel-homes": 0.24, "villa-carousel": 0.28 };
function wearOut(adName, i) {
  const k = WEAR[adName];
  if (!k) return 1;
  return 1 - k * Math.min(1, Math.max(0, (i - (DAYS - 16)) / 15));
}

// Hooks, headlines and formats of the demo ads (for the creative library).
const DEMO_CREATIVE = {
  "film-15s-price": { format: "VIDEO", body: "From 7.88M EGP, 5% down and 8 years to pay. Serviced apartments above The Boulevard.", title: "Krypton · from 7.88M EGP" },
  "carousel-homes": { format: "CAROUSEL", body: "One, two or three bedrooms, fully finished with A/C. Swipe to pick yours.", title: "Choose your home at Krypton" },
  "static-price-plan": { format: "IMAGE", body: "5% down, 5% after 3 months, then 8 years of equal installments.", title: "5% down · 8 years" },
  "reminder-price-plan": { format: "IMAGE", body: "Still thinking about Krypton? The 5% down plan is open this month.", title: "5% down · 8 years" },
  "film-15s-price-gulf": { format: "VIDEO", body: "A Cairo home that's looked after while you're abroad. From 7.88M EGP.", title: "Your home in NEWKAIRO" },
  "wa-film-15s-krypton": { format: "VIDEO", body: "Hotel-style serviced living on The Boulevard. Chat with an advisor on WhatsApp.", title: "Krypton on WhatsApp" },
  "wa-static-5pct-down": { format: "IMAGE", body: "5% down payment, 8 years to pay. Message us for the plan.", title: "5% down · 8 years" },
  "wa-gulf-serviced-15s": { format: "VIDEO", body: "Serviced apartment in Cairo, managed while you're in the Gulf.", title: "Serviced living in Cairo" },
  "wa-ivy-lake-15s": { format: "VIDEO", body: "A quiet town around a 17-acre lake in New Zayed.", title: "IVY · lake living" },
  "wa-kings-school-chat": { format: "IMAGE", body: "The King's School Canterbury Cairo inside the gates. Ask about family homes.", title: "A British school at your door" },
  "wa-lagoon-chalet-15s": { format: "VIDEO", body: "Lagoon chalets at Ras El Hekma. Chat with us about this summer.", title: "Lagoon chalets" },
  "lake-film-15s": { format: "VIDEO", body: "Walk around the 17-acre lake at IVY, New Zayed.", title: "IVY · a town around a lake" },
  "school-carousel": { format: "CAROUSEL", body: "The King's School Canterbury Cairo and IVYPARK sports club inside the gates.", title: "School and club inside IVY" },
  "townhouse-tour-20s": { format: "VIDEO", body: "Tour a fully finished townhouse at Neon Views. From 19.23M EGP, 5% down.", title: "Neon Views · from 19.23M EGP" },
  "villa-carousel": { format: "CAROUSEL", body: "Townhouses and villas with gardens around the lakes.", title: "Villas at Neon Views" },
  "lagoon-static": { format: "IMAGE", body: "Chalets on the lagoon at Seashell Ras El Hekma, private beach.", title: "Seashell Ras El Hekma" },
  "beach-carousel": { format: "CAROUSEL", body: "Guaranteed rental returns every summer on the beach.", title: "Earn every summer" },
  "lagoon-film-15s": { format: "VIDEO", body: "Lagoon chalets, 5% down and 8 years. 35% off for cash.", title: "Lagoon chalets · 35% off cash" },
  "fairway-film-20s": { format: "VIDEO", body: "Villas on the 18-hole golf course at NEWKAIRO.", title: "Golf Views villas" },
};

function demoDaily(state, range, since, until) {
  const [a, b] = rangeIdx(range, since, until);
  const rows = [];
  for (const c of state.campaigns)
    for (const s of c.sets)
      for (const ad of s.ads)
        for (let i = a; i <= b; i += 1) {
          const x = ad.rows[i];
          if (!x) continue;
          rows.push({ date: ymd(dayIso(i)), campaignId: c.id, adsetId: s.id, adId: ad.id, adName: ad.name, spend: Math.round(x.spend * 100) / 100, impressions: Math.round(x.imps), reach: Math.round(x.imps / 1.15), clicks: Math.round(x.clicks), leads: x.leads, convos: x.convos });
        }
  return { range: { preset: range, since: ymd(dayIso(a)), until: ymd(dayIso(b)) }, fetchedAt: new Date().toISOString(), demo: true, rows };
}

function demoBreakdowns(state, range, campaignId, since, until) {
  const idx = rangeIdx(range, since, until);
  const region = {};
  const country = {};
  const ag = {};
  const put = (map, key, t, w) => {
    const o = (map[key] ??= { spend: 0, impressions: 0, clicks: 0, leads: 0, convos: 0 });
    o.spend += t.spend * w;
    o.impressions += t.imps * w;
    o.clicks += t.clicks * w;
    o.leads += t.leads * w;
    o.convos += t.convos * w;
  };
  for (const c of state.campaigns) {
    if (campaignId && c.id !== campaignId) continue;
    for (const s of c.sets) {
      const t = { spend: 0, imps: 0, clicks: 0, leads: 0, convos: 0 };
      for (const a of s.ads) {
        const x = sumRows(a.rows, idx);
        for (const k of Object.keys(t)) t[k] += x[k] || 0;
      }
      if (!t.spend) continue;
      // Where: each targeted place gets an equal share; Egyptian ones spill a little into neighbouring governorates.
      const dests = (s.targeting.geo_locations?.cities || []).map((x) => CITY_TO_GOV[x.name] || "Cairo");
      const list = dests.length ? dests : ["Cairo"];
      for (const d of list) {
        const w = 1 / list.length;
        if (GCC_ISO[d]) {
          put(country, GCC_ISO[d], t, w * 0.97);
          put(country, d === "GCC · UAE" ? "OM" : "BH", t, w * 0.03);
        } else {
          put(country, "EG", t, w * 0.992);
          put(country, "SA", t, w * 0.008);
          put(region, META_REGION[d] || `${d} Governorate`, t, w * 0.84 * 0.992);
          const others = SPILL.filter((g) => g !== d);
          for (const g of others) put(region, META_REGION[g] || `${g} Governorate`, t, (w * 0.16 * 0.992) / others.length);
        }
      }
      // Who: ages inside the ad set's age range; leads come cheaper from some ages than others.
      const lo = s.targeting.age_min ?? 18;
      const hi = s.targeting.age_max ?? 65;
      const ages = AGE.filter(([b]) => bucketMax(b) >= lo && bucketMin(b) <= (hi >= 65 ? 120 : hi));
      const wSum = ages.reduce((n, [, w]) => n + w, 0);
      const female = c.project === "seashell-rah" || c.project === "ivy" ? 0.45 : 0.36;
      const cells = [];
      for (const [b, w] of ages) {
        cells.push([b, "male", (w / wSum) * (1 - female - 0.01), 1]);
        cells.push([b, "female", (w / wSum) * female, 1.08]);
        cells.push([b, "unknown", (w / wSum) * 0.01, 1]);
      }
      const mult = Object.fromEntries(AGE.map(([b, , m]) => [b, m]));
      const leadW = cells.map(([b, , w, gm]) => w / (mult[b] * gm));
      const leadSum = leadW.reduce((n, x) => n + x, 0);
      cells.forEach(([b, g, w], i) => {
        const o = (ag[`${b}|${g}`] ??= { age: b, gender: g, spend: 0, impressions: 0, clicks: 0, leads: 0, convos: 0 });
        o.spend += t.spend * w;
        o.impressions += t.imps * w;
        o.clicks += t.clicks * w;
        o.leads += (t.leads * leadW[i]) / leadSum;
        o.convos += (t.convos * leadW[i]) / leadSum;
      });
    }
  }
  const round = (o) => ({ ...o, spend: Math.round(o.spend * 100) / 100, impressions: Math.round(o.impressions), reach: Math.round(o.impressions / 1.6), clicks: Math.round(o.clicks), leads: Math.round(o.leads), convos: Math.round(o.convos) });
  return {
    range: { preset: range, ...(range === "custom" ? { since, until } : {}) },
    campaignId: campaignId || null,
    fetchedAt: new Date().toISOString(),
    demo: true,
    region: Object.entries(region).map(([k, v]) => round({ region: k, ...v })),
    country: Object.entries(country).map(([k, v]) => round({ country: k, ...v })),
    ageGender: Object.values(ag).map(round),
  };
}

// Website tracking: what the Pixel and the Conversions API would show for the
// demo account's last 7 days of landing page views (made-up, like the rest).
function demoTracking(state, catalog) {
  const r = rng(7311);
  let lpv = 0;
  const ads = [];
  for (const c of state.campaigns)
    for (const s of c.sets)
      for (const a of s.ads) {
        const v = a.rows.slice(-7).reduce((t, x) => t + (x?.lpv || 0), 0);
        lpv += v;
        if (v > 0 && !c.name.includes("WhatsApp")) ads.push({ a, c, w: v });
      }
  const k = (x) => Math.round(lpv * x);
  const byEvent = { PageView: k(1.55), ViewContent: k(0.92), CustomizeProduct: k(0.38), Contact: k(0.12), Lead: k(0.031), BrochureDownload: k(0.02) };
  const total = ads.reduce((t, x) => t + x.w, 0) || 1;
  const pick = () => {
    let x = r() * total;
    for (const o of ads) if ((x -= o.w) <= 0) return o;
    return ads[0];
  };
  const SITE = [["Page view", "PageView", 0.46], ["Project page", "ViewContent", 0.24], ["Payment plan opened", "CustomizeProduct", 0.12], ["Krypton layout viewed", "ViewContent", 0.08], ["WhatsApp click", "Contact", 0.06], ["Call click", "Contact", 0.02], ["Brief sent", "Lead", 0.02]];
  const now = Date.now();
  const events = [];
  for (let i = 0; i < 120 && ads.length; i += 1) {
    let x = r();
    const [event, metaEvent] = SITE.find(([, , w]) => (x -= w) <= 0) || SITE[0];
    const fromAd = r() < 0.72;
    const o = pick();
    const slug = catalog?.projects?.find((p) => p.id === o.c.project)?.slug || o.c.project || "krypton";
    events.push({
      id: `we_demo${i}`,
      at: new Date(now - i * (4 + r() * 20) * 60000).toISOString(),
      event,
      metaEvent,
      project: o.c.project || null,
      page: `/${slug}/`,
      place: /WhatsApp|Call/.test(event) ? ["Floating button", "Project details", "Header"][Math.floor(r() * 3)] : null,
      utmSource: fromAd ? (r() < 0.7 ? "fb" : "ig") : null,
      utmCampaign: fromAd ? o.c.name : null,
      utmContent: fromAd ? o.a.name : null,
      ref: fromAd ? `W-${BigInt(o.a.id).toString(36).toUpperCase()}` : "WEB",
      adId: fromAd ? o.a.id : null,
      sent: true,
      test: false,
    });
  }
  const received = events.length * 9;
  return {
    demo: true,
    capi: { forwarding: true, off: false, datasetSet: true, testCode: false, origins: ["https://mahmoud-elhemaly.onrender.com"], queued: 0, since: new Date(now - 26 * 3600000).toISOString(), received, sent: received - 3, test: 0, kept: 3, failed: 0, byEvent: { PageView: Math.round(received * 0.52), ViewContent: Math.round(received * 0.3), CustomizeProduct: Math.round(received * 0.1), Contact: Math.round(received * 0.06), Lead: Math.round(received * 0.02) }, lastSentAt: new Date(now - 90000).toISOString(), lastError: null, lastErrorAt: null },
    pixel: { id: "000000000000000", name: "Demo Pixel (made-up)", lastFired: new Date(now - 60000).toISOString(), days: 7, byEvent, statsError: null },
    pixelError: null,
    events,
  };
}

export function createDemo(catalog) {
  let state = build(catalog);
  const find = (id) => {
    for (const c of state.campaigns) {
      if (c.id === id) return { o: c, kind: "campaign" };
      for (const s of c.sets) {
        if (s.id === id) return { o: s, kind: "ad set" };
        for (const a of s.ads) if (a.id === id) return { o: a, kind: "ad" };
      }
    }
    return null;
  };
  const log = (e) => {
    const x = { at: new Date().toISOString(), ...e };
    state.audit.unshift(x);
    return x;
  };

  function dailySeries(idx, filterCampaignId = null) {
    const [a, b] = idx;
    const out = [];
    for (let i = a; i <= b; i += 1) {
      const date = ymd(dayIso(i));
      let spend = 0, imps = 0, clicks = 0, lpv = 0, leads = 0, convos = 0;
      for (const c of state.campaigns) {
        if (filterCampaignId && c.id !== filterCampaignId) continue;
        for (const s of c.sets) {
          for (const ad of s.ads) {
            const row = ad.rows[i];
            if (!row) continue;
            spend += row.spend;
            imps += row.imps;
            clicks += row.clicks;
            lpv += row.lpv || row.clicks * 0.78;
            leads += row.leads;
            convos += row.convos;
          }
        }
      }
      out.push({
        date,
        spend: Math.round(spend * 100) / 100,
        impressions: Math.round(imps),
        linkClicks: Math.round(clicks),
        landingViews: Math.round(lpv),
        leads: leads + convos,
      });
    }
    return out;
  }

  function tree(range, since, until) {
    const idx = rangeIdx(range, since, until);
    const life = dailySeries([0, DAYS - 1]);
    const lifetimeSpend = Math.round(life.reduce((s, d) => s + (d.spend || 0), 0));
    const activeDailyBudget = state.campaigns
      .filter((c) => c.status === "ACTIVE")
      .reduce((sum, c) => sum + c.sets.filter((s) => s.status === "ACTIVE").reduce((acc, s) => acc + (s.budget || 0), 0), 0);
    return {
      account: { id: "act_demo", name: "Demo account (made-up data)", business: "G Developments (demo)", currency: "EGP", timezone: "Africa/Cairo", status: 1, amountSpent: lifetimeSpend, dailyBudgetRunRate: activeDailyBudget, spendCap: null },
      range: { preset: range, since: ymd(dayIso(idx[0])), until: ymd(dayIso(idx[1])) },
      fetchedAt: new Date().toISOString(),
      readOnly: false,
      demo: true,
      daily: dailySeries(idx),
      campaigns: state.campaigns.map((c) => {
        let ct = { spend: 0, imps: 0, clicks: 0, lpv: 0, leads: 0, convos: 0, video: 0, days: 0 };
        let fSum = 0;
        let fW = 0;
        const adsets = c.sets.map((s) => {
          let st = { spend: 0, imps: 0, clicks: 0, lpv: 0, leads: 0, convos: 0, video: 0, days: 0 };
          const ads = s.ads.map((a) => {
            const t = sumRows(a.rows, idx);
            st = add(st, t);
            return { id: a.id, name: a.name, status: a.status, effectiveStatus: a.issue && a.status === "ACTIVE" ? a.issue.status : eff(a.status, s.status !== "ACTIVE" || c.status !== "ACTIVE", s.status !== "ACTIVE" ? "ADSET" : "CAMPAIGN"), created: null, creative: { id: `${a.id}9`, thumb: null, title: a.title || null, body: a.body || null, type: a.format || "VIDEO" }, m: toMetrics(t, s.sp.f * a.freqX, idx) };
          });
          ct = add(ct, st);
          fSum += s.sp.f * st.imps;
          fW += st.imps;
          return { id: s.id, name: s.name, status: s.status, effectiveStatus: eff(s.status, c.status !== "ACTIVE", "CAMPAIGN"), dailyBudget: s.budget, lifetimeBudget: null, optimization: s.sp.optimization || "LEAD_GENERATION", destination: c.objective === "OUTCOME_ENGAGEMENT" ? "WHATSAPP" : "ON_AD", bidStrategy: "LOWEST_COST_WITHOUT_CAP", learning: s.sp.learning, targeting: describeTargeting(s.targeting), rawTargeting: s.targeting, m: toMetrics(st, s.sp.f, idx), ads };
        });
        return { id: c.id, name: c.name, status: c.status, effectiveStatus: c.status, objective: c.objective, dailyBudget: null, lifetimeBudget: null, bidStrategy: null, specialCategories: [], created: null, m: toMetrics(ct, fW ? fSum / fW : 1.2, idx), daily: dailySeries(idx, c.id), adsets };
      }),
    };
  }

  const wait = (v, ms = 120) => new Promise((done) => setTimeout(() => done(v), ms));
  const fail = (msg) => Promise.reject(Object.assign(new Error(msg), { status: 400 }));

  const INTERESTS = ["Real estate investing", "Luxury real estate", "Real estate", "Serviced apartment", "Golf", "Parents with children (6-12 years)", "Parents with teenagers (13-17 years)", "British international schools", "Interior design", "Home and garden", "Beach resort", "Frequent international travelers", "Business owners", "Lived in Egypt (formerly expats - Egypt)"];
  const PLACES = [...Object.keys(CITY).map((n) => ({ key: CITY[n], name: n, type: "city", country: ["Riyadh", "Jeddah", "Dammam"].includes(n) ? "SA" : ["Dubai", "Abu Dhabi"].includes(n) ? "AE" : n === "Kuwait City" ? "KW" : n === "Doha" ? "QA" : "EG" })), { key: "EG", name: "Egypt", type: "country", country: "EG" }, { key: "SA", name: "Saudi Arabia", type: "country", country: "SA" }, { key: "AE", name: "United Arab Emirates", type: "country", country: "AE" }];
  const JOBS = ["Doctor", "Dentist", "Physician", "Surgeon", "Business owner", "Engineer", "Pharmacist"];

  async function get(path, params = {}) {
    switch (path) {
      case "/api/settings":
        return wait(DEMO_SETTINGS, 40);
      case "/api/daily":
        return wait(demoDaily(state, params.range || "last_14d", params.since, params.until), 250);
      case "/api/breakdowns":
        return wait(demoBreakdowns(state, params.range || "last_7d", params.campaign || null, params.since, params.until), 300);
      case "/api/tree":
        return wait(tree(params.range || "last_7d", params.since, params.until), 160);
      case "/api/targeting": {
        const f = find(params.id);
        if (!f) return fail("Not found in the demo account.");
        return wait({ id: f.o.id, name: f.o.name, targeting: JSON.parse(JSON.stringify(f.o.targeting)), summary: describeTargeting(f.o.targeting) });
      }
      case "/api/search": {
        const q = String(params.q || "").toLowerCase();
        if (params.type === "interest") return wait(INTERESTS.filter((x) => x.toLowerCase().includes(q)).map((x) => ({ ...interest(x), size: 2000000 + (x.length * 1370000) % 40000000, path: "Interests" })));
        if (params.type === "job") return wait(JOBS.filter((x) => x.toLowerCase().includes(q)).map((x, i) => ({ id: String(108000000 + i), name: x })));
        return wait(PLACES.filter((x) => x.name.toLowerCase().includes(q)));
      }
      case "/api/audiences":
        return wait(Object.values(AUD));
      case "/api/payments": {
        const byMonth = {};
        const byCamp = {};
        const daily = {};
        const thisMonth = ymd(dayIso(DAYS - 1)).slice(0, 7);
        let life = 0;
        for (const c of state.campaigns)
          for (const st of c.sets)
            for (const a of st.ads)
              a.rows.forEach((x, i) => {
                if (!x) return;
                const d = ymd(dayIso(i));
                life += x.spend;
                byMonth[d.slice(0, 7)] = (byMonth[d.slice(0, 7)] || 0) + x.spend;
                if (d.slice(0, 7) === thisMonth) byCamp[c.id] = { id: c.id, name: c.name, spend: (byCamp[c.id]?.spend || 0) + x.spend };
                if (i >= DAYS - 8 && i <= DAYS - 2) daily[d] = (daily[d] || 0) + x.spend;
              });
        const r2 = (v) => Math.round(v * 100) / 100;
        const last3 = Object.entries(daily).sort().slice(-3).reduce((t, [, v]) => t + v, 0);
        return wait({
          fetchedAt: new Date().toISOString(),
          demo: true,
          currency: "EGP",
          account: { name: "Demo account (made-up data)", owed: r2(last3), amountSpent: r2(life), spendCap: Math.ceil((life * 1.08) / 10000) * 10000, prepay: false, method: { display: "Card ending 0000 (demo)", type: "Credit or debit card" } },
          months: Object.entries(byMonth).sort().map(([month, spend]) => ({ month, spend: r2(spend) })),
          thisMonth: Object.values(byCamp).map((x) => ({ ...x, spend: r2(x.spend) })).sort((a, b) => b.spend - a.spend),
          last7: Object.entries(daily).sort().map(([date, spend]) => ({ date, spend: r2(spend) })),
          billingUrl: "https://business.facebook.com/billing_hub/payment_activity",
        });
      }
      case "/api/health": {
        const items = [];
        const life = state.campaigns.reduce((t, c) => t + c.sets.reduce((u, st) => u + st.ads.reduce((v, a) => v + a.rows.reduce((w, x) => w + (x ? x.spend : 0), 0), 0), 0), 0);
        const cap = Math.ceil((life * 1.08) / 10000) * 10000;
        items.push({ tone: "warn", level: "account", id: "act_demo", name: "Demo account (made-up data)", problem: `Account spending limit ${Math.round((life / cap) * 100)}% used`, fix: `Raise or reset the account spending limit in Billing (limit ${cap.toLocaleString("en-US")} EGP). Ads stop at the limit.` });
        for (const c of state.campaigns)
          for (const st of c.sets)
            for (const a of st.ads)
              if (a.issue && a.status === "ACTIVE") items.push({ tone: "bad", level: "ad", id: a.id, name: a.name, campaignId: c.id, status: a.issue.status, problem: "Rejected by Meta", reason: a.issue.reason, fix: "Read Meta's reason, fix the words or image (no promised returns, no misleading prices, housing rules), then request another review from Account Quality or duplicate the ad with the fix." });
        return wait({ checkedAt: new Date().toISOString(), demo: true, account: { name: "Demo account (made-up data)", status: 1, currency: "EGP", spendCap: cap, amountSpent: Math.round(life) }, items });
      }
      case "/api/audit":
        return wait(state.audit);
      case "/api/rules":
        return wait({ currency: "EGP", offset: 100, rules: (state.rules ||= []) });
      case "/api/rules/history":
        return wait((state.ruleHistory ||= []));
      case "/api/web-events":
        return wait({ events: [] });
      case "/api/tracking":
        return wait(demoTracking(state, catalog));
      case "/api/leads": {
        const r = rng(Date.now() & 0xffff);
        const live = state.campaigns.filter((c) => c.status === "ACTIVE" && !c.name.includes("WhatsApp"));
        const n = 1 + Math.floor(r() * 3);
        const leads = [];
        for (let k = 0; k < n; k += 1) {
          const c = live[Math.floor(r() * live.length)];
          const s = c.sets[Math.floor(r() * c.sets.length)];
          const a = s.ads[0];
          const no = 50000 + Math.floor(r() * 49999);
          leads.push({ metaId: String(9200000000000000 + no), created: new Date(Date.now() - r() * 20 * 60000).toISOString(), formId: "demo", formName: PLAN.find((p) => p.name === c.name)?.form || "Demo form", adId: a.id, adName: a.name, adsetId: s.id, adsetName: s.name, campaignId: c.id, campaignName: c.name, platform: r() < 0.6 ? "ig" : "fb", organic: false, fields: { full_name: `${FIRST[Math.floor(r() * FIRST.length)]} ${LAST[Math.floor(r() * LAST.length)]}`, phone_number: `0100 000 ${String(no % 10000).padStart(4, "0")}`, "what_budget_do_you_have_in_mind?": r() < 0.6 ? "Matches the starting price" : "Below the starting price", "when_are_you_planning_to_buy?": r() < 0.5 ? "Within 3 months" : "3 to 6 months" } });
        }
        return wait({ forms: [{ id: "demo", name: "Demo forms", status: "ACTIVE" }], leads, since: 0 }, 220);
      }
      default:
        return fail("Not available in demo mode.");
    }
  }

  async function post(path, body = {}) {
    if (path === "/api/status") {
      const f = find(String(body.id));
      if (!f) return fail("Not found in the demo account.");
      if (!["ACTIVE", "PAUSED"].includes(body.status)) return fail("Status must be ACTIVE or PAUSED.");
      const from = f.o.status;
      f.o.status = body.status;
      return wait(log({ action: "status", kind: f.kind, id: f.o.id, name: f.o.name, from, to: body.status }));
    }
    if (path === "/api/budget") {
      const f = find(String(body.id));
      const v = Number(body.amount);
      if (!f || f.kind !== "ad set") return fail("This item has no budget of that type. The budget is set on the campaign or on its ad sets.");
      if (!(v > 0)) return fail("Enter a budget above zero.");
      const from = f.o.budget;
      f.o.budget = Math.round(v * 100) / 100;
      return wait(log({ action: "budget", field: body.field, id: f.o.id, name: f.o.name, from, to: f.o.budget, currency: "EGP" }));
    }
    if (path === "/api/targeting") {
      const f = find(String(body.id));
      if (!f || f.kind !== "ad set") return fail("Not found in the demo account.");
      const before = describeTargeting(f.o.targeting);
      const next = { ...f.o.targeting, ...(body.patch || {}) };
      for (const [k, v] of Object.entries(body.patch || {})) if (v === null || (Array.isArray(v) && !v.length)) delete next[k];
      if (next.geo_locations) {
        const byKey = Object.fromEntries(Object.entries(CITY).map(([n, k]) => [k, n]));
        next.geo_locations = { ...next.geo_locations, cities: (next.geo_locations.cities || []).map((c) => ({ ...c, name: c.name || byKey[c.key] || c.key })) };
      }
      f.o.targeting = next;
      return wait(log({ action: "targeting", id: f.o.id, name: f.o.name, from: before, to: describeTargeting(next) }));
    }
    if (path === "/api/lead-stage") return wait(log({ action: "lead-stage", id: String(body.leadId), name: body.event, to: 1 }));
    if (path === "/api/rules") {
      // Build the same rule the server would send to Meta, then run it once on the demo ads.
      let spec;
      try {
        spec = buildRule(body.preset, body.params || {}, 100);
      } catch (err) {
        return fail(err.message);
      }
      const rule = { id: String(Date.now()), status: "ENABLED", created_time: new Date().toISOString(), preset: body.preset, ...spec };
      (state.rules ||= []).unshift(rule);
      const hits = preview(body.preset, body.params || {}, tree("last_7d"));
      const P = PRESETS[body.preset];
      const results = [];
      for (const h of hits) {
        const f = find(h.id);
        if (!f) continue;
        if (P.action === "PAUSE" && f.o.status === "ACTIVE") {
          f.o.status = "PAUSED";
          results.push({ object_id: h.id, object_name: h.name, action: "Switched off", why: h.why });
        } else if (P.action === "CHANGE_BUDGET" && f.kind === "ad set") {
          const cap = Number(body.params?.maxBudget) || Infinity;
          const to = Math.min(cap, Math.round(f.o.budget * 1.15));
          if (to > f.o.budget) results.push({ object_id: h.id, object_name: h.name, action: `Budget ${f.o.budget} → ${to}`, why: h.why });
          f.o.budget = to;
        } else results.push({ object_id: h.id, object_name: h.name, action: "Notification sent", why: h.why });
      }
      (state.ruleHistory ||= []).unshift({ timestamp: new Date().toISOString(), rule_id: rule.id, rule_name: rule.name, results });
      log({ action: "rule-created", id: rule.id, name: rule.name, to: results.length });
      return wait({ id: rule.id, name: rule.name, demoRun: results.length });
    }
    if (path === "/api/copy" || path === "/api/ad-version") {
      // Copies start switched off and have no results yet, like real copies.
      const where = () => {
        for (const c of state.campaigns) {
          if (c.id === String(body.id)) return { c };
          for (const st of c.sets) {
            if (st.id === String(body.id)) return { c, s: st };
            for (const a of st.ads) if (a.id === String(body.id)) return { c, s: st, a };
          }
        }
        return null;
      };
      const w = where();
      const name = String(body.name || "").trim();
      if (!w) return fail("Not found in the demo account.");
      if (!name) return fail(path === "/api/copy" ? "Give the copy a name." : "Give the new ad a name.");
      let seq = 0;
      const newId = () => `${Date.now()}${String((seq += 1)).padStart(3, "0")}`;
      const cloneAd = (a, nm) => ({ ...a, id: newId(), name: nm ?? a.name, status: "PAUSED", rows: a.rows.map(() => null) });
      const cloneSet = (st, nm) => ({ ...st, id: newId(), name: nm ?? st.name, status: "PAUSED", targeting: JSON.parse(JSON.stringify(st.targeting)), ads: st.ads.map((a) => cloneAd(a)) });
      if (path === "/api/ad-version") {
        if (!w.a) return fail("Pick an ad.");
        if (!body.message && !body.headline) return fail("Change the primary text or the headline.");
        const v = cloneAd(w.a, name);
        if (body.message) v.body = String(body.message);
        if (body.headline) v.title = String(body.headline);
        w.s.ads.push(v);
        return wait(log({ action: "new-ad-version", kind: "ad", id: v.id, name, from: w.a.name, to: "off" }));
      }
      if (body.kind === "campaign" && !w.s) {
        const c2 = { ...w.c, id: newId(), name, status: "PAUSED", sets: w.c.sets.map((st) => cloneSet(st)) };
        state.campaigns.splice(state.campaigns.indexOf(w.c) + 1, 0, c2);
        return wait(log({ action: "copy", kind: "campaign", id: c2.id, name, from: w.c.name, to: `${c2.sets.length} ad sets, off` }));
      }
      if (body.kind === "adset" && w.s && !w.a) {
        const target = body.targetId ? state.campaigns.find((c) => c.id === String(body.targetId)) : w.c;
        if (!target) return fail("That campaign is not in this ad account.");
        const s2 = cloneSet(w.s, name);
        if (body.dailyBudget) s2.budget = Number(body.dailyBudget);
        target.sets.push(s2);
        return wait(log({ action: "copy", kind: "ad set", id: s2.id, name, from: w.s.name, to: `${s2.ads.length} ads, off` }));
      }
      if (body.kind === "ad" && w.a) {
        let target = w.s;
        if (body.targetId) for (const c of state.campaigns) for (const st of c.sets) if (st.id === String(body.targetId)) target = st;
        const a2 = cloneAd(w.a, name);
        target.ads.push(a2);
        return wait(log({ action: "copy", kind: "ad", id: a2.id, name, from: w.a.name, to: "off" }));
      }
      return fail("Copy a campaign, an ad set or an ad.");
    }
    if (path === "/api/rules/status") {
      const r = (state.rules ||= []).find((x) => x.id === String(body.id));
      if (!r) return fail("That rule is not in this ad account.");
      if (!["ENABLED", "DISABLED"].includes(body.status)) return fail("Status must be ENABLED or DISABLED.");
      const from = r.status;
      r.status = body.status;
      return wait(log({ action: "rule-status", id: r.id, name: r.name, from, to: r.status }));
    }
    if (path === "/api/rules/delete") {
      const i = (state.rules ||= []).findIndex((x) => x.id === String(body.id));
      if (i < 0) return fail("That rule is not in this ad account.");
      const [r] = state.rules.splice(i, 1);
      return wait(log({ action: "rule-deleted", id: r.id, name: r.name }));
    }
    if (path === "/api/web-event") return wait({ ok: true });
    return fail("Not available in demo mode.");
  }

  return {
    get,
    post,
    leads: () => state.leads.map((l) => ({ ...l })),
    reset() {
      state = build(catalog);
    },
  };
}

export const DEMO_TARGETS = { cpl: 250, cpvl: 900 };
