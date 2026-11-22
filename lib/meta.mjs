// Meta Marketing API layer for the media-buying dashboard.
//
// The access token stays on the server: the browser only ever talks to /api/*.
// Reads pass through. Writes are limited to a few fields (on/off, budget,
// targeting), checked against META_AD_ACCOUNT_ID, and logged with the value
// before and after. Set META_READ_ONLY=1 to block every write.
//
// Settings (environment variables, set on Render, never in the repo):
//   META_ACCESS_TOKEN    System user token with ads_management + ads_read
//                        (+ leads_retrieval and pages_* for lead forms)
//   META_AD_ACCOUNT_ID   act_1234567890 (or just the digits)
//   META_PAGE_ID         Facebook Page that owns the lead forms (optional)
//   META_PAGE_TOKEN      Page token, only if the system user token cannot fetch one (optional)
//   META_DATASET_ID      Pixel / dataset id for sending lead stages back to Meta (optional)
//   META_API_VERSION     Graph API version, default v23.0
//   META_READ_ONLY       1 = no changes can be made from the dashboard
//   META_MAX_DAILY_BUDGET Highest daily budget the dashboard may set, in account currency (optional)

import { buildRule } from "../public/js/rules.js";

const env = process.env;
const GRAPH = (env.META_GRAPH_URL || "https://graph.facebook.com").replace(/\/+$/, "");
const VERSION = env.META_API_VERSION || "v23.0";
const TOKEN = env.META_ACCESS_TOKEN || "";
const ACCOUNT_DIGITS = String(env.META_AD_ACCOUNT_ID || "").replace(/^act_/, "").trim();
const ACCOUNT = ACCOUNT_DIGITS ? `act_${ACCOUNT_DIGITS}` : "";
const PAGE_ID = String(env.META_PAGE_ID || "").trim();
const PAGE_TOKEN_ENV = env.META_PAGE_TOKEN || "";
const DATASET = String(env.META_DATASET_ID || "").trim();
const READ_ONLY = /^(1|true|yes|on)$/i.test(env.META_READ_ONLY || "");
const MAX_DAILY = Number(env.META_MAX_DAILY_BUDGET) || 0;

export const configured = () => Boolean(TOKEN && ACCOUNT_DIGITS);

// Currencies Meta stores without minor units (budgets are sent as whole numbers).
const NO_MINOR = new Set(["CLP", "COP", "CRC", "HUF", "ISK", "IDR", "JPY", "KRW", "PYG", "TWD", "VND", "UGX"]);
const offsetFor = (currency) => (NO_MINOR.has(String(currency).toUpperCase()) ? 1 : 100);

export class MetaError extends Error {
  constructor(message, status = 502, code = null) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const scrub = (s) => (TOKEN ? String(s).split(TOKEN).join("[token]") : String(s));

async function call(path, { method = "GET", params = {}, token = TOKEN, absolute = null } = {}) {
  let url;
  const init = { method, headers: {} };
  if (absolute) {
    // Paging links from Meta already carry their parameters (and the token).
    if (!absolute.startsWith(GRAPH + "/")) throw new MetaError("Unexpected paging link from Meta.");
    url = absolute;
  } else {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      qs.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
    }
    qs.set("access_token", token);
    url = `${GRAPH}/${VERSION}${path}`;
    if (method === "GET" || method === "DELETE") url += `?${qs}`;
    else {
      init.headers["Content-Type"] = "application/x-www-form-urlencoded";
      init.body = qs.toString();
    }
  }
  let res;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
  } catch (err) {
    throw new MetaError(`Could not reach Meta (${scrub(err?.message || err)}).`);
  }
  let body;
  try {
    body = await res.json();
  } catch {
    throw new MetaError(`Meta answered ${res.status} without data.`);
  }
  if (!res.ok || body?.error) {
    const e = body?.error || {};
    const code = e.code ?? null;
    let msg = e.error_user_msg || e.message || `Meta answered ${res.status}.`;
    if (code === 190) msg = "The Meta access token is invalid or expired. Make a new system user token and update META_ACCESS_TOKEN.";
    else if (code === 17 || code === 4 || code === 80004 || code === 613) msg = "Meta's rate limit was reached. Wait a few minutes and refresh.";
    else if (code === 10 || code === 200 || code === 294) msg = `Permission missing: ${e.message || "check the token's permissions and assigned assets."}`;
    throw new MetaError(scrub(msg), res.status >= 400 && res.status < 500 ? 400 : 502, code);
  }
  return body;
}

async function all(path, params, maxPages = 15) {
  const out = [];
  let page = await call(path, { params });
  for (let i = 0; i < maxPages; i += 1) {
    out.push(...(page.data || []));
    const next = page.paging?.next;
    if (!next) break;
    page = await call("", { absolute: next });
  }
  return out;
}

// Try a full field list; if Meta rejects a field (code 100), fall back to the basics.
async function withFallback(fn, fullFields, basicFields) {
  try {
    return await fn(fullFields);
  } catch (err) {
    if (err instanceof MetaError && err.code === 100 && basicFields) return fn(basicFields);
    throw err;
  }
}

// ---------------------------------------------------------------- reading
const RANGES = new Set(["today", "yesterday", "last_7d", "last_14d", "last_30d", "last_90d", "this_month", "last_month", "maximum"]);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const ymdDaysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function rangeParams(range, since, until) {
  if (range === "custom") {
    if (!DAY_RE.test(since || "") || !DAY_RE.test(until || "") || since > until) throw new MetaError("Pick a start and end date.", 400);
    return { time_range: { since, until } };
  }
  if (range === "last_60d") {
    return { time_range: { since: ymdDaysAgo(60), until: ymdDaysAgo(1) } };
  }
  return { date_preset: RANGES.has(range) ? range : "last_7d" };
}

const num = (v) => (v === undefined || v === null || v === "" ? 0 : Number(v) || 0);
const actionSum = (list, types) =>
  (list || []).filter((a) => types.includes(a.action_type)).reduce((n, a) => n + num(a.value), 0);

/** Plain numbers from one insights row. Reach is per object and is never added up. */
function metrics(row) {
  if (!row) return null;
  const a = row.actions || [];
  let leads = actionSum(a, ["lead"]);
  if (!leads) leads = actionSum(a, ["onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"]);
  return {
    spend: num(row.spend),
    impressions: num(row.impressions),
    reach: num(row.reach),
    frequency: num(row.frequency),
    clicks: num(row.clicks),
    linkClicks: num(row.inline_link_clicks),
    ctr: num(row.inline_link_click_ctr), // link CTR, %
    cpm: num(row.cpm),
    leads,
    convos: actionSum(a, ["onsite_conversion.messaging_conversation_started_7d"]),
    landingViews: actionSum(a, ["landing_page_view", "omni_landing_page_view"]),
    videoViews: actionSum(a, ["video_view"]),
    contacts: actionSum(a, ["contact_total", "offsite_conversion.fb_pixel_contact", "onsite_web_contact"]),
    dateStart: row.date_start || null,
    dateStop: row.date_stop || null,
  };
}

// ---------------------------------------------------------------- website funnel telemetry
const webEvents = [];
export function recordWebEvent(evt = {}) {
  const clean = {
    id: `we_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
    event: String(evt.event || "PageView").slice(0, 60),
    project: String(evt.project || "").slice(0, 60) || null,
    page: String(evt.page || "/").slice(0, 160),
    place: String(evt.place || "").slice(0, 80) || null,
    utmSource: String(evt.utm_source || evt.utmSource || "").slice(0, 60) || null,
    utmCampaign: String(evt.utm_campaign || evt.utmCampaign || "").slice(0, 120) || null,
    utmContent: String(evt.utm_content || evt.utmContent || "").slice(0, 120) || null,
    ref: String(evt.ref || "").slice(0, 40) || null,
    meta: evt.meta && typeof evt.meta === "object" ? evt.meta : null,
  };
  webEvents.unshift(clean);
  if (webEvents.length > 1000) webEvents.length = 1000;
  return clean;
}
export function getWebEvents() {
  return webEvents.slice(0, 300);
}

const INSIGHT_FIELDS =
  "campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,reach,frequency,clicks," +
  "inline_link_clicks,inline_link_click_ctr,cpm,actions,date_start,date_stop";

async function insights(level, rp) {
  const rows = await all(`/${ACCOUNT}/insights`, { level, fields: INSIGHT_FIELDS, limit: 500, ...rp });
  const key = level === "campaign" ? "campaign_id" : level === "adset" ? "adset_id" : "ad_id";
  return Object.fromEntries(rows.map((r) => [r[key], metrics(r)]));
}

/** A short, readable description of an ad set's targeting. */
export function describeTargeting(t) {
  if (!t) return null;
  const g = t.geo_locations || {};
  const places = [
    ...(g.countries || []),
    ...(g.regions || []).map((r) => r.name || r.key),
    ...(g.cities || []).map((c) => (c.radius ? `${c.name || c.key} +${c.radius}${c.distance_unit === "mile" ? "mi" : "km"}` : c.name || c.key)),
    ...(g.custom_locations || []).map((c) => c.name || `${c.latitude},${c.longitude} +${c.radius}km`),
    ...(g.places || []).map((p) => p.name),
  ];
  const interests = (t.flexible_spec || []).flatMap((f) => [...(f.interests || []), ...(f.behaviors || []), ...(f.work_positions || []), ...(f.industries || []), ...(f.income || []), ...(f.family_statuses || []), ...(f.life_events || [])]);
  return {
    places,
    excludedPlaces: [...((t.excluded_geo_locations || {}).countries || []), ...((t.excluded_geo_locations || {}).cities || []).map((c) => c.name || c.key), ...((t.excluded_geo_locations || {}).regions || []).map((r) => r.name || r.key)],
    ageMin: t.age_min ?? null,
    ageMax: t.age_max ?? null,
    genders: t.genders || [],
    interests: interests.map((i) => i.name).filter(Boolean),
    audiences: (t.custom_audiences || []).map((c) => c.name || c.id),
    excludedAudiences: (t.excluded_custom_audiences || []).map((c) => c.name || c.id),
    advantageAudience: t.targeting_automation?.advantage_audience === 1,
    locales: t.locales || [],
  };
}

const money = (minor, offset) => (minor === undefined || minor === null || minor === "" ? null : Number(minor) / offset);

export async function account() {
  return withFallback(
    (fields) => call(`/${ACCOUNT}`, { params: { fields } }),
    "id,name,currency,timezone_name,account_status,amount_spent,spend_cap,business_name",
    "id,name,currency,timezone_name,account_status",
  );
}

/** Campaigns → ad sets → ads, each with its own results for the chosen dates. */
export async function tree(range, since, until) {
  const rp = rangeParams(range, since, until);
  const acct = await account();
  const offset = offsetFor(acct.currency);
  const [campaigns, adsets, ads, insC, insS, insA, dailyRows] = await Promise.all([
    withFallback(
      (fields) => all(`/${ACCOUNT}/campaigns`, { fields, limit: 200 }),
      "id,name,status,effective_status,objective,daily_budget,lifetime_budget,budget_remaining,bid_strategy,special_ad_categories,start_time,stop_time,created_time",
      "id,name,status,effective_status,objective,daily_budget,lifetime_budget",
    ),
    withFallback(
      (fields) => all(`/${ACCOUNT}/adsets`, { fields, limit: 200 }),
      "id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,optimization_goal,billing_event,bid_strategy,destination_type,targeting,learning_stage_info,start_time,end_time",
      "id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,optimization_goal,targeting",
    ),
    withFallback(
      (fields) => all(`/${ACCOUNT}/ads`, { fields, limit: 200 }),
      "id,name,adset_id,campaign_id,status,effective_status,created_time,creative{id,name,thumbnail_url,title,body,object_type}",
      "id,name,adset_id,campaign_id,status,effective_status",
    ),
    insights("campaign", rp),
    insights("adset", rp),
    insights("ad", rp),
    // Day-by-day totals for the account (the Command Center's daily chart). A failure here must not hide the campaigns.
    all(`/${ACCOUNT}/insights`, { level: "account", time_increment: 1, fields: "spend,impressions,inline_link_clicks,actions,date_start", limit: 500, ...rp }).catch(() => null),
  ]);
  const gone = (o) => ["DELETED", "ARCHIVED"].includes(o.effective_status);
  const adsBySet = {};
  for (const ad of ads.filter((x) => !gone(x))) {
    (adsBySet[ad.adset_id] ??= []).push({
      id: ad.id,
      name: ad.name,
      status: ad.status,
      effectiveStatus: ad.effective_status,
      created: ad.created_time || null,
      creative: ad.creative ? { id: ad.creative.id, thumb: ad.creative.thumbnail_url || null, title: ad.creative.title || null, body: ad.creative.body || null, type: ad.creative.object_type || null } : null,
      m: insA[ad.id] || null,
    });
  }
  const setsByCampaign = {};
  for (const s of adsets.filter((x) => !gone(x))) {
    (setsByCampaign[s.campaign_id] ??= []).push({
      id: s.id,
      name: s.name,
      status: s.status,
      effectiveStatus: s.effective_status,
      dailyBudget: money(s.daily_budget, offset),
      lifetimeBudget: money(s.lifetime_budget, offset),
      optimization: s.optimization_goal || null,
      destination: s.destination_type || null,
      bidStrategy: s.bid_strategy || null,
      learning: s.learning_stage_info?.status || null,
      targeting: describeTargeting(s.targeting),
      m: insS[s.id] || null,
      ads: adsBySet[s.id] || [],
    });
  }
  return {
    account: {
      id: acct.id,
      name: acct.name,
      business: acct.business_name || null,
      currency: acct.currency,
      timezone: acct.timezone_name,
      status: acct.account_status,
      amountSpent: money(acct.amount_spent, offset),
      spendCap: money(acct.spend_cap, offset) || null,
    },
    range: { preset: range, ...(rp.time_range || {}) },
    fetchedAt: new Date().toISOString(),
    readOnly: READ_ONLY,
    daily: dailyRows
      ? dailyRows
          .map((r) => {
            const m = metrics(r);
            return { date: r.date_start, spend: m.spend, impressions: m.impressions, linkClicks: m.linkClicks, landingViews: m.landingViews, leads: m.leads + m.convos };
          })
          .sort((a, b) => a.date.localeCompare(b.date))
      : null,
    campaigns: campaigns
      .filter((c) => !gone(c))
      .map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        effectiveStatus: c.effective_status,
        objective: c.objective || null,
        dailyBudget: money(c.daily_budget, offset),
        lifetimeBudget: money(c.lifetime_budget, offset),
        bidStrategy: c.bid_strategy || null,
        specialCategories: c.special_ad_categories || [],
        created: c.created_time || null,
        m: insC[c.id] || null,
        adsets: setsByCampaign[c.id] || [],
      })),
  };
}

export async function search(type, q, country) {
  const text = String(q || "").trim().slice(0, 80);
  if (text.length < 2) return [];
  if (type === "interest") {
    const r = await call("/search", { params: { type: "adinterest", q: text, limit: 25 } });
    return (r.data || []).map((x) => ({ id: x.id, name: x.name, size: x.audience_size_upper_bound || x.audience_size || null, path: (x.path || []).join(" › ") }));
  }
  if (type === "location") {
    const params = { type: "adgeolocation", q: text, location_types: ["country", "region", "city"], limit: 25 };
    if (/^[A-Z]{2}$/.test(country || "")) params.country_code = country;
    const r = await call("/search", { params });
    return (r.data || []).map((x) => ({ key: x.key, name: x.name, type: x.type, country: x.country_code || null, region: x.region || null }));
  }
  if (type === "job") {
    const r = await call("/search", { params: { type: "adworkposition", q: text, limit: 25 } });
    return (r.data || []).map((x) => ({ id: x.id, name: x.name }));
  }
  throw new MetaError("Unknown search type.", 400);
}

// ---------------------------------------------------------------- day by day, per ad (trends and fatigue)
export async function daily(range, since, until) {
  const rp = rangeParams(range, since, until);
  const rows = await all(
    `/${ACCOUNT}/insights`,
    { level: "ad", time_increment: 1, fields: "campaign_id,adset_id,ad_id,ad_name,spend,impressions,reach,inline_link_clicks,actions,date_start", limit: 500, ...rp },
    40,
  );
  return {
    range: { preset: range, ...(rp.time_range || {}) },
    fetchedAt: new Date().toISOString(),
    rows: rows.map((r) => {
      const m = metrics(r);
      return { date: r.date_start, campaignId: r.campaign_id, adsetId: r.adset_id, adId: r.ad_id, adName: r.ad_name, spend: m.spend, impressions: m.impressions, reach: m.reach, clicks: m.linkClicks, leads: m.leads, convos: m.convos };
    }),
  };
}

// ---------------------------------------------------------------- breakdowns (where and who)
// Meta's own delivery report split by region, country and age × gender: where
// the money was actually spent and who saw and answered the ads. Read-only.
async function breakdownRows(breakdowns, rp, filtering) {
  const rows = await all(`/${ACCOUNT}/insights`, {
    level: "account",
    breakdowns,
    fields: "spend,impressions,reach,inline_link_clicks,actions",
    limit: 500,
    ...rp,
    ...(filtering ? { filtering } : {}),
  });
  return rows.map((r) => {
    const m = metrics(r);
    return {
      ...(r.region !== undefined ? { region: r.region } : {}),
      ...(r.country !== undefined ? { country: r.country } : {}),
      ...(r.age !== undefined ? { age: r.age } : {}),
      ...(r.gender !== undefined ? { gender: r.gender } : {}),
      spend: m.spend,
      impressions: m.impressions,
      reach: m.reach,
      clicks: m.linkClicks,
      leads: m.leads,
      convos: m.convos,
    };
  });
}

export async function breakdowns(range, since, until, campaignId) {
  const rp = rangeParams(range, since, until);
  if (campaignId && !ID_RE.test(String(campaignId))) throw new MetaError("Not a valid campaign id.", 400);
  const filtering = campaignId ? [{ field: "campaign.id", operator: "EQUAL", value: String(campaignId) }] : null;
  const [region, country, ageGender] = await Promise.all([
    breakdownRows("region", rp, filtering),
    breakdownRows("country", rp, filtering),
    breakdownRows("age,gender", rp, filtering),
  ]);
  return { range: { preset: range, ...(rp.time_range || {}) }, campaignId: campaignId || null, fetchedAt: new Date().toISOString(), region, country, ageGender };
}

export async function audiences() {
  const rows = await withFallback(
    (fields) => all(`/${ACCOUNT}/customaudiences`, { fields, limit: 200 }),
    "id,name,subtype,approximate_count_lower_bound,approximate_count_upper_bound,time_updated",
    "id,name,subtype",
  );
  return rows.map((a) => ({ id: a.id, name: a.name, subtype: a.subtype || null, min: a.approximate_count_lower_bound ?? null, max: a.approximate_count_upper_bound ?? null }));
}

/** Full targeting of one ad set (for the editor). */
export async function targeting(adsetId) {
  const s = await owned(adsetId, "name,targeting");
  return { id: adsetId, name: s.name, targeting: s.targeting || {}, summary: describeTargeting(s.targeting || {}) };
}

// ---------------------------------------------------------------- leads (Meta lead forms)
let pageToken = { value: "", until: 0 };
async function pageAccessToken() {
  if (PAGE_TOKEN_ENV) return PAGE_TOKEN_ENV;
  if (pageToken.value && pageToken.until > Date.now()) return pageToken.value;
  try {
    const r = await call(`/${PAGE_ID}`, { params: { fields: "access_token" } });
    if (r.access_token) {
      pageToken = { value: r.access_token, until: Date.now() + 50 * 60 * 1000 };
      return r.access_token;
    }
  } catch {
    /* fall back to the main token */
  }
  return TOKEN;
}

export async function leads(sinceUnix) {
  if (!PAGE_ID) throw new MetaError("Set META_PAGE_ID to read lead forms.", 400);
  const token = await pageAccessToken();
  const since = Number.isFinite(sinceUnix) && sinceUnix > 0 ? Math.floor(sinceUnix) : Math.floor(Date.now() / 1000) - 30 * 86400;
  const formsPage = await call(`/${PAGE_ID}/leadgen_forms`, { params: { fields: "id,name,status", limit: 100 }, token });
  const forms = formsPage.data || [];
  const out = [];
  for (const f of forms) {
    let page = await call(`/${f.id}/leads`, {
      token,
      params: {
        fields: "id,created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,platform,is_organic",
        limit: 200,
        filtering: [{ field: "time_created", operator: "GREATER_THAN", value: since }],
      },
    });
    for (let i = 0; i < 10; i += 1) {
      for (const l of page.data || []) {
        const fields = {};
        for (const fd of l.field_data || []) fields[fd.name] = (fd.values || []).join(", ");
        out.push({
          metaId: l.id,
          created: l.created_time,
          formId: f.id,
          formName: f.name,
          adId: l.ad_id || null,
          adName: l.ad_name || null,
          adsetId: l.adset_id || null,
          adsetName: l.adset_name || null,
          campaignId: l.campaign_id || null,
          campaignName: l.campaign_name || null,
          platform: l.platform || null,
          organic: Boolean(l.is_organic),
          fields,
        });
      }
      if (!page.paging?.next) break;
      page = await call("", { absolute: page.paging.next });
    }
  }
  return { forms: forms.map((f) => ({ id: f.id, name: f.name, status: f.status })), leads: out, since };
}

// ---------------------------------------------------------------- writing
const audit = [];
const remember = (entry) => {
  const e = { at: new Date().toISOString(), ...entry };
  audit.unshift(e);
  audit.length = Math.min(audit.length, 300);
  console.log("META CHANGE", JSON.stringify(e));
  return e;
};
export const auditLog = () => audit.slice(0, 100);

const ID_RE = /^\d{5,25}$/;
/** Reads an object and refuses it unless it belongs to the configured ad account. */
async function owned(id, fields) {
  if (!ID_RE.test(String(id))) throw new MetaError("Not a valid Meta id.", 400);
  const o = await call(`/${id}`, { params: { fields: `account_id,${fields}` } });
  if (String(o.account_id || "").replace(/^act_/, "") !== ACCOUNT_DIGITS) throw new MetaError("That item is not in this ad account.", 403);
  return o;
}
const writable = () => {
  if (READ_ONLY) throw new MetaError("The dashboard is in read-only mode (META_READ_ONLY). Changes are switched off.", 403);
};

export async function setStatus(id, status, kind) {
  writable();
  if (!["ACTIVE", "PAUSED"].includes(status)) throw new MetaError("Status must be ACTIVE or PAUSED.", 400);
  const o = await owned(id, "name,status");
  if (o.status === status) return { id, name: o.name, status, unchanged: true };
  await call(`/${id}`, { method: "POST", params: { status } });
  return remember({ action: "status", kind: kind || null, id, name: o.name, from: o.status, to: status });
}

export async function setBudget(id, field, amount) {
  writable();
  if (!["daily_budget", "lifetime_budget"].includes(field)) throw new MetaError("Unknown budget type.", 400);
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) throw new MetaError("Enter a budget above zero.", 400);
  if (field === "daily_budget" && MAX_DAILY && value > MAX_DAILY) throw new MetaError(`The dashboard limit is ${MAX_DAILY} per day (META_MAX_DAILY_BUDGET).`, 400);
  const o = await owned(id, `name,${field}`);
  if (o[field] === undefined || o[field] === null || o[field] === "" || o[field] === "0") {
    throw new MetaError("This item has no budget of that type. The budget is set on the campaign or on its ad sets.", 400);
  }
  const acct = await account();
  const offset = offsetFor(acct.currency);
  const minor = Math.round(value * offset);
  await call(`/${id}`, { method: "POST", params: { [field]: minor } });
  return remember({ action: "budget", field, id, name: o.name, from: Number(o[field]) / offset, to: minor / offset, currency: acct.currency });
}

// Only these parts of an ad set's targeting can be changed from the dashboard.
const TARGET_KEYS = ["geo_locations", "excluded_geo_locations", "age_min", "age_max", "genders", "flexible_spec", "exclusions", "custom_audiences", "excluded_custom_audiences", "locales"];

function cleanTargetingPatch(patch) {
  const out = {};
  for (const k of TARGET_KEYS) if (k in patch) out[k] = patch[k];
  if ("age_min" in out) {
    const v = Number(out.age_min);
    if (!Number.isInteger(v) || v < 18 || v > 65) throw new MetaError("Minimum age must be 18 to 65.", 400);
    out.age_min = v;
  }
  if ("age_max" in out) {
    const v = Number(out.age_max);
    if (!Number.isInteger(v) || v < 18 || v > 65) throw new MetaError("Maximum age must be 18 to 65 (65 means 65+).", 400);
    out.age_max = v;
  }
  if ("genders" in out && !(Array.isArray(out.genders) && out.genders.every((g) => g === 1 || g === 2))) throw new MetaError("Gender must be men (1), women (2) or both.", 400);
  const geo = out.geo_locations;
  if (geo !== undefined) {
    const n = ["countries", "regions", "cities", "zips", "custom_locations", "places", "geo_markets"].reduce((s, k) => s + (Array.isArray(geo?.[k]) ? geo[k].length : 0), 0);
    if (!n) throw new MetaError("Keep at least one location.", 400);
  }
  return out;
}

export async function setTargeting(adsetId, patch) {
  writable();
  if (!patch || typeof patch !== "object") throw new MetaError("Nothing to change.", 400);
  const clean = cleanTargetingPatch(patch);
  if (!Object.keys(clean).length) throw new MetaError("Nothing to change.", 400);
  const o = await owned(adsetId, "name,targeting");
  const before = o.targeting || {};
  const next = { ...before, ...clean };
  for (const k of Object.keys(clean)) {
    const v = clean[k];
    if (v === null || (Array.isArray(v) && !v.length) || (typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length)) delete next[k];
  }
  if (Number(next.age_min) > Number(next.age_max ?? 65)) throw new MetaError("Minimum age is above maximum age.", 400);
  await call(`/${adsetId}`, { method: "POST", params: { targeting: next } });
  return remember({ action: "targeting", id: adsetId, name: o.name, from: describeTargeting(before), to: describeTargeting(next) });
}

// ---------------------------------------------------------------- copying campaigns, ad sets and ads
// Copies are always created switched off (status_option PAUSED), so nothing
// spends until the copy has been checked and switched on. Meta copies an object
// with its children in one call only while there are 3 children or fewer, so
// bigger campaigns and ad sets are copied level by level.
const copiedId = (r) => String(r.copied_campaign_id || r.copied_adset_id || r.copied_ad_id || r.id || "");
const KEEP_NAMES = { rename_strategy: "NO_RENAME" };

async function childIds(id, edge) {
  const rows = await all(`/${id}/${edge}`, { fields: "id,effective_status", limit: 100 }, 3);
  return rows.filter((x) => !["DELETED", "ARCHIVED"].includes(x.effective_status)).map((x) => x.id);
}

async function copyAdInto(adId, adsetId) {
  const r = await call(`/${adId}/copies`, { method: "POST", params: { ...(adsetId ? { adset_id: adsetId } : {}), status_option: "PAUSED", rename_options: KEEP_NAMES } });
  return copiedId(r);
}

async function copyAdsetInto(adsetId, campaignId) {
  const ads = await childIds(adsetId, "ads");
  const deep = ads.length <= 3;
  const r = await call(`/${adsetId}/copies`, { method: "POST", params: { ...(campaignId ? { campaign_id: campaignId } : {}), deep_copy: deep, status_option: "PAUSED", rename_options: KEEP_NAMES } });
  const id = copiedId(r);
  let adCount = deep ? ads.length : 0;
  if (!deep) for (const ad of ads) {
    await copyAdInto(ad, id);
    adCount += 1;
  }
  return { id, ads: adCount };
}

export async function copyObject(kind, id, opts = {}) {
  writable();
  const name = String(opts.name || "").trim().slice(0, 200);
  if (!name) throw new MetaError("Give the copy a name.", 400);
  if (kind === "campaign") {
    const src = await owned(id, "name");
    const sets = await childIds(id, "adsets");
    const r = await call(`/${id}/copies`, { method: "POST", params: { deep_copy: false, status_option: "PAUSED", rename_options: { rename_strategy: "ONLY_TOP_LEVEL_RENAME" } } });
    const newId = copiedId(r);
    let ads = 0;
    for (const s of sets) ads += (await copyAdsetInto(s, newId)).ads;
    await call(`/${newId}`, { method: "POST", params: { name } });
    return remember({ action: "copy", kind: "campaign", id: newId, name, from: src.name, to: `${sets.length} ad sets, ${ads} ads, off` });
  }
  if (kind === "adset") {
    const src = await owned(id, "name,campaign_id");
    const target = opts.targetId ? String(opts.targetId) : null;
    if (target) await owned(target, "name");
    const out = await copyAdsetInto(id, target);
    const update = { name };
    if (opts.dailyBudget !== undefined && opts.dailyBudget !== null && opts.dailyBudget !== "") {
      const v = Number(opts.dailyBudget);
      if (!Number.isFinite(v) || v <= 0) throw new MetaError("Enter a daily budget above zero.", 400);
      if (MAX_DAILY && v > MAX_DAILY) throw new MetaError(`The dashboard limit is ${MAX_DAILY} per day (META_MAX_DAILY_BUDGET).`, 400);
      const acct = await account();
      update.daily_budget = Math.round(v * offsetFor(acct.currency));
    }
    await call(`/${out.id}`, { method: "POST", params: update });
    return remember({ action: "copy", kind: "ad set", id: out.id, name, from: src.name, to: `${out.ads} ads, off` });
  }
  if (kind === "ad") {
    const src = await owned(id, "name");
    const target = opts.targetId ? String(opts.targetId) : null;
    if (target) await owned(target, "name");
    const newId = await copyAdInto(id, target);
    await call(`/${newId}`, { method: "POST", params: { name } });
    return remember({ action: "copy", kind: "ad", id: newId, name, from: src.name, to: "off" });
  }
  throw new MetaError("Copy a campaign, an ad set or an ad.", 400);
}

/**
 * A new version of an ad with a different primary text and/or headline: the
 * creative is copied with only those words changed, and the new ad is added to
 * the same ad set, switched off. Works for single image/video/link ads; ads
 * that reuse an existing post or use dynamic creative have to be changed in
 * Ads Manager.
 */
export async function newAdVersion(adId, opts = {}) {
  writable();
  const name = String(opts.name || "").trim().slice(0, 200);
  const message = opts.message === undefined ? undefined : String(opts.message).slice(0, 2200);
  const headline = opts.headline === undefined ? undefined : String(opts.headline).slice(0, 255);
  if (!name) throw new MetaError("Give the new ad a name.", 400);
  if (!message && !headline) throw new MetaError("Change the primary text or the headline.", 400);
  const ad = await owned(adId, "name,adset_id,creative{id,name,object_story_spec,asset_feed_spec,object_story_id}");
  const cr = ad.creative || {};
  if (cr.asset_feed_spec) throw new MetaError("This ad uses dynamic creative. Make the new version in Ads Manager.", 400);
  const spec = cr.object_story_spec ? JSON.parse(JSON.stringify(cr.object_story_spec)) : null;
  if (!spec || !(spec.link_data || spec.video_data)) throw new MetaError("This ad reuses an existing post. Make the new version in Ads Manager, or duplicate the ad instead.", 400);
  if (spec.link_data) {
    if (message) spec.link_data.message = message;
    if (headline) spec.link_data.name = headline;
  } else {
    if (message) spec.video_data.message = message;
    if (headline) spec.video_data.title = headline;
  }
  const created = await call(`/${ACCOUNT}/adcreatives`, { method: "POST", params: { name: `${name} · creative`.slice(0, 100), object_story_spec: spec } });
  const r = await call(`/${ACCOUNT}/ads`, { method: "POST", params: { name, adset_id: ad.adset_id, creative: { creative_id: created.id }, status: "PAUSED" } });
  return remember({ action: "new-ad-version", kind: "ad", id: String(r.id || ""), name, from: ad.name, to: [message ? "new text" : "", headline ? "new headline" : ""].filter(Boolean).join(" + ") + ", off" });
}

// ---------------------------------------------------------------- automatic rules (Meta's Ad Rules Engine)
// Rules live in Meta and run there around the clock. The dashboard only builds
// them from the presets in public/js/rules.js, lists them, switches them on or
// off and deletes them. A rule must be in this ad account before it is touched.
const RULE_FIELDS = "id,name,status,evaluation_spec,execution_spec,schedule_spec,created_time,updated_time";

export async function rules() {
  const rows = await all(`/${ACCOUNT}/adrules_library`, { fields: RULE_FIELDS, limit: 100 });
  const acct = await account();
  return { currency: acct.currency, offset: offsetFor(acct.currency), rules: rows };
}

async function ownedRule(id) {
  if (!ID_RE.test(String(id))) throw new MetaError("Not a valid rule id.", 400);
  const rows = await all(`/${ACCOUNT}/adrules_library`, { fields: "id,name,status", limit: 100 });
  const r = rows.find((x) => String(x.id) === String(id));
  if (!r) throw new MetaError("That rule is not in this ad account.", 403);
  return r;
}

export async function createRule(preset, params) {
  writable();
  const acct = await account();
  let spec;
  try {
    spec = buildRule(preset, params, offsetFor(acct.currency));
  } catch (err) {
    throw new MetaError(err.message, 400);
  }
  const r = await call(`/${ACCOUNT}/adrules_library`, { method: "POST", params: { ...spec, status: "ENABLED" } });
  return remember({ action: "rule-created", id: String(r.id || ""), name: spec.name, to: spec.evaluation_spec.filters.length });
}

export async function setRuleStatus(id, status) {
  writable();
  if (!["ENABLED", "DISABLED"].includes(status)) throw new MetaError("Status must be ENABLED or DISABLED.", 400);
  const r = await ownedRule(id);
  await call(`/${id}`, { method: "POST", params: { status } });
  return remember({ action: "rule-status", id: String(id), name: r.name, from: r.status, to: status });
}

export async function deleteRule(id) {
  writable();
  const r = await ownedRule(id);
  await call(`/${id}`, { method: "DELETE" });
  return remember({ action: "rule-deleted", id: String(id), name: r.name });
}

export async function rulesHistory() {
  const r = await call(`/${ACCOUNT}/adrules_history`, { params: { limit: 50 } });
  return r.data || [];
}

// ---------------------------------------------------------------- lead stages back to Meta
// Conversions API for CRM: tells Meta which leads turned into real interest,
// meetings or reservations, so delivery can favour people like them.
export async function crmEvent(leadId, eventName) {
  writable();
  if (!DATASET) throw new MetaError("Set META_DATASET_ID to send lead stages to Meta.", 400);
  if (!/^\d{5,25}$/.test(String(leadId))) throw new MetaError("Only leads from Meta lead forms can be sent (they carry a Meta lead id).", 400);
  const name = String(eventName || "").trim().slice(0, 50);
  if (!/^[\w \-]{2,50}$/.test(name)) throw new MetaError("Event name must be letters, numbers, spaces or dashes.", 400);
  // The lead id is written as a raw number: it can be longer than JavaScript numbers keep exactly.
  const data =
    `[{"event_name":${JSON.stringify(name)},"event_time":${Math.floor(Date.now() / 1000)},"action_source":"system_generated",` +
    `"custom_data":{"event_source":"crm","lead_event_source":"G Media Buying Dashboard"},"user_data":{"lead_id":${leadId}}}]`;
  const r = await call(`/${DATASET}/events`, { method: "POST", params: { data } });
  return remember({ action: "lead-stage", id: String(leadId), name, to: r.events_received ?? null });
}

export const settings = () => ({
  connected: configured(),
  account: ACCOUNT || null,
  readOnly: READ_ONLY,
  leadForms: Boolean(PAGE_ID),
  stagesToMeta: Boolean(DATASET),
  version: VERSION,
  maxDailyBudget: MAX_DAILY || null,
});
