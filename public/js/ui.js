// Small helpers shared by every screen: safe HTML, number formats, dialogs,
// the side drawer, toasts and file helpers. No outside libraries.

export class Raw {
  constructor(s) {
    this.s = s;
  }
  toString() {
    return this.s;
  }
}
export const raw = (s) => new Raw(String(s ?? ""));
export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const part = (v) => (v === null || v === undefined || v === false ? "" : v instanceof Raw ? v.s : Array.isArray(v) ? v.map(part).join("") : esc(v));
/** Tagged template: every value is escaped unless it is raw() or another html``. */
export const html = (strings, ...vals) => raw(strings.reduce((out, s, i) => out + s + (i < vals.length ? part(vals[i]) : ""), ""));

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---------------------------------------------------------------- numbers
let CURRENCY = "EGP";
export const setCurrency = (c) => {
  if (c) CURRENCY = c;
};
export const currency = () => CURRENCY;
const nf = (d) => new Intl.NumberFormat("en-US", { maximumFractionDigits: d, minimumFractionDigits: 0 });
export const n = (v, d = 0) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? "—" : nf(d).format(Number(v)));
export const short = (v) => {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return "—";
  const a = Math.abs(v);
  if (a >= 1e9) return `${nf(2).format(v / 1e9)}B`;
  if (a >= 1e6) return `${nf(a >= 1e8 ? 0 : 2).format(v / 1e6)}M`;
  if (a >= 1e4) return `${nf(a >= 1e5 ? 0 : 1).format(v / 1e3)}K`;
  return nf(0).format(v);
};
/** Money in the ad account currency. Small amounts keep 2 decimals. */
export const money = (v, opts = {}) => {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return "—";
  const cur = opts.currency || CURRENCY;
  const a = Math.abs(v);
  const body = opts.short && a >= 1e4 ? short(v) : nf(a < 100 ? 2 : 0).format(v);
  return `${cur} ${body}`;
};
export const egp = (v) => (v ? `${short(v)} EGP` : "—");
export const pct = (v, d = 1) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? "—" : `${nf(d).format(v)}%`);
export const ratio = (a, b) => (b > 0 && Number.isFinite(a) ? a / b : null);
export const per = (spend, count) => (count > 0 ? spend / count : null);

export const ago = (iso) => {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "—";
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
};
export const day = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};
export const dateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};
export const localDay = (d = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
export const uid = (p = "id") => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// ---------------------------------------------------------------- toasts
export function toast(msg, tone = "") {
  let box = $(".toasts");
  if (!box) {
    box = document.createElement("div");
    box.className = "toasts";
    box.setAttribute("role", "status");
    box.setAttribute("aria-live", "polite");
    document.body.append(box);
  }
  const t = document.createElement("div");
  t.className = `toast ${tone}`;
  t.textContent = msg;
  box.append(t);
  setTimeout(() => t.remove(), tone === "bad" ? 7000 : 3500);
}

// ---------------------------------------------------------------- dialogs
/** Confirm dialog. Resolves true when the person presses the main button. */
export function confirmDialog({ title, body = "", ok = "Confirm", danger = false, cancel = "Cancel" }) {
  return new Promise((done) => {
    const d = document.createElement("dialog");
    d.innerHTML = html`<form method="dialog" class="dlg">
      <h2>${title}</h2>
      <div class="muted">${body}</div>
      <div class="acts"><button class="btn" value="no">${cancel}</button><button class="btn ${danger ? "danger" : "primary"}" value="yes" autofocus>${ok}</button></div>
    </form>`.s;
    document.body.append(d);
    d.addEventListener("close", () => {
      done(d.returnValue === "yes");
      d.remove();
    });
    d.showModal();
  });
}

/** Asks for one value. Resolves the text, or null when cancelled. */
export function promptDialog({ title, body = "", label = "", value = "", type = "text", ok = "Save", hint = null, inputmode = null }) {
  return new Promise((done) => {
    const d = document.createElement("dialog");
    d.innerHTML = html`<form method="dialog" class="dlg">
      <h2>${title}</h2>
      ${body ? html`<div class="muted">${body}</div>` : ""}
      <label class="field"><span>${label}</span><input class="input" name="v" type="${type}" value="${value}" ${inputmode ? raw(`inputmode="${esc(inputmode)}"`) : ""} required step="any"></label>
      <div class="small muted" data-hint></div>
      <div class="acts"><button class="btn" value="no" formnovalidate>Cancel</button><button class="btn primary" value="yes">${ok}</button></div>
    </form>`.s;
    document.body.append(d);
    const input = $("input", d);
    const hintBox = $("[data-hint]", d);
    if (hint) {
      const upd = () => (hintBox.innerHTML = part(hint(input.value)));
      input.addEventListener("input", upd);
      upd();
    }
    d.addEventListener("close", () => {
      done(d.returnValue === "yes" ? input.value : null);
      d.remove();
    });
    d.showModal();
    input.select();
  });
}

// ---------------------------------------------------------------- drawer
let drawerEl = null;
let scrimEl = null;
export function openDrawer(content, onClose) {
  closeDrawer();
  scrimEl = document.createElement("div");
  scrimEl.className = "scrim open";
  drawerEl = document.createElement("aside");
  drawerEl.className = "drawer";
  drawerEl.setAttribute("role", "dialog");
  drawerEl.setAttribute("aria-modal", "true");
  drawerEl.innerHTML = part(content);
  document.body.append(scrimEl, drawerEl);
  requestAnimationFrame(() => drawerEl && drawerEl.classList.add("open"));
  const close = () => {
    closeDrawer();
    onClose?.();
  };
  scrimEl.addEventListener("click", close);
  drawerEl.addEventListener("click", (e) => e.target.closest("[data-close]") && close());
  document.addEventListener("keydown", escClose);
  return drawerEl;
}
function escClose(e) {
  if (e.key === "Escape" && !document.querySelector("dialog[open]")) closeDrawer();
}
export function closeDrawer() {
  document.removeEventListener("keydown", escClose);
  drawerEl?.remove();
  scrimEl?.remove();
  drawerEl = scrimEl = null;
}

// ---------------------------------------------------------------- files
export function download(name, text, type = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}
export const csvCell = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r\t]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCSV = (rows) => "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");

/** Reads a CSV/TSV file. Meta's lead downloads are UTF-16 with tabs; Excel exports are UTF-8 with commas. */
export async function readTable(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  let text;
  if (buf[0] === 0xff && buf[1] === 0xfe) text = new TextDecoder("utf-16le").decode(buf.subarray(2));
  else if (buf[0] === 0xfe && buf[1] === 0xff) text = new TextDecoder("utf-16be").decode(buf.subarray(2));
  else text = new TextDecoder("utf-8").decode(buf).replace(/^﻿/, "");
  const first = text.split(/\r?\n/, 1)[0] || "";
  const delim = (first.match(/\t/g) || []).length > (first.match(/,/g) || []).length ? "\t" : first.includes(";") && !first.includes(",") ? ";" : ",";
  const rows = [];
  let row = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
}

export function pickFile(accept) {
  return new Promise((done) => {
    const i = document.createElement("input");
    i.type = "file";
    i.accept = accept;
    i.addEventListener("change", () => done(i.files?.[0] || null));
    i.click();
  });
}

export async function copy(text, what = "Copied") {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${what}.`, "good");
  } catch {
    toast("Could not copy. Select the text and copy it by hand.", "bad");
  }
}

export const debounce = (fn, ms = 250) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};
