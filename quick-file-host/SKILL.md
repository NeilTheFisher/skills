---
name: quick-file-host
description: >
  Host a single local file for a temporary download over a Cloudflare quick
  tunnel (trycloudflare.com) that tears itself down after the first complete
  download (or a timeout), so the URL dies on its own. Use when the user wants
  to hand someone a file (APK, build artifact, export, log bundle) via a URL,
  says "host this for a quick download", "give me a download link", "put this
  behind cloudflare and take it down after", "share this APK", or asks for a
  one-shot / expiring download link. Also use it instead of re-explaining the
  quick-tunnel flow.
---

# quick-file-host

Serve one file at a public URL and take it down automatically after it has been
downloaded once. This is the standard flow for "give me a temporary download link
for this file" — a local one-shot HTTP server exposed through a Cloudflare quick
tunnel, with the tunnel killed as soon as the first complete download finishes.

## Use it

```bash
serve-once.sh <file> [--timeout <seconds>] [--port <port>] [--name <download-name>]
                    [--max-downloads <n>] [--keep]
```

The script lives next to this file: `~/.agents/skills/quick-file-host/serve-once.sh`
(also reachable via the `~/.config/opencode/skills`, `~/.claude/skills`,
`~/.codex/skills` symlinks). Run it in the background and read its output:

```bash
nohup ~/.agents/skills/quick-file-host/serve-once.sh /abs/path/app-release.apk \
  --timeout 1800 --name app-release.apk > /tmp/qfh.out 2>&1 &
# then wait for the URL lines:
for i in $(seq 1 40); do grep -q DOWNLOAD_URL= /tmp/qfh.out && break; sleep 1; done
cat /tmp/qfh.out
```

It prints two lines:

```
DOWNLOAD_URL=https://<random>.trycloudflare.com/<name>   # give this to the requester
INDEX_URL=https://<random>.trycloudflare.com/            # safe to open; does NOT consume the one-shot
```

Give the requester `DOWNLOAD_URL`. Tell them it is one-shot: the URL stops working
after the first complete download, so they should not open it twice or preview it.

## Behavior

- `GET /<name>` (or `/download`) streams the file once; when the body finishes
  flushing, the server writes a done flag and the wrapper kills `cloudflared` and
  the server. A partial/aborted download (client disconnects) does **not** count.
- `GET /` returns a tiny index and `HEAD` returns metadata — neither consumes the
  one-shot, so you can verify the link is live without burning it.
- `--timeout` (default 1800s) is the hard stop even if nobody downloads.
- `--keep` / `--max-downloads N` allow repeated downloads instead of one-shot.
- `--port 0` (default) picks a free port; the script waits for the tunnel's
  "Registered tunnel connection" before printing the URL, so the link is routable
  when you share it.

## Gotchas

- `cloudflared` is not always on `PATH`; the script finds it under
  `~/.t3/tools/cloudflared/*/linux-x64/cloudflared` (newest first) or the
  `storage/cloudflared_tunnel/cloudflared-linux-amd64` fallback. Install it or put
  it on `PATH` if neither exists.
- The URL is **public while it is live**. Only serve files you intend to share,
  prefer one-shot, and keep `--timeout` modest. Do not point it at a directory or
  anything with secrets.
- It is a quick tunnel (`trycloudflare.com`), not a named tunnel: no auth, a
  random hostname each run, and no uptime guarantee. Fine for a single download.
- The wrapper cleans up on exit/`INT`/`TERM`. If a run is orphaned, kill the
  `cloudflared … --url http://127.0.0.1:<port>` process and the `python3
  …/server.py` process together (both are children of the wrapper's PID).
- Large files (hundreds of MB) are fine, but tell the requester to use a
  download manager / stable connection so the transfer completes in one go.

## Durable alternative

If the link must survive the serving process, or be reusable/time-limited rather
than one-shot, use Cloudflare R2 + a signed URL (see the `cloudflare` skill's R2
reference) or a small Worker with an expiry. `quick-file-host` is the fast path
for "hand over a file once, then it's gone".
