// What to say for each project: the numbers buyers care about, angles to
// test, ready ad copy in English and Egyptian Arabic, and a lead form that
// filters for real buyers. Figures come from the website data.
import { html, raw, egp, copy, $ } from "../ui.js";
import { load, save } from "../store.js";
import { PLAYBOOK, fill, tokens, mainPlan, budgetBuckets } from "../playbook.js";
import { projectPicker } from "./audiences.js";

let pick = load("messagesProject", "krypton");

function formText(p, pb) {
  const homes = p.homes?.length ? p.homes.map((h) => h.name) : (p.inventory?.byType || []).slice(0, 5).map((t) => t.type);
  const q = [];
  if (homes.length) q.push(["Which home are you interested in?", [...homes, "Not sure yet"]]);
  const b = budgetBuckets(p);
  if (b.length) q.push(["What budget do you have in mind?", b]);
  q.push(["When are you planning to buy?", ["Now", "Within 3 months", "3 to 6 months", "Later than 6 months"]]);
  if (p.cashOnly) q.push(["This project is sold for cash. Is cash payment possible for you?", ["Yes", "No, I need installments"]]);
  else q.push(["How would you like to pay?", ["Installments", "Cash"]]);
  if (pb?.purpose) q.push(["Are you buying to live in or to invest?", ["To live in", "To invest or rent", "Both"]]);
  q.push(["How should we contact you?", ["WhatsApp", "Phone call"]]);
  return q;
}

export function render(ctx) {
  const p = ctx.catalog?.projects?.find((x) => x.id === pick) || ctx.catalog?.projects?.[0];
  if (!p) return html`<div class="top"><h1>Messages</h1></div><div class="card empty"><h3>No project data</h3><p>Run scripts/sync-website.mjs.</p></div>`;
  const pb = PLAYBOOK[p.id];
  const tk = tokens(p);
  const plan = mainPlan(p);
  const angles = (pb?.angles || []).map((a) => fill(a, p)).filter(Boolean);
  const form = formText(p, pb);
  const formCopy = form.map(([qq, a]) => `${qq}\n${a.map((x) => `  • ${x}`).join("\n")}`).join("\n\n");
  const block = (label, text, dir = "ltr", lang = "en") => html`<div class="copy-block"><div class="row between"><span class="label">${label}</span><button class="btn sm ghost" type="button" data-copy="${text}">Copy</button></div><p dir="${dir}" lang="${lang}">${text}</p></div>`;
  return html`
  <div class="top"><div><h1>Messages</h1><p class="sub">Say the price and the plan up front: it keeps away people who cannot buy and brings real buyers to the call. Tone: a private advisor helping people find what suits them, not a hard sell.</p></div></div>
  ${projectPicker(ctx, p.id, "data-mproject")}
  <div class="grid g2" style="margin-top:14px">
    <div class="card">
      <div class="card-head"><div><h2>${p.name}</h2><p>${p.place} · ${p.status}</p></div><a class="btn sm" href="${p.url}" target="_blank" rel="noopener">Open page</a></div>
      <dl class="kv">
        <dt>Starting price</dt><dd>${egp(p.from)} <span class="faint small">${p.fromSource || ""}</span></dd>
        <dt>Plan</dt><dd>${plan ? (plan.cashOnly ? "Cash" : `${(plan.down || []).map((d) => `${d}%`).join(" + ")} down, ${plan.years} years (${plan.installments} ${plan.annual ? "yearly" : "quarterly"} installments)`) : "—"}${plan && !plan.official ? html` <span class="pill warn">not on the official sheet</span>` : ""}</dd>
        <dt>Cash discount</dt><dd>${tk.cash || "—"}</dd>
        <dt>Delivery</dt><dd>${plan?.delivery ? `${plan.delivery} months` : "—"}</dd>
        <dt>Maintenance</dt><dd>${p.payment?.maintenance ? `${p.payment.maintenance.pct}%, ${p.payment.maintenance.due}` : "—"}</dd>
      </dl>
      ${plan?.note ? html`<p class="small muted" style="margin-top:8px">${plan.note}</p>` : ""}
      <hr class="hr">
      <h3 style="margin-bottom:6px">Angles to test (one per ad)</h3>
      <ol class="list">${angles.map((a) => html`<li>${a}</li>`)}${(p.highlights || []).slice(0, 3).map((h) => html`<li>${h}</li>`)}</ol>
    </div>
    <div class="card">
      <h2>Creative checklist</h2>
      <ul class="list" style="margin-top:8px">
        <li>First 3 seconds: the place and "from ${egp(p.from)}" on screen.</li>
        ${p.hasFilm ? html`<li>Use the ${p.name} film from the website; cut a 15-second vertical version.</li>` : ""}
        ${p.illustrativeImages ? html`<li class="late">The website images for ${p.name} are illustrative. Get official renders from G Developments before using images in ads.</li>` : html`<li>Use the official renders and brochure images.</li>`}
        <li>Make 9:16 (Reels, Stories) and 4:5 (Feed) versions of every ad.</li>
        <li>Arabic text on the video for Egypt; English or Arabic for the Gulf.</li>
        <li>End card: "Contact a salesperson", not a price list.</li>
        <li>Show home types and starting prices. Leave unit sizes and exact installment amounts for the call.</li>
        <li>No promises of returns or rental income, no "last chance" pressure.</li>
        <li>3–5 ads per ad set. Replace the weakest every week or two.</li>
      </ul>
    </div>
  </div>
  ${pb ? html`<div class="grid g2">
    <div class="card"><h2>Ad copy · English</h2><div class="stack" style="margin-top:10px">${block("Headline", fill(pb.copy.en.headline, p))}${block("Primary text", fill(pb.copy.en.primary, p))}</div></div>
    <div class="card"><h2>Ad copy · Egyptian Arabic</h2><div class="stack" style="margin-top:10px">${block("العنوان", fill(pb.copy.ar.headline, p), "rtl", "ar")}${block("النص", fill(pb.copy.ar.primary, p), "rtl", "ar")}</div></div>
  </div>` : ""}
  <div class="card">
    <div class="card-head"><div><h2>Lead form that filters for real buyers</h2><p>Instant form, type <b>Higher intent</b> (adds a review step). Multiple-choice answers sort leads before you call.</p></div><button class="btn sm" type="button" data-copy="${formCopy}">Copy questions</button></div>
    <div class="grid g3">${form.map(([qq, a]) => html`<div class="copy-block"><b>${qq}</b><ul class="list tight small">${a.map((x) => html`<li>${x}</li>`)}</ul></div>`)}</div>
    <p class="small muted" style="margin-top:10px">Treat "Below ${egp(p.from)}" as low budget, offer a cheaper project (see What to sell), and do not count it as valid. For WhatsApp ads, put the ref code from Tracked links in the pre-filled message.</p>
  </div>`;
}

export function mount(root, ctx) {
  root.onclick = (e) => {
    const b = e.target.closest("[data-mproject]");
    if (b) {
      pick = b.dataset.mproject;
      save("messagesProject", pick);
      return ctx.render();
    }
    const c = e.target.closest("[data-copy]");
    if (c) copy(c.dataset.copy, "Copied");
  };
}

export const _$ = $;
export const _raw = raw;
