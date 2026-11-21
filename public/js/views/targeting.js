// Targeting editor for one ad set: locations, ages, gender, interests and
// custom audiences. Shows the change before saving; the server only accepts
// these fields and checks the ad set is in the connected ad account.
import { html, raw, $, toast, confirmDialog, openDrawer, closeDrawer, debounce, esc } from "../ui.js";
import { get, post } from "../api.js";
import { describeChange } from "./targeting-diff.js";

let audiencesCache = null;
const AGES = Array.from({ length: 48 }, (_, i) => 18 + i);

export async function openTargeting(adset, ctx) {
  const el = openDrawer(html`<div class="drawer-head"><div><h2>Targeting</h2><p class="small muted">${adset.name}</p></div><button class="btn sm ghost" type="button" data-close>Close</button></div><div class="drawer-body"><div class="skeleton"></div><div class="skeleton"></div></div>`);
  let data;
  try {
    [data, audiencesCache] = await Promise.all([get("/api/targeting", { id: adset.id }), audiencesCache ? Promise.resolve(audiencesCache) : get("/api/audiences").catch(() => [])]);
  } catch (e) {
    $(".drawer-body", el).innerHTML = html`<div class="note bad"><b>Could not load the targeting.</b> ${e.message}</div>`.s;
    return;
  }
  const orig = data.targeting || {};
  const geo = orig.geo_locations || {};
  const flex = orig.flexible_spec || [];
  const st = {
    countries: [...(geo.countries || [])],
    regions: [...(geo.regions || [])],
    cities: [...(geo.cities || [])],
    ageMin: orig.age_min ?? 18,
    ageMax: orig.age_max ?? 65,
    genders: [...(orig.genders || [])],
    interests: [...(flex[0]?.interests || [])],
    work: [...(flex[0]?.work_positions || [])],
    include: [...(orig.custom_audiences || [])],
    exclude: [...(orig.excluded_custom_audiences || [])],
    results: [],
    resultsFor: "",
  };
  const ro = ctx.tree?.readOnly;
  const advantage = orig.targeting_automation?.advantage_audience === 1;
  const otherGroups = flex.length > 1;
  const groupOther = flex[0] ? Object.keys(flex[0]).filter((k) => !["interests", "work_positions"].includes(k)) : [];

  const chip = (label, key, i) => html`<span class="chip">${label}<button type="button" aria-label="Remove ${label}" data-rm="${key}" data-i="${i}" ${ro ? raw("disabled") : ""}>×</button></span>`;
  const audName = (a) => a.name || audiencesCache?.find((x) => x.id === a.id)?.name || a.id;

  function draw() {
    const body = $(".drawer-body", el);
    if (!body) return;
    const keepFocus = document.activeElement?.dataset?.search;
    const keepVal = keepFocus ? document.activeElement.value : "";
    body.innerHTML = html`
      ${advantage ? html`<div class="note"><b>Advantage+ audience is on.</b> Meta treats ages, gender and interests as suggestions and may show ads beyond them. Locations and the minimum age stay firm. To control the audience strictly, switch Advantage+ audience off in Ads Manager.</div>` : ""}
      <section><h3>Locations</h3><p class="small muted" style="margin:2px 0 8px">Where the buyers live now. For Egyptians abroad, add the Gulf cities.</p>
        <div class="chips">${st.countries.map((c, i) => chip(c, "countries", i))}${st.regions.map((r, i) => chip(r.name || r.key, "regions", i))}${st.cities.map((c, i) => chip(`${c.name || c.key}${c.radius ? ` +${c.radius}${c.distance_unit === "mile" ? "mi" : "km"}` : ""}`, "cities", i))}</div>
        ${ro ? "" : html`<input class="input" style="margin-top:8px" type="search" placeholder="Add a city, area or country (e.g. New Cairo, Riyadh)" data-search="location" value="${st.resultsFor === "location" ? keepVal : ""}">`}
        ${st.resultsFor === "location" && st.results.length ? html`<div class="results" style="margin-top:6px">${st.results.map((r, i) => html`<button type="button" data-add="location" data-i="${i}"><span>${r.name}${r.region ? `, ${r.region}` : ""}</span><span class="muted small">${r.type}${r.country ? ` · ${r.country}` : ""}</span></button>`)}</div>` : ""}
      </section>
      <section><h3>Age and gender</h3>
        <div class="row wrap" style="margin-top:8px">
          <label class="field"><span>From</span><select class="input" data-age="min" ${ro ? raw("disabled") : ""}>${AGES.map((a) => html`<option ${a === st.ageMin ? raw("selected") : ""}>${a}</option>`)}</select></label>
          <label class="field"><span>To</span><select class="input" data-age="max" ${ro ? raw("disabled") : ""}>${AGES.map((a) => html`<option value="${a}" ${a === st.ageMax ? raw("selected") : ""}>${a === 65 ? "65+" : a}</option>`)}</select></label>
          <div class="field"><span>Gender</span><div class="seg">${[["all", "All"], ["1", "Men"], ["2", "Women"]].map(([v, l]) => html`<button type="button" data-gender="${v}" aria-pressed="${v === "all" ? !st.genders.length || st.genders.length === 2 : st.genders.length === 1 && String(st.genders[0]) === v}" ${ro ? raw("disabled") : ""}>${l}</button>`)}</div></div>
        </div>
        <p class="small muted" style="margin-top:6px">Property buyers with real budgets are rarely under 27. Excluding men or women usually cuts good buyers: keep "All" unless results prove otherwise.</p>
      </section>
      <section><h3>Interests and job titles</h3><p class="small muted" style="margin:2px 0 8px">People who match any of these. ${otherGroups ? "This ad set also has narrowing groups that are kept as they are." : ""}${groupOther.length ? ` Other parts of this group (${groupOther.join(", ")}) are kept.` : ""}</p>
        <div class="chips">${st.interests.map((x, i) => chip(x.name || x.id, "interests", i))}${st.work.map((x, i) => chip(`Job: ${x.name || x.id}`, "work", i))}</div>
        ${ro ? "" : html`<div class="row" style="margin-top:8px"><input class="input grow" type="search" placeholder="Add an interest (e.g. Golf, Real estate investing)" data-search="interest" value="${st.resultsFor === "interest" ? keepVal : ""}"><input class="input" style="width:42%" type="search" placeholder="Job title (e.g. Doctor)" data-search="job" value="${st.resultsFor === "job" ? keepVal : ""}"></div>`}
        ${(st.resultsFor === "interest" || st.resultsFor === "job") && st.results.length ? html`<div class="results" style="margin-top:6px">${st.results.map((r, i) => html`<button type="button" data-add="${st.resultsFor}" data-i="${i}"><span>${r.name}</span><span class="muted small">${r.size ? `${(r.size / 1e6).toFixed(1)}M people` : ""} ${r.path || ""}</span></button>`)}</div>` : ""}
      </section>
      <section><h3>Custom audiences</h3><p class="small muted" style="margin:2px 0 8px">Include website visitors, video viewers or lookalikes of valid leads. Exclude people who already sent their details.</p>
        <div class="small muted">Include</div><div class="chips" style="margin:4px 0 8px">${st.include.length ? st.include.map((a, i) => chip(audName(a), "include", i)) : html`<span class="faint small">None</span>`}</div>
        <div class="small muted">Exclude</div><div class="chips" style="margin:4px 0 8px">${st.exclude.length ? st.exclude.map((a, i) => chip(audName(a), "exclude", i)) : html`<span class="faint small">None</span>`}</div>
        ${ro || !audiencesCache?.length ? (audiencesCache?.length ? "" : html`<p class="small faint">No custom audiences in this ad account yet. See Audiences for which ones to build.</p>`) : html`<div class="row wrap">
          <select class="input grow" data-aud-pick><option value="">Choose an audience…</option>${audiencesCache.map((a) => html`<option value="${a.id}">${a.name}${a.max ? ` (${a.min?.toLocaleString() ?? "?"}–${a.max.toLocaleString()})` : ""}</option>`)}</select>
          <button class="btn sm" type="button" data-aud="include">Include</button><button class="btn sm" type="button" data-aud="exclude">Exclude</button></div>`}
      </section>`.s;
    if (keepFocus) {
      const i = $(`[data-search="${keepFocus}"]`, body);
      i?.focus();
      i?.setSelectionRange(keepVal.length, keepVal.length);
    }
  }

  const foot = document.createElement("div");
  foot.className = "drawer-foot";
  foot.innerHTML = ro ? html`<button class="btn" type="button" data-close>Close</button>`.s : html`<button class="btn" type="button" data-close>Cancel</button><button class="btn primary" type="button" data-save>Review and save</button>`.s;
  el.append(foot);
  draw();

  const runSearch = debounce(async (type, q) => {
    if (q.trim().length < 2) {
      st.results = [];
      return draw();
    }
    try {
      st.results = await get("/api/search", { type, q });
      st.resultsFor = type;
      draw();
    } catch (e) {
      toast(e.message, "bad");
    }
  }, 350);

  el.addEventListener("input", (e) => {
    const s = e.target.closest("[data-search]");
    if (s) {
      st.resultsFor = s.dataset.search;
      runSearch(s.dataset.search, s.value);
    }
  });
  el.addEventListener("change", (e) => {
    const a = e.target.closest("[data-age]");
    if (a) {
      st[a.dataset.age === "min" ? "ageMin" : "ageMax"] = Number(a.value);
      if (st.ageMin > st.ageMax) [st.ageMin, st.ageMax] = [st.ageMax, st.ageMin];
      draw();
    }
  });
  el.addEventListener("click", async (e) => {
    const rm = e.target.closest("[data-rm]");
    if (rm) {
      st[rm.dataset.rm].splice(Number(rm.dataset.i), 1);
      return draw();
    }
    const g = e.target.closest("[data-gender]");
    if (g) {
      st.genders = g.dataset.gender === "all" ? [] : [Number(g.dataset.gender)];
      return draw();
    }
    const add = e.target.closest("[data-add]");
    if (add) {
      const r = st.results[Number(add.dataset.i)];
      if (add.dataset.add === "location") {
        if (r.type === "country") !st.countries.includes(r.key) && st.countries.push(r.key);
        else if (r.type === "region") !st.regions.some((x) => x.key === r.key) && st.regions.push({ key: r.key, name: r.name });
        else !st.cities.some((x) => x.key === r.key) && st.cities.push({ key: r.key, name: r.name });
      } else if (add.dataset.add === "interest") !st.interests.some((x) => x.id === r.id) && st.interests.push({ id: r.id, name: r.name });
      else if (add.dataset.add === "job") !st.work.some((x) => x.id === r.id) && st.work.push({ id: r.id, name: r.name });
      st.results = [];
      $$clear(el);
      return draw();
    }
    const aud = e.target.closest("[data-aud]");
    if (aud) {
      const id = $("[data-aud-pick]", el)?.value;
      if (!id) return toast("Choose an audience first.");
      const a = audiencesCache.find((x) => x.id === id);
      const list = st[aud.dataset.aud];
      const other = st[aud.dataset.aud === "include" ? "exclude" : "include"];
      if (other.some((x) => x.id === id)) return toast("That audience is already on the other list.", "bad");
      if (!list.some((x) => x.id === id)) list.push({ id, name: a?.name });
      return draw();
    }
    if (e.target.closest("[data-save]")) {
      const patch = buildPatch(orig, st);
      if (!Object.keys(patch).length) return toast("Nothing changed.");
      const ok = await confirmDialog({ title: "Save the new targeting?", body: html`<b>${adset.name}</b><div class="diff" style="margin-top:8px">${describeChange(orig, patch, audiencesCache, [...st.countries, ...st.regions.map((r) => r.name || r.key), ...st.cities.map((c) => c.name || c.key)])}</div><p class="small" style="margin-top:8px">A big targeting change sends the ad set back into learning for a few days.</p>`, ok: "Save targeting" });
      if (!ok) return;
      const btn = e.target.closest("[data-save]");
      btn.disabled = true;
      btn.innerHTML = '<span class="spin"></span> Saving';
      try {
        await post("/api/targeting", { id: adset.id, patch });
        toast("Targeting saved.", "good");
        closeDrawer();
        ctx.loadTree(true);
      } catch (err) {
        toast(err.message, "bad");
        btn.disabled = false;
        btn.textContent = "Review and save";
      }
    }
  });
}

function $$clear(el) {
  for (const i of el.querySelectorAll("[data-search]")) i.value = "";
}

const strip = (list, keys) => list.map((x) => Object.fromEntries(Object.entries(x).filter(([k]) => keys.includes(k))));
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Only the parts that changed, in the shape Meta expects. */
function buildPatch(orig, st) {
  const patch = {};
  const geo = orig.geo_locations || {};
  const nextGeo = { ...geo, countries: st.countries, regions: strip(st.regions, ["key"]), cities: strip(st.cities, ["key", "radius", "distance_unit"]) };
  for (const k of ["countries", "regions", "cities"]) if (!nextGeo[k].length) delete nextGeo[k];
  const origGeoCmp = { countries: geo.countries || [], regions: strip(geo.regions || [], ["key"]), cities: strip(geo.cities || [], ["key", "radius", "distance_unit"]) };
  const nextGeoCmp = { countries: st.countries, regions: strip(st.regions, ["key"]), cities: strip(st.cities, ["key", "radius", "distance_unit"]) };
  if (!same(origGeoCmp, nextGeoCmp)) patch.geo_locations = nextGeo;
  if (st.ageMin !== (orig.age_min ?? 18)) patch.age_min = st.ageMin;
  if (st.ageMax !== (orig.age_max ?? 65)) patch.age_max = st.ageMax;
  const og = [...(orig.genders || [])].sort();
  const ng = st.genders.length === 2 ? [] : [...st.genders].sort();
  if (!same(og.length === 2 ? [] : og, ng)) patch.genders = ng;
  const flex = orig.flexible_spec || [];
  const g0 = { ...(flex[0] || {}) };
  const ni = strip(st.interests, ["id", "name"]);
  const nw = strip(st.work, ["id", "name"]);
  if (!same(strip(g0.interests || [], ["id", "name"]), ni) || !same(strip(g0.work_positions || [], ["id", "name"]), nw)) {
    if (ni.length) g0.interests = ni;
    else delete g0.interests;
    if (nw.length) g0.work_positions = nw;
    else delete g0.work_positions;
    const rest = flex.slice(1);
    patch.flexible_spec = Object.keys(g0).length ? [g0, ...rest] : rest;
  }
  const ids = (l) => l.map((a) => ({ id: a.id }));
  if (!same(ids(orig.custom_audiences || []), ids(st.include))) patch.custom_audiences = ids(st.include);
  if (!same(ids(orig.excluded_custom_audiences || []), ids(st.exclude))) patch.excluded_custom_audiences = ids(st.exclude);
  return patch;
}

export const _test = { buildPatch, esc };
