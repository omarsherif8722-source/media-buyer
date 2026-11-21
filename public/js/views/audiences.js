// Who to target for each project, how to set up the ad sets, which custom
// audiences and lookalikes to build, and lists to upload to Meta.
import { html, raw, egp, n, download, toCSV, toast } from "../ui.js";
import { load, save } from "../store.js";
import { allLeads, isValid, RESERVED_UP } from "../model.js";
import { PLAYBOOK, PRIORITY } from "../playbook.js";

let pick = load("audiencesProject", "krypton");

export function projectPicker(ctx, current, attr = "data-project") {
  const ps = [...(ctx.catalog?.projects || [])].sort((a, b) => (PLAYBOOK[a.id]?.priority || 9) - (PLAYBOOK[b.id]?.priority || 9));
  return html`<div class="pick" role="group" aria-label="Project">${ps.map((p) => html`<button type="button" class="chip add ${p.id === current ? "on" : ""}" ${raw(attr)}="${p.id}" aria-pressed="${p.id === current}">${p.name}</button>`)}</div>`;
}

const e164 = (p) => {
  let d = String(p || "").replace(/[^\d+]/g, "");
  if (d.startsWith("+")) return d;
  d = d.replace(/^00/, "");
  if (/^01\d{9}$/.test(d)) return `+2${d}`;
  return d ? `+${d}` : "";
};

function listFile(kind) {
  const leads = allLeads().filter((l) => (kind === "valid" ? isValid(l.stage) : kind === "buyers" ? RESERVED_UP.has(l.stage) : true)).filter((l) => l.phone || l.email);
  if (!leads.length) return toast("No leads for that list yet.", "bad");
  const rows = leads.map((l) => {
    const [fn, ...rest] = String(l.name || "").trim().split(/\s+/);
    return [e164(l.phone), String(l.email || "").toLowerCase(), fn || "", rest.join(" "), "EG"];
  });
  download(`meta-list-${kind}-${new Date().toISOString().slice(0, 10)}.csv`, toCSV([["phone", "email", "fn", "ln", "country"], ...rows]));
  toast(`${rows.length} people in the list. Upload it in Meta: Audiences → Create → Custom audience → Customer list.`, "good");
}

export function render(ctx) {
  const p = ctx.catalog?.projects?.find((x) => x.id === pick) || ctx.catalog?.projects?.[0];
  const pb = p ? PLAYBOOK[p.id] : null;
  const leads = allLeads();
  const validCount = leads.filter((l) => isValid(l.stage)).length;
  return html`
  <div class="top"><div><h1>Audiences</h1><p class="sub">Who to show each project to. Start with these, then keep the ad sets that bring the lowest cost per valid lead.</p></div></div>
  <div class="note warn" style="margin-bottom:14px"><b>Housing ads.</b> Meta treats property sales as a special ad category. If any ad set reaches people in the US, Canada or Europe (for example Egyptians abroad), you must pick "Housing", and age, gender, ZIP and lookalike targeting are limited there. Ads aimed only at Egypt and the Gulf still ask for the category, but the limits there are usually optional. Check what Ads Manager says when you create the campaign.</div>
  ${p ? projectPicker(ctx, p.id) : ""}
  ${p && pb ? html`
  <div class="grid g2" style="margin-top:14px">
    <div class="card pcard">
      <div class="card-head"><div><h3>${p.name}${p.parent ? html` <span class="tag">· ${p.parent}</span>` : ""}</h3><p>${p.place} · ${p.status} · from ${egp(p.from)}</p></div><span class="pill ${PRIORITY[pb.priority][1]}">${PRIORITY[pb.priority][0]}</span></div>
      <p>${pb.why}</p>
      <hr class="hr">
      <h3 style="margin-bottom:8px">Who buys</h3>
      <div class="stack">${pb.buyers.map((b) => html`<div><b>${b.who}</b> <span class="pill line">${b.age}</span><p class="muted small" style="margin-top:2px">${b.angle}</p></div>`)}</div>
    </div>
    <div class="card">
      <h3>Where</h3>
      <p class="small muted" style="margin:2px 0 6px">Egypt (people living in these places)</p>
      <div class="chips">${pb.geo.egypt.map((g) => html`<span class="chip" style="padding-right:10px">${g}</span>`)}</div>
      ${pb.geo.abroad.length ? html`<p class="small muted" style="margin:10px 0 6px">Egyptians abroad (a separate ad set, so you can compare costs)</p><div class="chips">${pb.geo.abroad.map((g) => html`<span class="chip" style="padding-right:10px">${g}</span>`)}</div>` : ""}
      <hr class="hr">
      <h3>Interests and titles to try</h3>
      <p class="small muted" style="margin:2px 0 6px">Search these in the Targeting editor. Names in Meta can differ slightly.</p>
      <div class="chips">${pb.interests.map((g) => html`<span class="chip" style="padding-right:10px">${g}</span>`)}</div>
    </div>
  </div>
  <div class="card">
    <div class="card-head"><div><h2>Ad sets to start ${p.name} with</h2><p>One campaign per project. Equal budgets for 5–7 days, then move money to the lowest cost per valid lead.</p></div></div>
    <div class="table-wrap"><table><thead><tr><th>Ad set</th><th>Who</th><th>Why</th></tr></thead><tbody>
      <tr><td class="name">A · Broad</td><td>${pb.geo.egypt.slice(0, 3).join(", ")} +15 km, age ${pb.buyers[0].age.split("–")[0]}–65+, Advantage+ audience on</td><td>Lets Meta find buyers. Works once the form or chat filters out low budgets.</td></tr>
      <tr><td class="name">B · Interests</td><td>Same places, ${pb.interests.slice(0, 3).join(", ")}</td><td>A tighter start while the pixel and lead stages have little data.</td></tr>
      <tr><td class="name">C · Warm</td><td>Website visitors of the ${p.name} page, video viewers, people who opened the form</td><td>People who already looked. Usually the lowest cost per valid lead; small budget.</td></tr>
      ${pb.geo.abroad.length ? html`<tr><td class="name">D · Abroad</td><td>${pb.geo.abroad.slice(0, 4).join(", ")}, interest "Lived in Egypt" or Arabic speakers</td><td>Gulf-based buyers often have the budget; keep it separate to watch its cost.</td></tr>` : ""}
      <tr><td class="name">Later · Lookalike</td><td>1–3% lookalike of valid leads and reservations (Egypt)</td><td>Needs at least 100 people in the source list. Use valid leads, never all leads.</td></tr>
    </tbody></table></div>
  </div>` : ""}
  <div class="grid g2">
    <div class="card"><h2>Custom audiences to build</h2><p class="small muted" style="margin:2px 0 10px">In Meta: Audiences → Create audience → Custom audience.</p>
      <ol class="list">
        <li><b>Website visitors</b>, last 30 days, of each project page${p ? html` (for example <code>${p.url}</code>)` : ""}. Needs the Meta Pixel on the website.</li>
        <li><b>Video viewers</b>, 50% or more of a project video, last 90 days${p?.hasFilm ? `; ${p.name} has a film on the website you can run as an ad` : ""}.</li>
        <li><b>Lead form</b>: people who opened the form but did not send it, last 30 days.</li>
        <li><b>Engagers</b>: people who interacted with the Page or Instagram, last 60 days.</li>
        <li><b>Chats</b>: people who messaged the Page or WhatsApp, last 90 days.</li>
        <li><b>Your lead list</b> (below), to exclude people you already have, so you do not pay twice for them.</li>
      </ol>
    </div>
    <div class="card"><h2>Lists for Meta from your leads</h2><p class="small muted" style="margin:2px 0 10px">Upload as a Customer list. Meta hashes the phones and emails on upload. Phones are written as +20…</p>
      <div class="stack">
        <div class="row between wrap"><div><b>Valid leads</b><p class="small muted">Seed for lookalikes (${n(validCount)} now, need 100+).</p></div><button class="btn sm" type="button" data-list="valid">Download</button></div>
        <div class="row between wrap"><div><b>Reserved and sold</b><p class="small muted">The best seed once you have enough.</p></div><button class="btn sm" type="button" data-list="buyers">Download</button></div>
        <div class="row between wrap"><div><b>All leads</b><p class="small muted">To exclude people already in contact.</p></div><button class="btn sm" type="button" data-list="all">Download</button></div>
      </div>
    </div>
  </div>`;
}

export function mount(root, ctx) {
  root.onclick = (e) => {
    const b = e.target.closest("[data-project]");
    if (b) {
      pick = b.dataset.project;
      save("audiencesProject", pick);
      return ctx.render();
    }
    const l = e.target.closest("[data-list]");
    if (l) listFile(l.dataset.list);
  };
}
