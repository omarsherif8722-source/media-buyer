// Automatic rules: expert presets turned into Meta "Automated rules" (the Ad
// Rules Engine), which Meta runs around the clock, even while this dashboard
// is closed. Used by the server (to create real rules) and by the demo, so both
// build exactly the same rule. Spec format: Meta Marketing API, Ad Rules
// (evaluation_spec, execution_spec, schedule_spec). Money is in the currency's
// smallest unit (piasters for EGP), so amounts are multiplied by `offset`.

export const PRESETS = {
  stoploss: {
    label: "Stop ads that spend without results",
    short: "No-result stop-loss",
    level: "AD",
    action: "PAUSE",
    schedule: "SEMI_HOURLY",
    types: ["leads", "messages"],
    needs: ["cpl"],
    why: "Protects the budget overnight: an ad that has spent twice your target cost per lead in the last 7 days without a single result is switched off. New ads get 3 days first.",
  },
  highcpl: {
    label: "Stop ads whose leads cost far too much",
    short: "High cost per lead",
    level: "AD",
    action: "PAUSE",
    schedule: "DAILY",
    types: ["leads"],
    needs: ["cpl"],
    why: "Once an ad has at least 3 leads, if they cost more than 1.8× your target over 7 days, it is switched off so the budget moves to the better ads in the same ad set.",
  },
  tired: {
    label: "Tell me when an ad is tired",
    short: "Tired ad alert",
    level: "AD",
    action: "NOTIFICATION",
    schedule: "DAILY",
    types: ["leads", "messages"],
    needs: [],
    why: "Sends a Meta notification when people see an ad too often (high frequency) and fewer click it. Time for a new hook or video. Nothing is switched off.",
  },
  scale: {
    label: "Raise the budget of winning ad sets",
    short: "Scale winners +15%",
    level: "ADSET",
    action: "CHANGE_BUDGET",
    schedule: "DAILY",
    types: ["leads"],
    needs: ["cpl", "maxBudget"],
    why: "When an ad set brings 10+ leads in 7 days at less than 70% of your target cost, its daily budget goes up 15%, at most once every 3 days and never above your cap. Steps of 15% avoid restarting learning.",
  },
  spendcap: {
    label: "Alert me if today's spend runs high",
    short: "Daily spend alert",
    level: "CAMPAIGN",
    action: "NOTIFICATION",
    schedule: "HOURLY",
    types: ["leads", "messages"],
    needs: ["dailyCap"],
    why: "Checks every hour and sends a Meta notification when a campaign's spend today passes the amount you set. Nothing is switched off.",
  },
};

const num = (v, name, min = 0) => {
  const x = Number(v);
  if (!Number.isFinite(x) || x <= min) throw new Error(`Enter a valid ${name}.`);
  return x;
};

/**
 * One Meta rule from a preset.
 * p: { type: "leads" | "messages", campaignIds: [], scopeLabel, cpl, maxBudget, dailyCap, maxFrequency, minCtr }
 */
export function buildRule(preset, p = {}, offset = 100) {
  const P = PRESETS[preset];
  if (!P) throw new Error("Unknown rule.");
  const type = p.type === "messages" ? "messages" : "leads";
  if (!P.types.includes(type)) throw new Error("This rule only works for lead-form campaigns.");
  const ids = (p.campaignIds || []).map(String);
  if (!ids.length) throw new Error("Pick at least one campaign for the rule.");
  if (!ids.every((x) => /^\d{5,25}$/.test(x))) throw new Error("Campaign ids are not valid.");
  const money = (v) => Math.round(v * offset);
  const f = (field, operator, value) => ({ field, operator, value });
  const filters = [f("entity_type", "EQUAL", P.level), f("campaign.id", "IN", ids)];
  const resultField = type === "messages" ? "results" : "leadgen";
  const options = [];
  let execution_type = P.action;
  let time = "LAST_7_DAYS";

  if (preset === "stoploss") {
    const cpl = num(p.cpl, "target cost per lead");
    filters.push(f("hours_since_creation", "GREATER_THAN", 72), f("spent", "GREATER_THAN", money(cpl * 2)), f(resultField, "LESS_THAN", 1));
  } else if (preset === "highcpl") {
    const cpl = num(p.cpl, "target cost per lead");
    filters.push(f("leadgen", "GREATER_THAN", 2), f("cost_per_lead_fb", "GREATER_THAN", money(cpl * 1.8)), f("spent", "GREATER_THAN", money(cpl * 3)));
  } else if (preset === "tired") {
    const freq = num(p.maxFrequency ?? 3, "frequency");
    const ctr = num(p.minCtr ?? 0.5, "minimum CTR");
    filters.push(f("impressions", "GREATER_THAN", 3000), f("frequency", "GREATER_THAN", freq), f("link_ctr", "LESS_THAN", ctr));
  } else if (preset === "scale") {
    const cpl = num(p.cpl, "target cost per lead");
    const cap = num(p.maxBudget, "highest daily budget");
    filters.push(f("leadgen", "GREATER_THAN", 9), f("cost_per_lead_fb", "LESS_THAN", money(cpl * 0.7)));
    options.push(f("change_spec", "EQUAL", { amount: 15, unit: "PERCENTAGE", limit: money(cap) }), f("action_frequency", "EQUAL", 4320));
  } else if (preset === "spendcap") {
    const cap = num(p.dailyCap, "daily spend limit");
    time = "TODAY";
    filters.push(f("spent", "GREATER_THAN", money(cap)));
    execution_type = "NOTIFICATION";
  }
  filters.splice(1, 0, f("time_preset", "EQUAL", time));
  const scope = String(p.scopeLabel || `${ids.length} campaign${ids.length > 1 ? "s" : ""}`).slice(0, 60);
  return {
    name: `GD · ${P.short}${type === "messages" ? " (WhatsApp)" : ""} · ${scope}`.slice(0, 100),
    evaluation_spec: { evaluation_type: "SCHEDULE", filters },
    execution_spec: { execution_type, ...(options.length ? { execution_options: options } : {}) },
    schedule_spec: { schedule_type: P.schedule },
  };
}

// ---------------------------------------------------------------- reading a rule back in plain words
const FIELD = {
  spent: "spend",
  leadgen: "form leads",
  results: "results",
  cost_per_lead_fb: "cost per lead",
  frequency: "frequency",
  link_ctr: "link CTR %",
  impressions: "impressions",
  hours_since_creation: "hours since created",
  cpc: "cost per click",
  cpm: "CPM",
  ctr: "CTR %",
};
const MONEY = new Set(["spent", "cost_per_lead_fb", "cpc", "cpm"]);
const OP = { GREATER_THAN: ">", LESS_THAN: "<", EQUAL: "=", IN: "in", NOT_IN: "not in", IN_RANGE: "between", NOT_IN_RANGE: "outside" };
const SCHEDULE = { SEMI_HOURLY: "every 30 minutes", HOURLY: "every hour", DAILY: "once a day", CUSTOM: "on a custom schedule" };
const ACTION = { PAUSE: "switch off", UNPAUSE: "switch on", NOTIFICATION: "send a notification", CHANGE_BUDGET: "change ad set budget", CHANGE_CAMPAIGN_BUDGET: "change campaign budget", CHANGE_BID: "change bid", ROTATE: "rotate ads", REBALANCE_BUDGET: "rebalance budget" };
const LEVEL = { AD: "ads", ADSET: "ad sets", CAMPAIGN: "campaigns" };
const TIME = { LAST_7_DAYS: "last 7 days", LAST_3_DAYS: "last 3 days", LAST_14_DAYS: "last 14 days", LAST_30_DAYS: "last 30 days", TODAY: "today", YESTERDAY: "yesterday", LIFETIME: "lifetime" };

/** "Every 30 minutes: switch off ads (last 7 days) where spend > EGP 600 and form leads < 1". */
export function describeRule(rule, offset = 100, currency = "EGP", campaignName = (id) => id) {
  const fs = rule.evaluation_spec?.filters || [];
  const get = (k) => fs.find((x) => x.field === k)?.value;
  const level = LEVEL[get("entity_type")] || "items";
  const time = TIME[get("time_preset")] || String(get("time_preset") || "").toLowerCase().replace(/_/g, " ");
  const conds = fs
    .filter((x) => !["entity_type", "time_preset", "campaign.id", "id"].includes(x.field))
    .map((x) => {
      if (x.field === "hours_since_creation" && x.operator === "GREATER_THAN") return `older than ${Math.round(Number(x.value) / 24)} days`;
      const v = MONEY.has(x.field) ? `${currency} ${Math.round(Number(x.value) / offset).toLocaleString("en-US")}` : Array.isArray(x.value) ? x.value.join("–") : x.value;
      return `${FIELD[x.field] || x.field} ${OP[x.operator] || x.operator} ${v}`;
    });
  const camps = get("campaign.id");
  const ex = rule.execution_spec || {};
  const change = (ex.execution_options || []).find((o) => o.field === "change_spec")?.value;
  const act = `${ACTION[ex.execution_type] || ex.execution_type}${change ? ` ${change.amount > 0 ? "+" : ""}${change.amount}${change.unit === "PERCENTAGE" ? "%" : ""}${change.limit ? ` (cap ${currency} ${Math.round(change.limit / offset).toLocaleString("en-US")})` : ""}` : ""}`;
  return {
    when: SCHEDULE[rule.schedule_spec?.schedule_type] || "on schedule",
    action: act,
    level,
    time,
    conditions: conds,
    campaigns: Array.isArray(camps) ? camps.map(campaignName) : [],
    text: `${SCHEDULE[rule.schedule_spec?.schedule_type] || "On schedule"}: ${act} for ${level} (${time}) where ${conds.join(" and ")}`,
  };
}

// ---------------------------------------------------------------- preview on the dashboard's own numbers
/** Which items the preset would act on now, using a 7-day campaign tree (approximate: Meta decides on its own numbers). */
export function preview(preset, p, tree) {
  const ids = new Set((p.campaignIds || []).map(String));
  const out = [];
  const created = (a) => (a.created ? (Date.now() - new Date(a.created).getTime()) / 3600000 : 999);
  for (const c of tree?.campaigns || []) {
    if (!ids.has(String(c.id))) continue;
    for (const s of c.adsets) {
      const sm = s.m || {};
      if (preset === "scale" && sm.leads > 9 && sm.spend / sm.leads < p.cpl * 0.7 && s.status === "ACTIVE") out.push({ id: s.id, name: s.name, campaign: c.name, why: `${sm.leads} leads at ${Math.round(sm.spend / sm.leads)} each` });
      for (const a of s.ads) {
        const m = a.m || {};
        if (a.status !== "ACTIVE") continue;
        const results = (m.leads || 0) + (p.type === "messages" ? m.convos || 0 : 0);
        if (preset === "stoploss" && created(a) > 72 && m.spend > p.cpl * 2 && results < 1) out.push({ id: a.id, name: a.name, campaign: c.name, why: `${Math.round(m.spend)} spent, no results` });
        if (preset === "highcpl" && m.leads > 2 && m.spend > p.cpl * 3 && m.spend / m.leads > p.cpl * 1.8) out.push({ id: a.id, name: a.name, campaign: c.name, why: `${m.leads} leads at ${Math.round(m.spend / m.leads)} each` });
        if (preset === "tired" && m.impressions > 3000 && m.frequency > (p.maxFrequency ?? 3) && m.ctr > 0 && m.ctr < (p.minCtr ?? 0.5)) out.push({ id: a.id, name: a.name, campaign: c.name, why: `frequency ${m.frequency.toFixed(1)}, CTR ${m.ctr.toFixed(2)}%` });
      }
    }
  }
  return out;
}
