// Ref codes: the short code at the end of every WhatsApp message that starts
// on the website or from a Tracked link, e.g. "(Ref W-1J3TB5W4QGVK)".
//   W-…   a website visit that came from an ad: the ad's id, in base 36
//         (the website reads ad_id from the ad's URL parameters)
//   WEB   a website visit that did not come from an ad
//   other a Tracked link's code, saved under Tracked links
// The website makes W- codes the same way (js/site.js, REF).

const REF_IN_TEXT = /\(\s*(?:Ref|كود)\s+([A-Za-z0-9-]{2,24})\s*\)/i;
const B36 = "0123456789abcdefghijklmnopqrstuvwxyz";

/** The ref code inside a pasted WhatsApp message, or "". */
export function refFromText(text) {
  const m = String(text || "").match(REF_IN_TEXT);
  return m ? m[1].toUpperCase() : "";
}

/** An ad id as a W- code. */
export function adRef(adId) {
  if (!/^\d{1,20}$/.test(String(adId || ""))) return "";
  return `W-${BigInt(adId).toString(36).toUpperCase()}`;
}

/** The ad id inside a W- code, or null. */
export function adIdFromRef(ref) {
  const m = String(ref || "").trim().match(/^W-([0-9A-Z]{1,14})$/i);
  if (!m) return null;
  let v = 0n;
  for (const ch of m[1].toLowerCase()) v = v * 36n + BigInt(B36.indexOf(ch));
  return v.toString();
}

/** Where an ad sits in the dashboard's campaign tree. */
export function findAd(tree, adId) {
  for (const c of tree?.campaigns || [])
    for (const s of c.adsets || [])
      for (const a of s.ads || []) if (String(a.id) === String(adId)) return { campaign: c, adset: s, ad: a };
  return null;
}

/**
 * What a ref code points to.
 * kind: "ad" (website visit from an ad), "web" (website, no ad), "link" (a Tracked link), "unknown", or "" for no code.
 */
export function resolveRef(ref, { tree = null, links = [] } = {}) {
  const code = String(ref || "").trim().toUpperCase();
  if (!code) return { kind: "", code };
  if (code === "WEB") return { kind: "web", code, label: "The website, not from an ad" };
  const adId = adIdFromRef(code);
  if (adId) {
    const hit = findAd(tree, adId);
    if (hit)
      return {
        kind: "ad",
        code,
        adId,
        campaignId: hit.campaign.id,
        campaignName: hit.campaign.name,
        adsetId: hit.adset.id,
        adsetName: hit.adset.name,
        adName: hit.ad.name,
        label: `Website, from the ad ${hit.ad.name} (${hit.adset.name} · ${hit.campaign.name})`,
      };
    return { kind: "ad", code, adId, label: `Website, from ad ${adId} (not in the loaded campaigns: refresh, or widen the dates)` };
  }
  const link = links.find((k) => String(k.ref).toUpperCase() === code);
  if (link) return { kind: "link", code, link, campaignName: link.campaign || null, adName: link.content || null, label: `Tracked link · ${[link.campaign, link.content].filter(Boolean).join(" · ") || "no campaign name"}` };
  return { kind: "unknown", code, label: "Not a code this dashboard made" };
}
