// Tracked links: website links with UTM tags, the URL parameters line for
// Meta ads, and WhatsApp links with a ref code so a WhatsApp lead can be
// traced back to its campaign and ad.
import { html, raw, copy, toast, confirmDialog, day } from "../ui.js";
import { load, save } from "../store.js";

let form = load("linkForm", { project: "krypton", channel: "meta", campaign: "", content: "", lang: "ar" });

const CHANNELS = [
  ["meta", "Facebook / Instagram ads", "paid_social"],
  ["google", "Google ads", "cpc"],
  ["tiktok", "TikTok ads", "paid_social"],
  ["snapchat", "Snapchat ads", "paid_social"],
  ["whatsapp", "WhatsApp status or broadcast", "messaging"],
  ["organic", "Organic post or bio", "social"],
];
// ad_id lets the website put the ad in each WhatsApp message's ref code (W-…).
export const META_PARAMS = "utm_source={{site_source_name}}&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}&ad_id={{ad.id}}";

const slug = (s) => String(s || "").trim().toLowerCase().replace(/[^\w؀-ۿ]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
const abbr = (name) => {
  const w = String(name || "").replace(/[^A-Za-z ]/g, "").trim().split(/\s+/).filter(Boolean);
  return (w.length > 1 ? w.map((x) => x[0]).join("") : (w[0] || "GD").slice(0, 2)).slice(0, 3).toUpperCase();
};
const newRef = (p) => {
  const d = new Date();
  return `${abbr(p?.name)}-${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
};

function build(ctx) {
  const p = ctx.catalog?.projects?.find((x) => x.id === form.project);
  const ch = CHANNELS.find((c) => c[0] === form.channel) || CHANNELS[0];
  const ref = form.ref || newRef(p);
  form.ref = ref;
  const q = new URLSearchParams({ utm_source: ch[0], utm_medium: ch[2], utm_campaign: slug(form.campaign) || slug(`${p?.name || "gd"}-${new Date().toISOString().slice(0, 7)}`), ...(form.content ? { utm_content: slug(form.content) } : {}), ref });
  const url = p ? `${p.url}?${q}` : "";
  const wa = ctx.catalog?.site?.whatsapp;
  const text = form.lang === "ar" ? `أهلاً، عايز أعرف أكتر عن ${p?.name || ""}. (كود ${ref})` : `Hello, I would like to know more about ${p?.name || ""}. (Ref ${ref})`;
  const waUrl = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(text)}` : "";
  return { p, ref, url, waUrl, text };
}

export function render(ctx) {
  const out = build(ctx);
  const links = load("links", []);
  const box = (label, value, what) => html`<label class="field"><span>${label}</span><div class="copybox"><input class="input" readonly value="${value}"><button class="btn" type="button" data-copy="${value}" data-what="${what}">Copy</button></div></label>`;
  return html`
  <div class="top"><div><h1>Tracked links</h1><p class="sub">Every ad should say where its leads came from. Website links carry UTM tags; WhatsApp links carry a ref code that the lead sends back to you.</p></div></div>
  <div class="grid g2">
    <form class="card" data-linkform>
      <h2>Make a link</h2>
      <div class="fields" style="margin-top:10px">
        <label class="field"><span>Project</span><select class="input" name="project">${(ctx.catalog?.projects || []).map((p) => html`<option value="${p.id}" ${p.id === form.project ? raw("selected") : ""}>${p.name}</option>`)}</select></label>
        <label class="field"><span>Where it runs</span><select class="input" name="channel">${CHANNELS.map(([v, l]) => html`<option value="${v}" ${v === form.channel ? raw("selected") : ""}>${l}</option>`)}</select></label>
        <label class="field"><span>Campaign</span><input class="input" name="campaign" value="${form.campaign}" placeholder="e.g. GD | Krypton | Leads | Nov"></label>
        <label class="field"><span>Ad or post</span><input class="input" name="content" value="${form.content}" placeholder="e.g. film-15s-price"></label>
        <label class="field"><span>WhatsApp message</span><select class="input" name="lang"><option value="ar" ${form.lang === "ar" ? raw("selected") : ""}>Arabic</option><option value="en" ${form.lang === "en" ? raw("selected") : ""}>English</option></select></label>
        <label class="field"><span>Ref code</span><div class="row"><input class="input mono" name="ref" value="${out.ref}"><button class="btn sm" type="button" data-newref title="New code">New</button></div></label>
      </div>
      <div class="row" style="margin-top:12px"><button class="btn primary" type="button" data-savelink>Save this link</button><span class="small muted">Saved codes can be picked when you add a WhatsApp lead.</span></div>
    </form>
    <div class="card stack">
      ${box("Website link", out.url, "Website link copied")}
      ${box("WhatsApp link", out.waUrl, "WhatsApp link copied")}
      <p class="small muted">Message the buyer sends: <span ${form.lang === "ar" ? raw('dir="rtl" lang="ar"') : ""}>${out.text}</span></p>
      ${box("Meta ads: URL parameters (paste in the ad, under Tracking)", META_PARAMS, "URL parameters copied")}
      <p class="small muted">Meta fills in the campaign, ad set and ad names and the ad id by itself. On the website, every WhatsApp message then ends with a W- code for that ad, which Leads turns back into the ad. For Click-to-WhatsApp ads, put the ref code in the ad's pre-filled message.</p>
    </div>
  </div>
  <div class="card"><div class="card-head"><div><h2>Saved links</h2><p>Kept in this browser. Included in Leads → Backup.</p></div></div>
    ${links.length ? html`<div class="table-wrap"><table><thead><tr><th>Ref</th><th>Project</th><th>Campaign</th><th>Ad</th><th>Made</th><th></th></tr></thead><tbody>${links.map((k, i) => html`<tr><td class="mono">${k.ref}</td><td>${ctx.catalog?.projects?.find((p) => p.id === k.project)?.name || k.project}</td><td>${k.campaign}</td><td>${k.content}</td><td>${day(k.at)}</td><td class="n"><button class="btn sm ghost" type="button" data-copy="${k.waUrl}" data-what="WhatsApp link copied">WhatsApp</button><button class="btn sm ghost" type="button" data-copy="${k.url}" data-what="Website link copied">Website</button><button class="btn sm ghost danger" type="button" data-dellink="${i}">Delete</button></td></tr>`)}</tbody></table></div>` : html`<p class="muted small">No saved links yet.</p>`}
  </div>`;
}

export function mount(root, ctx) {
  const sync = () => {
    const f = root.querySelector("[data-linkform]");
    if (!f) return;
    const d = Object.fromEntries(new FormData(f));
    if (d.project !== form.project) d.ref = "";
    form = { ...form, ...d };
    save("linkForm", form);
  };
  root.onchange = (e) => {
    if (e.target.closest("[data-linkform]")) {
      sync();
      ctx.render();
    }
  };
  root.onclick = async (e) => {
    const c = e.target.closest("[data-copy]");
    if (c) return copy(c.dataset.copy, c.dataset.what || "Copied");
    if (e.target.closest("[data-newref]")) {
      sync();
      form.ref = "";
      return ctx.render();
    }
    if (e.target.closest("[data-savelink]")) {
      sync();
      const out = build(ctx);
      const links = load("links", []);
      if (links.some((k) => k.ref === out.ref)) return toast("That ref code is already saved. Press New for another.", "bad");
      links.unshift({ ref: out.ref, project: form.project, channel: form.channel, campaign: form.campaign, content: form.content, url: out.url, waUrl: out.waUrl, at: new Date().toISOString() });
      save("links", links);
      form.ref = "";
      save("linkForm", form);
      toast("Link saved.", "good");
      return ctx.render();
    }
    const del = e.target.closest("[data-dellink]");
    if (del) {
      const links = load("links", []);
      const k = links[Number(del.dataset.dellink)];
      if (k && (await confirmDialog({ title: "Delete this link?", body: html`Ref <b>${k.ref}</b>. Leads that already carry it keep it.`, ok: "Delete", danger: true }))) {
        links.splice(Number(del.dataset.dellink), 1);
        save("links", links);
        ctx.render();
      }
    }
  };
}
