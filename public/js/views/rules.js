// Automatic rules: expert presets created as Meta Automated Rules, so they run
// inside Meta around the clock (every 30 minutes, hourly or daily), even when
// this dashboard is closed. Preview what a rule would act on now, then manage
// the rules (on/off, delete) and read what they did.
import { html, raw, money, n, toast, confirmDialog, dateTime } from "../ui.js";
import { get, post } from "../api.js";
import { load, save, targets, saveTargets } from "../store.js";
import { PRESETS, buildRule, describeRule, preview } from "../rules.js";
import { connectCard, loadingCard } from "./common.js";

let tree7 = null; // 7-day campaign tree for previews
let rulesData = null;
let history = null;
let loading = false;
let picked = null; // Set of campaign ids in scope

const isMessages = (c) => c.objective === "OUTCOME_ENGAGEMENT" || c.objective === "MESSAGES" || /whatsapp|\bwa\b/i.test(c.name) || c.adsets.some((a) => /WHATSAPP|MESSENGER|MESSAGING/i.test(a.destination || ""));

function loadAll(ctx, force = false) {
  if (loading || (!force && tree7 && rulesData && history)) return;
  loading = true;
  Promise.all([get("/api/tree", { range: "last_7d" }), get("/api/rules"), get("/api/rules/history").catch(() => [])])
    .then(([t, r, h]) => {
      tree7 = t;
      rulesData = r;
      history = h;
    })
    .catch((e) => {
      rulesData = { error: e.message };
    })
    .finally(() => {
      loading = false;
      ctx.render();
    });
}

function params() {
  const t = targets();
  return { cpl: t.cpl, maxFrequency: t.maxFrequency, minCtr: t.minCtr, maxBudget: load("ruleMaxBudget", null), dailyCap: load("ruleDailyCap", null) };
}

function scopeFor(type) {
  const camps = (tree7?.campaigns || []).filter((c) => picked.has(c.id) && (type === "messages" ? isMessages(c) : !isMessages(c)));
  return { ids: camps.map((c) => c.id), label: camps.length === 1 ? camps[0].name.replace(/^GD \| /, "").slice(0, 40) : `${camps.length} campaigns` };
}

function presetCard(key, ctx) {
  const P = PRESETS[key];
  const p = params();
  const missing = P.needs.filter((k) => !(Number(p[k]) > 0));
  const parts = P.types.map((type) => ({ type, ...scopeFor(type) })).filter((x) => x.ids.length);
  let desc = null;
  let hits = [];
  if (!missing.length && parts.length) {
    try {
      const first = parts[0];
      desc = describeRule(buildRule(key, { ...p, type: first.type, campaignIds: first.ids }, rulesData?.offset || 100), rulesData?.offset || 100, rulesData?.currency || "EGP");
      for (const part of parts) hits = hits.concat(preview(key, { ...p, type: part.type, campaignIds: part.ids }, tree7));
    } catch (err) {
      desc = { text: err.message, conditions: [] };
    }
  }
  const ro = tree7?.readOnly;
  return html`<div class="card rulecard">
    <div class="card-head"><div><h3>${P.label}</h3><p>${P.why}</p></div><span class="pill ${P.action === "PAUSE" ? "warn" : P.action === "CHANGE_BUDGET" ? "info" : "line"}">${P.action === "PAUSE" ? "Switches off" : P.action === "CHANGE_BUDGET" ? "Raises budget" : "Notifies only"}</span></div>
    ${missing.length ? html`<div class="note warn">Set ${missing.map((m) => ({ cpl: "your target cost per lead", maxBudget: "the highest daily budget", dailyCap: "the daily spend alert" })[m]).join(" and ")} above first.</div>` : !parts.length ? html`<div class="note">${P.types.includes("messages") ? "Pick at least one campaign above." : "Pick at least one lead-form campaign above (this rule does not apply to WhatsApp campaigns)."}</div>` : html`
      <p class="small"><b>Rule:</b> ${desc.when}, ${desc.action} ${desc.level} where ${desc.conditions.join(" and ")} (${desc.time}).${parts.length > 1 ? " WhatsApp campaigns get their own copy counting conversations." : ""}</p>
      <p class="small muted" style="margin-top:6px"><b>Would act on now</b> (on the last 7 days, approximately): ${hits.length ? html`${n(hits.length)}` : "nothing"}</p>
      ${hits.length ? html`<ul class="list tight small" style="margin-top:4px">${hits.slice(0, 5).map((h) => html`<li><b>${h.name}</b> <span class="muted">· ${h.campaign} · ${h.why}</span></li>`)}${hits.length > 5 ? html`<li class="muted">and ${hits.length - 5} more</li>` : ""}</ul>` : ""}
      <div class="row" style="margin-top:10px"><button class="btn ${P.action === "NOTIFICATION" ? "" : "primary"}" type="button" data-create="${key}" ${ro ? raw("disabled title='Read-only mode'") : ""}>Create in Meta</button></div>`}
  </div>`;
}

function histRows(h, names) {
  return (h || []).slice(0, 30).map((e) => {
    const results = e.results || e.actions || [];
    return {
      at: e.timestamp || e.time || e.evaluation_time || e.created_time || null,
      rule: e.rule_name || names[e.rule_id] || names[e.id] || e.rule_id || "Rule",
      items: results.map((r) => ({ name: r.object_name || r.object_id || "", action: r.action || (r.actions || []).map((a) => a.action || a.field || "").join(", ") || "", why: r.why || "" })),
    };
  });
}

let mode = null;
export function render(ctx) {
  // Demo and real accounts have different campaigns and rules.
  if (ctx.settings && mode !== Boolean(ctx.settings.demo)) {
    mode = Boolean(ctx.settings.demo);
    tree7 = rulesData = history = picked = null;
  }
  const top = html`<div class="top"><div><h1>Automatic rules</h1><p class="sub">Rules run inside Meta every 30 minutes, hourly or daily, even when this dashboard is closed and you are asleep. Start with the presets: each one is a habit of experienced media buyers, filled in with your numbers.</p></div>
    <div class="top-actions"><button class="btn icon" type="button" data-rrefresh title="Refresh" aria-label="Refresh">↻</button></div></div>`;
  if (!ctx.settings) return html`${top}${loadingCard()}`;
  if (!ctx.settings.connected) return html`${top}${connectCard(ctx.settings)}`;
  loadAll(ctx);
  if (!tree7 || !rulesData) return html`${top}${loadingCard()}`;
  if (rulesData.error) return html`${top}<div class="note bad"><b>Could not load the rules from Meta.</b> ${rulesData.error}</div>`;

  const camps = tree7.campaigns;
  if (!picked) picked = new Set(camps.filter((c) => c.status === "ACTIVE").map((c) => c.id));
  const names = Object.fromEntries((rulesData.rules || []).map((r) => [r.id, r.name]));
  const campName = Object.fromEntries(camps.map((c) => [String(c.id), c.name]));
  const t = targets();
  const p = params();
  const rows = histRows(history, names);
  const ro = tree7.readOnly;

  return html`${top}
  ${ro ? html`<div class="note warn" style="margin-bottom:12px"><b>Read-only mode.</b> Rules can be read here but not created or changed (META_READ_ONLY).</div>` : ""}
  <div class="note" style="margin-bottom:12px">Meta sends rule notifications to the account that created the rule (the dashboard's system user), so check <b>What the rules did</b> below, or Ads Manager → Rules. Every switch-off can be undone from Campaigns.</div>
  <div class="card">
    <div class="card-head"><div><h2>Your numbers</h2><p>The presets use these. Change them any time; existing rules keep the numbers they were created with.</p></div></div>
    <form class="fields" data-rnums>
      <label class="field"><span>Target cost per lead (EGP)</span><input class="input" type="number" min="1" step="1" name="cpl" value="${t.cpl ?? ""}" placeholder="e.g. 250"></label>
      <label class="field"><span>Highest daily budget when scaling (EGP)</span><input class="input" type="number" min="1" step="50" name="maxBudget" value="${p.maxBudget ?? ""}" placeholder="e.g. 1500"></label>
      <label class="field"><span>Daily spend alert per campaign (EGP)</span><input class="input" type="number" min="1" step="50" name="dailyCap" value="${p.dailyCap ?? ""}" placeholder="e.g. 2000"></label>
      <label class="field"><span>Tired when frequency above</span><input class="input" type="number" min="1" step="0.1" name="maxFrequency" value="${t.maxFrequency}"></label>
      <label class="field"><span>…and link CTR below (%)</span><input class="input" type="number" min="0.05" step="0.05" name="minCtr" value="${t.minCtr}"></label>
      <div class="field" style="align-self:end"><button class="btn" type="submit">Save numbers</button></div>
    </form>
    <hr class="hr">
    <div class="row between wrap"><h3>Campaigns the rules cover</h3><div class="row small"><button class="btn sm ghost" type="button" data-rall="on">All on</button><button class="btn sm ghost" type="button" data-rall="all">All</button><button class="btn sm ghost" type="button" data-rall="none">None</button></div></div>
    <div class="chips" style="margin-top:8px">${camps.map((c) => html`<label class="chip ${picked.has(c.id) ? "on" : ""}" style="padding-right:10px;cursor:pointer"><input type="checkbox" data-rcamp="${c.id}" ${picked.has(c.id) ? raw("checked") : ""} style="margin:0 4px 0 0">${c.name}${isMessages(c) ? html` <span class="pill line">WhatsApp</span>` : ""}</label>`)}</div>
  </div>
  <div class="grid g2">${Object.keys(PRESETS).map((k) => presetCard(k, ctx))}</div>
  <div class="card">
    <div class="card-head"><div><h2>Rules in Meta</h2><p>All automated rules in this ad account, including ones made in Ads Manager.</p></div></div>
    ${(rulesData.rules || []).length ? html`<div class="stack">${rulesData.rules.map((r) => {
      const d = describeRule(r, rulesData.offset, rulesData.currency, (id) => campName[String(id)] || id);
      const on = r.status === "ENABLED";
      return html`<div class="lead"><div class="row between wrap" style="align-items:flex-start"><div class="row" style="gap:10px;align-items:flex-start"><button type="button" class="switch" role="switch" aria-checked="${on}" aria-label="${on ? "Turn off" : "Turn on"} ${r.name}" data-rstatus="${r.id}" ${ro ? raw("disabled") : ""}></button><div><b>${r.name}</b><div class="small muted">${d.text}</div>${d.campaigns.length ? html`<div class="tiny faint">Campaigns: ${d.campaigns.join(", ")}</div>` : ""}</div></div><div class="row"><span class="pill ${on ? "good" : "line"}">${on ? "On" : "Off"}</span><button class="btn sm ghost danger" type="button" data-rdel="${r.id}" ${ro ? raw("disabled") : ""}>Delete</button></div></div><div class="tiny faint">Created ${dateTime(r.created_time)}</div></div>`;
    })}</div>` : html`<p class="muted">No rules yet. Create one from the presets above.</p>`}
  </div>
  <div class="card">
    <div class="card-head"><div><h2>What the rules did</h2><p>Latest runs that changed something or sent a notification.</p></div></div>
    ${rows.length ? html`<div class="stack">${rows.map((e) => html`<div class="lead"><div class="row between wrap"><b>${e.rule}</b><span class="small muted">${dateTime(e.at)}</span></div>${e.items.length ? html`<ul class="list tight small">${e.items.slice(0, 8).map((i) => html`<li>${i.action ? html`<b>${i.action}</b>: ` : ""}${i.name}${i.why ? html` <span class="muted">(${i.why})</span>` : ""}</li>`)}</ul>` : html`<p class="small muted">Ran; nothing matched.</p>`}</div>`)}</div>` : html`<p class="muted small">Nothing yet. Rules record here when they act.</p>`}
  </div>`;
}

export function mount(root, ctx) {
  root.onsubmit = (e) => {
    const f = e.target.closest("[data-rnums]");
    if (!f) return;
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    const num = (v) => (v === "" ? null : Number(v));
    saveTargets({ ...load("targets", {}), cpl: num(d.cpl), maxFrequency: num(d.maxFrequency) ?? 3, minCtr: num(d.minCtr) ?? 0.5 });
    save("ruleMaxBudget", num(d.maxBudget));
    save("ruleDailyCap", num(d.dailyCap));
    toast("Numbers saved.", "good");
    ctx.render();
  };
  root.onchange = (e) => {
    const c = e.target.closest("[data-rcamp]");
    if (c) {
      c.checked ? picked.add(c.dataset.rcamp) : picked.delete(c.dataset.rcamp);
      ctx.render();
    }
  };
  root.onclick = async (e) => {
    if (e.target.closest("[data-rrefresh]")) {
      tree7 = rulesData = history = null;
      return ctx.render();
    }
    const all = e.target.closest("[data-rall]");
    if (all) {
      const camps = tree7?.campaigns || [];
      picked = new Set(all.dataset.rall === "none" ? [] : camps.filter((c) => all.dataset.rall === "all" || c.status === "ACTIVE").map((c) => c.id));
      return ctx.render();
    }
    const cr = e.target.closest("[data-create]");
    if (cr) {
      const key = cr.dataset.create;
      const P = PRESETS[key];
      const p = params();
      const parts = P.types.map((type) => ({ type, ...scopeFor(type) })).filter((x) => x.ids.length);
      const descs = parts.map((part) => ({ part, d: describeRule(buildRule(key, { ...p, type: part.type, campaignIds: part.ids, scopeLabel: part.label }, rulesData?.offset || 100), rulesData?.offset || 100, rulesData?.currency || "EGP", (id) => (tree7.campaigns.find((c) => String(c.id) === String(id)) || {}).name || id) }));
      const ok = await confirmDialog({
        title: `Create ${parts.length > 1 ? `${parts.length} rules` : "this rule"} in Meta?`,
        body: html`${descs.map(({ part, d }) => html`<div class="diff" style="margin-top:8px"><div><b>${P.label}${part.type === "messages" ? " (WhatsApp)" : ""}</b></div><div>${d.when}: ${d.action} ${d.level} where ${d.conditions.join(" and ")} (${d.time})</div><div class="tiny">${d.campaigns.join(", ")}</div></div>`)}<p class="small" style="margin-top:8px">It runs inside Meta from now on. You can switch it off or delete it here any time.</p>`,
        ok: "Create",
      });
      if (!ok) return;
      for (const { part } of descs) {
        try {
          const r = await post("/api/rules", { preset: key, params: { ...p, type: part.type, campaignIds: part.ids, scopeLabel: part.label } });
          toast(r.demoRun !== undefined ? `Rule created. Demo run: ${r.demoRun} item${r.demoRun === 1 ? "" : "s"} acted on.` : "Rule created in Meta.", "good");
        } catch (err) {
          toast(err.message, "bad");
        }
      }
      tree7 = rulesData = history = null;
      ctx.loadTree?.(true);
      return ctx.render();
    }
    const st = e.target.closest("[data-rstatus]");
    if (st) {
      const r = (rulesData?.rules || []).find((x) => String(x.id) === st.dataset.rstatus);
      if (!r) return;
      const on = r.status === "ENABLED";
      const ok = await confirmDialog({ title: on ? "Switch this rule off?" : "Switch this rule on?", body: html`<b>${r.name}</b><br>${on ? "Meta stops running it until you switch it back on." : "Meta starts running it again on its schedule."}`, ok: on ? "Switch off" : "Switch on", danger: on });
      if (!ok) return;
      try {
        await post("/api/rules/status", { id: r.id, status: on ? "DISABLED" : "ENABLED" });
        r.status = on ? "DISABLED" : "ENABLED";
        toast(`Rule ${on ? "off" : "on"}.`, "good");
      } catch (err) {
        toast(err.message, "bad");
      }
      return ctx.render();
    }
    const del = e.target.closest("[data-rdel]");
    if (del) {
      const r = (rulesData?.rules || []).find((x) => String(x.id) === del.dataset.rdel);
      if (!r) return;
      const ok = await confirmDialog({ title: "Delete this rule?", body: html`<b>${r.name}</b> is removed from Meta. What it already did stays done.`, ok: "Delete", danger: true });
      if (!ok) return;
      try {
        await post("/api/rules/delete", { id: r.id });
        toast("Rule deleted.", "good");
      } catch (err) {
        toast(err.message, "bad");
      }
      rulesData = null;
      return ctx.render();
    }
  };
}

export const _test = { isMessages };
