// Pieces several screens share.
import { html, raw, money, n, pct } from "../ui.js";

export const kpi = (label, value, note = "", key = false) =>
  html`<div class="kpi${key ? " key" : ""}"><span>${label}</span><b>${value}</b>${note ? html`<small>${note}</small>` : ""}</div>`;

const EFFECTIVE = {
  ACTIVE: ["On", "good"],
  PAUSED: ["Off", ""],
  CAMPAIGN_PAUSED: ["Campaign off", ""],
  ADSET_PAUSED: ["Ad set off", ""],
  IN_PROCESS: ["Updating", "info"],
  PENDING_REVIEW: ["In review", "info"],
  PREAPPROVED: ["Approved", "info"],
  DISAPPROVED: ["Rejected", "bad"],
  WITH_ISSUES: ["Has issues", "bad"],
  PENDING_BILLING_INFO: ["Billing needed", "bad"],
};
export function statusPill(effective) {
  const [label, tone] = EFFECTIVE[effective] || [String(effective || "").toLowerCase().replace(/_/g, " "), "line"];
  return html`<span class="pill ${tone}">${label}</span>`;
}

export const OBJECTIVES = {
  OUTCOME_LEADS: "Leads",
  OUTCOME_ENGAGEMENT: "Engagement",
  OUTCOME_TRAFFIC: "Traffic",
  OUTCOME_AWARENESS: "Awareness",
  OUTCOME_SALES: "Sales",
  OUTCOME_APP_PROMOTION: "App",
  LEAD_GENERATION: "Leads",
  MESSAGES: "Messages",
  LINK_CLICKS: "Traffic",
  CONVERSIONS: "Conversions",
  VIDEO_VIEWS: "Video views",
  REACH: "Reach",
  BRAND_AWARENESS: "Awareness",
  POST_ENGAGEMENT: "Engagement",
};
export const objective = (o) => OBJECTIVES[o] || (o ? String(o).toLowerCase().replace(/_/g, " ") : "—");

export function switchBtn(kind, obj, readOnly) {
  const on = obj.status === "ACTIVE";
  return html`<button type="button" class="switch" role="switch" aria-checked="${on}" aria-label="${on ? "Turn off" : "Turn on"} ${obj.name}" data-toggle="${kind}" data-id="${obj.id}" data-name="${obj.name}" ${readOnly ? raw("disabled title='Read-only mode'") : ""}></button>`;
}

export function connectCard(settings) {
  return html`<div class="card">
    <div class="card-head"><div><h2>Connect the G Developments ad account</h2><p>Once connected, every campaign, ad set and ad shows here with its results, and you can turn them on or off, change budgets and edit targeting.</p></div><span class="pill warn">Not connected</span></div>
    <ol class="steps">
      <li><div><b>Get access to the ad account.</b> Ask G Developments (or the agency that owns the Business Manager) to add you as a partner or employee with full control of the ad account and the Facebook Page.</div></li>
      <li><div><b>Make a system user token.</b> Business settings → Users → System users → Add (Admin) → Assign assets: the ad account (Manage campaigns) and the Page → Generate token with <code>ads_management</code>, <code>ads_read</code>, <code>business_management</code>, <code>leads_retrieval</code>, <code>pages_show_list</code>, <code>pages_read_engagement</code>, <code>pages_manage_ads</code>.</div></li>
      <li><div><b>Add the settings on Render</b> (Environment): <code>META_ACCESS_TOKEN</code>, <code>META_AD_ACCOUNT_ID</code> (act_…), and for lead forms <code>META_PAGE_ID</code>. Optional: <code>META_DATASET_ID</code> (the Pixel ID; assign the Pixel to the system user too) to pass website events and valid-lead stages to Meta, <code>META_READ_ONLY=1</code> to look without changing anything.</div></li>
      <li><div><b>Reload this page.</b> The status at the bottom of the menu turns to "Meta connected".</div></li>
    </ol>
    ${settings && !settings.connected ? html`<p class="small muted" style="margin-top:12px">Until then, Leads, Audiences, Messages, Tracked links, the Budget planner and What to sell all work without Meta.</p>` : ""}
  </div>`;
}

export const loadingCard = () => html`<div class="stack"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>`;

/** A short targeting line for tables. */
export function targetingLine(t) {
  if (!t) return "";
  const bits = [];
  if (t.places.length) bits.push(t.places.slice(0, 3).join(", ") + (t.places.length > 3 ? ` +${t.places.length - 3}` : ""));
  if (t.ageMin || t.ageMax) bits.push(`${t.ageMin || 18}–${t.ageMax === 65 || !t.ageMax ? "65+" : t.ageMax}`);
  if (t.genders?.length === 1) bits.push(t.genders[0] === 1 ? "Men" : "Women");
  if (t.interests.length) bits.push(`${t.interests.length} interest${t.interests.length > 1 ? "s" : ""}`);
  if (t.audiences.length) bits.push(`${t.audiences.length} custom`);
  if (t.advantageAudience) bits.push("Advantage+");
  return bits.join(" · ");
}

export const fmtM = { money, n, pct };
