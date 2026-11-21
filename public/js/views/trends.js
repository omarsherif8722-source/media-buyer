// Trends & fatigue: the account day by day (spend, leads, cost per lead, valid
// leads, cost per valid lead, CTR) and a fatigue check on every ad. An ad is
// tired when fewer people click it in the second half of the period than in
// the first, while the same people keep seeing it (high frequency) or its
// leads get dearer. Those ads need a new creative.
import { html, raw, money, n, pct, toast, confirmDialog, $ } from "../ui.js";
import { get, post } from "../api.js";
import { allLeads, isValid } from "../model.js";
import { connectCard, loadingCard, statusPill } from "./common.js";

let range = "last_14d"; // last_14d | last_30d | last_60d
let campaign = "";
const cache = new Map(); // range -> { daily, tree } | { error }
let pending = "";

function load(ctx) {
  if (cache.has(range) || pending === range) return cache.get(range);
  pending = range;
  const r = range;
  Promise.all([get("/api/daily", { range: r }), get("/api/tree", { range: r })])
    .then(([daily, tree]) => cache.set(r, { daily, tree }))
    .catch((e) => cache.set(r, { error: e.message }))
    .finally(() => {
      pending = "";
      ctx.render();
    });
  return null;
}

// ---------------------------------------------------------------- shaping
const ymdList = (a, b) => {
  const out = [];
  const d = new Date(`${a}T00:00:00`);
  const end = new Date(`${b}T00:00:00`);
  while (d <= end) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    d.setDate(d.getDate() + 1);
  }
  return out;
};

function series(data, campaignId) {
  const rows = (data.daily.rows || []).filter((r) => !campaignId || r.campaignId === campaignId);
  const dates = rows.map((r) => r.date).sort();
  if (!dates.length) return [];
  const since = data.daily.range?.since || dates[0];
  const until = data.daily.range?.until || dates[dates.length - 1];
  const days = ymdList(since < dates[0] ? since : dates[0], until > dates[dates.length - 1] ? until : dates[dates.length - 1]);
  const by = Object.fromEntries(days.map((d) => [d, { date: d, spend: 0, impressions: 0, clicks: 0, leads: 0, valid: 0 }]));
  for (const r of rows) {
    const x = by[r.date];
    if (!x) continue;
    x.spend += r.spend || 0;
    x.impressions += r.impressions || 0;
    x.clicks += r.clicks || 0;
    x.leads += (r.leads || 0) + (r.convos || 0);
  }
  for (const l of allLeads()) {
    if (campaignId && l.campaignId !== campaignId) continue;
    const x = by[String(l.created || "").slice(0, 10)];
    if (x && isValid(l.stage)) x.valid += 1;
  }
  const list = days.map((d) => by[d]);
  // Seven-day averages smooth the costs, which jump around day to day.
  list.forEach((x, i) => {
    const w = list.slice(Math.max(0, i - 6), i + 1);
    const s = w.reduce((t, y) => t + y.spend, 0);
    const l = w.reduce((t, y) => t + y.leads, 0);
    const v = w.reduce((t, y) => t + y.valid, 0);
    x.cpl7 = l ? s / l : null;
    x.cpvl7 = v ? s / v : null;
    x.ctr = x.impressions ? (x.clicks / x.impressions) * 100 : null;
  });
  return list;
}

/** Last 7 days against the 7 before, for one measure. */
function weekChange(list, f, sumMode) {
  if (list.length < 14) return null;
  const a = list.slice(-14, -7);
  const b = list.slice(-7);
  const val = (w) => (sumMode ? w.reduce((t, x) => t + (f(x) || 0), 0) : f(w[w.length - 1]));
  const pa = val(a);
  const pb = val(b);
  if (!pa || pb === null || pb === undefined) return null;
  return (pb - pa) / Math.abs(pa);
}

// Frequency builds up over the period, so the bar rises with the window.
export const FREQ_WATCH = { last_14d: 4, last_30d: 5, last_60d: 6 };

export function fatigue(rows, freqOf, freqWatch = 4) {
  const byAd = {};
  for (const r of rows) (byAd[r.adId] ??= []).push(r);
  return Object.entries(byAd).map(([adId, list]) => {
    const days = list.filter((r) => r.impressions > 0).sort((a, b) => a.date.localeCompare(b.date));
    const imps = days.reduce((t, r) => t + r.impressions, 0);
    const spend = days.reduce((t, r) => t + r.spend, 0);
    const base = { adId, adName: list[0].adName, campaignId: list[0].campaignId, adsetId: list[0].adsetId, spend, imps, days, freq: freqOf(adId) };
    if (days.length < 6 || imps < 3000) return { ...base, state: "little", why: "Not enough data yet" };
    const half = Math.floor(days.length / 2);
    const sum = (w, k) => w.reduce((t, r) => t + (r[k] || 0), 0);
    const f = days.slice(0, half);
    const l = days.slice(days.length - half);
    const ctr1 = (sum(f, "clicks") / Math.max(1, sum(f, "impressions"))) * 100;
    const ctr2 = (sum(l, "clicks") / Math.max(1, sum(l, "impressions"))) * 100;
    const leads = (w) => sum(w, "leads") + sum(w, "convos");
    const cpl1 = leads(f) >= 3 ? sum(f, "spend") / leads(f) : null;
    const cpl2 = leads(l) >= 3 ? sum(l, "spend") / leads(l) : null;
    const drop = ctr1 > 0 ? (ctr1 - ctr2) / ctr1 : 0;
    const rise = cpl1 && cpl2 ? (cpl2 - cpl1) / cpl1 : null;
    const freq = base.freq;
    let state = "fresh";
    const why = [];
    if (drop >= 0.15) why.push(`CTR fell ${pct(drop * 100, 0)} (${ctr1.toFixed(2)}% → ${ctr2.toFixed(2)}%)`);
    if (rise !== null && rise >= 0.3) why.push(`cost per lead rose ${pct(rise * 100, 0)}`);
    if (freq >= freqWatch) why.push(`frequency ${freq.toFixed(1)}`);
    if ((drop >= 0.25 && (freq >= freqWatch - 1 || (rise !== null && rise >= 0.3))) || drop >= 0.35) state = "tired";
    else if (drop >= 0.15 || freq >= freqWatch || (rise !== null && rise >= 0.3)) state = "watch";
    if (state === "fresh") why.push(`CTR steady at ${ctr2.toFixed(2)}%`);
    return { ...base, state, ctr1, ctr2, cpl1, cpl2, drop, rise, why: why.join(", ") };
  });
}

// ---------------------------------------------------------------- charts (one measure each, one axis)
const W = 320;
const H = 118;
const PAD = { l: 40, r: 10, t: 10, b: 20 };

function chart(list, key, fmt, label) {
  const vals = list.map((x) => x[key]);
  const nums = vals.filter((v) => v !== null && v !== undefined && Number.isFinite(v));
  const max = Math.max(1e-9, ...nums) * 1.12;
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const x = (i) => PAD.l + (list.length > 1 ? (i / (list.length - 1)) * iw : iw / 2);
  const y = (v) => PAD.t + ih - (v / max) * ih;
  let d = "";
  let pen = false;
  vals.forEach((v, i) => {
    if (v === null || v === undefined || !Number.isFinite(v)) {
      pen = false;
      return;
    }
    d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    pen = true;
  });
  const lastI = vals.map((v, i) => [v, i]).filter(([v]) => v !== null && v !== undefined && Number.isFinite(v)).pop();
  const top = max / 1.12;
  const ticks = [0, top / 2, top];
  const lab = (i) => list[i]?.date.slice(5).replace("-", "/");
  return html`<svg class="tchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label} per day" data-n="${list.length}">
    ${ticks.map((t) => html`<line class="grid" x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(t)}" y2="${y(t)}"></line><text class="ax" x="${PAD.l - 6}" y="${y(t) + 3}" text-anchor="end">${fmt(t, true)}</text>`)}
    <text class="ax" x="${PAD.l}" y="${H - 4}">${lab(0)}</text><text class="ax" x="${W - PAD.r}" y="${H - 4}" text-anchor="end">${lab(list.length - 1)}</text>
    <path class="ln" d="${d}"></path>
    ${lastI ? html`<circle class="dot" cx="${x(lastI[1])}" cy="${y(lastI[0])}" r="3.5"></circle>` : ""}
    <line class="xh" x1="0" x2="0" y1="${PAD.t}" y2="${H - PAD.b}" visibility="hidden"></line>
    <rect class="hit" x="${PAD.l}" y="0" width="${iw}" height="${H}" fill="transparent"></rect>
  </svg>`;
}

const fmtMoney = (v, axis) => (v === null || v === undefined ? "—" : axis ? (v >= 1000 ? `${Math.round(v / 100) / 10}K` : Math.round(v)) : money(v));
const fmtNum = (v, axis) => (v === null || v === undefined ? "—" : axis ? Math.round(v) : n(v));
const fmtPct = (v, axis) => (v === null || v === undefined ? "—" : axis ? `${v.toFixed(1)}%` : `${v.toFixed(2)}%`);

const CHARTS = [
  { key: "spend", label: "Spend", fmt: fmtMoney, sum: true, lower: null },
  { key: "leads", label: "Leads (Meta)", fmt: fmtNum, sum: true, lower: false },
  { key: "cpl7", label: "Cost per lead · 7-day average", fmt: fmtMoney, sum: false, lower: true },
  { key: "valid", label: "Valid leads (your lead log)", fmt: fmtNum, sum: true, lower: false },
  { key: "cpvl7", label: "Cost per valid lead · 7-day average", fmt: fmtMoney, sum: false, lower: true },
  { key: "ctr", label: "Link CTR", fmt: fmtPct, sum: false, lower: false, avg: true },
];

function changeTag(ch, lower) {
  if (ch === null || !Number.isFinite(ch) || Math.abs(ch) < 0.03) return html`<span class="faint">steady vs the week before</span>`;
  const up = ch > 0;
  const tone = lower === null ? "" : (lower ? !up : up) ? "good" : "bad";
  return html`<span class="tc ${tone}">${up ? "▲" : "▼"} ${Math.abs(ch * 100).toFixed(0)}% vs the week before</span>`;
}

// ---------------------------------------------------------------- screen
const STATE = { tired: ["bad", "Tired"], watch: ["warn", "Watch"], fresh: ["good", "Fresh"], little: ["line", "Too little data"] };

export function render(ctx) {
  const top = html`<div class="top"><div><h1>Trends &amp; fatigue</h1><p class="sub">The account day by day, and which ads people are getting tired of. A tired ad gets fewer clicks each day while the same people keep seeing it: give it a new hook or a new video.</p></div>
    <div class="top-actions"><div class="seg" role="group" aria-label="Days">${[["last_14d", "14 days"], ["last_30d", "30 days"], ["last_60d", "60 days"]].map(([v, l]) => html`<button type="button" data-trange="${v}" aria-pressed="${range === v}">${l}</button>`)}</div><button class="btn icon" type="button" data-trefresh title="Refresh" aria-label="Refresh">↻</button></div></div>`;
  if (!ctx.settings) return html`${top}${loadingCard()}`;
  if (!ctx.settings.connected) return html`${top}${connectCard(ctx.settings)}`;
  const data = load(ctx);
  if (!data) return html`${top}${loadingCard()}`;
  if (data.error) return html`${top}<div class="note bad"><b>Could not load the daily results from Meta.</b> ${data.error}</div>`;

  const camps = data.tree.campaigns;
  const list = series(data, campaign);
  const adsById = {};
  for (const c of camps) for (const s of c.adsets) for (const a of s.ads) adsById[a.id] = { a, s, c };
  const fat = fatigue((data.daily.rows || []).filter((r) => !campaign || r.campaignId === campaign), (id) => adsById[id]?.a.m?.frequency || 0, FREQ_WATCH[range] || 4)
    .filter((f) => f.spend > 0)
    .sort((x, y) => ["tired", "watch", "fresh", "little"].indexOf(x.state) - ["tired", "watch", "fresh", "little"].indexOf(y.state) || y.spend - x.spend);
  const tired = fat.filter((f) => f.state === "tired");
  const watch = fat.filter((f) => f.state === "watch");
  const last7 = (rows) => rows.slice(-7).reduce((t, x) => t + x.spend, 0);
  const tiredSpend = tired.reduce((t, f) => t + last7(f.days), 0);
  const cplCh = weekChange(list, (x) => x.cpl7, false);
  const ctrCh = weekChange(list, (x) => (x.impressions ? x.clicks / x.impressions : null), false);
  const sumCtr = (w) => {
    const i = w.reduce((t, x) => t + x.impressions, 0);
    return i ? (w.reduce((t, x) => t + x.clicks, 0) / i) * 100 : null;
  };
  const notes = [];
  if (tired.length) notes.push({ tone: "bad", title: `${tired.length} ad${tired.length > 1 ? "s are" : " is"} tired`, text: `They took ${money(tiredSpend)} in the last 7 days. Replace the first 3 seconds (hook) or the video, keep the same offer, and turn the tired one off once the new one has a few days of results.` });
  if (cplCh !== null && cplCh > 0.15 && ctrCh !== null && ctrCh < -0.1) notes.push({ tone: "warn", title: `Cost per lead up ${pct(cplCh * 100, 0)} while CTR fell ${pct(-ctrCh * 100, 0)}`, text: "Fewer people click, so each lead costs more. That is creative fatigue more than targeting. New creative first." });
  else if (cplCh !== null && cplCh > 0.15) notes.push({ tone: "warn", title: `Cost per lead up ${pct(cplCh * 100, 0)} this week`, text: "CTR held, so look at the form or the landing page (fewer people finish), or at competition in the auction." });
  else if (cplCh !== null && cplCh < -0.1) notes.push({ tone: "good", title: `Cost per lead down ${pct(-cplCh * 100, 0)} this week`, text: "Keep what changed. Raise the best ad set 15–20% if valid leads held up too." });
  if (watch.length) notes.push({ tone: "info", title: `${watch.length} ad${watch.length > 1 ? "s" : ""} to watch`, text: "Clicks are starting to slip or frequency is high. Have a new version ready." });

  const wk = (c) => {
    if (c.key === "ctr") {
      if (list.length < 14) return null;
      const a = sumCtr(list.slice(-14, -7));
      const b = sumCtr(list.slice(-7));
      return a ? (b - a) / a : null;
    }
    return weekChange(list, (x) => x[c.key], c.sum);
  };
  const latest = (c) => {
    if (c.sum) return c.fmt(list.slice(-7).reduce((t, x) => t + (x[c.key] || 0), 0));
    if (c.key === "ctr") return c.fmt(sumCtr(list.slice(-7)));
    return c.fmt([...list].reverse().find((x) => x[c.key] !== null && x[c.key] !== undefined)?.[c.key] ?? null);
  };

  return html`${top}
  <div class="row wrap" style="margin-bottom:12px"><label class="row small"><span class="muted">Campaign</span>
    <select class="input" style="width:auto;min-height:32px" data-tcampaign><option value="">All campaigns</option>${camps.map((c) => html`<option value="${c.id}" ${c.id === campaign ? raw("selected") : ""}>${c.name}</option>`)}</select></label></div>
  ${notes.length ? html`<div class="card"><div class="alerts">${notes.map((a) => html`<div class="alert ${a.tone}"><span class="dot"></span><div class="grow"><b>${a.title}</b><p>${a.text}</p></div></div>`)}</div></div>` : ""}
  <div class="card viz tcharts-card"><div class="card-head"><div><h2>Day by day</h2><p>${list.length ? `${list[0].date} to ${list[list.length - 1].date}` : ""}. Totals are the last 7 days; costs are 7-day averages. Point at a chart to see one day.</p></div></div>
    ${list.length ? html`<div class="tcharts">${CHARTS.map((c) => html`<div class="tcell"><div class="row between wrap"><span class="small muted">${c.label}</span><b class="num">${latest(c)}</b></div>${chart(list, c.key, c.fmt, c.label)}<div class="tiny">${changeTag(wk(c), c.lower)}</div></div>`)}</div>` : html`<p class="muted">No results in these days.</p>`}
  </div>
  <div class="card viz"><div class="card-head"><div><h2>Ad fatigue</h2><p>First half of the period against the second half, per ad. Tired ads first.</p></div><div class="row small muted">${n(tired.length)} tired · ${n(watch.length)} to watch · ${n(fat.filter((f) => f.state === "fresh").length)} fresh</div></div>
    ${fat.length ? html`<div class="table-wrap"><table><thead><tr><th>Ad</th><th>State</th><th>Daily CTR</th><th class="n">CTR then → now</th><th class="n">CPL then → now</th><th class="n">Freq.</th><th class="n">Spend</th><th></th></tr></thead><tbody>
    ${fat.map((f) => {
      const info = adsById[f.adId];
      const [tone, label] = STATE[f.state];
      const on = info?.a.status === "ACTIVE";
      return html`<tr>
        <td style="min-width:200px"><div class="name">${f.adName}</div><div class="tiny muted">${info ? `${info.c.name} › ${info.s.name}` : ""}</div>${info && info.a.effectiveStatus !== "ACTIVE" ? statusPill(info.a.effectiveStatus) : ""}</td>
        <td><span class="pill ${tone}">${label}</span><div class="tiny muted" style="max-width:220px">${f.why}</div></td>
        <td>${spark(f.days)}</td>
        <td class="n">${f.ctr1 !== undefined ? html`${f.ctr1.toFixed(2)}% → <b>${f.ctr2.toFixed(2)}%</b>` : "—"}</td>
        <td class="n">${f.cpl1 && f.cpl2 ? html`${money(f.cpl1)} → <b>${money(f.cpl2)}</b>` : "—"}</td>
        <td class="n">${f.freq ? f.freq.toFixed(1) : "—"}</td>
        <td class="n">${money(f.spend)}</td>
        <td class="n">${on && f.state === "tired" && !data.tree.readOnly ? html`<button class="btn sm danger" type="button" data-toff="${f.adId}">Turn off</button>` : ""} ${info ? html`<a class="btn sm ghost" href="#/campaigns/${info.c.id}">Open</a>` : ""}</td>
      </tr>`;
    })}</tbody></table></div>` : html`<p class="muted">No ads with spend in these days.</p>`}
    <p class="tiny faint" style="margin-top:8px">Rules of thumb: tired when CTR falls 25% or more with high frequency (${(FREQ_WATCH[range] || 4) - 1}+ over these days) or a 30% dearer lead, or when CTR falls 35% or more. Ads need at least 6 days and 3,000 impressions to be judged.</p>
  </div>
  <div class="viztip" role="tooltip" hidden></div>`;
}

/** Tiny daily-CTR line for one ad (no axis; the table has the numbers). */
function spark(days) {
  const v = days.map((d) => (d.impressions ? (d.clicks / d.impressions) * 100 : null));
  const nums = v.filter((x) => x !== null);
  if (nums.length < 2) return html`<span class="faint">—</span>`;
  const max = Math.max(...nums) || 1;
  const pts = v
    .map((x, i) => (x === null ? null : `${((i / (v.length - 1)) * 96 + 2).toFixed(1)},${(26 - (x / max) * 22).toFixed(1)}`))
    .filter(Boolean)
    .join(" ");
  return html`<svg class="spark" viewBox="0 0 100 28" aria-hidden="true"><polyline points="${pts}"></polyline></svg>`;
}

export function mount(root, ctx) {
  const tip = $(".viztip", root);
  root.onpointermove = (e) => {
    const svg = e.target.closest?.(".tchart");
    if (!svg) {
      if (tip) tip.hidden = true;
      root.querySelectorAll(".xh").forEach((l) => l.setAttribute("visibility", "hidden"));
      return;
    }
    const data = cache.get(range);
    if (!data || data.error) return;
    const list = series(data, campaign);
    const box = svg.getBoundingClientRect();
    const fx = ((e.clientX - box.left) / box.width) * W;
    const iw = W - PAD.l - PAD.r;
    const i = Math.max(0, Math.min(list.length - 1, Math.round(((fx - PAD.l) / iw) * (list.length - 1))));
    const xPos = PAD.l + (list.length > 1 ? (i / (list.length - 1)) * iw : iw / 2);
    root.querySelectorAll(".xh").forEach((l) => {
      l.setAttribute("x1", xPos);
      l.setAttribute("x2", xPos);
      l.setAttribute("visibility", "visible");
    });
    const d = list[i];
    if (!tip || !d) return;
    tip.textContent = `${new Date(`${d.date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}\nSpend ${money(d.spend)}\nLeads ${n(d.leads)} · valid ${n(d.valid)}\nCPL (7-day) ${money(d.cpl7)}\nCost per valid (7-day) ${money(d.cpvl7)}\nCTR ${d.ctr === null ? "—" : `${d.ctr.toFixed(2)}%`}`;
    tip.hidden = false;
    tip.style.left = `${Math.min(window.innerWidth - tip.offsetWidth - 8, e.clientX + 14)}px`;
    tip.style.top = `${Math.max(8, e.clientY - tip.offsetHeight - 12)}px`;
  };
  root.onpointerleave = () => {
    if (tip) tip.hidden = true;
    root.querySelectorAll(".xh").forEach((l) => l.setAttribute("visibility", "hidden"));
  };
  root.onchange = (e) => {
    if (e.target.matches("[data-tcampaign]")) {
      campaign = e.target.value;
      ctx.render();
    }
  };
  root.onclick = async (e) => {
    const r = e.target.closest("[data-trange]");
    if (r) {
      range = r.dataset.trange;
      return ctx.render();
    }
    if (e.target.closest("[data-trefresh]")) {
      cache.delete(range);
      return ctx.render();
    }
    const off = e.target.closest("[data-toff]");
    if (off) {
      const data = cache.get(range);
      let found = null;
      for (const c of data?.tree?.campaigns || []) for (const s of c.adsets) for (const a of s.ads) if (a.id === off.dataset.toff) found = a;
      if (!found) return;
      const ok = await confirmDialog({ title: "Turn off this tired ad?", body: html`<b>${found.name}</b> stops within a few minutes. Have its replacement running first so the ad set keeps delivering.`, ok: "Turn off", danger: true });
      if (!ok) return;
      try {
        await post("/api/status", { id: found.id, status: "PAUSED", kind: "ad" });
        found.status = "PAUSED";
        toast(`${found.name} is off.`, "good");
        cache.delete(range);
        ctx.render();
      } catch (err) {
        toast(err.message, "bad");
      }
    }
  };
}

export const _test = { series, fatigue, weekChange };
