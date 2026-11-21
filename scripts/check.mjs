// End-to-end check: starts a stand-in Meta Graph API and the dashboard server,
// then signs in and runs every read and write through /api. Proves the
// dashboard sends Meta the right requests; it does not prove Meta accepts
// them (only a real ad account can).  Run: npm run check
import { createServer, request } from "node:http";
import { spawn } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TOKEN = "test-token-not-real";
const PASS = "local-check-password";
let failures = 0;
const ok = (name) => console.log(`  ✓ ${name}`);
async function test(name, fn) {
  try {
    await fn();
    ok(name);
  } catch (e) {
    failures += 1;
    console.log(`  ✗ ${name}\n    ${e.message}`);
  }
}

// ---------------------------------------------------------------- stand-in Graph API
const posts = [];
const targeting = { geo_locations: { countries: ["EG"], cities: [{ key: "1528", name: "New Cairo", radius: 15, distance_unit: "kilometer" }], location_types: ["home", "recent"] }, age_min: 28, age_max: 65, flexible_spec: [{ interests: [{ id: "6003", name: "Golf" }] }] };
const objects = {
  c1: { id: "c1", account_id: "123", name: "GD | Krypton | Leads | Broad | Nov", status: "ACTIVE", effective_status: "ACTIVE", objective: "OUTCOME_LEADS" },
  c2: { id: "c2", account_id: "123", name: "GD | Golf Views | Leads | Nov", status: "PAUSED", effective_status: "PAUSED", objective: "OUTCOME_LEADS", daily_budget: "30000" },
  s1: { id: "s1", account_id: "123", name: "A · Broad", campaign_id: "c1", status: "ACTIVE", effective_status: "ACTIVE", daily_budget: "50000", optimization_goal: "LEAD_GENERATION", targeting },
  a1: { id: "a1", account_id: "123", name: "film-15s-price", adset_id: "s1", campaign_id: "c1", status: "ACTIVE", effective_status: "ACTIVE" },
};
// Graph ids are numeric; map test ids to numbers the server accepts.
const NUM = { c1: "100001", c2: "100002", s1: "200001", a1: "300001", other: "999999" };
const byNum = Object.fromEntries(Object.entries(NUM).map(([k, v]) => [v, k]));
objects.other = { id: "other", account_id: "555", name: "Someone else's ad set", status: "ACTIVE" };
const withNum = (o) => ({ ...o, id: NUM[o.id] || o.id, campaign_id: o.campaign_id ? NUM[o.campaign_id] : undefined, adset_id: o.adset_id ? NUM[o.adset_id] : undefined });

const ins = (id, key) => ({ [key]: NUM[id], spend: "412.50", impressions: "20500", reach: "15000", frequency: "1.37", clicks: "300", inline_link_clicks: "210", inline_link_click_ctr: "1.02", cpm: "20.12", actions: [{ action_type: "lead", value: "9" }, { action_type: "onsite_conversion.messaging_conversation_started_7d", value: "3" }], date_start: "2026-11-14", date_stop: "2026-11-20" });

const graph = createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  let body = "";
  for await (const chunk of req) body += chunk;
  const params = req.method === "POST" ? new URLSearchParams(body) : url.searchParams;
  const send = (code, data) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };
  if (params.get("access_token") !== TOKEN && params.get("access_token") !== "page-token") return send(400, { error: { message: "Invalid OAuth access token.", code: 190 } });
  const path = url.pathname.replace(/^\/v23\.0/, "");
  if (req.method === "POST") {
    posts.push({ path, params: Object.fromEntries(params) });
    if (path === "/888/events") return send(200, { events_received: 1 });
    return send(200, { success: true });
  }
  if (path === "/act_123") return send(200, { id: "act_123", name: "G Developments · Test", currency: "EGP", timezone_name: "Africa/Cairo", account_status: 1, amount_spent: "1234500" });
  if (path === "/act_123/campaigns") return send(200, { data: [withNum(objects.c1), withNum(objects.c2)] });
  if (path === "/act_123/adsets") return send(200, { data: [withNum(objects.s1)] });
  if (path === "/act_123/ads") return send(200, { data: [withNum(objects.a1)] });
  if (path === "/act_123/insights" && params.get("breakdowns")) {
    const b = params.get("breakdowns");
    const row = (extra, spend, leads) => ({ ...extra, spend: String(spend), impressions: "1000", reach: "800", inline_link_clicks: "10", actions: [{ action_type: "lead", value: String(leads) }] });
    if (b === "region") return send(200, { data: [row({ region: "Cairo Governorate" }, 300, 6), row({ region: "Al Jizah" }, 100, 2), row({ region: "Riyadh Region" }, 12.5, 1)] });
    if (b === "country") return send(200, { data: [row({ country: "EG" }, 400, 8), row({ country: "SA" }, 12.5, 1)] });
    if (b === "age,gender") return send(200, { data: [row({ age: "35-44", gender: "male" }, 250, 5), row({ age: "35-44", gender: "female" }, 150, 3), row({ age: "25-34", gender: "unknown" }, 12.5, 1)] });
    return send(400, { error: { message: "bad breakdown", code: 100 } });
  }
  if (path === "/act_123/insights") {
    const level = params.get("level");
    if (!params.get("date_preset") && !params.get("time_range")) return send(400, { error: { message: "no dates", code: 100 } });
    if (level === "campaign") return send(200, { data: [ins("c1", "campaign_id")] });
    if (level === "adset") return send(200, { data: [ins("s1", "adset_id")] });
    return send(200, { data: [ins("a1", "ad_id")] });
  }
  if (path === "/act_123/customaudiences") return send(200, { data: [{ id: "400001", name: "Krypton page visitors 30d", subtype: "WEBSITE" }] });
  if (path === "/search") return send(200, { data: params.get("type") === "adinterest" ? [{ id: "6004", name: "Real estate investing", audience_size_upper_bound: 5000000 }] : [{ key: "EG", name: "Egypt", type: "country", country_code: "EG" }] });
  if (path === "/777") return send(200, { access_token: "page-token", id: "777" });
  if (path === "/777/leadgen_forms") return send(200, { data: [{ id: "500001", name: "Krypton · higher intent", status: "ACTIVE" }] });
  if (path === "/500001/leads") return send(200, { data: [{ id: "12345678901234567", created_time: "2026-11-20T10:00:00+0000", ad_id: NUM.a1, ad_name: "film-15s-price", adset_id: NUM.s1, adset_name: "A · Broad", campaign_id: NUM.c1, campaign_name: objects.c1.name, form_id: "500001", platform: "ig", field_data: [{ name: "full_name", values: ["Test Buyer"] }, { name: "phone_number", values: ["+201000000000"] }, { name: "what_budget_do_you_have_in_mind?", values: ["7.9M – 11.8M EGP"] }] }] });
  const id = path.slice(1);
  const key = byNum[id];
  if (key && objects[key]) return send(200, withNum(objects[key]));
  send(404, { error: { message: `Unknown path ${path}`, code: 100 } });
});
await new Promise((r) => graph.listen(0, "127.0.0.1", r));
const GRAPH_URL = `http://127.0.0.1:${graph.address().port}`;

// ---------------------------------------------------------------- dashboard servers
async function start(port, env) {
  const child = spawn(process.execPath, ["server.mjs"], { cwd: root, env: { ...process.env, PORT: String(port), ...env }, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  for (let i = 0; i < 50; i += 1) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (r.ok) return { child, log: () => log };
    } catch {
      /* starting */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  child.kill();
  throw new Error(`server did not start: ${log}`);
}
const base = 4300 + Math.floor(Math.random() * 500);
const metaEnv = { DASHBOARD_PASSWORD: PASS, META_GRAPH_URL: GRAPH_URL, META_ACCESS_TOKEN: TOKEN, META_AD_ACCOUNT_ID: "act_123", META_PAGE_ID: "777", META_DATASET_ID: "888" };
const main = await start(base, metaEnv);
const ro = await start(base + 1, { ...metaEnv, META_READ_ONLY: "1" });
const bare = await start(base + 2, { DASHBOARD_PASSWORD: PASS });
const nopass = await start(base + 3, { DASHBOARD_PASSWORD: "" });
const messy = await start(base + 4, { DASHBOARD_PASSWORD: ` "${PASS}" `, DASHBOARD_USER: " Media " });
const U = (p, port = base) => `http://127.0.0.1:${port}${p}`;
// fetch() drops Sec-Fetch-* headers, so browser-like requests go through node:http.
const raw = (path, { method = "GET", headers = {}, body } = {}) =>
  new Promise((done, fail) => {
    const r = request(U(path), { method, headers }, (res) => {
      let t = "";
      res.on("data", (d) => (t += d));
      res.on("end", () => done({ status: res.statusCode, text: t }));
    });
    r.on("error", fail);
    r.end(body);
  });

let cookie = "";
const login = async (port) => {
  const r = await fetch(U("/login", port), { method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `username=media&password=${PASS}` });
  return (r.headers.get("set-cookie") || "").split(";")[0];
};
const api = async (path, { method = "GET", body, port = base, headers = {} } = {}) => {
  const c = port === base ? cookie : await login(port);
  const r = await fetch(U(path, port), { method, headers: { Cookie: c, ...(body ? { "Content-Type": "application/json" } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  assert.ok(!text.includes(TOKEN), `token leaked in ${path}`);
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: r.status, data, text, headers: r.headers };
};

console.log("Sign-in");
await test("health check answers", async () => assert.equal((await fetch(U("/healthz"))).status, 200));
await test("no password configured → 503", async () => assert.equal((await fetch(U("/", base + 3))).status, 503));
await test("page without sign-in shows the sign-in page", async () => {
  const r = await raw("/", { headers: { "Sec-Fetch-Mode": "navigate", Accept: "text/html" } });
  assert.equal(r.status, 401);
  assert.match(r.text, /G Developments · Media buying/);
  assert.match(r.text, /name="username" type="text" value="media"/, "username filled in");
  assert.match(r.text, /id="show"/, "show password button");
});
await test("API without sign-in → 401", async () => assert.equal((await fetch(U("/api/tree"))).status, 401));
await test("wrong password refused", async () => {
  const r = await fetch(U("/login"), { method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "username=media&password=nope" });
  assert.equal(r.status, 401);
});
await test("right password signs in", async () => {
  cookie = await login(base);
  assert.match(cookie, /gmb_session=v1\./);
});
await test("password saved with spaces or quotes on Render still signs in", async () => {
  const r = await fetch(U("/login", base + 4), { method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `username=MEDIA&password=${PASS}%20` });
  assert.equal(r.status, 303);
  assert.match(r.headers.get("set-cookie") || "", /gmb_session=v1\./);
});
await test("dashboard page served with a content security policy", async () => {
  const r = await fetch(U("/"), { headers: { Cookie: cookie } });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-security-policy") || "", /script-src 'self'/);
});
await test("install files open without sign-in", async () => assert.equal((await fetch(U("/manifest.webmanifest"))).status, 200));
await test("catalog is served behind sign-in", async () => {
  assert.equal((await fetch(U("/data/catalog.json"))).status, 401);
  const r = await fetch(U("/data/catalog.json"), { headers: { Cookie: cookie } });
  const c = await r.json();
  assert.ok(c.projects.length >= 10);
});

console.log("Reading from Meta");
await test("settings say connected", async () => {
  const r = await api("/api/settings");
  assert.equal(r.data.connected, true);
  assert.equal(r.data.leadForms, true);
});
await test("campaign tree with results and budgets in EGP", async () => {
  const r = await api("/api/tree?range=last_7d");
  assert.equal(r.status, 200, r.text);
  assert.equal(r.data.campaigns.length, 2);
  const c1 = r.data.campaigns.find((c) => c.id === NUM.c1);
  assert.equal(c1.m.leads, 9);
  assert.equal(c1.m.convos, 3);
  assert.equal(c1.m.spend, 412.5);
  assert.equal(c1.adsets[0].dailyBudget, 500);
  assert.equal(c1.adsets[0].ads.length, 1);
  assert.deepEqual(c1.adsets[0].targeting.interests, ["Golf"]);
  assert.equal(r.data.campaigns.find((c) => c.id === NUM.c2).dailyBudget, 300);
  assert.equal(r.data.account.currency, "EGP");
});
await test("second read comes from the 1-minute cache", async () => assert.equal((await api("/api/tree?range=last_7d")).data.cached, true));
await test("custom dates are checked", async () => assert.equal((await api("/api/tree?range=custom&since=2026-11-10&until=2026-11-01")).status, 400));
await test("delivery report by region, country, age and gender", async () => {
  const r = await api("/api/breakdowns?range=last_7d");
  assert.equal(r.status, 200, r.text);
  assert.equal(r.data.region.length, 3);
  assert.equal(r.data.country.find((x) => x.country === "SA").spend, 12.5);
  assert.equal(r.data.ageGender.find((x) => x.gender === "male").leads, 5);
  const one = await api(`/api/breakdowns?range=last_7d&campaign=${NUM.c1}`);
  assert.equal(one.status, 200, one.text);
  assert.equal((await api("/api/breakdowns?range=last_7d&campaign=abc")).status, 400);
});
await test("interest search", async () => assert.equal((await api("/api/search?type=interest&q=real")).data[0].name, "Real estate investing"));
await test("custom audiences", async () => assert.equal((await api("/api/audiences")).data.length, 1));
await test("lead-form leads with answers", async () => {
  const r = await api("/api/leads?since=1");
  assert.equal(r.status, 200, r.text);
  assert.equal(r.data.leads.length, 1);
  assert.equal(r.data.leads[0].fields.full_name, "Test Buyer");
  assert.equal(r.data.leads[0].metaId, "12345678901234567");
});

console.log("Changing things (with checks)");
await test("turn an ad set off", async () => {
  const r = await api("/api/status", { method: "POST", body: { id: NUM.s1, status: "PAUSED", kind: "ad set" } });
  assert.equal(r.status, 200, r.text);
  const p = posts.at(-1);
  assert.equal(p.path, `/${NUM.s1}`);
  assert.equal(p.params.status, "PAUSED");
});
await test("refuse an item from another ad account", async () => {
  const before = posts.length;
  const r = await api("/api/status", { method: "POST", body: { id: NUM.other, status: "PAUSED" } });
  assert.equal(r.status, 403);
  assert.equal(posts.length, before);
});
await test("refuse a status other than on/off", async () => assert.equal((await api("/api/status", { method: "POST", body: { id: NUM.s1, status: "DELETED" } })).status, 400));
await test("daily budget sent in piasters", async () => {
  const r = await api("/api/budget", { method: "POST", body: { id: NUM.s1, field: "daily_budget", amount: 650 } });
  assert.equal(r.status, 200, r.text);
  assert.equal(posts.at(-1).params.daily_budget, "65000");
  assert.equal(r.data.from, 500);
  assert.equal(r.data.to, 650);
});
await test("refuse a budget type the item does not use", async () => assert.equal((await api("/api/budget", { method: "POST", body: { id: NUM.c1, field: "daily_budget", amount: 100 } })).status, 400));
await test("targeting change keeps everything else", async () => {
  const r = await api("/api/targeting", { method: "POST", body: { id: NUM.s1, patch: { age_min: 30, genders: [], flexible_spec: [{ interests: [{ id: "6004", name: "Real estate investing" }] }], publisher_platforms: ["audience_network"] } } });
  assert.equal(r.status, 200, r.text);
  const t = JSON.parse(posts.at(-1).params.targeting);
  assert.equal(t.age_min, 30);
  assert.equal(t.age_max, 65);
  assert.deepEqual(t.geo_locations.countries, ["EG"]);
  assert.equal(t.geo_locations.cities[0].key, "1528");
  assert.equal(t.flexible_spec[0].interests[0].id, "6004");
  assert.ok(!("genders" in t));
  assert.ok(!("publisher_platforms" in t), "fields outside the allowed list must be dropped");
});
await test("refuse removing every location", async () => assert.equal((await api("/api/targeting", { method: "POST", body: { id: NUM.s1, patch: { geo_locations: {} } } })).status, 400));
await test("refuse ages outside 18–65", async () => assert.equal((await api("/api/targeting", { method: "POST", body: { id: NUM.s1, patch: { age_min: 13 } } })).status, 400));
await test("lead stage to Meta keeps the 17-digit lead id exact", async () => {
  const r = await api("/api/lead-stage", { method: "POST", body: { leadId: "12345678901234567", event: "Valid lead" } });
  assert.equal(r.status, 200, r.text);
  const p = posts.at(-1);
  assert.equal(p.path, "/888/events");
  assert.match(p.params.data, /"lead_id":12345678901234567\}/);
  assert.match(p.params.data, /"event_name":"Valid lead"/);
  assert.match(p.params.data, /"action_source":"system_generated"/);
});
await test("change log lists the changes", async () => {
  const r = await api("/api/audit");
  assert.ok(r.data.length >= 4);
  assert.equal(r.data.find((x) => x.action === "budget").to, 650);
});
await test("POST needs JSON", async () => {
  const r = await fetch(U("/api/status"), { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/x-www-form-urlencoded" }, body: "id=1" });
  assert.equal(r.status, 415);
});
await test("POST from another site refused", async () => {
  const before = posts.length;
  const r = await raw("/api/status", { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json", "Sec-Fetch-Site": "cross-site" }, body: JSON.stringify({ id: NUM.s1, status: "ACTIVE" }) });
  assert.equal(r.status, 403);
  assert.equal(posts.length, before);
});
await test("read-only mode blocks changes", async () => {
  const before = posts.length;
  const r = await api("/api/status", { method: "POST", body: { id: NUM.s1, status: "ACTIVE" }, port: base + 1 });
  assert.equal(r.status, 403);
  assert.equal(posts.length, before);
});
await test("without a Meta token the API says not connected", async () => {
  const r = await api("/api/tree", { port: base + 2 });
  assert.equal(r.status, 409);
  assert.equal(r.data.notConnected, true);
});

console.log("Browser code");
const jsFiles = [];
const walk = (d) => readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith(".js") && jsFiles.push(join(d, e.name))));
walk(join(root, "public", "js"));
await test(`${jsFiles.length} browser modules load`, async () => {
  globalThis.localStorage = { getItem: () => null, setItem: () => {} };
  for (const f of jsFiles) if (!f.endsWith("app.js")) await import(f);
});
const catalog = JSON.parse(readFileSync(join(root, "public", "data", "catalog.json"), "utf8"));
const pb = await import(join(root, "public", "js", "playbook.js"));
const model = await import(join(root, "public", "js", "model.js"));
await test("ad copy has live prices and no leftover {tokens}", async () => {
  for (const p of catalog.projects) {
    const entry = pb.PLAYBOOK[p.id];
    assert.ok(entry, `no playbook for ${p.id}`);
    for (const lang of ["en", "ar"]) for (const k of ["headline", "primary"]) assert.ok(!/[{}]/.test(pb.fill(entry.copy[lang][k], p)), `${p.id} ${lang} ${k}`);
  }
  const kr = catalog.projects.find((p) => p.id === "krypton");
  assert.match(pb.fill(pb.PLAYBOOK.krypton.copy.en.primary, kr), /From 7\.88M EGP, 5% \+ 5% down and 8 years to pay/);
  assert.match(pb.fill(pb.PLAYBOOK.krypton.copy.ar.primary, kr), /7\.88 مليون جنيه، مقدم 5% و5% وتقسيط على 8 سنين/);
});
await test("project found from campaign names", async () => {
  assert.equal(model.projectFromName("GD | Krypton | Leads | Broad | Nov", catalog)?.id, "krypton");
  assert.equal(model.projectFromName("GD | Golf Views | Leads", catalog)?.id, "golf-views");
  assert.equal(model.projectFromName("Seashell Ras El Hekma - lagoon - Dec", catalog)?.id, "seashell-rah");
  assert.equal(model.projectFromName("Brand awareness Nov", catalog), null);
});
await test("lead quality counts valid leads per ad set", async () => {
  const leads = [
    { created: "2026-11-15T10:00:00Z", stage: "interested", adsetId: "s", campaignId: "c" },
    { created: "2026-11-16T10:00:00Z", stage: "reserved", adsetId: "s", campaignId: "c" },
    { created: "2026-11-16T10:00:00Z", stage: "broker", adsetId: "s", campaignId: "c" },
    { created: "2026-11-17T10:00:00Z", stage: "new", adsetId: "s", campaignId: "c" },
    { created: "2026-10-01T10:00:00Z", stage: "sold", adsetId: "s", campaignId: "c" },
  ];
  const q = model.quality(leads, "2026-11-14", "2026-11-20");
  assert.equal(q.adset.s.leads, 4);
  assert.equal(q.adset.s.valid, 2);
  assert.equal(q.adset.s.reserved, 1);
  const s = model.score({ spend: 1000, leads: 4, convos: 0 }, q.adset.s);
  assert.equal(s.cpvl, 500);
  assert.equal(s.validRate, 2 / 3);
});
await test("Meta lead download (UTF-16, tabs) reads", async () => {
  const { readTable } = await import(join(root, "public", "js", "ui.js"));
  const text = "id\tcreated_time\tcampaign_name\tfull_name\tphone_number\r\nl:123456789012\t2026-11-20T10:00:00+02:00\tGD | Krypton | Leads\tTest Buyer\tp:+201000000000\r\n";
  const buf = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")]);
  const rows = await readTable({ arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length) });
  const lead = model.leadFromCsv(rows[0]);
  assert.equal(lead.metaId, "123456789012");
  assert.equal(lead.phone, "+201000000000");
  assert.equal(lead.campaignName, "GD | Krypton | Leads");
});
await test("targeting editor sends only what changed", async () => {
  const { _test } = await import(join(root, "public", "js", "views", "targeting.js"));
  const orig = { geo_locations: { countries: ["EG"], location_types: ["home"] }, age_min: 28, age_max: 65, flexible_spec: [{ interests: [{ id: "1", name: "Golf" }] }] };
  const st = { countries: ["EG"], regions: [], cities: [{ key: "9", name: "Riyadh" }], ageMin: 28, ageMax: 60, genders: [], interests: [{ id: "1", name: "Golf" }], work: [], include: [], exclude: [] };
  const patch = _test.buildPatch(orig, st);
  assert.deepEqual(Object.keys(patch).sort(), ["age_max", "geo_locations"]);
  assert.deepEqual(patch.geo_locations.cities, [{ key: "9" }]);
  assert.deepEqual(patch.geo_locations.location_types, ["home"]);
});

console.log("Who & where, A/B tests");
const places = await import(join(root, "public", "js", "places.js"));
await test("Meta governorate spellings land on the map", async () => {
  for (const [meta, map] of [["Cairo Governorate", "Cairo"], ["Al Qahirah", "Cairo"], ["Al Jizah", "Giza"], ["Ash Sharqiyah", "Al Sharqia"], ["Ad Daqahliyah", "Dakahlia"], ["Kafr ash Shaykh", "Kafr el-Sheikh"], ["Bur Sa'id", "Port Said"], ["Al Minufiyah", "Monufia"], ["Matruh", "Matrouh"], ["Janub Sina'", "South Sinai"], ["Al Bahr al Ahmar", "Red Sea"], ["Al Wadi al Jadid", "New Valley"], ["Bani Suwayf", "Beni Suef"], ["Riyadh Region", null]]) {
    assert.equal(places.govName(meta), map, meta);
  }
  const eg = JSON.parse(readFileSync(join(root, "public", "data", "egypt-map.json"), "utf8"));
  for (const name of Object.keys(eg.egypt.paths)) assert.equal(places.govName(name), name, `map name ${name}`);
});
await test("phone numbers give the lead's country", async () => {
  assert.deepEqual(["01001234567", "+20 100 123 4567", "+966 50 123 4567", "00971501234567", "+965 5123 4567", "+974 3312 3456", "+44 7700 900123", "12345", ""].map(places.phoneCountry), ["EG", "EG", "SA", "AE", "KW", "QA", "GB", null, null]);
});
const ab = await import(join(root, "public", "js", "views", "abtests.js"));
await test("A/B verdict: clear winner, too early, and a tie", async () => {
  const v1 = ab.verdict([{ id: "a", name: "A", spend: 10000, valid: 30 }, { id: "b", name: "B", spend: 10000, valid: 10 }], "valid");
  assert.equal(v1.kind, "winner");
  assert.equal(v1.lead.id, "a");
  assert.ok(v1.conf > 0.99);
  const v2 = ab.verdict([{ id: "a", name: "A", spend: 1000, valid: 3 }, { id: "b", name: "B", spend: 1000, valid: 2 }], "valid");
  assert.equal(v2.kind, "early");
  assert.ok(v2.moreSpend > 0);
  const v3 = ab.verdict([{ id: "a", name: "A", spend: 10000, valid: 21 }, { id: "b", name: "B", spend: 10000, valid: 19 }], "valid");
  assert.equal(v3.kind, "tie");
  assert.ok(Math.abs(ab.binomTwoSided(5, 10, 0.5) - 1) < 1e-9);
  assert.ok(ab.binomTwoSided(10, 10, 0.5) < 0.01);
});

const rep = await import(join(root, "public", "js", "views", "report.js"));
await test("weekly report: week-on-week arrows point the right way", async () => {
  assert.deepEqual(rep._test.delta(120, 100), { text: "▲ 20%", tone: "good" });
  assert.deepEqual(rep._test.delta(80, 100, true), { text: "▼ 20%", tone: "good" });
  assert.deepEqual(rep._test.delta(120, 100, true), { text: "▲ 20%", tone: "bad" });
  assert.equal(rep._test.delta(120, 100, false, true).tone, "");
  assert.equal(rep._test.delta(5, 0).text, "new");
  assert.equal(rep._test.addDays("2026-11-01", -7), "2026-10-25");
});

console.log("Demo mode");
const { createDemo } = await import(join(root, "public", "js", "demo.js"));
const demo = createDemo(catalog);
await test("demo tree for every date range adds up", async () => {
  for (const range of ["today", "yesterday", "last_7d", "last_30d", "this_month", "maximum"]) {
    const t = await demo.get("/api/tree", { range });
    assert.equal(t.demo, true);
    assert.match(t.account.name, /Demo/);
    for (const c of t.campaigns) {
      const sets = c.adsets.reduce((n, s) => n + (s.m?.spend || 0), 0);
      if (c.m) assert.ok(Math.abs(c.m.spend - sets) < 1, `${range} ${c.name} spend ${c.m.spend} vs ${sets}`);
      for (const s of c.adsets) {
        const ads = s.ads.reduce((n, a) => n + (a.m?.leads || 0) + (a.m?.convos || 0), 0);
        assert.equal((s.m?.leads || 0) + (s.m?.convos || 0), ads, `${range} ${s.name} leads`);
      }
    }
  }
});
await test("demo lead log matches the demo's Meta lead counts", async () => {
  const t = await demo.get("/api/tree", { range: "last_30d" });
  const { since, until } = model.treeDates(t);
  const metaLeads = t.campaigns.reduce((n, c) => n + (c.m?.leads || 0) + (c.m?.convos || 0), 0);
  const ymd = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const logged = demo.leads().filter((l) => ymd(l.created) >= since && ymd(l.created) <= until).length;
  assert.ok(metaLeads > 100, `only ${metaLeads} demo leads`);
  assert.ok(Math.abs(logged - metaLeads) <= Math.max(3, metaLeads * 0.02), `logged ${logged} vs Meta ${metaLeads}`);
  const q = model.quality(demo.leads(), since, until);
  assert.ok(q.total.valid > 10 && q.total.valid < q.total.leads, "valid leads should be some, not all");
  assert.ok(q.total.reserved > 0, "some reservations");
});
await test("demo switches, budgets and targeting change only the demo", async () => {
  const t = await demo.get("/api/tree", { range: "last_7d" });
  const c = t.campaigns[0];
  const s = c.adsets[0];
  await demo.post("/api/status", { id: c.id, status: "PAUSED" });
  let t2 = await demo.get("/api/tree", { range: "last_7d" });
  assert.equal(t2.campaigns[0].status, "PAUSED");
  assert.equal(t2.campaigns[0].adsets[0].effectiveStatus, "CAMPAIGN_PAUSED");
  await demo.post("/api/budget", { id: s.id, field: "daily_budget", amount: 950 });
  await demo.post("/api/targeting", { id: s.id, patch: { age_min: 33 } });
  t2 = await demo.get("/api/tree", { range: "last_7d" });
  assert.equal(t2.campaigns[0].adsets[0].dailyBudget, 950);
  assert.equal(t2.campaigns[0].adsets[0].targeting.ageMin, 33);
  assert.equal((await demo.get("/api/audit")).length, 3);
  demo.reset();
  assert.equal((await demo.get("/api/tree", { range: "last_7d" })).campaigns[0].status, "ACTIVE");
});
await test("demo delivery report adds up to the demo campaigns", async () => {
  const t = await demo.get("/api/tree", { range: "last_30d" });
  const bd = await demo.get("/api/breakdowns", { range: "last_30d" });
  const total = t.campaigns.reduce((s, c) => s + (c.m?.spend || 0), 0);
  const sum = (rows) => rows.reduce((s, r) => s + r.spend, 0);
  assert.ok(Math.abs(sum(bd.country) - total) < 2, `country ${sum(bd.country)} vs ${total}`);
  assert.ok(Math.abs(sum(bd.ageGender) - total) < 2, `age ${sum(bd.ageGender)} vs ${total}`);
  for (const r of bd.region) assert.ok(places.govName(r.region), `demo region ${r.region} matches the map`);
  const reach = await import(join(root, "public", "js", "views", "reach.js"));
  const tips = reach._test.findings(reach._test.audience(bd), reach._test.countries(bd, demo.leads()), reach._test.governorates(bd));
  assert.ok(tips.length >= 3, "findings appear");
});
await test("demo answers exact weeks for the report", async () => {
  const until = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d; })();
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const since = new Date(until); since.setDate(since.getDate() - 6);
  const wk = await demo.get("/api/tree", { range: "custom", since: ymd(since), until: ymd(until) });
  const l7 = await demo.get("/api/tree", { range: "last_7d" });
  const sp = (t) => Math.round(t.campaigns.reduce((s, c) => s + (c.m?.spend || 0), 0));
  assert.equal(sp(wk), sp(l7), "the last full week equals Meta's last 7 days");
  const text = rep._test.whatsappText({ since: ymd(since), until: ymd(until) }, rep._test.totals(wk, demo.leads(), ymd(since), ymd(until)), rep._test.totals(l7, demo.leads(), ymd(since), ymd(until)), [], { best: [], waste: [] }, "- Do this", "Omar");
  assert.match(text, /Weekly media report/);
  assert.match(text, /Next week:\n• Do this/);
});
await test("demo 'get new leads' brings Meta-shaped leads", async () => {
  const r = await demo.get("/api/leads", { since: 0 });
  assert.ok(r.leads.length >= 1);
  assert.ok(model.mergeMetaLeads.length >= 1);
  assert.match(r.leads[0].metaId, /^\d{16}$/);
});

for (const s of [main, ro, bare, nopass, messy]) s.child.kill();
graph.close();
console.log(failures ? `\n${failures} check(s) failed.` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);
