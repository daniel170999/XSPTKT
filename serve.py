# -*- coding: utf-8 -*-
"""
serve.py — Chay app o che do LIVE: mo trinh duyet + tu dong cap nhat du lieu.

- Phuc vu app tai http://127.0.0.1:8368
- Tu dong kiem tra moi 60 giay:
    * XSMN: sau 16:35 neu chua co ket qua hom nay -> tu tai
    * XSMB: sau 18:32 neu chua co ket qua hom nay -> tu tai
- Trang web tu phat hien du lieu moi va tu refresh.
- /api/update : ep cap nhat ngay (nut tren giao dien).

Chay:  py serve.py   (hoac bam dup MoApp.bat)
"""
import http.server
import json
import os
import re
import subprocess
import sys
import threading
import time
import webbrowser
from datetime import date, datetime

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

BASE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE, "data")
PORT = 8368

STATE = {"updating": False, "last_try": 0.0, "last_msg": "san sang"}
LOCKF = os.path.join(DATA_DIR, ".update.lock")


def read_meta():
    try:
        with open(os.path.join(DATA_DIR, "meta.js"), encoding="utf-8") as f:
            m = re.search(r"\{.*\}", f.read(), re.S)
            return json.loads(m.group(0)) if m else {}
    except Exception:
        return {}


def run_update(max_fetch=30, days=None):
    """Chay update.py trong tien trinh con (co khoa chong trung trong update.py)."""
    if STATE["updating"]:
        return False
    STATE["updating"] = True
    STATE["last_try"] = time.time()
    STATE["last_msg"] = "dang cap nhat…"
    try:
        cmd = [sys.executable if sys.executable else "py",
               os.path.join(BASE, "update.py"), "--max-fetch", str(max_fetch)]
        if days:
            cmd += ["--days", str(days)]
        print("\n[auto] " + " ".join(cmd))
        result = subprocess.run(cmd, cwd=BASE, timeout=1800)
        if result.returncode != 0:
            STATE["last_msg"] = "cap nhat that bai " + datetime.now().strftime("%H:%M")
            return False
        build = [sys.executable if sys.executable else "py", os.path.join(BASE, "build_pages.py")]
        result = subprocess.run(build, cwd=BASE, timeout=1800)
        if result.returncode != 0:
            STATE["last_msg"] = "tao trang that bai " + datetime.now().strftime("%H:%M")
            return False
        STATE["last_msg"] = "cap nhat xong " + datetime.now().strftime("%H:%M")
        return True
    except Exception as e:
        STATE["last_msg"] = "loi cap nhat: " + str(e)[:80]
        return False
    finally:
        STATE["updating"] = False


def auto_loop():
    """Vong lap nen: tu cap nhat khi den gio co ket qua moi."""
    while True:
        try:
            meta = read_meta()
            today = date.today().isoformat()
            now = datetime.now()
            hm = now.hour * 60 + now.minute
            need_mn = meta.get("xsmn_last", "") < today and hm >= 16 * 60 + 35
            need_mb = meta.get("xsmb_last", "") < today and hm >= 18 * 60 + 32
            cooldown = time.time() - STATE["last_try"] > 240  # 4 phut thu lai 1 lan
            locked = os.path.exists(LOCKF) and time.time() - os.path.getmtime(LOCKF) < 45 * 60
            if (need_mn or need_mb) and cooldown and not STATE["updating"] and not locked:
                run_update(max_fetch=15)
        except Exception:
            pass
        time.sleep(60)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=BASE, **kw)

    def log_message(self, fmt, *args):  # bot log cho gon
        pass

    def end_headers(self):
        # du lieu luon tuoi, khong cache
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path.startswith("/api/status"):
            meta = read_meta()
            meta["live"] = True
            meta["updating"] = STATE["updating"]
            meta["msg"] = STATE["last_msg"]
            body = json.dumps(meta).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/update"):
            started = not STATE["updating"]
            if started:
                threading.Thread(target=run_update, kwargs={"max_fetch": 40}, daemon=True).start()
            body = json.dumps({"started": started}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_response(404)
        self.end_headers()


def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    threading.Thread(target=auto_loop, daemon=True).start()
    url = "http://127.0.0.1:%d" % PORT
    print("=" * 46)
    print("  APP DANG CHAY O CHE DO LIVE: %s" % url)
    print("  Tu dong cap nhat XSMN ~16:35, XSMB ~18:32")
    print("  Dong cua so nay de tat.")
    print("=" * 46)
    threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
