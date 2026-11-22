// Everything private (leads, notes, saved links, targets) is kept in this
// browser only. It never goes to the server or the GitHub repository.
// Use Leads → Backup to copy it to another device.

// Demo mode keeps its own copy of everything under a different prefix, so
// demo leads and settings never mix with real ones.
const REAL = "gmb.v1.";
const DEMO = "gmb.demo.v1.";
const GLOBAL = "gmb.";
const read = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};
/** Settings shared by both modes (theme, the demo switch itself). */
export const loadGlobal = (name, fallback) => read(GLOBAL + name, fallback);
export const saveGlobal = (name, value) => write(GLOBAL + name, value);

let KEY = loadGlobal("demo", false) ? DEMO : REAL;
export const isDemo = () => KEY === DEMO;
export function setDemo(on) {
  KEY = on ? DEMO : REAL;
  saveGlobal("demo", Boolean(on));
}
/** Removes every demo item (used by "Reset demo"). */
export function clearDemo() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(DEMO)) localStorage.removeItem(k);
  } catch {
    /* storage blocked */
  }
}

export const load = (name, fallback) => read(KEY + name, fallback);
export const save = (name, value) => write(KEY + name, value);

// Targets and alert rules. Rules of thumb, editable on the Overview screen.
export const DEFAULT_TARGETS = {
  cpl: null, // target cost per lead (account currency)
  cpvl: null, // target cost per valid lead
  maxFrequency: 3, // 7-day frequency above this → refresh creative or widen audience
  minCtr: 0.5, // link CTR % below this (after minImpressions) → weak hook
  minImpressions: 2000,
  noLeadSpendX: 2, // spend above this × target CPL with no leads → consider turning off
  zeroValidAfter: 10, // this many leads and none valid → targeting or message problem
  speedToLead: 15, // minutes before an untouched lead is flagged
};
export const targets = () => ({ ...DEFAULT_TARGETS, ...load("targets", {}) });
export const saveTargets = (t) => save("targets", t);

// Names of the lead stages as they are set up in Meta Events Manager (CRM integration).
export const DEFAULT_STAGE_EVENTS = {
  interested: "Valid lead",
  meeting: "Meeting booked",
  visited: "Site visit",
  reserved: "Reservation",
  sold: "Sale",
};
export const stageEvents = () => ({ ...DEFAULT_STAGE_EVENTS, ...load("stageEvents", {}) });
