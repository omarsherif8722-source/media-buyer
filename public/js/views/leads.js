// Lead log, A/B/C/D lead grading, geographic corridor attribution, speed-to-lead
// SLA distribution chart, and batch Meta Conversions API (CAPI) sync.
import { html, raw, $, toast, confirmDialog, n, pct, ago, dateTime, egp, readTable, pickFile, download, toCSV, esc } from "../ui.js";
import { get, post } from "../api.js";
import { load, save, targets, stageEvents } from "../store.js";
import {
  STAGES, STAGE, SOURCES, TIMELINES, PURPOSES, PAYS, isValid, isWaiting, isBad, MEETING_UP, RESERVED_UP,
  allLeads, addLead, updateLead, removeLead, replaceAll, mergeMetaLeads, leadFromCsv, projectFromName, budgetFit, median,
  scoreLeadGrade, EGYPT_CORRIDORS,
} from "../model.js";
import { kpi } from "./common.js";

let groupFilter = "all"; // all | gradeA | waiting | valid | bad
let projectFilter = "";
let cityFilter = "";
let range = "30"; // days, or "all"
let text = "";
let limit = 60;

const opts = (list, val) => list.map(([v, l]) => html`<option value="${v}" ${String(val ?? "") === v ? raw("selected") : ""}>${l}</option>`);
const digits = (p) => String(p || "").replace(/[^\d]/g, "");
const waNumber = (p) => {
  const d = digits(p);
  if (d.startsWith("00")) return d.slice(2);
  if (d.startsWith("01") && d.length === 11) return `2${d}`; // Egyptian mobile written locally
  return d;
};

function inRange(l) {
  if (range === "all") return true;
  return Date.now() - new Date(l.created).getTime() <= Number(range) * 86400000;
}

function funnel(list) {
  const all = list.length;
  const contacted = list.filter((l) => l.stage !== "new").length;
  const valid = list.filter((l) => isValid(l.stage)).length;
  const meet = list.filter((l) => MEETING_UP.has(l.stage)).length;
  const res = list.filter((l) => RESERVED_UP.has(l.stage)).length;
  const step = (label, v, of, key) => html`<div class="${key ? "key" : ""}"><span>${label}</span><b>${n(v)}</b><small>${of ? `${pct((v / of) * 100, 0)} of previous` : ""}</small><div class="bar"><i style="width:${all ? Math.round((v / all) * 100) : 0}%"></i></div></div>`;
  return html`<div class="funnel">${step("All leads", all, 0)}${step("Contacted", contacted, all)}${step("Valid (real interest)", valid, contacted, true)}${step("Meeting or visit", meet, valid)}${step("Reserved or sold", res, meet, true)}</div>`;
}

function speedToLeadChart(list) {
  const buckets = [
    { label: "Under 15 min (Target SLA)", max: 15, total: 0, valid: 0, tone: "good" },
    { label: "15 – 60 min", max: 60, total: 0, valid: 0, tone: "info" },
    { label: "1 – 4 hours", max: 240, total: 0, valid: 0, tone: "warn" },
    { label: "Over 4 hours", max: Infinity, total: 0, valid: 0, tone: "bad" },
  ];
  for (const l of list) {
    if (!l.firstContactAt || !l.created) continue;
    const mins = (new Date(l.firstContactAt) - new Date(l.created)) / 60000;
    if (mins < 0) continue;
    const b = buckets.find((x) => mins <= x.max) || buckets[3];
    b.total += 1;
    if (isValid(l.stage)) b.valid += 1;
  }
  return html`
  <div class="grid g4" style="grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:10px">
    ${buckets.map((b) => {
      const rate = b.total > 0 ? (b.valid / b.total) * 100 : null;
      return html`<div class="kpi">
        <span>${b.label}</span>
        <b>${pct(rate, 0)} <small style="display:inline;font-size:12px">valid rate</small></b>
        <small>${n(b.valid)} valid of ${n(b.total)} called</small>
        <div class="bar" style="margin-top:6px"><i style="width:${rate ? Math.min(100, Math.round(rate * 2)) : 0}%;background:var(--${b.tone})"></i></div>
      </div>`;
    })}
  </div>`;
}

function qualityTable(list) {
  const groups = {};
  for (const l of list) {
    const key = l.campaignName || l.campaignId || SOURCES.find((s) => s[0] === l.source)?.[1] || "Other";
    const g = (groups[key] ??= { key, leads: 0, contacted: 0, valid: 0, bad: 0, meet: 0, res: 0, mins: [] });
    g.leads += 1;
    if (l.stage !== "new") g.contacted += 1;
    if (isValid(l.stage)) g.valid += 1;
    if (isBad(l.stage)) g.bad += 1;
    if (MEETING_UP.has(l.stage)) g.meet += 1;
    if (RESERVED_UP.has(l.stage)) g.res += 1;
    if (l.firstContactAt) {
      const m = (new Date(l.firstContactAt) - new Date(l.created)) / 60000;
      if (m >= 0) g.mins.push(m);
    }
  }
  const rows = Object.values(groups).sort((a, b) => b.leads - a.leads);
  if (!rows.length) return html`<p class="muted small">No leads in these dates.</p>`;
  return html`<div class="table-wrap"><table><thead><tr><th>Campaign or source</th><th class="n">Leads</th><th class="n">Contacted</th><th class="n">Valid</th><th class="n">Valid rate</th><th class="n">Not valid</th><th class="n">Meet.</th><th class="n">Reserved</th><th class="n">Reply time</th></tr></thead><tbody>
  ${rows.map((g) => {
    const rate = g.contacted - 0 ? (g.valid / Math.max(1, g.contacted)) * 100 : null;
    const med = median(g.mins);
    return html`<tr><td class="name">${g.key}</td><td class="n">${n(g.leads)}</td><td class="n">${n(g.contacted)}</td><td class="n"><b>${n(g.valid)}</b></td><td class="n"><b>${pct(rate, 0)}</b></td><td class="n">${n(g.bad)}</td><td class="n">${n(g.meet)}</td><td class="n">${n(g.res)}</td><td class="n">${med === null ? "—" : med < 60 ? `${Math.round(med)} min` : `${(med / 60).toFixed(1)} h`}</td></tr>`;
  })}</tbody></table></div><p class="tiny faint" style="margin-top:6px">Valid rate = valid ÷ contacted. Reply time = median minutes from the lead arriving to its first stage change.</p>`;
}

function leadCard(l, ctx, t) {
  const p = ctx.catalog?.projects?.find((x) => x.id === l.project);
  const fit = budgetFit(l, ctx.catalog);
  const grade = scoreLeadGrade(l, ctx.catalog);
  const late = l.stage === "new" && Date.now() - new Date(l.created).getTime() > t.speedToLead * 60000;
  const wa = waNumber(l.phone);
  const projectName = p?.name || "";
  const waText = `Hello ${l.name || ""}, this is the G Developments sales advisory${projectName ? ` about ${projectName}` : ""}. Is now a good time to talk?`;
  const canSend = ctx.settings?.stagesToMeta && l.metaId && isValid(l.stage) && STAGE[l.stage];
  const sent = l.sentToMeta?.[l.stage];
  const source = [SOURCES.find((s) => s[0] === l.source)?.[1], l.campaignName, l.adsetName, l.adName, l.ref ? `ref ${l.ref}` : ""].filter(Boolean).join(" › ");
  return html`<article class="lead" data-lead="${l.id}">
    <div class="lead-top">
      <div>
        <div class="row wrap" style="gap:6px">
          <span class="pill ${grade.tone}" title="${grade.reasons.join(" · ")}">Grade ${grade.grade} (${grade.points})</span>
          <div class="lead-name">${l.name || "No name"}</div>
          ${l.city ? html`<span class="pill line">📍 ${l.city}</span>` : ""}
        </div>
        <div class="lead-meta" style="margin-top:3px">
          <span class="${late ? "late" : ""}">${late ? "Waiting " : ""}${ago(l.created)}</span>
          ${l.phone ? html`<span class="mono">${l.phone}</span>` : ""}
          ${l.email ? html`<span>${l.email}</span>` : ""}
        </div>
      </div>
      <div class="row wrap">
        ${wa ? html`<a class="btn sm" href="https://wa.me/${wa}?text=${encodeURIComponent(waText)}" target="_blank" rel="noopener" data-contact>WhatsApp</a><a class="btn sm" href="tel:+${wa}" data-contact>Call</a>` : ""}
        <select class="input" data-field="stage" aria-label="Stage">${STAGES.map((s) => html`<option value="${s.id}" ${s.id === l.stage ? raw("selected") : ""}>${s.group === "valid" ? "✓ " : ""}${s.label}</option>`)}</select>
      </div>
    </div>
    <div class="lead-meta">${source ? html`<span>${source}</span>` : ""}${l.formName ? html`<span>Form: ${l.formName}</span>` : ""}</div>
    <div class="row wrap">
      <select class="input" data-field="project" aria-label="Project"><option value="">Project…</option>${(ctx.catalog?.projects || []).map((x) => html`<option value="${x.id}" ${x.id === l.project ? raw("selected") : ""}>${x.name}</option>`)}</select>
      <select class="input" data-field="city" aria-label="City Corridor"><option value="">City / Area…</option>${EGYPT_CORRIDORS.map((c) => html`<option value="${c.id}" ${c.id === l.city ? raw("selected") : ""}>${c.id} (${c.gov})</option>`)}</select>
      <input class="input" style="width:150px" type="number" inputmode="numeric" min="0" step="100000" placeholder="Budget (EGP)" data-field="budget" value="${l.budget || ""}" aria-label="Budget in EGP">
      <select class="input" data-field="timeline" aria-label="When">${opts(TIMELINES, l.timeline)}</select>
      <select class="input" data-field="purpose" aria-label="Purpose">${opts(PURPOSES, l.purpose)}</select>
      <select class="input" data-field="pay" aria-label="Payment">${opts(PAYS, l.pay)}</select>
      ${fit === true ? html`<span class="pill good">Budget fits (from ${egp(p.from)})</span>` : fit === false ? html`<span class="pill bad">Below ${egp(p.from)}</span>` : ""}
      ${p?.cashOnly && l.pay === "installments" ? html`<span class="pill bad">${p.name} is cash only</span>` : ""}
    </div>
    <textarea class="input" data-field="notes" placeholder="Notes from the call" aria-label="Notes" rows="2">${l.notes || ""}</textarea>
    <div class="row between wrap">
      <div class="row wrap">
        ${l.answers && Object.keys(l.answers).length ? html`<details><summary class="small muted">Form answers</summary><dl class="kv small" style="margin-top:6px">${Object.entries(l.answers).map(([k, v]) => html`<dt>${k.replace(/_/g, " ")}</dt><dd>${v}</dd>`)}</dl></details>` : ""}
        ${canSend ? (sent ? html`<span class="pill good">Sent to Meta: ${stageEvents()[l.stage] || l.stage}</span>` : html`<button class="btn sm" type="button" data-send>Tell Meta: ${stageEvents()[l.stage] || l.stage}</button>`) : ""}
      </div>
      <button class="btn sm ghost danger" type="button" data-remove>Delete</button>
    </div>
  </article>`;
}

export function render(ctx) {
  const t = targets();
  const all = allLeads();
  const dated = all.filter(inRange);
  const s = text.trim().toLowerCase();
  const shown = dated.filter(
    (l) =>
      (groupFilter === "all" || (groupFilter === "gradeA" ? scoreLeadGrade(l, ctx.catalog).grade === "A" : STAGE[l.stage]?.group === groupFilter)) &&
      (!projectFilter || l.project === projectFilter) &&
      (!cityFilter || l.city === cityFilter) &&
      (!s || [l.name, l.phone, l.email, l.city, l.campaignName, l.adName, l.notes, l.ref].some((x) => String(x || "").toLowerCase().includes(s))),
  );
  const waiting = dated.filter((l) => isWaiting(l.stage)).length;
  const valid = dated.filter((l) => isValid(l.stage)).length;
  const gradeACount = dated.filter((l) => scoreLeadGrade(l, ctx.catalog).grade === "A").length;
  const contacted = dated.filter((l) => l.stage !== "new").length;
  const unsentValid = dated.filter((l) => ctx.settings?.stagesToMeta && l.metaId && isValid(l.stage) && !l.sentToMeta?.[l.stage]);
  const med = median(dated.filter((l) => l.firstContactAt).map((l) => (new Date(l.firstContactAt) - new Date(l.created)) / 60000).filter((m) => m >= 0));
  const auto = load("autoStages", false);
  return html`
  <div class="top"><div><h1>Leads &amp; Sales CRM</h1><p class="sub">After the first call, give each lead a stage. "Real interest" and every stage after it count as a valid buyer, which drives campaign CPVL and Meta CAPI optimization.</p></div>
    <div class="top-actions">
      <button class="btn primary" type="button" data-add>Add lead</button>
      ${ctx.settings?.leadForms ? html`<button class="btn" type="button" data-pull>Get new leads from Meta</button>` : ""}
      ${unsentValid.length ? html`<button class="btn" type="button" data-sync-capi>Sync ${n(unsentValid.length)} Valid Leads to Meta CAPI</button>` : ""}
      <button class="btn" type="button" data-import>Import CSV</button>
      <button class="btn" type="button" data-export>Export CSV</button>
      <button class="btn ghost" type="button" data-backup>Backup</button>
      <button class="btn ghost" type="button" data-restore>Restore</button>
    </div></div>
  <div class="note" style="margin-bottom:14px">Leads are kept <b>in this browser only</b>, not on the server or GitHub. Use Backup to move them to your phone or laptop, and keep a backup after each day.${ctx.settings?.leadForms ? "" : " To pull Meta lead-form leads straight in, set META_PAGE_ID on the server; until then, download them from Meta and use Import CSV."}</div>
  <div class="row between wrap" style="margin-bottom:10px">
    <div class="seg" role="group" aria-label="Dates">${[["7", "7 days"], ["14", "14 days"], ["30", "30 days"], ["60", "60 days"], ["90", "90 days"], ["all", "All time"]].map(([v, l]) => html`<button type="button" data-range="${v}" aria-pressed="${range === v}">${l}</button>`)}</div>
    ${ctx.settings?.stagesToMeta ? html`<label class="row small"><input type="checkbox" data-auto ${auto ? raw("checked") : ""}> Send valid stages to Meta automatically</label>` : ""}
  </div>
  <div class="kpis" style="margin-bottom:14px">
    ${kpi("Leads", n(dated.length))}
    ${kpi("Grade A Hot Buyers", n(gradeACount), "Budget & timeline fit", true)}
    ${kpi("Waiting for a call", n(waiting), waiting ? "call them first" : "", false)}
    ${kpi("Valid leads", n(valid), "", true)}
    ${kpi("Valid rate", pct(contacted ? (valid / contacted) * 100 : null, 0), "of contacted", true)}
    ${kpi("Median reply time", med === null ? "—" : med < 60 ? `${Math.round(med)} min` : `${(med / 60).toFixed(1)} h`, `target under ${t.speedToLead} min`)}
  </div>
  <div class="card">${funnel(dated)}</div>
  <div class="card"><div class="card-head"><div><h2>Speed-to-Lead SLA Impact on Valid Buyer Rate</h2><p>How fast sales calls a new lead directly controls the valid qualification rate.</p></div></div>${speedToLeadChart(dated)}</div>
  <div class="card"><div class="card-head"><div><h2>Lead quality by campaign</h2><p>Which campaigns bring people who really want to buy. Spend and cost per valid lead are on Campaigns.</p></div></div>${qualityTable(dated)}</div>
  <div class="card">
    <div class="card-head"><h2>Lead list (${n(shown.length)})</h2>
      <div class="row wrap">
        <div class="seg" role="group" aria-label="Stage">${[["all", "All"], ["gradeA", "Grade A"], ["waiting", "Waiting"], ["valid", "Valid"], ["bad", "Not valid"]].map(([v, l]) => html`<button type="button" data-group="${v}" aria-pressed="${groupFilter === v}">${l}</button>`)}</div>
        <select class="input" style="width:auto" data-project-filter aria-label="Project"><option value="">All projects</option>${(ctx.catalog?.projects || []).map((p) => html`<option value="${p.id}" ${projectFilter === p.id ? raw("selected") : ""}>${p.name}</option>`)}</select>
        <select class="input" style="width:auto" data-city-filter aria-label="City Corridor"><option value="">All cities</option>${EGYPT_CORRIDORS.map((c) => html`<option value="${c.id}" ${cityFilter === c.id ? raw("selected") : ""}>${c.id}</option>`)}</select>
        <input class="input" style="width:200px" type="search" placeholder="Search name, phone, city, campaign" value="${text}" data-text aria-label="Search leads">
      </div>
    </div>
    ${shown.length ? html`${shown.slice(0, limit).map((l) => leadCard(l, ctx, t))}${shown.length > limit ? html`<div class="row" style="justify-content:center;margin-top:10px"><button class="btn" type="button" data-more-leads>Show ${Math.min(60, shown.length - limit)} more of ${shown.length - limit}</button></div>` : ""}` : html`<div class="empty"><h3>${all.length ? "No leads match" : "No leads yet"}</h3><p>${all.length ? "Change the filters above." : "Add a lead by hand, import Meta's lead download, or connect lead forms."}</p></div>`}
  </div>`;
}

// ---------------------------------------------------------------- actions
function addDialog(ctx) {
  const d = document.createElement("dialog");
  const campaigns = ctx.tree?.campaigns || [];
  const links = load("links", []);
  d.innerHTML = html`<form method="dialog" class="dlg">
    <h2>Add a lead</h2>
    <div class="fields">
      <label class="field"><span>Name</span><input class="input" name="name" autocomplete="off"></label>
      <label class="field"><span>Phone</span><input class="input" name="phone" type="tel" inputmode="tel" autocomplete="off" required></label>
      <label class="field"><span>Project</span><select class="input" name="project"><option value="">—</option>${(ctx.catalog?.projects || []).map((p) => html`<option value="${p.id}">${p.name}</option>`)}</select></label>
      <label class="field"><span>City / Corridor</span><select class="input" name="city">${EGYPT_CORRIDORS.map((c) => html`<option value="${c.id}">${c.id} (${c.gov})</option>`)}</select></label>
      <label class="field"><span>Came from</span><select class="input" name="source">${SOURCES.map(([v, l]) => html`<option value="${v}" ${v === "whatsapp" ? raw("selected") : ""}>${l}</option>`)}</select></label>
      ${links.length ? html`<label class="field"><span>Ref code (from the WhatsApp message)</span><select class="input" name="ref"><option value="">—</option>${links.map((k) => html`<option value="${k.ref}">${k.ref} · ${k.campaign || ""} ${k.content || ""}</option>`)}</select></label>` : ""}
      ${campaigns.length ? html`<label class="field"><span>Campaign</span><select class="input" name="campaign"><option value="">—</option>${campaigns.map((c) => html`<option value="${c.id}">${c.name}</option>`)}</select></label>` : html`<label class="field"><span>Campaign name</span><input class="input" name="campaignName"></label>`}
    </div>
    <label class="field"><span>Notes</span><textarea class="input" name="notes" rows="2"></textarea></label>
    <div class="acts"><button class="btn" value="no" formnovalidate>Cancel</button><button class="btn primary" value="yes">Add lead</button></div>
  </form>`.s;
  document.body.append(d);
  d.addEventListener("close", () => {
    if (d.returnValue === "yes") {
      const f = new FormData($("form", d));
      const ref = f.get("ref") || "";
      const link = links.find((k) => k.ref === ref);
      const camp = campaigns.find((c) => c.id === f.get("campaign"));
      addLead({
        name: String(f.get("name") || "").trim(),
        phone: String(f.get("phone") || "").trim(),
        project: f.get("project") || link?.project || null,
        city: String(f.get("city") || "New Cairo"),
        source: f.get("source") || "other",
        ref: ref || null,
        campaignId: camp?.id || null,
        campaignName: camp?.name || String(f.get("campaignName") || "").trim() || link?.campaign || null,
        adName: link?.content || null,
        notes: String(f.get("notes") || "").trim(),
      });
      toast("Lead added.", "good");
    }
    d.remove();
  });
  d.showModal();
}

async function pull(ctx, btn) {
  const metaLeads = allLeads().filter((l) => l.metaId && l.source === "meta-form");
  const newest = metaLeads.reduce((m, l) => Math.max(m, new Date(l.created).getTime() || 0), 0);
  const since = newest ? Math.floor(newest / 1000) - 3600 : Math.floor(Date.now() / 1000) - 30 * 86400;
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Getting leads';
  try {
    const r = await get("/api/leads", { since });
    const added = mergeMetaLeads(r.leads, (x) => projectFromName([x.campaignName, x.adsetName, x.formName].join(" "), ctx.catalog)?.id);
    toast(added ? `${added} new lead${added > 1 ? "s" : ""} from ${r.forms.length} form${r.forms.length === 1 ? "" : "s"}.` : "No new leads.", "good");
  } catch (e) {
    toast(e.message, "bad");
  } finally {
    btn.disabled = false;
    btn.textContent = "Get new leads from Meta";
  }
}

async function batchSyncCapi(ctx, btn) {
  const unsent = allLeads().filter((l) => l.metaId && isValid(l.stage) && !l.sentToMeta?.[l.stage]).slice(0, 25);
  if (!unsent.length) return toast("All valid leads are already synced to Meta.", "good");
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Syncing to Meta CAPI';
  let sentCount = 0;
  for (const l of unsent) {
    const event = stageEvents()[l.stage];
    if (!event) continue;
    try {
      await post("/api/lead-stage", { leadId: l.metaId, event });
      updateLead(l.id, { sentToMeta: { ...(l.sentToMeta || {}), [l.stage]: new Date().toISOString() } });
      sentCount += 1;
    } catch {
      break;
    }
  }
  btn.disabled = false;
  toast(`Synced ${sentCount} valid buyer outcomes to Meta Conversions API.`, "good");
  ctx.render();
}

async function importCsv(ctx) {
  const file = await pickFile(".csv,.tsv,.txt,text/csv");
  if (!file) return;
  let rows;
  try {
    rows = await readTable(file);
  } catch {
    return toast("Could not read that file.", "bad");
  }
  const existing = allLeads();
  const keyOf = (l) => l.metaId || `${digits(l.phone)}|${String(l.created).slice(0, 10)}`;
  const seen = new Set(existing.map(keyOf));
  const fresh = [];
  for (const r of rows) {
    const l = leadFromCsv(r);
    if (!l.phone && !l.email && !l.name) continue;
    if (!l.project) l.project = projectFromName([l.campaignName, l.adsetName, l.formName].join(" "), ctx.catalog)?.id || null;
    else if (!ctx.catalog?.projects?.some((p) => p.id === l.project)) l.project = projectFromName(l.project, ctx.catalog)?.id || null;
    const k = keyOf(l);
    if (seen.has(k)) continue;
    seen.add(k);
    fresh.push(l);
  }
  if (!fresh.length) return toast(`No new leads in ${file.name} (${rows.length} rows, all already here or empty).`);
  const ok = await confirmDialog({ title: `Import ${fresh.length} leads?`, body: html`From <b>${file.name}</b>. ${rows.length - fresh.length} rows were already here or empty.`, ok: "Import" });
  if (!ok) return;
  for (const l of fresh.reverse()) addLead({ ...l, history: [{ stage: l.stage, at: l.created }] });
  toast(`${fresh.length} leads imported.`, "good");
}

function exportCsv(ctx) {
  const head = ["created", "name", "phone", "email", "city", "governorate", "grade", "project", "source", "campaign_name", "adset_name", "ad_name", "ref", "stage", "stage_label", "valid", "budget_egp", "timeline", "purpose", "payment", "first_contact", "notes", "meta_lead_id"];
  const rows = allLeads().map((l) => [l.created, l.name, l.phone, l.email, l.city || "", l.governorate || "", scoreLeadGrade(l, ctx.catalog).grade, ctx.catalog?.projects?.find((p) => p.id === l.project)?.name || l.project, l.source, l.campaignName, l.adsetName, l.adName, l.ref, l.stage, STAGE[l.stage]?.label, isValid(l.stage) ? "yes" : "no", l.budget, l.timeline, l.purpose, l.pay, l.firstContactAt, l.notes, l.metaId]);
  download(`g-leads-${new Date().toISOString().slice(0, 10)}.csv`, toCSV([head, ...rows]));
}

function backup() {
  const data = { kind: "g-media-buying-backup", version: 1, at: new Date().toISOString(), leads: allLeads(), links: load("links", []), targets: load("targets", {}), stageEvents: load("stageEvents", {}) };
  download(`g-media-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data), "application/json");
}

async function restore() {
  const file = await pickFile(".json,application/json");
  if (!file) return;
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    return toast("That is not a backup file.", "bad");
  }
  if (data?.kind !== "g-media-buying-backup" || !Array.isArray(data.leads)) return toast("That is not a backup from this dashboard.", "bad");
  const ok = await confirmDialog({ title: "Replace the leads on this device?", body: html`The backup from ${dateTime(data.at)} has <b>${data.leads.length}</b> leads. The ${allLeads().length} leads on this device will be replaced. Make a backup of this device first if you are not sure.`, ok: "Replace", danger: true });
  if (!ok) return;
  save("links", data.links || []);
  save("targets", data.targets || {});
  save("stageEvents", data.stageEvents || {});
  replaceAll(data.leads);
  toast("Backup restored.", "good");
}

async function sendStage(ctx, l, quiet = false) {
  const event = stageEvents()[l.stage];
  if (!event || !l.metaId) return;
  try {
    await post("/api/lead-stage", { leadId: l.metaId, event });
    updateLead(l.id, { sentToMeta: { ...(l.sentToMeta || {}), [l.stage]: new Date().toISOString() } });
    if (!quiet) toast(`Meta told: ${event}.`, "good");
  } catch (e) {
    toast(e.message, "bad");
  }
}

export function mount(root, ctx) {
  root.onclick = async (e) => {
    const el = e.target;
    if (el.closest("[data-add]")) return addDialog(ctx);
    if (el.closest("[data-pull]")) return pull(ctx, el.closest("[data-pull]"));
    if (el.closest("[data-sync-capi]")) return batchSyncCapi(ctx, el.closest("[data-sync-capi]"));
    if (el.closest("[data-import]")) return importCsv(ctx);
    if (el.closest("[data-export]")) return exportCsv(ctx);
    if (el.closest("[data-backup]")) return backup();
    if (el.closest("[data-restore]")) return restore();
    if (el.closest("[data-more-leads]")) {
      limit += 60;
      return ctx.render();
    }
    const g = el.closest("[data-group]");
    if (g) {
      groupFilter = g.dataset.group;
      limit = 60;
      return ctx.render();
    }
    const r = el.closest("[data-range]");
    if (r) {
      range = r.dataset.range;
      return ctx.render();
    }
    const card = el.closest("[data-lead]");
    if (!card) return;
    const l = allLeads().find((x) => x.id === card.dataset.lead);
    if (!l) return;
    if (el.closest("[data-remove]")) {
      const ok = await confirmDialog({ title: "Delete this lead?", body: html`<b>${l.name || l.phone}</b> will be removed from this device. This cannot be undone.`, ok: "Delete", danger: true });
      if (ok) removeLead(l.id);
      return;
    }
    if (el.closest("[data-send]")) return sendStage(ctx, l);
    if (el.closest("[data-contact]") && l.stage === "new") {
      setTimeout(() => updateLead(l.id, { stage: "no_answer" }), 400);
    }
  };
  root.onchange = (e) => {
    const el = e.target;
    if (el.matches("[data-auto]")) return save("autoStages", el.checked);
    if (el.matches("[data-project-filter]")) {
      projectFilter = el.value;
      return ctx.render();
    }
    if (el.matches("[data-city-filter]")) {
      cityFilter = el.value;
      return ctx.render();
    }
    const card = el.closest("[data-lead]");
    const field = el.dataset.field;
    if (!card || !field) return;
    const value = field === "budget" ? (el.value ? Number(el.value) : null) : el.value;
    updateLead(card.dataset.lead, { [field]: value || (field === "budget" ? null : "") });
    if (field === "stage" && load("autoStages", false) && ctx.settings?.stagesToMeta) {
      const l = allLeads().find((x) => x.id === card.dataset.lead);
      if (l && isValid(l.stage) && l.metaId && !l.sentToMeta?.[l.stage]) sendStage(ctx, l, true);
    }
  };
  root.oninput = (e) => {
    if (e.target.matches("[data-text]")) {
      text = e.target.value;
      limit = 60;
      ctx.render();
      const i = $("[data-text]", root);
      i?.focus();
      i?.setSelectionRange(text.length, text.length);
    }
  };
}

export const _esc = esc;
