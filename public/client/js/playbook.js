// Targeting and message playbook per project. These are starting points to
// test, not results: keep what brings valid leads, drop what does not.
// Prices, plans and discounts are filled in from catalog.json (the website's
// data), so the copy stays correct when the website changes.

export const PLAYBOOK = {
  krypton: {
    priority: 1,
    why: "New launch with the lowest entry price in NEWKAIRO, and serviced living that appeals to both end users and investors.",
    buyers: [
      { who: "East Cairo professionals and young families", angle: "A finished, serviced home in NEWKAIRO with a small monthly installment.", age: "28–45" },
      { who: "Investors who want a unit to rent", angle: "Hotel-style service and The Boulevard at the door make it easy to rent.", age: "35–60" },
      { who: "Egyptians working in the Gulf", angle: "A Cairo base that is looked after while they are away.", age: "30–55" },
    ],
    geo: { egypt: ["New Cairo", "Heliopolis", "Nasr City", "Madinaty", "El Shorouk", "Maadi"], abroad: ["Riyadh", "Jeddah", "Dammam", "Dubai", "Abu Dhabi", "Kuwait City", "Doha"] },
    interests: ["Real estate investing", "Luxury real estate", "Serviced apartment", "Hotels", "Frequent international travelers", "Lived in Egypt (expats)"],
    angles: ["Serviced living above The Boulevard", "{from}", "{plan}", "Fully finished with air conditioning", "Concierge and housekeeping"],
    copy: {
      en: { headline: "Krypton, NEWKAIRO · from {from}", primary: "Serviced apartments above The Boulevard at NEWKAIRO. Fully finished with A/C, with concierge and housekeeping.\n\nFrom {from}, {plan}.\n\nTell us what suits you and a salesperson will call you back." },
      ar: { headline: "كريبتون نيو كايرو · تبدأ من {fromAr}", primary: "شقق فندقية فوق البوليفارد في نيو كايرو. متشطبة بالكامل بالتكييف، مع كونسيرج وخدمة تنظيف.\n\nتبدأ من {fromAr}، {planAr}.\n\nقولّنا اللي يناسبك ومستشار مبيعات هيكلمك." },
    },
    purpose: true,
  },
  "golf-views": {
    priority: 2,
    why: "High-value villas on the golf course: few buyers, large deals. Needs a tight, high-income audience and patient follow-up.",
    buyers: [
      { who: "Families moving up to a villa", angle: "A villa on the fairway with the golf, schools and club inside NEWKAIRO.", age: "38–60" },
      { who: "Business owners and senior executives", angle: "First-row golf views and a long payment plan, or a large cash discount.", age: "40–65" },
      { who: "Golfers", angle: "Live on an 18-hole course.", age: "35–65" },
    ],
    geo: { egypt: ["New Cairo", "Heliopolis", "Zamalek", "Maadi", "Garden City"], abroad: ["Riyadh", "Jeddah", "Dubai", "Kuwait City", "Doha"] },
    interests: ["Golf", "Luxury real estate", "Business owners", "Luxury vehicles", "Private banking", "Frequent international travelers"],
    angles: ["Villas on the golf course", "{from}", "{plan}", "{cash} off for cash"],
    copy: {
      en: { headline: "Golf Views, NEWKAIRO · from {from}", primary: "Twin villas, Tee View and Fairscape villas on the NEWKAIRO golf course.\n\nFrom {from}, {plan}, or {cash} off for cash.\n\nA salesperson will walk you through the rows and views that are still open." },
      ar: { headline: "جولف فيوز نيو كايرو · تبدأ من {fromAr}", primary: "فيلات توين وتي فيو وفيرسكيب على ملعب الجولف في نيو كايرو.\n\nتبدأ من {fromAr}، {planAr}، أو خصم {cash} للكاش.\n\nمستشار مبيعات هيعرّفك على الصفوف والإطلالات المتاحة." },
    },
  },
  "neon-views": {
    priority: 1,
    why: "Fully finished townhouses and villas: the natural next step for families leaving an apartment.",
    buyers: [
      { who: "Families moving from an apartment to their first villa", angle: "A finished townhouse or villa with a garden, no fit-out to wait for.", age: "32–50" },
      { who: "Parents with school-age children", angle: "International schools and sports clubs inside NEWKAIRO.", age: "32–50" },
    ],
    geo: { egypt: ["New Cairo", "Heliopolis", "Nasr City", "Madinaty", "El Shorouk", "Maadi"], abroad: ["Riyadh", "Jeddah", "Dubai", "Kuwait City"] },
    interests: ["Parents with children (6–12)", "Parents with teenagers", "Interior design", "Home and garden", "Luxury real estate"],
    angles: ["Fully finished villas and townhouses", "{from}", "{plan}", "{cash} off for cash"],
    copy: {
      en: { headline: "Neon Views, NEWKAIRO · from {from}", primary: "Fully finished townhouses and villas at Neon Views, NEWKAIRO, around gardens and lakes.\n\nFrom {from}, {plan}, or {cash} off for cash.\n\nTell us the home that suits your family and a salesperson will call you." },
      ar: { headline: "نيون فيوز نيو كايرو · تبدأ من {fromAr}", primary: "تاون هاوس وفيلات متشطبة بالكامل في نيون فيوز، نيو كايرو، وسط حدائق وبحيرات.\n\nتبدأ من {fromAr}، {planAr}، أو خصم {cash} للكاش.\n\nقولّنا البيت اللي يناسب عيلتك ومستشار مبيعات هيكلمك." },
    },
  },
  "urban-living": {
    priority: 2,
    why: "Finished apartments in NEWKAIRO at a lower entry price than villas; payment terms are confirmed per unit.",
    buyers: [
      { who: "First-time buyers in East Cairo", angle: "A finished apartment in a full town, not just a compound.", age: "27–42" },
      { who: "Young families", angle: "Schools, clubs and The Boulevard nearby.", age: "28–45" },
      { who: "Small investors", angle: "A finished unit that is ready to rent after handover.", age: "30–55" },
    ],
    geo: { egypt: ["New Cairo", "Heliopolis", "Nasr City", "Madinaty", "El Shorouk", "Obour"], abroad: ["Riyadh", "Jeddah", "Dubai", "Kuwait City"] },
    interests: ["Newlywed (life event)", "Parents with young children", "Real estate", "Interior design"],
    angles: ["Fully finished apartments", "{from}", "{plan}"],
    copy: {
      en: { headline: "Urban Living, NEWKAIRO · from {from}", primary: "Fully finished apartments, one to four bedrooms, in NEWKAIRO.\n\nFrom {from}, {plan}.\n\nTell us how many bedrooms you need and a salesperson will call you." },
      ar: { headline: "أوربان ليفينج نيو كايرو · تبدأ من {fromAr}", primary: "شقق متشطبة بالكامل من غرفة لـ 4 غرف نوم في نيو كايرو.\n\nتبدأ من {fromAr}، {planAr}.\n\nقولّنا عدد الغرف اللي محتاجها ومستشار مبيعات هيكلمك." },
    },
  },
  newgiza: {
    priority: 3,
    why: "Cash only with delivery in about a year. Say 'cash' in the ad so installment buyers do not fill the form.",
    buyers: [
      { who: "West Cairo families buying for cash", angle: "A near-ready home in a 1,550-acre town that is 90% open space.", age: "38–65" },
      { who: "Buyers upgrading inside Sheikh Zayed and 6th of October", angle: "Golf, university, sports club and health park in one town.", age: "38–65" },
    ],
    geo: { egypt: ["Sheikh Zayed", "6th of October", "Mohandessin", "Dokki", "Zamalek", "Giza"], abroad: ["Riyadh", "Jeddah", "Dubai", "Kuwait City", "Doha"] },
    interests: ["Golf", "Luxury real estate", "Business owners", "Private banking", "Frequent international travelers"],
    angles: ["Cash, delivery in about 12 months", "{from}", "A town with 90% open space"],
    copy: {
      en: { headline: "NEWGIZA · cash homes from {from}", primary: "Homes in NEWGIZA for cash buyers, with delivery in about 12 months.\n\nFrom {from}. Golf, university, sports club and health park inside the town.\n\nA salesperson will send you what is available." },
      ar: { headline: "نيو جيزة · بيوت كاش تبدأ من {fromAr}", primary: "بيوت في نيو جيزة للدفع كاش، والاستلام خلال حوالي 12 شهر.\n\nتبدأ من {fromAr}. جولف وجامعة ونادي رياضي وهيلث بارك جوه المدينة.\n\nمستشار مبيعات هيبعتلك المتاح." },
    },
  },
  artlife: {
    priority: 3,
    why: "Two different products: hotel-serviced residences and offices. Run them as separate campaigns with separate audiences.",
    buyers: [
      { who: "Investors who want a hotel-serviced residence in West Cairo", angle: "Serviced residences with a short payment plan or a cash discount.", age: "35–60" },
      { who: "Business owners who need an office", angle: "Offices inside NEWGIZA instead of renting.", age: "32–60" },
    ],
    geo: { egypt: ["Sheikh Zayed", "6th of October", "Mohandessin", "Dokki", "Zamalek"], abroad: ["Riyadh", "Dubai", "Kuwait City"] },
    interests: ["Business owners", "Entrepreneurship", "Real estate investing", "Hotels"],
    angles: ["{from}", "{plan}", "Up to {cash} off for cash"],
    copy: {
      en: { headline: "Artlife, NEWGIZA · from {from}", primary: "Serviced residences and offices at Artlife, NEWGIZA.\n\nFrom {from}, {plan}, or up to {cash} off for cash.\n\nTell us whether you are buying to live, to rent or for your business." },
      ar: { headline: "آرت لايف نيو جيزة · تبدأ من {fromAr}", primary: "وحدات فندقية ومكاتب في آرت لايف، نيو جيزة.\n\nتبدأ من {fromAr}، {planAr}، أو خصم لحد {cash} للكاش.\n\nقولّنا بتشتري للسكن ولا للإيجار ولا لشغلك." },
    },
    purpose: true,
  },
  meditown: {
    priority: 3,
    why: "Clinics: the buyer is a doctor or medical group. Target by job title and industry, not by home-buying interests.",
    buyers: [
      { who: "Doctors and dentists opening or moving a clinic", angle: "A fully finished clinic in a medical hub instead of rent.", age: "30–60" },
      { who: "Medical groups and investors", angle: "Several clinics in one building, short payment plan.", age: "35–65" },
    ],
    geo: { egypt: ["Sheikh Zayed", "6th of October", "Giza", "Mohandessin", "Dokki"], abroad: ["Riyadh", "Jeddah", "Kuwait City"] },
    interests: ["Job title: Doctor", "Job title: Dentist", "Job title: Physician", "Industry: Healthcare and medical services", "Medicine"],
    angles: ["Fully finished clinics", "{from}", "{plan}"],
    copy: {
      en: { headline: "Meditown clinics · from {from}", primary: "Fully finished clinics from 80 m² at Meditown, NEWGIZA.\n\nFrom {from}, {plan}.\n\nA salesperson will send you the floors that are still available." },
      ar: { headline: "عيادات ميدي تاون · تبدأ من {fromAr}", primary: "عيادات متشطبة بالكامل من 80 متر في ميدي تاون، نيو جيزة.\n\nتبدأ من {fromAr}، {planAr}.\n\nمستشار مبيعات هيبعتلك الأدوار المتاحة." },
    },
  },
  ivy: {
    priority: 1,
    why: "Family town in New Zayed with a lake and a British school inside, clear payment plan and a cash discount.",
    buyers: [
      { who: "West Cairo families with school-age children", angle: "The King's School Canterbury Cairo and a sports club inside the gates.", age: "32–52" },
      { who: "Families upgrading from Sheikh Zayed and 6th of October", angle: "A low-rise town around a 17-acre lake.", age: "32–55" },
    ],
    geo: { egypt: ["Sheikh Zayed", "6th of October", "Mohandessin", "Dokki", "Haram"], abroad: ["Riyadh", "Jeddah", "Dubai", "Kuwait City"] },
    interests: ["Parents with children (6–12)", "Parents with teenagers", "British international schools", "Sports clubs"],
    angles: ["A town around a 17-acre lake", "The King's School Canterbury Cairo", "{from}", "{plan}", "{cash} off for cash"],
    copy: {
      en: { headline: "IVY, New Zayed · from {from}", primary: "A low-rise town around a 17-acre lake, with The King's School Canterbury Cairo and the IVYPARK sports club inside.\n\nFrom {from}, {plan}, or {cash} off for cash.\n\nTell us the home that suits your family." },
      ar: { headline: "آيفي نيو زايد · تبدأ من {fromAr}", primary: "مدينة هادية حوالين بحيرة 17 فدان، وجواها مدرسة The King's School Canterbury Cairo ونادي IVYPARK.\n\nتبدأ من {fromAr}، {planAr}، أو خصم {cash} للكاش.\n\nقولّنا البيت اللي يناسب عيلتك." },
    },
  },
  "seashell-rah": {
    priority: 1,
    why: "Large stock on the North Coast with the biggest cash discount. Push hardest from late winter to early summer.",
    buyers: [
      { who: "Cairo families buying a summer home", angle: "Lagoon chalets on a private beach at Ras El Hekma.", age: "32–55" },
      { who: "Investors who rent out in summer", angle: "Long payment plan, rent in season.", age: "35–60" },
      { who: "Egyptians in the Gulf", angle: "A summer home for the family's yearly visit.", age: "32–55" },
    ],
    geo: { egypt: ["Cairo", "New Cairo", "Sheikh Zayed", "Heliopolis", "Alexandria", "Maadi"], abroad: ["Riyadh", "Jeddah", "Dubai", "Kuwait City", "Doha"] },
    interests: ["Beach resort", "Mediterranean", "Summer vacation", "Luxury travel", "Frequent travelers"],
    angles: ["Lagoon chalets at Ras El Hekma", "{from}", "{plan}", "{cash} off for cash"],
    copy: {
      en: { headline: "Seashell Ras El Hekma · from {from}", primary: "Chalets on the lagoons at Seashell Ras El Hekma, with a private beach.\n\nFrom {from}, {plan}, or {cash} off for cash.\n\nTell us the size you have in mind and a salesperson will send what is available." },
      ar: { headline: "سي شل رأس الحكمة · تبدأ من {fromAr}", primary: "شاليهات على اللاجونز في سي شل رأس الحكمة، وشاطئ خاص.\n\nتبدأ من {fromAr}، {planAr}، أو خصم {cash} للكاش.\n\nقولّنا المساحة اللي في بالك ومستشار مبيعات هيبعتلك المتاح." },
    },
    purpose: true,
  },
  "playa-rah": {
    priority: 2,
    why: "Chalets run by G Hotel: a strong angle for investors who do not want to manage a rental.",
    buyers: [
      { who: "Investors who want a managed summer unit", angle: "Serviced chalets run by G Hotel.", age: "35–60" },
      { who: "Families buying a summer home", angle: "Lagoons and beach at Ras El Hekma.", age: "32–55" },
    ],
    geo: { egypt: ["Cairo", "New Cairo", "Sheikh Zayed", "Heliopolis", "Alexandria"], abroad: ["Riyadh", "Jeddah", "Dubai", "Kuwait City"] },
    interests: ["Real estate investing", "Beach resort", "Hotels", "Luxury travel"],
    angles: ["Serviced chalets run by G Hotel", "{from}", "{plan}", "{cash} off for cash"],
    copy: {
      en: { headline: "Playa Ras El Hekma · from {from}", primary: "Serviced chalets at Playa Ras El Hekma, run by G Hotel.\n\nFrom {from}, {plan}, or {cash} off for cash.\n\nTell us if you are buying for your family or to rent." },
      ar: { headline: "بلايا رأس الحكمة · تبدأ من {fromAr}", primary: "شاليهات فندقية في بلايا رأس الحكمة بإدارة G Hotel.\n\nتبدأ من {fromAr}، {planAr}، أو خصم {cash} للكاش.\n\nقولّنا بتشتري لعيلتك ولا للإيجار." },
    },
    purpose: true,
  },
  playa: {
    priority: 2,
    why: "Several phases, some ready to move: good for buyers who want this summer, not in four years.",
    buyers: [
      { who: "Families who want a summer home soon", angle: "Ready and near-ready homes at Ghazala Bay.", age: "32–55" },
      { who: "Alexandria and Cairo buyers", angle: "Beach, promenade and cable park.", age: "30–55" },
    ],
    geo: { egypt: ["Cairo", "Alexandria", "New Cairo", "Sheikh Zayed", "Heliopolis"], abroad: ["Riyadh", "Jeddah", "Kuwait City"] },
    interests: ["Beach resort", "Summer vacation", "Water sports", "Parents with children"],
    angles: ["Ready and near-ready homes", "{from}", "{plan}", "Up to {cash} off for cash"],
    copy: {
      en: { headline: "Playa Ghazala Bay · from {from}", primary: "Chalets and villas at Playa Ghazala Bay, some ready to move.\n\nFrom {from}, {plan}, or up to {cash} off for cash.\n\nTell us when you want to move in and a salesperson will call you." },
      ar: { headline: "بلايا غزالة باي · تبدأ من {fromAr}", primary: "شاليهات وفيلات في بلايا غزالة باي، ومنها استلام فوري.\n\nتبدأ من {fromAr}، {planAr}، أو خصم لحد {cash} للكاش.\n\nقولّنا عايز تستلم امتى ومستشار مبيعات هيكلمك." },
    },
  },
  seashell: {
    priority: 4,
    why: "Delivered, cash only, mostly resale. Small paid budget at most; better served by retargeting and referrals.",
    buyers: [{ who: "Cash buyers who want a delivered home this season", angle: "Delivered and lived in, handover in about 3 months.", age: "35–60" }],
    geo: { egypt: ["Cairo", "Alexandria", "Sheikh Zayed", "New Cairo"], abroad: [] },
    interests: ["Beach resort", "Summer vacation"],
    angles: ["Delivered, cash, handover in about 3 months"],
    copy: {
      en: { headline: "Seashell Sidi Abdelrahman · delivered", primary: "Delivered homes at the original Seashell, Sidi Abdelrahman, for cash with handover in about 3 months.\n\nA salesperson will send you what is available." },
      ar: { headline: "سي شل سيدي عبد الرحمن · استلام", primary: "بيوت متسلّمة في سي شل سيدي عبد الرحمن، كاش والاستلام خلال حوالي 3 شهور.\n\nمستشار مبيعات هيبعتلك المتاح." },
    },
  },
  "ein-bay": {
    priority: 4,
    why: "Resale and occasional releases with no payment sheet. Confirm what is for sale before spending.",
    buyers: [{ who: "New Cairo families who want a weekend home", angle: "Ninety minutes from New Cairo on the Red Sea, all year.", age: "35–60" }],
    geo: { egypt: ["New Cairo", "Heliopolis", "Nasr City", "Maadi"], abroad: [] },
    interests: ["Beach resort", "Golf", "Weekend getaways"],
    angles: ["Red Sea, 90 minutes from New Cairo", "Year-round"],
    copy: {
      en: { headline: "Ein Bay, Ain Sokhna", primary: "Homes at Ein Bay, Ain Sokhna, ninety minutes from New Cairo and open all year.\n\nAsk a salesperson what is available now." },
      ar: { headline: "عين باي، العين السخنة", primary: "بيوت في عين باي بالعين السخنة، على بعد 90 دقيقة من القاهرة الجديدة وطول السنة.\n\nاسأل مستشار المبيعات عن المتاح دلوقتي." },
    },
  },
};

// ---------------------------------------------------------------- filling in the live figures
const arMillions = (v) => {
  if (!v) return "";
  if (v >= 1e6) return `${Number((v / 1e6).toFixed(2))} مليون جنيه`;
  return `${Math.round(v).toLocaleString("en-US")} جنيه`;
};
const enMillions = (v) => (v ? (v >= 1e6 ? `${Number((v / 1e6).toFixed(2))}M EGP` : `${Math.round(v).toLocaleString("en-US")} EGP`) : "");
const arYears = (y) => (y === 1 ? "سنة" : y === 2 ? "سنتين" : y <= 10 ? `${y} سنين` : `${y} سنة`);

/** The plan most buyers see first: the first official installment plan of the project. */
export function mainPlan(p) {
  const phases = p.payment?.phases || [];
  return phases.find((x) => x.official && !x.cashOnly && x.years) || phases.find((x) => x.years) || phases[0] || null;
}
export function tokens(p) {
  const plan = mainPlan(p);
  const cashVals = (p.payment?.phases || []).map((x) => x.cash).filter(Boolean);
  const cash = cashVals.length ? `${Math.max(...cashVals)}%` : "";
  let planEn = "";
  let planAr = "";
  if (plan?.cashOnly) {
    planEn = "cash payment";
    planAr = "الدفع كاش";
  } else if (plan) {
    const down = (plan.down || []).map((d) => `${d}%`).join(" + ");
    // "+" between percentages can be reordered in right-to-left text, so Arabic uses "و".
    const downAr = (plan.down || []).map((d) => `${d}%`).join(" و");
    planEn = `${down} down and ${plan.years} years to pay`;
    planAr = `مقدم ${downAr} وتقسيط على ${arYears(plan.years)}`;
  }
  return { from: enMillions(p.from), fromAr: arMillions(p.from), plan: planEn, planAr, cash, years: plan?.years ? String(plan.years) : "" };
}
export function fill(text, p) {
  const t = tokens(p);
  return String(text || "")
    .replace(/\{(\w+)\}/g, (m, k) => (k in t && t[k] ? t[k] : m))
    .replace(/,? ?(?:or )?(?:up to )?\{cash\} off for cash/g, "")
    .replace(/،? ?(?:أو )?خصم (?:لحد )?\{cash\} للكاش/g, "")
    .replace(/\{(\w+)\}/g, "");
}

/** Lead-form budget answers that sort buyers by what they can spend. */
export function budgetBuckets(p) {
  if (!p.from) return [];
  const m = (v) => (v >= 1e6 ? `${Number((v / 1e6).toFixed(1))}M` : `${Math.round(v / 1e3)}K`);
  const a = p.from;
  return [`Below ${m(a)} EGP`, `${m(a)} – ${m(a * 1.5)} EGP`, `${m(a * 1.5)} – ${m(a * 2.5)} EGP`, `Above ${m(a * 2.5)} EGP`];
}

export const PRIORITY = { 1: ["Push now", "good"], 2: ["Steady", "info"], 3: ["Niche", "warn"], 4: ["Low / check first", "bad"] };
