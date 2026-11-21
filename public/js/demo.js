// Demo mode: a realistic G Developments ad account, daily time-series,
// geographic attribution across Egypt governorates & GCC hubs, website funnel
// telemetry, and 2,000+ leads so every visualization and action works live.
// NOTHING HERE IS REAL. In demo mode every /api call is answered by this file
// in the browser: no request reaches the server or Meta.

const DAYS = 45; // index 0 = 44 days ago, index 44 = today
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
    sets: [{ name: "Messages · East Cairo & Delta", budget: 300, cpm: 70, ctr: 1.3, cvr: 11, valid: 20, meet: 38, res: 12, f: 1.3, learning: "SUCCESS", optimization: "CONVERSATIONS", t: tg({ cities: ["New Cairo", "Nasr City", "Madinaty", "Mansoura", "Tanta"], age: [27, 55] }), ads: [["wa-film-15s", 0.6, 1, 1], ["wa-static-from-price", 0.4, 0.85, 1.1]] }],
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
        const a = { id: nid(), name: adName, status: "ACTIVE", freqX, rows: [] };
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
          const clicks = imps * (sp.ctr / 100) * ctrX * (0.85 + r() * 0.3);
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
  const phone = isGcc
    ? `+966 50 ${String(100 + (no % 900))} ${String(1000 + (no % 9000))}`
    : `0100 000 ${String(1000 + (no % 9000)).padStart(4, "0")}`;
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
    ref: c.whatsapp ? `KR-1101-${String.fromCharCode(65 + (no % 26))}${no % 10}` : null,
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
  if (!c.whatsapp) lead.answers = { "what_city_do_you_live_in?": city, "when_are_you_planning_to_buy?": valid ? "Within 3 months" : "Later than 6 months", "how_would_you_like_to_pay?": lead.pay === "cash" ? "Cash" : "Installments" };
  return lead;
}

// ---------------------------------------------------------------- reading the demo account like the API does
function rangeIdx(range) {
  const today = DAYS - 1;
  if (range === "today") return [today, today];
  if (range === "yesterday") return [today - 1, today - 1];
  if (range === "last_30d") return [today - 30, today - 1];
  if (range === "this_month") return [today - (new Date().getDate() - 1), today];
  if (range === "maximum") return [0, today];
  if (range === "last_14d") return [today - 14, today - 1];
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

  function tree(range) {
    const idx = rangeIdx(range);
    return {
      account: { id: "act_demo", name: "Demo account (made-up data)", business: "G Developments (demo)", currency: "EGP", timezone: "Africa/Cairo", status: 1, amountSpent: null, spendCap: null },
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
            return { id: a.id, name: a.name, status: a.status, effectiveStatus: eff(a.status, s.status !== "ACTIVE" || c.status !== "ACTIVE", s.status !== "ACTIVE" ? "ADSET" : "CAMPAIGN"), created: null, creative: { id: `${a.id}9`, thumb: null, title: null, body: null, type: "VIDEO" }, m: toMetrics(t, s.sp.f * a.freqX, idx) };
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
      case "/api/tree":
        return wait(tree(params.range || "last_7d"), 160);
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
      case "/api/audit":
        return wait(state.audit);
      case "/api/web-events":
        return wait({ events: [] });
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
