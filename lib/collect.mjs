// Website events in, Meta Conversions API out.
//
// The website (another address) sends each visitor action here with
// navigator.sendBeacon. This adds what only a server sees (the visitor's IP
// address and browser), keeps a copy for the dashboard's Website screen, and
// passes the event on to Meta's Conversions API under the same event id the
// browser Pixel used, so Meta counts it once. No sign-in, so it is narrow: it
// takes events only from the website's own address, only the Meta events the
// website sends, at most 300 per visitor per 10 minutes, and answers nothing.
//
// Settings (Render):
//   WEBSITE_ORIGINS       Addresses allowed to send, comma separated
//                         (default https://mahmoud-elhemaly.onrender.com)
//   META_DATASET_ID       The Pixel (dataset) id. With META_ACCESS_TOKEN set,
//                         events go to Meta. META_READ_ONLY does not stop this:
//                         it changes no ads.
//   META_TEST_EVENT_CODE  From Events Manager > Test events. Pages opened with
//                         ?track=test send with it; without it they send nothing.
//   META_CAPI             0 = keep events in the dashboard only, send none to Meta
import { createHash } from "node:crypto";
import * as meta from "./meta.mjs";

const env = process.env;
const clean = (v) => String(v || "").trim().replace(/^(["'])(.*)\1$/s, "$2").trim();
export const ORIGINS = new Set(
  clean(env.WEBSITE_ORIGINS || "https://mahmoud-elhemaly.onrender.com")
    .split(",")
    .map((o) => clean(o).replace(/\/+$/, ""))
    .filter(Boolean),
);
const TEST_CODE = clean(env.META_TEST_EVENT_CODE);
const OFF = /^(0|false|no|off)$/i.test(clean(env.META_CAPI));
const FLUSH_MS = Number(env.COLLECT_FLUSH_MS) || 2000;
// What the website sends (see js/site.js, META_EVENT). Anything else is refused.
const EVENTS = new Set(["PageView", "ViewContent", "Contact", "Lead", "CustomizeProduct", "BrochureDownload"]);
const CUSTOM_KEYS = ["channel", "content_type", "content_name", "content_category", "place"];

const sha = (s) => createHash("sha256").update(String(s)).digest("hex");
const str = (v, max) => String(v ?? "").trim().slice(0, max);

// ------------------------------------------------------------ per-visitor limit
const LIMIT = 300;
const WINDOW = 10 * 60 * 1000;
const hits = new Map(); // ip -> { n, since }
export function allowed(ip) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.since > WINDOW) {
    if (!h && hits.size >= 20_000) hits.delete(hits.keys().next().value);
    hits.set(ip, { n: 1, since: now });
    return true;
  }
  h.n += 1;
  return h.n <= LIMIT;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, h] of hits) if (now - h.since > WINDOW) hits.delete(ip);
}, 60 * 1000).unref();

// ------------------------------------------------------------ counts since start
// Kept in memory: they start again when the server restarts (the free plan
// sleeps after 15 idle minutes). Meta's own counts are on the Website screen.
const stats = { since: new Date().toISOString(), received: 0, sent: 0, test: 0, kept: 0, failed: 0, byEvent: {}, lastSentAt: null, lastError: null, lastErrorAt: null };
let queue = [];
let timer = null;

export function status() {
  return {
    forwarding: !OFF && meta.capiReady(),
    off: OFF,
    datasetSet: meta.capiReady(),
    testCode: Boolean(TEST_CODE),
    origins: [...ORIGINS],
    queued: queue.length,
    ...stats,
    byEvent: { ...stats.byEvent },
  };
}

/** Checks one event from the website. Returns { error } or { event, record, test }. */
export function shape(body, { ip, ua, origin }) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Could not read the event." };
  const name = str(body.event_name, 40);
  if (!EVENTS.has(name)) return { error: "Unknown event." };
  const id = str(body.event_id, 64);
  if (!/^[\w.-]{8,64}$/.test(id)) return { error: "Bad event id." };
  const url = str(body.url, 1000);
  try {
    if (new URL(url).origin !== origin) return { error: "The page is not on the website." };
  } catch {
    return { error: "Bad page address." };
  }
  const now = Math.floor(Date.now() / 1000);
  let time = Math.floor(Number(body.event_time)) || now;
  // Meta refuses events from the future or more than 7 days old.
  if (time > now + 60 || time < now - 7 * 86400) time = now;
  const cd = body.custom_data && typeof body.custom_data === "object" ? body.custom_data : {};
  const custom = {};
  for (const k of CUSTOM_KEYS) if (cd[k] !== undefined && cd[k] !== null && cd[k] !== "") custom[k] = str(cd[k], 80);
  const user = {};
  if (ip) user.client_ip_address = str(ip, 64);
  if (ua) user.client_user_agent = str(ua, 400);
  const fbp = str(body.fbp, 120);
  if (/^fb\.\d\.\d{10,13}\.\d{1,20}$/.test(fbp)) user.fbp = fbp;
  const fbc = str(body.fbc, 500);
  if (/^fb\.\d\.\d{10,13}\.[\w-]{8,480}$/.test(fbc)) user.fbc = fbc;
  const visitor = str(body.visitor, 64);
  if (/^[\w-]{8,64}$/.test(visitor)) user.external_id = [sha(visitor)];
  const event = { event_name: name, event_time: time, event_id: id, action_source: "website", event_source_url: url, user_data: user };
  if (Object.keys(custom).length) event.custom_data = custom;
  const a = body.attr && typeof body.attr === "object" ? body.attr : {};
  const record = {
    event: str(body.site_event, 60) || name,
    metaEvent: name,
    project: str(body.project, 60),
    page: str(body.page, 160) || new URL(url).pathname,
    place: custom.place || "",
    utm_source: str(a.utm_source, 60),
    utm_campaign: str(a.utm_campaign, 120),
    utm_content: str(a.utm_content, 120),
    ref: /^[A-Za-z0-9-]{2,24}$/.test(str(body.ref, 24)) ? str(body.ref, 24).toUpperCase() : "",
    adId: /^\d{6,20}$/.test(str(a.ad_id, 20)) ? str(a.ad_id, 20) : null,
    test: body.test === true,
  };
  return { event, record, test: body.test === true };
}

/** Takes one event: keeps it for the dashboard and queues it for Meta. */
export function accept(body, ctx) {
  const s = shape(body, ctx);
  if (s.error) return s;
  stats.received += 1;
  stats.byEvent[s.event.event_name] = (stats.byEvent[s.event.event_name] || 0) + 1;
  const toMeta = !OFF && meta.capiReady() && (!s.test || Boolean(TEST_CODE));
  meta.recordWebEvent({ ...s.record, sent: toMeta });
  if (!toMeta) {
    stats.kept += 1;
    return { ok: true, queued: false };
  }
  queue.push(s);
  if (queue.length >= 500) flush();
  else if (!timer) timer = setTimeout(flush, FLUSH_MS);
  return { ok: true, queued: true };
}

// Events go to Meta in batches (up to 1,000 per request), a couple of seconds
// after they arrive. Test-page events go separately, with the test code.
export async function flush() {
  clearTimeout(timer);
  timer = null;
  const batch = queue.splice(0, 1000);
  for (const test of [false, true]) {
    const group = batch.filter((x) => x.test === test).map((x) => x.event);
    if (!group.length) continue;
    try {
      await meta.sendWebsiteEvents(group, test ? TEST_CODE : null);
      stats.sent += group.length;
      if (test) stats.test += group.length;
      stats.lastSentAt = new Date().toISOString();
    } catch (err) {
      stats.failed += group.length;
      stats.lastError = err instanceof Error ? err.message : String(err);
      stats.lastErrorAt = new Date().toISOString();
      console.error("Conversions API:", stats.lastError);
    }
  }
  if (queue.length && !timer) timer = setTimeout(flush, FLUSH_MS);
}
