// Everything private (leads, notes, saved links, targets) is kept in this
// browser only. It never goes to the server or the GitHub repository.
// Use Leads → Backup to copy it to another device.

const KEY = "gmb.v1.";
export function load(name, fallback) {
  try {
    const v = localStorage.getItem(KEY + name);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}
export function save(name, value) {
  try {
    localStorage.setItem(KEY + name, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

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
