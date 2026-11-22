// App shell: sidebar and phone tab bar, routing, the date range, and loading
// data from the server (settings + Meta campaigns) and the website catalog.
import { html, raw, $, toast, setCurrency, promptDialog } from "./ui.js";
import { get, setDemoBackend } from "./api.js";
import { load, save, loadGlobal, saveGlobal, isDemo, setDemo, clearDemo } from "./store.js";
import { allLeads, onLeads, reloadLeads, replaceAll } from "./model.js";
import { createDemo, DEMO_TARGETS } from "./demo.js";
import * as overview from "./views/overview.js";
import * as geo from "./views/geo.js";
import * as reach from "./views/reach.js";
import * as abtests from "./views/abtests.js";
import * as report from "./views/report.js";
import * as trends from "./views/trends.js";
import * as rules from "./views/rules.js";
import * as health from "./views/health.js";
import * as creatives from "./views/creatives.js";
import * as brief from "./views/brief.js";
import * as forms from "./views/forms.js";
import * as payments from "./views/payments.js";
import * as website from "./views/website.js";
import * as campaigns from "./views/campaigns.js";
import * as planner from "./views/planner.js";
import * as leads from "./views/leads.js";
import * as audiences from "./views/audiences.js";
import * as messages from "./views/messages.js";
import * as links from "./views/links.js";
import * as inventory from "./views/inventory.js";
import * as guide from "./views/guide.js";

const I = {
  home: '<path d="M3 11.5 12 4l9 7.5M5 10v10h14V10"/>',
  map: '<path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20V6.5Z"/><path d="M9 4v13.5M15 6.5V20"/>',
  web: '<circle cx="12" cy="12" r="9"/><path d="M3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  ads: '<path d="M4 13V7l12-4v14L4 13Zm0 0 2 7h3l-1.5-6M19 8.5a3 3 0 0 1 0 5"/>',
  plan: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  leads: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.6c1.7.8 2.7 2.6 3 5.4"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3"/>',
  msg: '<path d="M4 5h16v11H8l-4 4V5Z"/><path d="M8 9h8M8 12h5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  box: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z"/><path d="m3 7.5 9 4.5 9-4.5M12 12v9"/>',
  book: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H4V4ZM20 4h-6a3 3 0 0 0-3 3"/><path d="M20 4v13.5h-6.5A2.5 2.5 0 0 0 11 20"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
};
const icon = (k) => raw(`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[k]}</svg>`);

const VIEWS = [
  { id: "brief", label: "Morning brief", icon: "book", mod: brief },
  { id: "overview", label: "Command Center", icon: "home", mod: overview },
  { id: "geo", label: "Egypt & GCC Map", icon: "map", group: "Intelligence", mod: geo },
  { id: "reach", label: "Who & where", icon: "web", group: "Intelligence", mod: reach },
  { id: "creatives", label: "Creative library", icon: "msg", group: "Intelligence", mod: creatives },
  { id: "website", label: "Website Funnel", icon: "web", group: "Intelligence", mod: website },
  { id: "campaigns", label: "Campaigns", icon: "ads", group: "Ads", mod: campaigns },
  { id: "trends", label: "Trends & fatigue", icon: "plan", group: "Ads", mod: trends },
  { id: "abtests", label: "A/B tests", icon: "plan", group: "Ads", mod: abtests },
  { id: "rules", label: "Automatic rules", icon: "plan", group: "Ads", mod: rules },
  { id: "health", label: "Account health", icon: "plan", group: "Ads", mod: health },
  { id: "payments", label: "Payments", icon: "box", group: "Ads", mod: payments },
  { id: "planner", label: "Budget planner", icon: "plan", group: "Ads", mod: planner },
  { id: "report", label: "Weekly report", icon: "book", group: "Ads", mod: report },
  { id: "leads", label: "Leads & CRM", icon: "leads", group: "Buyers", mod: leads },
  { id: "forms", label: "Form answers", icon: "leads", group: "Buyers", mod: forms },
  { id: "audiences", label: "Audiences", icon: "target", group: "Buyers", mod: audiences },
  { id: "messages", label: "Messages & Copy", icon: "msg", group: "Content", mod: messages },
  { id: "links", label: "Tracked links", icon: "link", group: "Content", mod: links },
  { id: "inventory", label: "What to sell", icon: "box", group: "Product", mod: inventory },
  { id: "guide", label: "Playbook", icon: "book", group: "Guide", mod: guide },
];
const PHONE_TABS = ["brief", "overview", "campaigns", "leads"];

export const PERIODS = [
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["last_7d", "7 days"],
  ["last_14d", "14 days"],
  ["last_30d", "30 days"],
  ["last_60d", "60 days"],
  ["last_90d", "90 days"],
  ["this_month", "This month"],
  ["maximum", "Lifetime"],
];

const ctx = {
  catalog: null,
  settings: null,
  tree: null,
  treeError: null,
  treeLoading: false,
  period: load("period", "last_7d"),
  view: "overview",
  params: [],
  setPeriod(p) {
    ctx.period = p;
    save("period", p);
    ctx.loadTree();
  },
  async loadTree(force = false) {
    if (!ctx.settings?.connected) return;
    ctx.treeLoading = true;
    ctx.render();
    try {
      // Meta's delivery report by region, country, age and gender loads alongside;
      // if it fails, the campaigns still show.
      const [tree, bd, health] = await Promise.all([
        get("/api/tree", { range: ctx.period, fresh: force ? 1 : "" }),
        get("/api/breakdowns", { range: ctx.period, fresh: force ? 1 : "" }).then(
          (v) => ({ v }),
          (e) => ({ e }),
        ),
        // Problems that stop delivery (rejected ads, billing, spending limit).
        get("/api/health", { fresh: force ? 1 : "" }).catch(() => null),
      ]);
      ctx.health = health;
      ctx.tree = tree;
      ctx.breakdowns = bd.v || null;
      ctx.breakdownsError = bd.e ? bd.e.message : null;
      ctx.treeError = null;
      setCurrency(ctx.tree.account?.currency);
    } catch (e) {
      ctx.treeError = e.message;
      if (force) toast(e.message, "bad");
    } finally {
      ctx.treeLoading = false;
      ctx.render();
    }
  },
  go(path) {
    location.hash = `#/${path}`;
  },
  render,
  periodSwitch() {
    return html`<div class="seg" role="group" aria-label="Dates">${PERIODS.map(([v, l]) => html`<button type="button" data-period="${v}" aria-pressed="${ctx.period === v}">${l}</button>`)}</div>`;
  },
  refreshButton() {
    return html`<button class="btn icon" type="button" data-refresh title="Refresh from Meta" aria-label="Refresh from Meta">${ctx.treeLoading ? raw('<span class="spin"></span>') : raw('<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/></svg>')}</button>`;
  },
};

function route() {
  const parts = (location.hash.replace(/^#\/?/, "") || "overview").split("/").map(decodeURIComponent);
  ctx.view = VIEWS.some((v) => v.id === parts[0]) ? parts[0] : "overview";
  ctx.params = parts.slice(1);
}

function waitingCount() {
  return allLeads().filter((l) => l.stage === "new").length;
}

const G_MARK = raw('<svg viewBox="0 0 32 33" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M17.06 19.61V14.89H30.83V31.51H26.58L25.76 27.44C23.51 30.65 20.18 32.21 15.72 32.21C11.26 32.21 7.71 30.73 5.03 27.79C2.34 24.85 1 20.95 1 16.1C1 11.26 2.34 7.36 5.11 4.37C7.84 1.47 11.56 0 16.24 0C20.09 0 23.29 1 25.89 2.94C28.4 4.93 29.96 7.58 30.48 10.95H24.46C24.03 9.13 23.08 7.71 21.61 6.67C20.13 5.63 18.36 5.11 16.28 5.11C13.42 5.11 11.22 6.1 9.57 8.05C7.93 10.04 7.1 12.73 7.1 16.1C7.1 19.52 7.93 22.21 9.62 24.16C11.26 26.15 13.55 27.1 16.5 27.1C18.79 27.1 20.78 26.41 22.43 25.02C24.07 23.64 24.94 21.86 25.11 19.61H17.06Z"/></svg>');

const DEFAULT_CLIENTS = [
  { id: "mahmoud-gdev", name: "Mahmoud Elhemaly", brand: "G Developments", portalUrl: "./client/" },
];

function getClients() {
  return loadGlobal("agency.clients", DEFAULT_CLIENTS);
}
function getActiveClient() {
  const list = getClients();
  const id = loadGlobal("agency.activeClient", "mahmoud-gdev");
  return list.find((c) => c.id === id) || list[0];
}

function shell() {
  const groups = [];
  for (const v of VIEWS) {
    const g = v.group || "";
    if (!groups.length || groups[groups.length - 1].name !== g) groups.push({ name: g, items: [] });
    groups[groups.length - 1].items.push(v);
  }
  const theme = loadGlobal("theme", "system");
  const clients = getClients();
  const activeClient = getActiveClient();
  return html`
  <div class="shell">
    <nav class="side" aria-label="Sections">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true">${G_MARK}</div>
        <div>
          <b>Omar Sherif</b>
          <span>Media Buying Command Center</span>
        </div>
      </div>
      <div style="padding:8px;border-radius:10px;background:var(--bg-2);border:1px solid var(--line);display:grid;gap:6px">
        <div class="row between">
          <span class="tiny muted" style="font-weight:650;text-transform:uppercase;letter-spacing:0.04em">Client Account</span>
          <button class="btn sm ghost" type="button" data-add-client style="min-height:22px;padding:1px 6px;font-size:11px">+ Add Client</button>
        </div>
        <select class="input" data-client-switch aria-label="Active Client Account" style="min-height:30px;padding:3px 8px;font-weight:650;font-size:12.5px">
          ${clients.map((c) => html`<option value="${c.id}" ${c.id === activeClient.id ? raw("selected") : ""}>${c.name} · ${c.brand}</option>`)}
        </select>
        <a class="btn sm primary" href="./client/" target="_blank" rel="noopener" style="width:100%;justify-content:center">
          Open Client Portal (${activeClient.name.split(" ")[0]}) ↗
        </a>
      </div>
      ${groups.map(
        (g) => html`<div class="nav-group">${g.name ? html`<span>${g.name}</span>` : ""}<div class="nav">${g.items.map(
          (v) => html`<a href="#/${v.id}" data-nav="${v.id}">${icon(v.icon)}<span>${v.label}</span>${v.id === "leads" ? html`<span class="count" data-waiting hidden></span>` : ""}</a>`,
        )}</div></div>`,
      )}
      <div class="side-foot">
        <div data-conn class="small"></div>
        <div class="row"><button class="btn sm ghost" type="button" data-theme-toggle>Theme: ${theme}</button><a class="btn sm ghost" href="/logout">Sign out</a></div>
      </div>
    </nav>
    <div class="content">
      <header class="appbar">
        <div class="appbar-brand"><div class="brand-mark" aria-hidden="true">${G_MARK}</div><b>Omar Sherif · Media Buyer</b></div>
        <div class="appbar-status small" data-appbar-status></div>
        <a class="btn sm" href="./client/" target="_blank" rel="noopener" title="Open Mahmoud Elhemaly's Client Lead & Results Portal">Client Portal (Mahmoud) ↗</a>
        <div class="demo-switch"><span id="demo-label">Demo</span><button type="button" class="switch" role="switch" aria-checked="false" aria-labelledby="demo-label" data-demo-toggle title="Show made-up campaigns and leads"></button></div>
      </header>
      <div class="demo-banner" data-demo-banner hidden><div><b>Demo account active.</b> Full interactive G Developments simulation (6 campaigns, 45 days of daily data, Egypt &amp; GCC geo attribution, website funnel, and 2,000+ graded leads). Switches, budgets and retargeting edits work live in the browser without touching Meta.</div><button class="btn sm" type="button" data-demo-reset>Reset demo</button></div>
      <a class="health-banner" data-health-banner href="#/health" hidden></a>
      <main class="main" id="main" tabindex="-1"></main>
    </div>
    <nav class="tabbar" aria-label="Sections">
      ${PHONE_TABS.map((id) => VIEWS.find((v) => v.id === id)).map((v) => html`<a href="#/${v.id}" data-nav="${v.id}">${icon(v.icon)}<span>${v.label}</span></a>`)}
      <button type="button" data-more>${icon("more")}<span>More</span></button>
    </nav>
    <div class="more-sheet" data-sheet>${VIEWS.filter((v) => !PHONE_TABS.includes(v.id)).map((v) => html`<a href="#/${v.id}" data-nav="${v.id}">${v.label}</a>`)}<a href="/logout">Sign out</a></div>
  </div>`;
}

function render() {
  const main = $("#main");
  if (!main) return;
  const v = VIEWS.find((x) => x.id === ctx.view);
  document.title = `${v.label} · G Developments Media Command`;
  for (const a of document.querySelectorAll("[data-nav]")) {
    if (a.dataset.nav === ctx.view) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  const w = waitingCount();
  const badge = $("[data-waiting]");
  if (badge) {
    badge.hidden = !w;
    badge.textContent = w;
  }
  const demo = isDemo();
  const sw = $("[data-demo-toggle]");
  if (sw) sw.setAttribute("aria-checked", String(demo));
  const hb = $("[data-health-banner]");
  if (hb) {
    const items = (ctx.health?.items || []).filter((x) => x.tone === "bad" || x.tone === "warn");
    hb.hidden = !items.length || ctx.view === "health";
    hb.className = `health-banner ${items.some((x) => x.tone === "bad") ? "bad" : "warn"}`;
    hb.innerHTML = items.length ? html`<b>${items.length} problem${items.length > 1 ? "s" : ""} may be stopping your ads:</b> ${items.slice(0, 2).map((x) => `${x.problem}${x.level !== "account" ? ` (${x.name})` : ""}`).join(" · ")}${items.length > 2 ? " · …" : ""} <span class="hb-go">See account health →</span>`.s : "";
  }
  const banner = $("[data-demo-banner]");
  if (banner) banner.hidden = !demo;
  document.documentElement.classList.toggle("is-demo", demo);
  const status = $("[data-appbar-status]");
  const periodSpend = (ctx.tree?.campaigns || []).reduce((s, c) => s + (c.m?.spend || 0), 0);
  const lifeSpend = ctx.tree?.account?.amountSpent || null;
  const periodLabel = PERIODS.find(([k]) => k === ctx.period)?.[1] || ctx.period;
  const spendBadge = ctx.tree ? html`<span class="pill accent">Spent (${periodLabel}): <b>${ raw(new Intl.NumberFormat("en-US").format(Math.round(periodSpend))) } ${ctx.tree.account?.currency || "EGP"}</b></span>${lifeSpend ? html` <span class="pill line">95d Total: <b>${ raw(new Intl.NumberFormat("en-US").format(Math.round(lifeSpend))) } ${ctx.tree.account?.currency || "EGP"}</b></span>` : ""}` : "";
  if (status) status.innerHTML = demo ? html`<span class="pill warn">Demo account</span> ${spendBadge}`.s : ctx.settings?.connected ? html`<span class="pill good">Meta connected</span> <span class="muted">${ctx.tree?.account?.name || ""}</span> ${spendBadge}`.s : ctx.settings ? html`<span class="pill line">Meta not connected (Switch Demo ON to explore)</span>`.s : "";
  const conn = $("[data-conn]");
  if (conn) {
    const s = ctx.settings;
    conn.innerHTML = !s
      ? ""
      : demo
        ? html`<span class="pill warn">Demo data</span>`.s
        : s.connected
        ? html`<span class="pill good">Meta connected</span> ${s.readOnly ? html`<span class="pill warn">Read-only</span>` : ""}<div class="tiny faint" style="margin-top:4px">${ctx.tree?.account?.name || s.account}</div>`.s
        : html`<span class="pill warn">Meta not connected</span>`.s;
  }
  try {
    const keep = main.scrollTop;
    main.onclick = main.oninput = main.onchange = main.onkeydown = main.onsubmit = main.onpointermove = main.onpointerleave = main.onfocusin = main.onfocusout = null;
    main.innerHTML = v.mod.render(ctx).s;
    v.mod.mount?.(main, ctx);
    main.scrollTop = keep;
  } catch (err) {
    console.error(err);
    main.innerHTML = html`<div class="card"><h2>Something went wrong on this screen</h2><p class="muted">${err.message}</p></div>`.s;
  }
}

function bindShell() {
  document.addEventListener("click", (e) => {
    const p = e.target.closest("[data-period]");
    if (p) return ctx.setPeriod(p.dataset.period);
    if (e.target.closest("[data-refresh]")) return ctx.loadTree(true);
    if (e.target.closest("[data-demo-toggle]")) return switchDemo(!isDemo());
    if (e.target.closest("[data-demo-reset]")) {
      seedDemo(true);
      ctx.tree = null;
      ctx.loadTree();
      return toast("Demo reset.", "good");
    }
    if (e.target.closest("[data-more]")) return $("[data-sheet]").classList.toggle("open");
    if (e.target.closest("[data-sheet] a")) $("[data-sheet]").classList.remove("open");
    const t = e.target.closest("[data-theme-toggle]");
    if (t) {
      const order = ["system", "light", "dark"];
      const next = order[(order.indexOf(loadGlobal("theme", "system")) + 1) % 3];
      saveGlobal("theme", next);
      applyTheme();
      t.textContent = `Theme: ${next}`;
    }
    const addClientBtn = e.target.closest("[data-add-client]");
    if (addClientBtn) {
      promptDialog({
        title: "Add New Client Account (Omar Sherif Agency)",
        body: "Enter the client and brand name (e.g. 'Ahmed Mansour · Palm Hills' or 'Karim Tarek · Mountain View')",
        label: "Client · Developer Brand",
        value: "",
        ok: "Add Client Account",
      }).then((val) => {
        if (!val || !val.trim()) return;
        const parts = val.split("·").map((s) => s.trim());
        const name = parts[0] || val.trim();
        const brand = parts[1] || "Real Estate Advisory";
        const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now().toString(36).slice(-3);
        const list = getClients();
        list.push({ id, name, brand, portalUrl: "./client/" });
        saveGlobal("agency.clients", list);
        saveGlobal("agency.activeClient", id);
        document.getElementById("app").innerHTML = shell().s;
        render();
        toast(`Switched to client account: ${name} (${brand})`, "good");
      });
    }
  });
  document.addEventListener("change", (e) => {
    if (e.target.matches("[data-client-switch]")) {
      const id = e.target.value;
      saveGlobal("agency.activeClient", id);
      const active = getActiveClient();
      document.getElementById("app").innerHTML = shell().s;
      render();
      toast(`Active client: ${active.name} · ${active.brand}`, "good");
    }
  });
  window.addEventListener("hashchange", () => {
    const before = ctx.view;
    route();
    render();
    if (before !== ctx.view) window.scrollTo(0, 0);
  });
  onLeads(() => render());
}

function applyTheme() {
  const t = loadGlobal("theme", "system");
  if (t === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.dataset.theme = t;
}

// ---------------------------------------------------------------- demo mode
let demoBackend = null;
/** Fills the demo with made-up leads (first time, or on "Reset demo"). */
function seedDemo(force = false) {
  if (!demoBackend || !isDemo()) return;
  if (force) {
    clearDemo();
    demoBackend.reset();
  }
  if (force || !load("seeded", false)) {
    save("targets", DEMO_TARGETS);
    save("seeded", true);
    replaceAll(demoBackend.leads());
  }
}
async function switchDemo(on) {
  setDemo(on);
  ctx.period = load("period", "last_7d");
  seedDemo();
  reloadLeads();
  ctx.tree = null;
  ctx.breakdowns = null;
  ctx.health = null;
  ctx.treeError = null;
  ctx.settings = null;
  render();
  try {
    ctx.settings = await get("/api/settings");
  } catch {
    ctx.settings = { connected: false };
  }
  render();
  toast(on ? "Demo on: interactive simulation active." : "Demo off: your real data.", on ? "" : "good");
  if (ctx.settings.connected) ctx.loadTree();
}

async function start() {
  applyTheme();
  route();
  document.getElementById("app").innerHTML = shell().s;
  bindShell();
  render();
  const [catalog, settings] = await Promise.allSettled([fetch("./data/catalog.json", { credentials: "same-origin" }).then((r) => r.json()), get("/api/settings")]);
  ctx.catalog = catalog.status === "fulfilled" ? catalog.value : { projects: [], regions: [], site: {} };
  demoBackend = createDemo(ctx.catalog);
  setDemoBackend(demoBackend);
  const realSettings = settings.status === "fulfilled" ? settings.value : { connected: false };
  // If Meta is not connected yet and the user hasn't explicitly chosen demo=false, start in Demo mode so all visualizations work immediately
  if (!realSettings.connected && loadGlobal("demo", null) === null) {
    setDemo(true);
  }
  if (isDemo()) {
    seedDemo();
    ctx.settings = await get("/api/settings");
  } else {
    ctx.settings = realSettings;
  }
  render();
  if (ctx.settings.connected) ctx.loadTree();
}
start();
