// Places: Meta's governorate names → the Egypt map, country codes → the world
// map, and a phone number → the country it belongs to (for overseas leads).

// Meta writes governorates in several spellings ("Cairo Governorate",
// "Al Qahirah", "Ash Sharqiyah"...). Each spelling, simplified, points to the
// name used on the map.
const GOV_ALIASES = {
  Cairo: ["cairo", "qahirah", "qahira", "kairo"],
  Giza: ["giza", "jizah", "gizeh", "jiza", "jizeh"],
  Alexandria: ["alexandria", "iskandariyah", "iskandariya", "iskandaria"],
  Qalyubia: ["qalyubia", "qalyubiyah", "qaliubiya", "kalyubia", "qalubia", "qalyubiya", "kalioubia"],
  "Al Sharqia": ["sharqia", "sharqiyah", "sharkia", "sharqiya", "sharkiya"],
  Dakahlia: ["dakahlia", "daqahliyah", "dakahliya", "daqahlia", "dakahlya"],
  Gharbia: ["gharbia", "gharbiyah", "gharbiya"],
  Monufia: ["monufia", "minufiyah", "menofia", "menoufia", "minufia", "minufiya"],
  Beheira: ["beheira", "buhayrah", "buhaira", "behera", "bohaira"],
  "Kafr el-Sheikh": ["kafrsheikh", "kafrshaykh", "kafrelsheikh", "kafrshaikh", "kafrelshaikh"],
  Damietta: ["damietta", "dumyat", "domyat"],
  "Port Said": ["portsaid", "bursaid", "porsaid"],
  Ismailia: ["ismailia", "ismailiyah", "ismailiya"],
  Suez: ["suez", "suways", "sues"],
  Faiyum: ["faiyum", "fayyum", "fayoum", "fayum", "faiyoum"],
  "Beni Suef": ["benisuef", "banisuwayf", "benisweif", "banisuef", "benisuwayf"],
  Minya: ["minya", "minia", "menia"],
  Asyut: ["asyut", "assiut", "asyout", "assiout"],
  Sohag: ["sohag", "suhaj", "sawhaj"],
  Qena: ["qena", "qina", "kena"],
  Luxor: ["luxor", "uqsur", "luqsur"],
  Aswan: ["aswan"],
  "Red Sea": ["redsea", "bahrahmar"],
  "New Valley": ["newvalley", "wadijadid", "wadigedid", "wadiljadid"],
  Matrouh: ["matrouh", "matruh", "marsamatruh", "marsamatrouh"],
  "North Sinai": ["northsinai", "shamalsina", "shamalsinai"],
  "South Sinai": ["southsinai", "janubsina", "janubsinai"],
};
const simplify = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(governorate|province|region|muhafazat)\b/g, " ")
    .replace(/\b(al|el|ad|ash|as|an|ar|at|az|ath|ed|es)[\s-]+/g, "")
    .replace(/[^a-z]/g, "");
const GOV_BY_ALIAS = {};
for (const [name, list] of Object.entries(GOV_ALIASES)) for (const a of list) GOV_BY_ALIAS[a] = name;

/** The map's name for a Meta region name, or null when it is not an Egyptian governorate. */
export function govName(region) {
  const k = simplify(region);
  return GOV_BY_ALIAS[k] || null;
}

// ISO 3166 two-letter → three-letter codes (the world map uses three letters) and names.
const COUNTRIES = {
  EG: ["EGY", "Egypt"], SA: ["SAU", "Saudi Arabia"], AE: ["ARE", "UAE"], KW: ["KWT", "Kuwait"], QA: ["QAT", "Qatar"],
  BH: ["BHR", "Bahrain"], OM: ["OMN", "Oman"], JO: ["JOR", "Jordan"], LB: ["LBN", "Lebanon"], IQ: ["IRQ", "Iraq"],
  LY: ["LBY", "Libya"], SD: ["SDN", "Sudan"], YE: ["YEM", "Yemen"], SY: ["SYR", "Syria"], PS: ["PSE", "Palestine"],
  MA: ["MAR", "Morocco"], TN: ["TUN", "Tunisia"], DZ: ["DZA", "Algeria"], TR: ["TUR", "Turkey"], CY: ["CYP", "Cyprus"],
  GB: ["GBR", "United Kingdom"], IE: ["IRL", "Ireland"], DE: ["DEU", "Germany"], FR: ["FRA", "France"], IT: ["ITA", "Italy"],
  NL: ["NLD", "Netherlands"], BE: ["BEL", "Belgium"], ES: ["ESP", "Spain"], PT: ["PRT", "Portugal"], CH: ["CHE", "Switzerland"],
  AT: ["AUT", "Austria"], SE: ["SWE", "Sweden"], NO: ["NOR", "Norway"], DK: ["DNK", "Denmark"], FI: ["FIN", "Finland"],
  GR: ["GRC", "Greece"], PL: ["POL", "Poland"], RU: ["RUS", "Russia"], UA: ["UKR", "Ukraine"], US: ["USA", "United States"],
  CA: ["CAN", "Canada"], AU: ["AUS", "Australia"], NZ: ["NZL", "New Zealand"], CN: ["CHN", "China"], IN: ["IND", "India"],
  PK: ["PAK", "Pakistan"], MY: ["MYS", "Malaysia"], SG: ["SGP", "Singapore"], JP: ["JPN", "Japan"], KR: ["KOR", "South Korea"],
  ZA: ["ZAF", "South Africa"], NG: ["NGA", "Nigeria"], KE: ["KEN", "Kenya"], ET: ["ETH", "Ethiopia"], BR: ["BRA", "Brazil"],
};
export const iso3 = (iso2) => COUNTRIES[String(iso2 || "").toUpperCase()]?.[0] || null;
export const countryName = (iso2) => COUNTRIES[String(iso2 || "").toUpperCase()]?.[1] || String(iso2 || "Unknown");
export const GULF = new Set(["SA", "AE", "KW", "QA", "BH", "OM"]);
/** The name Antigravity's Egypt & GCC screen uses for a Gulf country. */
export const gccName = (iso2) => ({ SA: "GCC · Saudi Arabia", AE: "GCC · UAE", KW: "GCC · Kuwait", QA: "GCC · Qatar", BH: "GCC · Bahrain", OM: "GCC · Oman" })[iso2] || null;

// Dialling codes → two-letter country. Longest code wins.
const DIAL = {
  20: "EG", 966: "SA", 971: "AE", 965: "KW", 974: "QA", 973: "BH", 968: "OM", 962: "JO", 961: "LB", 964: "IQ",
  218: "LY", 249: "SD", 967: "YE", 963: "SY", 970: "PS", 212: "MA", 216: "TN", 213: "DZ", 90: "TR", 357: "CY",
  44: "GB", 353: "IE", 49: "DE", 33: "FR", 39: "IT", 31: "NL", 32: "BE", 34: "ES", 351: "PT", 41: "CH",
  43: "AT", 46: "SE", 47: "NO", 45: "DK", 358: "FI", 30: "GR", 48: "PL", 7: "RU", 380: "UA", 1: "US",
  61: "AU", 64: "NZ", 86: "CN", 91: "IN", 92: "PK", 60: "MY", 65: "SG", 81: "JP", 82: "KR", 27: "ZA",
  234: "NG", 254: "KE", 251: "ET", 55: "BR",
};
/** Two-letter country of a phone number, or null when it cannot be told. Local Egyptian mobiles (01x…) count as Egypt. */
export function phoneCountry(phone) {
  const raw = String(phone || "").trim();
  let d = raw.replace(/[^\d+]/g, "");
  if (!d) return null;
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (/^01[0125]\d{8}$/.test(d)) return "EG";
  else return null;
  for (const len of [3, 2, 1]) {
    const c = DIAL[d.slice(0, len)];
    if (c) return c;
  }
  return null;
}

/** Meta region + country rows → totals per Egyptian governorate and per Gulf country (Egypt & GCC screen). */
export function actualByPlace(bd) {
  if (!bd) return null;
  const out = {};
  const add = (name, r) => {
    const o = (out[name] ??= { spend: 0, impressions: 0, clicks: 0, leads: 0 });
    o.spend += r.spend || 0;
    o.impressions += r.impressions || 0;
    o.clicks += r.clicks || 0;
    o.leads += (r.leads || 0) + (r.convos || 0);
  };
  for (const r of bd.region || []) {
    const g = govName(r.region);
    if (g) add(g, r);
  }
  for (const r of bd.country || []) {
    const g = gccName(String(r.country || "").toUpperCase());
    if (g) add(g, r);
  }
  return out;
}

export const _test = { simplify };
