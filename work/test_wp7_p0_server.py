"""Serve WP7 P0 failure modes without changing the production source files."""

from __future__ import annotations

import mimetypes
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
MODES = {"case3", "case4"}


def replace_once(text: str, needle: str, replacement: str) -> str:
    if text.count(needle) != 1:
        raise RuntimeError(f"Expected one injection marker, found {text.count(needle)}")
    return text.replace(needle, replacement, 1)


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        print(format % args)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_bytes(self, body: bytes, content_type: str) -> None:
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        request = urlsplit(self.path)
        mode = parse_qs(request.query).get("wp7", [""])[0]
        path = unquote(request.path)

        try:
            if path in {"/", "/index.html"}:
                page = (ROOT / "index.html").read_text(encoding="utf-8")
                if mode in MODES:
                    page = replace_once(
                        page,
                        '<script defer src="ui.js"></script>',
                        f'<script defer src="ui.js?wp7={mode}"></script>',
                    )
                self.send_bytes(page.encode("utf-8"), "text/html; charset=utf-8")
                return

            if path == "/ui.js" and mode in MODES:
                script = (ROOT / "ui.js").read_text(encoding="utf-8")
                if mode == "case3":
                    script = replace_once(
                        script,
                        "  checkStale();\n",
                        "  checkStale();\n  throw new Error(\"WP7_CASE3_AFTER_CHECK_STALE\");\n",
                    )
                else:
                    script = replace_once(
                        script,
                        "/* --------- khởi động --------- */\nfunction initApp(){",
                        "/* --------- khởi động --------- */\nDB.MB.days=[]; DB.MN.days=[];\nfunction initApp(){",
                    )
                self.send_bytes(script.encode("utf-8"), "text/javascript; charset=utf-8")
                return

            relative = path.lstrip("/")
            target = (ROOT / relative).resolve()
            if ROOT not in target.parents or not target.is_file():
                self.send_error(404)
                return
            content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
            self.send_bytes(target.read_bytes(), content_type)
        except RuntimeError as error:
            self.send_error(500, str(error))


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8371
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"WP7 P0 test server: http://127.0.0.1:{port}/")
    server.serve_forever()


if __name__ == "__main__":
    main()
