#!/usr/bin/env python3
"""Local Python 3 server for the G Developments Media Buying Command Center.

Works identically to server.mjs when Node is not installed on the local Mac:
  python3 server.py
Opens at http://127.0.0.1:4173
"""
import json
import mimetypes
import os
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent / "public"
PORT = int(os.environ.get("PORT", "4173"))
WEB_EVENTS = []


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        pass

    def send_json(self, code, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        p = parsed.path
        if p == "/healthz":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"ok")
            return
        if p == "/api/settings":
            token = os.environ.get("META_ACCESS_TOKEN", "").strip()
            acct = os.environ.get("META_AD_ACCOUNT_ID", "").replace("act_", "").strip()
            self.send_json(200, {
                "connected": bool(token and acct),
                "account": f"act_{acct}" if acct else None,
                "readOnly": os.environ.get("META_READ_ONLY", "") in ("1", "true", "yes"),
                "leadForms": bool(os.environ.get("META_PAGE_ID", "").strip()),
                "stagesToMeta": bool(os.environ.get("META_DATASET_ID", "").strip()),
                "version": os.environ.get("META_API_VERSION", "v23.0"),
                "maxDailyBudget": NumberOrNone(os.environ.get("META_MAX_DAILY_BUDGET")),
            })
            return
        if p == "/api/web-events":
            self.send_json(200, {"events": WEB_EVENTS[:300]})
            return
        if p.startswith("/api/"):
            self.send_json(409, {"error": "Meta is not connected yet. Switch Demo mode ON in the top bar to explore full analytics.", "notConnected": True})
            return
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        p = parsed.path
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(min(length, 65536)).decode("utf-8", errors="replace") if length else "{}"
        try:
            body = json.loads(raw)
        except Exception:
            body = {}
        if p == "/api/web-event":
            from datetime import datetime, timezone
            evt = {
                "id": f"we_{len(WEB_EVENTS) + 1}",
                "at": datetime.now(timezone.utc).isoformat(),
                "event": str(body.get("event") or "PageView")[:60],
                "project": body.get("project"),
                "page": str(body.get("page") or "/")[:160],
                "place": body.get("place"),
                "utmSource": body.get("utm_source") or body.get("utmSource"),
                "utmCampaign": body.get("utm_campaign") or body.get("utmCampaign"),
                "utmContent": body.get("utm_content") or body.get("utmContent"),
                "ref": body.get("ref"),
            }
            WEB_EVENTS.insert(0, evt)
            del WEB_EVENTS[1000:]
            self.send_json(200, evt)
            return
        self.send_json(409, {"error": "Meta is not connected yet.", "notConnected": True})


def NumberOrNone(v):
    try:
        n = float(v)
        return n if n > 0 else None
    except Exception:
        return None


if __name__ == "__main__":
    mimetypes.add_type("application/manifest+json", ".webmanifest")
    mimetypes.add_type("font/woff2", ".woff2")
    srv = HTTPServer(("127.0.0.1", PORT), Handler)
    print(f"G Developments Media Buying Command Center running on http://127.0.0.1:{PORT}")
    srv.serve_forever()
