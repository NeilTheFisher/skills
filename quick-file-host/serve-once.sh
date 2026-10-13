#!/usr/bin/env bash
# Serve one local file for a temporary, one-shot download over a Cloudflare quick
# tunnel (trycloudflare.com). The tunnel and server tear themselves down after the
# first COMPLETE download (or after --timeout), so the URL dies on its own.
#
# Usage:
#   serve-once.sh <file> [--timeout <seconds>] [--port <port>] [--name <download-name>]
#                       [--max-downloads <n>] [--keep]
#
# Prints:
#   DOWNLOAD_URL=<url>/<name>   # give this to the requester
#   INDEX_URL=<url>/            # safe to open; does NOT consume the one-shot
#
# Notes:
#   * A HEAD request or a GET of / never consumes the download.
#   * Only a GET of /<name> (or /download) counts, and only once the body is
#     fully flushed.
#   * --keep serves until --timeout and allows repeated downloads (not one-shot).
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "usage: serve-once.sh <file> [--timeout s] [--port p] [--name n] [--max-downloads n] [--keep]" >&2
  exit 2
fi

FILE="$1"; shift
TIMEOUT=1800
PORT=0
NAME="$(basename "$FILE")"
MAX_DOWNLOADS=1
while [ "$#" -gt 0 ]; do
  case "$1" in
    --timeout) TIMEOUT="$2"; shift 2;;
    --port) PORT="$2"; shift 2;;
    --name) NAME="$2"; shift 2;;
    --max-downloads) MAX_DOWNLOADS="$2"; shift 2;;
    --keep) MAX_DOWNLOADS=0; shift;;
    *) echo "unknown arg: $1" >&2; exit 2;;
  esac
done

[ -f "$FILE" ] || { echo "not a file: $FILE" >&2; exit 2; }
command -v python3 >/dev/null || { echo "python3 is required" >&2; exit 2; }

find_cloudflared() {
  if command -v cloudflared >/dev/null 2>&1; then command -v cloudflared; return; fi
  local c
  c="$(ls -1dt "$HOME"/.t3/tools/cloudflared/*/linux-x64/cloudflared 2>/dev/null | head -1 || true)"
  if [ -n "$c" ]; then echo "$c"; return; fi
  for c in "$HOME"/repos/personal/obsidian/storage/cloudflared_tunnel/cloudflared-linux-amd64 \
           /usr/local/bin/cloudflared /usr/bin/cloudflared; do
    [ -x "$c" ] && { echo "$c"; return; }
  done
  echo ""
}
CLOUDFLARED="$(find_cloudflared)"
[ -n "$CLOUDFLARED" ] || { echo "cloudflared not found; install it or set it on PATH" >&2; exit 2; }

WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/quick-file-host.XXXXXX")"
SERVER_PY="$WORKDIR/server.py"
DONE="$WORKDIR/done"
CF_LOG="$WORKDIR/cloudflared.log"

cat > "$SERVER_PY" <<'PY'
import http.server, os, socketserver, sys, threading, time
file_path, name, port, done_flag, timeout, max_downloads = sys.argv[1:7]
port, timeout, max_downloads = int(port), int(timeout), int(max_downloads)
size = os.path.getsize(file_path)
ctype = "application/vnd.android.package-archive" if name.lower().endswith(".apk") else "application/octet-stream"
count = [0]
lock = threading.Lock()

class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    def log_message(self, *a): pass
    def _head(self, body=False):
        self.send_response(200)
        self.send_header("Content-Type", ctype if body else "text/html; charset=utf-8")
        if body:
            self.send_header("Content-Length", str(size))
            self.send_header("Content-Disposition", f'attachment; filename="{name}"')
        self.end_headers()
    def do_HEAD(self):
        if self.path.startswith("/" + name) or self.path == "/download":
            self._head(body=True)
        else:
            self._head(body=False)
    def do_GET(self):
        if self.path.startswith("/" + name) or self.path == "/download":
            self._head(body=True)
            try:
                with open(file_path, "rb") as f:
                    while True:
                        chunk = f.read(1024 * 256)
                        if not chunk: break
                        self.wfile.write(chunk)
                self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                return  # aborted download: does not count
            with lock:
                count[0] += 1
                if max_downloads and count[0] >= max_downloads:
                    open(done_flag, "w").close()
        else:
            body = f"<html><body><a href=\"/{name}\">{name}</a> ({size} bytes)</body></html>".encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

with socketserver.ThreadingTCPServer(("127.0.0.1", port), Handler) as httpd:
    httpd.daemon_threads = True
    # Print the actually-bound port (PORT=0 picks a free one).
    print(f"PORT={httpd.server_address[1]}", flush=True)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    deadline = time.time() + timeout
    while not os.path.exists(done_flag) and time.time() < deadline:
        time.sleep(0.5)
    httpd.shutdown()
PY

python3 "$SERVER_PY" "$FILE" "$NAME" "$PORT" "$DONE" "$TIMEOUT" "$MAX_DOWNLOADS" > "$WORKDIR/server.out" 2>&1 &
SERVER_PID=$!

cleanup() {
  kill "$TUNNEL_PID" "$SERVER_PID" 2>/dev/null || true
  wait "$TUNNEL_PID" "$SERVER_PID" 2>/dev/null || true
  rm -rf "$WORKDIR"
}
trap cleanup EXIT INT TERM

# Wait for the bound port, then start the quick tunnel.
for _ in $(seq 1 100); do
  PORT="$(grep -oE '^PORT=[0-9]+' "$WORKDIR/server.out" 2>/dev/null | head -1 | cut -d= -f2 || true)"
  [ -n "$PORT" ] && break
  kill -0 "$SERVER_PID" 2>/dev/null || { echo "server failed to start" >&2; cat "$WORKDIR/server.out" >&2; exit 1; }
  sleep 0.1
done
[ -n "$PORT" ] || { echo "server did not report a port" >&2; exit 1; }

"$CLOUDFLARED" tunnel --no-autoupdate --url "http://127.0.0.1:$PORT" > "$CF_LOG" 2>&1 &
TUNNEL_PID=$!

URL=""
for _ in $(seq 1 120); do
  URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$CF_LOG" 2>/dev/null | head -1 || true)"
  # Wait for a registered connection too: the hostname is not routable until then.
  if [ -n "$URL" ] && grep -q "Registered tunnel connection" "$CF_LOG" 2>/dev/null; then break; fi
  kill -0 "$TUNNEL_PID" 2>/dev/null || { echo "cloudflared exited; see log" >&2; cat "$CF_LOG" >&2; exit 1; }
  sleep 0.5
done
[ -n "$URL" ] || { echo "cloudflared did not print a URL; see $CF_LOG" >&2; cat "$CF_LOG" >&2; exit 1; }

echo "DOWNLOAD_URL=$URL/$NAME"
echo "INDEX_URL=$URL/"

DEADLINE=$(( $(date +%s) + TIMEOUT ))
while [ ! -f "$DONE" ] && [ "$(date +%s)" -lt "$DEADLINE" ]; do
  kill -0 "$TUNNEL_PID" 2>/dev/null || { echo "tunnel died; tearing down" >&2; break; }
  kill -0 "$SERVER_PID" 2>/dev/null || break
  sleep 1
done
if [ -f "$DONE" ]; then echo "served; tearing down"; else echo "timed out; tearing down"; fi
