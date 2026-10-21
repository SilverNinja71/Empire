#!/usr/bin/env python3
"""
Local Game Server for SilverNinja Games
Serves every game from one origin (so they share one account) and opens the hub in your default web browser.

Speed-ups over Python's plain file server:
  * Many files at once (one thread per connection) with HTTP/1.1 keep-alive.
  * Text files (HTML, JS, CSS, JSON, SVG...) are gzipped, and the gzip is kept until the file changes.
  * Every file is sent with "Cache-Control: no-cache" plus an ETag and Last-Modified date, so the
    browser always asks "has this changed?" and gets a quick 304 "no" for files you haven't edited.

Options: python3 server.py [--no-browser]
"""

import email.utils
import gzip
import http.server
import io
import os
import socket
import sys
import threading
import urllib.parse
import webbrowser

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

GAMES = [
    ("Penguin League", "penguin-league/"),
    ("Spear-Mace PVP", "mace-pvp/"),
    ("Penguin Life", "penguin-life/"),
    ("Penguintrack", "penguintrack/"),
    ("Stone Court Battlegrounds", "battlegrounds/"),
]

# Text files worth compressing (images, fonts and audio are already compressed)
COMPRESSIBLE = {".html", ".htm", ".js", ".mjs", ".css", ".json", ".svg", ".txt", ".md", ".xml", ".map", ".webmanifest", ".csv"}
MIN_GZIP_BYTES = 256

# path -> (mtime_ns, size, gzipped bytes); rebuilt when the file changes
_gzip_cache = {}
_gzip_lock = threading.Lock()


def gzipped(path, mtime_ns, size):
    with _gzip_lock:
        hit = _gzip_cache.get(path)
    if hit and hit[0] == mtime_ns and hit[1] == size:
        return hit[2]
    with open(path, "rb") as f:
        data = gzip.compress(f.read(), compresslevel=6, mtime=0)
    with _gzip_lock:
        _gzip_cache[path] = (mtime_ns, size, data)
    return data


class Handler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"  # keep connections open between files
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".html": "text/html; charset=utf-8",
        ".htm": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".mjs": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".svg": "image/svg+xml",
        ".md": "text/markdown; charset=utf-8",
        ".txt": "text/plain; charset=utf-8",
        ".webmanifest": "application/manifest+json",
        ".wasm": "application/wasm",
        ".woff2": "font/woff2",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def accepts_gzip(self):
        for part in self.headers.get("Accept-Encoding", "").split(","):
            name, _, params = part.strip().partition(";")
            if name.strip().lower() in ("gzip", "*"):
                return params.replace(" ", "") not in ("q=0", "q=0.0", "q=0.00", "q=0.000")
        return False

    def not_modified(self, etag, mtime):
        """True when the browser's cached copy is still current (If-None-Match wins over If-Modified-Since)."""
        inm = self.headers.get("If-None-Match")
        if inm is not None:
            tags = [t.strip() for t in inm.split(",")]
            return "*" in tags or any(t.removeprefix("W/") == etag for t in tags)
        ims = self.headers.get("If-Modified-Since")
        if ims:
            try:
                return int(mtime) <= email.utils.parsedate_to_datetime(ims).timestamp()
            except (TypeError, IndexError, OverflowError, ValueError):
                return False
        return False

    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            # Trailing-slash redirects and folder listings stay with the standard handler
            if not urllib.parse.urlsplit(self.path).path.endswith(("/", "%2f", "%2F")):
                return super().send_head()
            for index in self.index_pages:
                if os.path.isfile(os.path.join(path, index)):
                    path = os.path.join(path, index)
                    break
            else:
                return super().send_head()
        if path.endswith("/") or not os.path.isfile(path):
            self.send_error(404, "File not found")
            return None
        try:
            st = os.stat(path)
        except OSError:
            self.send_error(404, "File not found")
            return None

        ext = os.path.splitext(path)[1].lower()
        compress = ext in COMPRESSIBLE and st.st_size >= MIN_GZIP_BYTES and self.accepts_gzip()
        etag = '"%x-%x%s"' % (st.st_mtime_ns, st.st_size, "-gz" if compress else "")

        def common_headers():
            self.send_header("ETag", etag)
            self.send_header("Last-Modified", self.date_time_string(st.st_mtime))
            self.send_header("Cache-Control", "no-cache")  # always revalidate: edits show straight away
            if ext in COMPRESSIBLE:
                self.send_header("Vary", "Accept-Encoding")

        if self.not_modified(etag, st.st_mtime):
            self.send_response(304)
            common_headers()
            self.end_headers()
            return None

        try:
            if compress:
                body = io.BytesIO(gzipped(path, st.st_mtime_ns, st.st_size))
                length = len(body.getbuffer())
            else:
                body = open(path, "rb")
                length = os.fstat(body.fileno()).st_size
        except OSError:
            self.send_error(404, "File not found")
            return None

        self.send_response(200)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Length", str(length))
        if compress:
            self.send_header("Content-Encoding", "gzip")
        common_headers()
        self.end_headers()
        return body


class Server(http.server.ThreadingHTTPServer):
    daemon_threads = True

    def handle_error(self, request, client_address):
        # The browser hung up mid-file (a cancelled prefetch, a closed tab): nothing to report
        if isinstance(sys.exc_info()[1], (ConnectionResetError, BrokenPipeError, ConnectionAbortedError)):
            return
        super().handle_error(request, client_address)


def lan_address():
    """This computer's address on the local network, for testing on a phone."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))  # picks the outgoing network; nothing is sent
            ip = s.getsockname()[0]
    except OSError:
        return None
    return None if ip.startswith(("127.", "0.")) else ip


def run():
    port = PORT
    server = None

    # Try preferred port, or fall back to an available port
    for p in range(PORT, PORT + 20):
        try:
            server = Server(("", p), Handler)
            port = p
            break
        except OSError:
            continue

    if not server:
        print("Error: Could not bind to any port from 8080 to 8100.")
        sys.exit(1)

    url = f"http://localhost:{port}/"
    width = max(len(name) for name, _ in GAMES) + 1
    print("=" * 62)
    print("🎮 SILVERNINJA GAMES - Server Running!")
    print(f"👉 Hub: {url}")
    for name, folder in GAMES:
        print(f"   {(name + ':').ljust(width)} {url}{folder}")
    lan = lan_address()
    if lan:
        print(f"📱 Phone on the same Wi-Fi: http://{lan}:{port}/")
        print("   (a phone keeps its own account; password sign-in needs localhost or https)")
    print("🛑 Press Ctrl+C to stop the server.")
    print("=" * 62)

    # Open in browser automatically
    if "--no-browser" not in sys.argv[1:]:
        webbrowser.open(url)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped. Thanks for playing!")
        server.server_close()

if __name__ == "__main__":
    run()
