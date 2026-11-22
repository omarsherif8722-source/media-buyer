// Password-protected server for the G Developments media-buying dashboard.
// Adapted from the Hytech marketing dashboard server: nothing in public/ is
// sent until the visitor has signed in (sign-in page + signed cookie; Basic
// Auth for scripts). Fails closed: with no password configured, every request
// gets 503. /api/* talks to Meta with a token that never leaves the server.
// No dependencies; Node 20+.
import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { promisify } from "node:util";
import { brotliCompress, constants as zc, gzip } from "node:zlib";
import { extname, join, normalize, resolve, sep } from "node:path";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import * as meta from "./lib/meta.mjs";

const ROOT = resolve(new URL(".", import.meta.url).pathname, "public");
const PORT = Number(process.env.PORT) || 4173;
// Values pasted into Render's settings often carry a stray space or quote
// marks; strip them so the password typed at sign-in still matches.
const clean = (v) => String(v || "").trim().replace(/^(["'])(.*)\1$/s, "$2").trim();
const USER = clean(process.env.DASHBOARD_USER) || "media";
const PASS = clean(process.env.DASHBOARD_PASSWORD);

if (PASS.length < 12) {
  console.error("DASHBOARD_PASSWORD is missing or shorter than 12 characters — serving 503 to everyone.");
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8",
};

const digest = (s) => createHash("sha256").update(s).digest();
const same = (a, b) => timingSafeEqual(digest(a), digest(b));

// Text files are compressed once at start-up (brotli + gzip) and kept in memory,
// so phones on slow connections download roughly a quarter of the bytes. Fonts
// and images are already compressed and are streamed as they are.
const COMPRESSIBLE = new Set([".html", ".js", ".css", ".json", ".svg", ".webmanifest"]);
const packed = new Map(); // file path -> { size, mtimeMs, br, gzip }
const brotli = promisify(brotliCompress);
const gz = promisify(gzip);
const pack = async (dir) => {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) await pack(file);
    else if (COMPRESSIBLE.has(extname(file))) {
      const [raw, st] = await Promise.all([readFile(file), stat(file)]);
      if (raw.length < 1024) continue; // not worth it
      const [br, gzip_] = await Promise.all([
        brotli(raw, { params: { [zc.BROTLI_PARAM_QUALITY]: 9, [zc.BROTLI_PARAM_SIZE_HINT]: raw.length } }),
        gz(raw, { level: 9 }),
      ]);
      packed.set(file, { size: st.size, mtimeMs: st.mtimeMs, br, gzip: gzip_ });
    }
  }
};
// Until this finishes (or if it fails) files are simply served uncompressed.
pack(ROOT).catch((err) => console.error("Pre-compression skipped:", err.message));

// Slow down password guessing: max 10 failures per IP per 15 minutes.
const fails = new Map();
const WINDOW = 15 * 60 * 1000;
const MAX_TRACKED = 10_000;
// Render sits behind Cloudflare, which sets CF-Connecting-IP itself and
// overwrites anything the visitor sends. X-Forwarded-For is only the fallback:
// its first entry is whatever the visitor typed, so on its own it would let a
// guesser dodge the limit by changing the header on every try.
const clientIp = (req) =>
  String(req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "")
    .split(",")[0]
    .trim();
const blocked = (ip) => {
  const f = fails.get(ip);
  if (!f || Date.now() - f.since > WINDOW) return false;
  return f.n >= 10;
};
const recordFail = (ip) => {
  const f = fails.get(ip);
  if (!f || Date.now() - f.since > WINDOW) {
    fails.delete(ip);
    if (fails.size >= MAX_TRACKED) fails.delete(fails.keys().next().value); // drop the oldest
    fails.set(ip, { n: 1, since: Date.now() });
  } else f.n += 1;
};
// Forget expired entries so the list cannot grow for as long as the server runs.
setInterval(() => {
  const now = Date.now();
  for (const [ip, f] of fails) if (now - f.since > WINDOW) fails.delete(ip);
}, 60 * 1000).unref();

const SECURITY_HEADERS = {
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=31536000",
  "Cross-Origin-Opener-Policy": "same-origin",
  "X-DNS-Prefetch-Control": "off",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

// Chrome's install check and iOS's home-screen icon fetch often omit the
// Basic Auth header, so a password on these files blocks "Install app" and
// "Add to Home Screen". They are the name and the icon only — no
// dashboard figures. Exact paths, GET/HEAD only. HTML, JS, CSS and every
// other file still require the password, and nothing here is cached as app data.
const PUBLIC_INSTALL = new Set([
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/apple-touch-icon.png",
]);

// ------------------------------------------------------------ sign-in cookie
// A home-screen app does not remember a Basic Auth prompt, so browsers sign in
// on a small page that sets a signed, HttpOnly cookie (30 days, renewed while
// in use). Stateless: "v1.<expiry>.<signature>", signed with a key derived
// from the password — it survives restarts, and changing DASHBOARD_PASSWORD
// signs every device out. Basic Auth is still accepted for scripts.
const DAY = 24 * 60 * 60 * 1000;
const SESSION_MS = 30 * DAY;
const SESSION_KEY = createHmac("sha256", PASS).update(`g-media-buying-session:${USER}`).digest();
const sign = (exp) => createHmac("sha256", SESSION_KEY).update(`v1.${exp}`).digest("base64url");
const mintSession = () => {
  const exp = (Date.now() + SESSION_MS).toString(36);
  return `v1.${exp}.${sign(exp)}`;
};
/** Expiry time (ms) of a valid session cookie, or 0. */
const sessionExpiry = (token) => {
  const [v, exp, mac, extra] = String(token).split(".");
  if (v !== "v1" || !exp || !mac || extra !== undefined || !/^[0-9a-z]{1,12}$/.test(exp)) return 0;
  if (!same(mac, sign(exp))) return 0;
  const at = parseInt(exp, 36);
  return at > Date.now() ? at : 0;
};
// Browsers only send the cookie over HTTPS, except on a developer's own machine.
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
const cookieName = (secure) => (secure ? "__Host-gmb_session" : "gmb_session");
const cookieHeader = (secure, value, maxAgeSeconds) =>
  `${cookieName(secure)}=${value}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
const readCookie = (req, name) => {
  for (const part of String(req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return "";
};

// Sign-in page: self-contained (no scripts, no outside files), no figures.
const LOGIN_CSS = `
*{box-sizing:border-box}
html{background:#000;-webkit-text-size-adjust:100%}
body{margin:0;min-height:100vh;min-height:100dvh;display:grid;place-items:center;
  padding:max(24px,env(safe-area-inset-top)) 16px max(24px,env(safe-area-inset-bottom));color:#f5f5f7;
  font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Arabic",sans-serif;
  background:#000}
main{width:100%;max-width:380px}
.brand{display:flex;flex-direction:column;align-items:center;gap:14px;margin-bottom:22px;text-align:center}
.brand img{width:76px;height:76px;border-radius:18px;box-shadow:0 0 0 1px rgba(255,255,255,.08),0 14px 40px rgba(0,0,0,.5)}
h1{margin:0;font-size:21px;line-height:1.25;font-weight:650;letter-spacing:-.01em}
.sub{margin:4px 0 0;color:#98989d;font-size:14px}
form{display:grid;gap:14px;padding:20px;border:1px solid rgba(255,255,255,.1);border-radius:16px;background:#1c1c1e}
label{display:grid;gap:6px;font-size:13px;color:#aeaeb2}
label span{display:flex;justify-content:space-between;gap:12px}
input{width:100%;min-height:48px;padding:0 14px;border:1px solid rgba(255,255,255,.16);border-radius:10px;
  background:#000;color:#f5f5f7;font:inherit}
input:focus-visible{outline:2px solid #f08a7a;outline-offset:1px;border-color:transparent}
button{min-height:50px;margin-top:4px;border:0;border-radius:10px;background:#b3301f;color:#fff;font:inherit;font-weight:600;cursor:pointer}
button:hover{background:#8f2618}
button:focus-visible{outline:2px solid #fff;outline-offset:2px}
.pw{position:relative}
.pw input{padding-right:76px}
.pw button{position:absolute;right:6px;top:6px;min-height:36px;margin:0;padding:0 12px;background:#2c2c2e;font-size:13px}
.pw button:hover{background:#3a3a3c}
.err{margin:0;padding:10px 12px;border:1px solid rgba(235,93,118,.5);border-radius:10px;background:rgba(235,93,118,.1);color:#ffc2cc;font-size:14px}
.note{margin:16px 0 0;text-align:center;color:#98989d;font-size:12.5px}
`;
// The only script on the sign-in page: the Show / Hide password button.
const LOGIN_JS =
  'document.getElementById("show").addEventListener("click",function(){var p=document.getElementById("pw");var s=p.type==="password";p.type=s?"text":"password";this.textContent=s?"Hide":"Show";this.setAttribute("aria-pressed",String(s));p.focus();});';
const LOGIN_CSP =
  `default-src 'none'; style-src 'sha256-${createHash("sha256").update(LOGIN_CSS).digest("base64")}'; ` +
  `script-src 'sha256-${createHash("sha256").update(LOGIN_JS).digest("base64")}'; ` +
  "img-src 'self'; manifest-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";
const LOGIN_ERRORS = {
  wrong: ["Wrong username or password.", "اسم المستخدم أو كلمة المرور غير صحيحة."],
  blocked: ["Too many attempts. Try again in 15 minutes.", "محاولات كثيرة. حاول مرة أخرى بعد 15 دقيقة."],
};
const loginHtml = (error) => `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#000000">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="G Media">
<title>Sign in · G Developments Media Buying</title>
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">
<style>${LOGIN_CSS}</style>
</head>
<body>
<main>
<div class="brand">
<img src="/icons/icon.svg" width="76" height="76" alt="">
<div><h1>G Developments · Media buying</h1>
<p class="sub">Sign in to continue · <span lang="ar" dir="rtl">سجّل الدخول للمتابعة</span></p></div>
</div>
<form method="post" action="/login">
${
  LOGIN_ERRORS[error]
    ? `<p class="err" role="alert">${LOGIN_ERRORS[error][0]}<br><span lang="ar" dir="rtl">${LOGIN_ERRORS[error][1]}</span></p>`
    : ""
}
<label><span>Username <span lang="ar" dir="rtl">اسم المستخدم</span></span>
<input name="username" type="text" value="${htmlEscape(USER)}" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required></label>
<label><span>Password <span lang="ar" dir="rtl">كلمة المرور</span></span>
<div class="pw"><input id="pw" name="password" type="password" autocomplete="current-password" autocapitalize="none" autocorrect="off" spellcheck="false" required autofocus><button type="button" id="show" aria-pressed="false" aria-controls="pw">Show</button></div></label>
<button type="submit">Sign in · <span lang="ar" dir="rtl">دخول</span></button>
</form>
<p class="note">This device stays signed in for 30 days.<br>The password is the DASHBOARD_PASSWORD value in the service's Environment settings on Render.</p>
</main>
<script>${LOGIN_JS}</script>
</body>
</html>
`;
const htmlEscape = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const sendLogin = (req, res, status, error) => {
  const body = Buffer.from(loginHtml(error));
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store",
    "Content-Security-Policy": LOGIN_CSP,
  });
  res.end(req.method === "HEAD" ? undefined : body);
};
const redirect = (res, to, headers = {}) =>
  void res.writeHead(303, { Location: to, "Cache-Control": "no-store", ...headers }).end();
/** The submitted form as text, or null if it is larger than a login form can be. */
const readForm = (req) =>
  new Promise((done) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 4096) {
        done(null);
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on("end", () => done(Buffer.concat(chunks).toString()));
    req.on("error", () => done(null));
  });

const requestPath = (req) => {
  try {
    return decodeURIComponent(new URL(req.url || "/", "http://x").pathname);
  } catch {
    return null;
  }
};

// Serve one file that already lives under public/. No directory index and no
// single-page fallback — a missing icon must not return the dashboard HTML.
const sendFile = (req, res, file, st, cacheControl) => {
  const etag = `W/"${st.size.toString(36)}-${Math.round(st.mtimeMs).toString(36)}"`;
  const headers = {
    "Content-Type": TYPES[extname(file)] || "application/octet-stream",
    "Cache-Control": cacheControl,
    ETag: etag,
  };
  if (COMPRESSIBLE.has(extname(file))) headers.Vary = "Accept-Encoding";
  if (req.headers["if-none-match"] === etag) return void res.writeHead(304, headers).end();

  const p = packed.get(file);
  const accepts = String(req.headers["accept-encoding"] || "");
  const encoding =
    p && p.size === st.size && p.mtimeMs === st.mtimeMs
      ? /\bbr\b/.test(accepts)
        ? "br"
        : /\bgzip\b/.test(accepts)
          ? "gzip"
          : ""
      : "";
  if (encoding) {
    const body = p[encoding];
    res.writeHead(200, { ...headers, "Content-Encoding": encoding, "Content-Length": body.length });
    return void res.end(req.method === "HEAD" ? undefined : body);
  }
  res.writeHead(200, { ...headers, "Content-Length": st.size });
  if (req.method === "HEAD") return void res.end();
  const stream = createReadStream(file);
  stream.on("error", () => {
    if (!res.headersSent) res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }).end("Something went wrong.");
    else res.destroy();
  });
  // A phone that drops the connection mid-download must not leave the file open.
  res.on("close", () => stream.destroy());
  stream.pipe(res);
};

const sendPublicInstall = (req, res, pathname) => {
  const file = normalize(join(ROOT, pathname));
  if (file !== ROOT && !file.startsWith(ROOT + sep)) return void res.writeHead(400).end();
  let st;
  try {
    st = statSync(file);
    if (!st.isFile()) return void res.writeHead(404).end();
  } catch {
    return void res.writeHead(404).end();
  }
  sendFile(req, res, file, st, "public, max-age=86400");
};

// ------------------------------------------------------------ dashboard API
const sendJson = (res, status, data) => {
  const body = Buffer.from(JSON.stringify(data));
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Content-Length": body.length });
  res.end(body);
};
/** The posted JSON (max 64 KB), or null. */
const readJson = (req) =>
  new Promise((done) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 64 * 1024) {
        done(null);
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        done(JSON.parse(Buffer.concat(chunks).toString() || "{}"));
      } catch {
        done(null);
      }
    });
    req.on("error", () => done(null));
  });

// Meta reads are kept for a minute so switching tabs does not use up Meta's
// rate limit. Any change made from the dashboard clears this.
const treeCache = new Map();
const TREE_MS = 60 * 1000;

async function handleApi(req, res, urlPath) {
  const q = new URL(req.url || "/", "http://x").searchParams;
  if (req.method === "POST") {
    // Changes only from the dashboard itself: same site, JSON body.
    const site = req.headers["sec-fetch-site"];
    if (site && site !== "same-origin") return sendJson(res, 403, { error: "Forbidden." });
    if (!String(req.headers["content-type"] || "").startsWith("application/json")) return sendJson(res, 415, { error: "Send JSON." });
  } else if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed." });

  const route = `${req.method} ${urlPath}`;
  if (route === "GET /api/settings") return sendJson(res, 200, meta.settings());
  if (route === "GET /api/web-events") return sendJson(res, 200, { events: meta.getWebEvents() });
  if (route === "POST /api/web-event") {
    const evtBody = await readJson(req);
    if (!evtBody) return sendJson(res, 400, { error: "Could not read event." });
    return sendJson(res, 200, meta.recordWebEvent(evtBody));
  }
  if (!meta.configured()) return sendJson(res, 409, { error: "Meta is not connected yet.", notConnected: true });
  const body = req.method === "POST" ? await readJson(req) : null;
  if (req.method === "POST" && !body) return sendJson(res, 400, { error: "Could not read the request." });
  try {
    switch (route) {
      case "GET /api/tree": {
        const key = `${q.get("range")}|${q.get("since")}|${q.get("until")}`;
        const hit = treeCache.get(key);
        if (hit && Date.now() - hit.at < TREE_MS && q.get("fresh") !== "1") return sendJson(res, 200, { ...hit.data, cached: true });
        const data = await meta.tree(q.get("range") || "last_7d", q.get("since"), q.get("until"));
        treeCache.set(key, { at: Date.now(), data });
        return sendJson(res, 200, data);
      }
      case "GET /api/daily": {
        const key = `daily|${q.get("range")}|${q.get("since")}|${q.get("until")}`;
        const hit = treeCache.get(key);
        if (hit && Date.now() - hit.at < TREE_MS && q.get("fresh") !== "1") return sendJson(res, 200, { ...hit.data, cached: true });
        const data = await meta.daily(q.get("range") || "last_14d", q.get("since"), q.get("until"));
        treeCache.set(key, { at: Date.now(), data });
        return sendJson(res, 200, data);
      }
      case "GET /api/breakdowns": {
        const key = `bd|${q.get("range")}|${q.get("since")}|${q.get("until")}|${q.get("campaign") || ""}`;
        const hit = treeCache.get(key);
        if (hit && Date.now() - hit.at < TREE_MS && q.get("fresh") !== "1") return sendJson(res, 200, { ...hit.data, cached: true });
        const data = await meta.breakdowns(q.get("range") || "last_7d", q.get("since"), q.get("until"), q.get("campaign") || null);
        treeCache.set(key, { at: Date.now(), data });
        return sendJson(res, 200, data);
      }
      case "GET /api/payments": {
        const hit = treeCache.get("payments");
        if (hit && Date.now() - hit.at < TREE_MS && q.get("fresh") !== "1") return sendJson(res, 200, { ...hit.data, cached: true });
        const data = await meta.payments();
        treeCache.set("payments", { at: Date.now(), data });
        return sendJson(res, 200, data);
      }
      case "GET /api/health": {
        const hit = treeCache.get("health");
        if (hit && Date.now() - hit.at < TREE_MS && q.get("fresh") !== "1") return sendJson(res, 200, { ...hit.data, cached: true });
        const data = await meta.health();
        treeCache.set("health", { at: Date.now(), data });
        return sendJson(res, 200, data);
      }
      case "POST /api/copy":
        treeCache.clear();
        return sendJson(res, 200, await meta.copyObject(String(body.kind || ""), String(body.id || ""), body));
      case "POST /api/ad-version":
        treeCache.clear();
        return sendJson(res, 200, await meta.newAdVersion(String(body.id || ""), body));
      case "GET /api/rules":
        return sendJson(res, 200, await meta.rules());
      case "GET /api/rules/history":
        return sendJson(res, 200, await meta.rulesHistory());
      case "POST /api/rules":
        return sendJson(res, 200, await meta.createRule(String(body.preset || ""), body.params || {}));
      case "POST /api/rules/status":
        return sendJson(res, 200, await meta.setRuleStatus(String(body.id || ""), body.status));
      case "POST /api/rules/delete":
        return sendJson(res, 200, await meta.deleteRule(String(body.id || "")));
      case "GET /api/targeting":
        return sendJson(res, 200, await meta.targeting(q.get("id")));
      case "GET /api/search":
        return sendJson(res, 200, await meta.search(q.get("type"), q.get("q"), q.get("country")));
      case "GET /api/audiences":
        return sendJson(res, 200, await meta.audiences());
      case "GET /api/leads":
        return sendJson(res, 200, await meta.leads(Number(q.get("since"))));
      case "GET /api/audit":
        return sendJson(res, 200, meta.auditLog());
      case "POST /api/status":
        treeCache.clear();
        return sendJson(res, 200, await meta.setStatus(String(body.id || ""), body.status, body.kind));
      case "POST /api/budget":
        treeCache.clear();
        return sendJson(res, 200, await meta.setBudget(String(body.id || ""), body.field, body.amount));
      case "POST /api/targeting":
        treeCache.clear();
        return sendJson(res, 200, await meta.setTargeting(String(body.id || ""), body.patch));
      case "POST /api/lead-stage":
        return sendJson(res, 200, await meta.crmEvent(String(body.leadId || ""), body.event));
      default:
        return sendJson(res, 404, { error: "Unknown API route." });
    }
  } catch (err) {
    const status = err instanceof meta.MetaError ? err.status : 500;
    if (status === 500) console.error("API error:", err instanceof Error ? err.message : err);
    return sendJson(res, status, { error: err instanceof Error ? err.message : "Something went wrong.", code: err?.code ?? null });
  }
}

// The dashboard page may load only its own scripts; ad thumbnails come from Meta's image servers.
// Inline style attributes are allowed (layout only); inline scripts are not.
const APP_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; " +
  "connect-src 'self'; manifest-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'";

const server = createServer(async (req, res) => {
  try {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
  const ip = clientIp(req);

  if (req.url === "/healthz") return void res.writeHead(200).end("ok");
  if (PASS.length < 12) return void res.writeHead(503).end("Dashboard password not configured.");

  const urlPath = requestPath(req);
  if (urlPath && PUBLIC_INSTALL.has(urlPath) && (req.method === "GET" || req.method === "HEAD")) {
    return sendPublicInstall(req, res, urlPath);
  }

  const secure = !LOCAL_HOST.test(req.headers.host || "");
  const reading = req.method === "GET" || req.method === "HEAD";
  const expiry = sessionExpiry(readCookie(req, cookieName(secure)));

  if (urlPath === "/login") {
    if (reading) return expiry ? redirect(res, "/") : sendLogin(req, res, 200);
    if (req.method !== "POST") return void res.writeHead(405, { Allow: "GET, HEAD, POST" }).end();
    // A sign-in form posted from another website is refused.
    const site = req.headers["sec-fetch-site"];
    if (site && site !== "same-origin" && site !== "none") return void res.writeHead(403).end("Forbidden.");
    if (blocked(ip)) return sendLogin(req, res, 429, "blocked");
    const form = new URLSearchParams((await readForm(req)) ?? "");
    // Phones like to capitalise the first letter; the username is not the secret.
    const user = (form.get("username") || "").trim().toLowerCase();
    const typed = (form.get("password") || "").trim();
    const userOk = same(user, USER.toLowerCase());
    const passOk = same(typed, PASS);
    if (!(userOk & passOk)) {
      recordFail(ip);
      // A note in Render's log (never the password) to tell a typo from a wrong username.
      console.log(
        `SIGN-IN REFUSED: ${userOk ? "username ok" : `unknown username "${user.slice(0, 40)}"`}, ` +
          `${passOk ? "password ok" : `wrong password (typed ${typed.length} characters, ${typed.length === PASS.length ? "same length as" : "different length from"} the saved one)`}`,
      );
      return sendLogin(req, res, 401, blocked(ip) ? "blocked" : "wrong");
    }
    return redirect(res, "/", { "Set-Cookie": cookieHeader(secure, mintSession(), SESSION_MS / 1000) });
  }
  if (urlPath === "/logout") {
    if (!reading && req.method !== "POST") return void res.writeHead(405, { Allow: "GET, HEAD, POST" }).end();
    return redirect(res, "/login", { "Set-Cookie": cookieHeader(secure, "", 0) });
  }

  // Everything else needs the sign-in cookie (or Basic Auth from a script).
  // The lockout applies to guessing, not to a device that is already signed in.
  let ok = expiry > 0;
  if (!ok && blocked(ip)) return void res.writeHead(429).end("Too many attempts. Try again in 15 minutes.");
  const [scheme, token] = (req.headers.authorization || "").split(" ");
  if (!ok && scheme === "Basic" && token) {
    const raw = Buffer.from(token, "base64").toString();
    const i = raw.indexOf(":");
    ok = i > 0 && Boolean(same(raw.slice(0, i).trim().toLowerCase(), USER.toLowerCase()) & same(raw.slice(i + 1).trim(), PASS));
  }
  if (!ok) {
    if (scheme === "Basic") recordFail(ip);
    // No WWW-Authenticate: a browser shows the sign-in page, not a pop-up.
    const opening =
      reading &&
      (req.headers["sec-fetch-mode"] === "navigate" ||
        (!req.headers["sec-fetch-mode"] && String(req.headers.accept || "").includes("text/html")));
    if (opening) return sendLogin(req, res, 401);
    return void res.writeHead(401, { "Content-Type": "text/plain", "Cache-Control": "no-store" }).end("Login required.");
  }

  if (urlPath === null) return void res.writeHead(400).end();
  if (urlPath.startsWith("/api/")) return void (await handleApi(req, res, urlPath));
  if (req.method !== "GET" && req.method !== "HEAD") return void res.writeHead(405).end();
  let file = normalize(join(ROOT, urlPath));
  if (file !== ROOT && !file.startsWith(ROOT + sep)) return void res.writeHead(400).end();
  let st;
  try {
    st = statSync(file);
    if (st.isDirectory()) {
      file = join(file, "index.html");
      st = statSync(file);
    }
  } catch {
    // A missing script, style, font or image is "not found" — answering with
    // the dashboard page instead makes the browser fail on it silently.
    if (extname(urlPath)) {
      return void res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }).end("Not found.");
    }
    file = join(ROOT, "index.html"); // single-page app fallback
    st = statSync(file);
  }
  const hashed = file.includes(`${sep}assets${sep}`);
  const ext = extname(file);
  // Hashed build files can stay in the browser. HTML is never stored: it is
  // the door to the figures, and a shared cache must not keep it.
  const cache = hashed
    ? "private, max-age=31536000, immutable"
    : ext === ".html"
      ? "private, no-store"
      : "private, no-cache";
  if (ext === ".html") res.setHeader("Content-Security-Policy", APP_CSP);
  // Keep a device that is in use signed in: renew the cookie about once a day.
  if (ext === ".html" && expiry && expiry - Date.now() < SESSION_MS - DAY) {
    res.setHeader("Set-Cookie", cookieHeader(secure, mintSession(), SESSION_MS / 1000));
  }
  sendFile(req, res, file, st, cache);
  } catch (err) {
    console.error("Request failed:", err instanceof Error ? err.message : err);
    if (!res.headersSent) res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }).end("Something went wrong.");
    else {
      try {
        res.end();
      } catch {
        /* the response is already finished */
      }
    }
  }
});

server.on("clientError", (_err, socket) => {
  if (socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
});
server.listen(PORT, "0.0.0.0", () => console.log(`G media-buying dashboard on port ${PORT} (password protected, Meta ${meta.configured() ? "connected" : "not connected"})`));
