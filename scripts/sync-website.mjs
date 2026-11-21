// Copies what the media buyer needs from the website's data files into
// public/data/catalog.json: projects, pages, starting prices, payment plans
// and availability. Run it whenever the website data changes:
//
//   node scripts/sync-website.mjs [path-to-website-folder]
//
// Default website folder: ../mahmoud-elhemaly-site (next to this repo).
// Nothing is invented here: every figure comes from the website's JSON, and
// each project says where its starting price came from.
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SITE_DIR = resolve(process.argv[2] || join(here, "..", "..", "mahmoud-elhemaly-site"));
const OUT = join(here, "..", "public", "data", "catalog.json");
const SITE_URL = process.env.SITE_URL || "https://mahmoud-elhemaly.onrender.com";

const read = (name) => JSON.parse(readFileSync(join(SITE_DIR, "data", name), "utf8"));
const portfolio = read("portfolio.json");
const inventory = read("inventory.json");
const terms = read("payment_terms.json");
const config = read("site_config.json");
const krypton = read("krypton.json");

const F = Object.fromEntries(inventory.fields.map((f, i) => [f, i]));
const units = inventory.units;
const destById = Object.fromEntries(terms.destinations.map((d) => [d.id, d]));
const regionName = Object.fromEntries(portfolio.regions.map((r) => [r.id, r.name]));

const label = (a) => (Array.isArray(a) ? a[1] : a); // amenities are [icon, label] or "label"

function inventoryFor(p) {
  if (p.id === "krypton") {
    // Krypton's released units live in krypton.json (floor by floor), not in the ATS sheet.
    const released = Object.values(krypton.blockFloors || {}).flat().reduce((n, f) => n + (f.units?.length || 0), 0);
    return { source: "Krypton release (Blocks 1–2)", released, asOf: null, available: null, byType: [] };
  }
  if (!p.inventory) return null;
  const { project, phases } = p.inventory;
  const rows = units.filter((u) => u[F.project] === project && (!phases || phases.includes(u[F.phase])));
  if (!rows.length) return null;
  const count = (s) => rows.filter((u) => u[F.status] === s).length;
  const avail = rows.filter((u) => u[F.status] === "available" && u[F.price]);
  const types = {};
  for (const u of avail) {
    const t = u[F.type] || "Other";
    types[t] ??= { type: t, available: 0, from: Infinity, beds: new Set() };
    types[t].available += 1;
    types[t].from = Math.min(types[t].from, u[F.price]);
    if (u[F.beds]) types[t].beds.add(u[F.beds]);
  }
  return {
    source: inventory.source,
    asOf: inventory.projects[project]?.asOf ?? inventory.generated,
    total: rows.length,
    available: count("available"),
    hold: count("hold"),
    requested: count("requested") + count("ready"),
    from: avail.length ? Math.min(...avail.map((u) => u[F.price])) : null,
    byType: Object.values(types)
      .map((t) => ({ type: t.type, available: t.available, from: t.from, beds: [...t.beds].sort() }))
      .sort((a, b) => a.from - b.from),
  };
}

function paymentFor(p) {
  if (!p.payment) return null;
  const d = destById[p.payment.destination];
  if (!d) return null;
  const phases = d.phases
    .filter((ph) => p.payment.phases.includes(ph.id))
    .map((ph) => ({ id: ph.id, name: ph.name, official: ph.official, note: ph.note || null, ...ph.plans[0] }));
  return { destination: d.name, maintenance: d.maintenance || null, source: terms.source, phases };
}

const projects = portfolio.projects.map((p) => {
  const inv = inventoryFor(p);
  const homes = (p.homes || []).map((h) => ({ name: h.name, from: h.from ?? null, to: h.to ?? null }));
  const factFrom = (p.facts || []).find((f) => f[0] === "From");
  // Lowest known price: the cheapest available unit in the sheet or the
  // website's homes list, whichever is lower (some sheets cover one phase only).
  const homeFrom = homes.some((h) => h.from) ? Math.min(...homes.filter((h) => h.from).map((h) => h.from)) : null;
  let from = null;
  let fromSource = null;
  if (inv?.from && (!homeFrom || inv.from <= homeFrom)) [from, fromSource] = [inv.from, `Cheapest available unit, ${inv.source} (${inv.asOf})`];
  else if (homeFrom) [from, fromSource] = [homeFrom, "Website homes list"];
  const pay = paymentFor(p);
  return {
    id: p.id,
    name: p.name,
    parent: p.parent || null,
    region: p.region,
    regionName: regionName[p.region] || p.region,
    place: p.place,
    status: p.status,
    illustrativeImages: Boolean(p.illustrative),
    slug: p.slug,
    url: `${SITE_URL}/${p.slug}/`,
    intro: p.intro,
    facts: p.facts || [],
    fromText: factFrom ? factFrom[1] : null,
    highlights: p.highlights || [],
    amenities: (p.amenities || []).map(label),
    homes,
    from,
    fromSource,
    payment: pay,
    cashOnly: Boolean(pay?.phases.length && pay.phases.every((ph) => ph.cashOnly)),
    inventory: inv,
    hasFilm: Boolean(p.video?.film),
    brochures: (p.brochures || []).length,
  };
});

const catalog = {
  generated: new Date().toISOString().slice(0, 10),
  source: {
    website: SITE_URL,
    payment: terms.source,
    inventory: `${inventory.source}, generated ${inventory.generated}`,
  },
  site: {
    url: SITE_URL,
    advisor: config.advisor?.name || null,
    whatsapp: config.contact?.whatsapp || null,
    phoneDisplay: config.contact?.phoneDisplay || null,
    hours: config.contact?.hours || null,
  },
  regions: portfolio.regions.map((r) => ({ id: r.id, name: r.name, line: r.line })),
  projects,
};

writeFileSync(OUT, JSON.stringify(catalog, null, 1) + "\n");
console.log(`Wrote ${OUT}: ${projects.length} projects from ${SITE_DIR}`);
for (const p of projects) {
  const inv = p.inventory;
  console.log(
    `  ${p.name.padEnd(24)} from ${p.from ? (p.from / 1e6).toFixed(2) + "M" : "—"}`.padEnd(42) +
      (inv?.available != null ? `${inv.available} available` : inv?.released ? `${inv.released} released` : "no sheet"),
  );
}
