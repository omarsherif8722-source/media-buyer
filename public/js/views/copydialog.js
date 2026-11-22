// Dialogs for copying a campaign, ad set or ad, and for making a new version of
// an ad with a different hook or headline. Everything they create starts
// switched off, so nothing spends until it has been checked and switched on.
import { html, raw, $, toast } from "../ui.js";
import { post } from "../api.js";
import { projectFromName } from "../model.js";
import { PLAYBOOK, fill } from "../playbook.js";

function openDialog(content, onSubmit, wide = false) {
  const d = document.createElement("dialog");
  if (wide) d.style.width = "min(580px, calc(100vw - 32px))";
  d.innerHTML = content.s;
  document.body.append(d);
  const form = $("form", d);
  form.addEventListener("submit", async (e) => {
    if (e.submitter?.value !== "yes") return;
    e.preventDefault();
    const btn = e.submitter;
    btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span> Working';
    const ok = await onSubmit(new FormData(form), d);
    if (ok) d.close();
    else {
      btn.disabled = false;
      btn.textContent = btn.dataset.label;
    }
  });
  d.addEventListener("close", () => d.remove());
  d.showModal();
  return d;
}

const KIND = { campaign: "campaign", adset: "ad set", ad: "ad" };

export function openCopy(kind, obj, ctx) {
  const camps = ctx.tree?.campaigns || [];
  const parentCampaign = camps.find((c) => c.adsets.some((s) => s.id === obj.id || s.ads.some((a) => a.id === obj.id)));
  const parentSet = parentCampaign?.adsets.find((s) => s.ads.some((a) => a.id === obj.id));
  const note = {
    campaign: "Copies the campaign with every ad set and ad. Bigger campaigns take a few seconds longer.",
    adset: "Copies the ad set with its targeting and ads. Put it in another campaign or change the budget here; change the targeting after with the Targeting button.",
    ad: "Copies the ad with the same creative. Put it into another ad set to test the same ad on a new audience.",
  }[kind];
  openDialog(
    html`<form method="dialog" class="dlg">
      <h2>Duplicate this ${KIND[kind]}</h2>
      <div class="muted small">${obj.name}</div>
      <label class="field"><span>Name of the copy</span><input class="input" name="name" value="${obj.name} · copy" required maxlength="200"></label>
      ${kind === "adset" ? html`<label class="field"><span>Into campaign</span><select class="input" name="targetId">${camps.map((c) => html`<option value="${c.id}" ${c.id === parentCampaign?.id ? raw("selected") : ""}>${c.name}</option>`)}</select></label>
        <label class="field"><span>Daily budget of the copy (leave as is, or change)</span><input class="input" name="dailyBudget" type="number" min="1" step="50" inputmode="decimal" value="${obj.dailyBudget || ""}" placeholder="${obj.dailyBudget ? "" : "uses the campaign budget"}"></label>` : ""}
      ${kind === "ad" ? html`<label class="field"><span>Into ad set</span><select class="input" name="targetId">${camps.flatMap((c) => c.adsets.map((s) => html`<option value="${s.id}" ${s.id === parentSet?.id ? raw("selected") : ""}>${c.name} › ${s.name}</option>`))}</select></label>` : ""}
      <div class="note">${note} <b>The copy starts switched off</b>: switch it on in Campaigns when you are ready.</div>
      <div class="acts"><button class="btn" value="no" formnovalidate>Cancel</button><button class="btn primary" value="yes" data-label="Duplicate">Duplicate</button></div>
    </form>`,
    async (f) => {
      const body = { kind, id: obj.id, name: String(f.get("name") || "").trim() };
      const target = f.get("targetId");
      if (target && target !== (kind === "adset" ? parentCampaign?.id : parentSet?.id)) body.targetId = target;
      const budget = f.get("dailyBudget");
      if (kind === "adset" && budget && Number(budget) !== Number(obj.dailyBudget)) body.dailyBudget = Number(budget);
      try {
        await post("/api/copy", body);
        toast(`Copy created, switched off: ${body.name}`, "good");
        ctx.loadTree(true);
        return true;
      } catch (err) {
        toast(err.message, "bad");
        return false;
      }
    },
  );
}

export function openVersion(ad, campaign, ctx) {
  const p = projectFromName(campaign?.name, ctx.catalog);
  const pb = p ? PLAYBOOK[p.id] : null;
  const ready = pb
    ? [
        ["English text", "message", fill(pb.copy.en.primary, p)],
        ["English headline", "headline", fill(pb.copy.en.headline, p)],
        ["Arabic text", "message", fill(pb.copy.ar.primary, p)],
        ["Arabic headline", "headline", fill(pb.copy.ar.headline, p)],
      ]
    : [];
  const body = ad.creative?.body || "";
  const title = ad.creative?.title || "";
  const d = openDialog(
    html`<form method="dialog" class="dlg">
      <h2>New version of this ad</h2>
      <div class="muted small">${ad.name}${campaign ? ` · ${campaign.name}` : ""}</div>
      <label class="field"><span>Name of the new ad</span><input class="input" name="name" value="${ad.name} · v2" required maxlength="200"></label>
      <label class="field"><span>Primary text</span><textarea class="input" name="message" rows="5" placeholder="${body ? "" : "Type the new primary text, or leave empty to keep the current one"}">${body}</textarea></label>
      <label class="field"><span>Headline</span><input class="input" name="headline" value="${title}" maxlength="255" placeholder="${title ? "" : "Type a new headline, or leave empty to keep the current one"}"></label>
      ${ready.length ? html`<div class="field"><span>Ready-made copy for ${p.name} (from Messages)</span><div class="row wrap">${ready.map(([label, field, text], i) => html`<button class="btn sm" type="button" data-fill="${field}" data-i="${i}">${label}</button>`)}</div></div>` : ""}
      <div class="note">Change one thing at a time (the opening line or the headline), so the A/B test shows what made the difference. The image or video stays the same. <b>The new ad starts switched off</b>, in the same ad set: switch it on next to the original to test it.</div>
      <div class="acts"><button class="btn" value="no" formnovalidate>Cancel</button><button class="btn primary" value="yes" data-label="Create new version">Create new version</button></div>
    </form>`,
    async (f) => {
      const message = String(f.get("message") || "").trim();
      const headline = String(f.get("headline") || "").trim();
      const req = { id: ad.id, name: String(f.get("name") || "").trim() };
      if (message && message !== body.trim()) req.message = message;
      if (headline && headline !== title.trim()) req.headline = headline;
      if (!req.message && !req.headline) {
        toast("Change the primary text or the headline first.", "bad");
        return false;
      }
      try {
        await post("/api/ad-version", req);
        toast(`New version created, switched off: ${req.name}`, "good");
        ctx.loadTree(true);
        return true;
      } catch (err) {
        toast(err.message, "bad");
        return false;
      }
    },
    true,
  );
  d.addEventListener("click", (e) => {
    const b = e.target.closest("[data-fill]");
    if (!b) return;
    const [, field, text] = ready[Number(b.dataset.i)];
    const el = $(`[name="${field}"]`, d);
    el.value = text;
    el.dir = /[؀-ۿ]/.test(text) ? "rtl" : "ltr";
    el.focus();
  });
}
