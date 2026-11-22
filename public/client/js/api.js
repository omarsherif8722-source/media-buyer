// Calls to this dashboard's own server. The server holds the Meta token.
// In demo mode every call is answered in the browser by demo.js instead:
// nothing reaches the server or Meta.
import { isDemo } from "./store.js";

let demo = null;
export const setDemoBackend = (d) => {
  demo = d;
};

async function parse(res) {
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* not JSON */
  }
  if (res.status === 401) {
    location.href = "/login";
    throw new Error("Signed out.");
  }
  if (!res.ok) {
    const e = new Error(data?.error || `Server answered ${res.status}.`);
    e.status = res.status;
    e.notConnected = Boolean(data?.notConnected);
    throw e;
  }
  return data;
}

export const get = (path, params = {}) => {
  if (isDemo() && demo) return demo.get(path, params);
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""));
  return fetch(`${path}${qs.toString() ? `?${qs}` : ""}`, { headers: { Accept: "application/json" }, credentials: "same-origin" }).then(parse);
};
export const post = (path, body) =>
  isDemo() && demo
    ? demo.post(path, body)
    : fetch(path, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, credentials: "same-origin", body: JSON.stringify(body) }).then(parse);
