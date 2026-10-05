"""Local dev server: wraps index.html in the same skeleton the Artifact host adds."""
import http.server
import os
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
ROOT = os.path.dirname(os.path.abspath(__file__))

HEAD = (
    '<!doctype html><html lang="cs"><head><meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
    "<style>:root{padding:env(safe-area-inset-top,0) 0 env(safe-area-inset-bottom,0)}"
    "body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style>"
    "</head><body>"
)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path.split("?")[0] in ("/", "/index.html"):
            with open(os.path.join(ROOT, "index.html"), encoding="utf-8") as f:
                body = (HEAD + f.read() + "</body></html>").encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
    print(f"serving on http://localhost:{PORT}")
    httpd.serve_forever()
