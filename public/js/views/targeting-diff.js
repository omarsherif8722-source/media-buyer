// Human-readable "before → after" lines for a targeting change.
import { html } from "../ui.js";

const places = (g = {}) => [...(g.countries || []), ...(g.regions || []).map((r) => r.name || r.key), ...(g.cities || []).map((c) => c.name || c.key)];
const names = (l = [], aud) => l.map((x) => x.name || aud?.find((a) => a.id === x.id)?.name || x.id);
const gender = (g = []) => (g.length === 1 ? (g[0] === 1 ? "Men" : "Women") : "All");
const age = (a, b) => `${a ?? 18}–${b === 65 || b === undefined || b === null ? "65+" : b}`;

export function describeChange(orig, patch, aud, placesAfter) {
  const lines = [];
  const line = (label, before, after) => lines.push(html`<div><b>${label}:</b> ${before || "none"} → <b>${after || "none"}</b></div>`);
  if (patch.geo_locations) {
    // Names for new places come from the editor (the patch itself only carries Meta's keys).
    const a = places(orig.geo_locations);
    const b = placesAfter || places(patch.geo_locations);
    const added = b.filter((x) => !a.includes(x));
    const removed = a.filter((x) => !b.includes(x));
    lines.push(html`<div><b>Locations:</b> ${added.length ? html`add ${added.join(", ")}` : ""}${added.length && removed.length ? "; " : ""}${removed.length ? html`remove ${removed.join(", ")}` : ""}${!added.length && !removed.length ? "changed" : ""}</div>`);
  }
  if ("age_min" in patch || "age_max" in patch) line("Age", age(orig.age_min, orig.age_max), age(patch.age_min ?? orig.age_min, patch.age_max ?? orig.age_max));
  if ("genders" in patch) line("Gender", gender(orig.genders), gender(patch.genders));
  if (patch.flexible_spec) {
    const a = [...names(orig.flexible_spec?.[0]?.interests), ...names(orig.flexible_spec?.[0]?.work_positions)];
    const b = [...names(patch.flexible_spec?.[0]?.interests), ...names(patch.flexible_spec?.[0]?.work_positions)];
    line("Interests and jobs", a.join(", "), b.join(", "));
  }
  if (patch.custom_audiences) line("Include audiences", names(orig.custom_audiences, aud).join(", "), names(patch.custom_audiences, aud).join(", "));
  if (patch.excluded_custom_audiences) line("Exclude audiences", names(orig.excluded_custom_audiences, aud).join(", "), names(patch.excluded_custom_audiences, aud).join(", "));
  return lines;
}
