---
name: blender-mcp
description: "Control a live Blender session for building/watching 3D models (parametric insoles, 3D-print parts, viewport feedback). Use whenever the user mentions Blender, wants to build/watch/edit a model in Blender, run bpy code live, capture viewport screenshots, or use the Blender MCP. Requires the Blender add-on running with its MCP server started. Invoked via bunx mcporter."
---

# blender-mcp — drive a live Blender session

Turns a running Blender into a controllable 3D workspace: build and watch
models build in real time, run arbitrary bpy Python, capture viewport
screenshots. Call it via `bunx mcporter` from any shell.

## Architecture

- MCP server: `uvx blender-mcp` (PyPI, stdio) — configured in `~/.mcporter/mcporter.json` as server `blender`.
- Blender side: the `BlenderMCP` add-on opens a TCP socket server on `localhost:9876`.
- The MCP server relays commands to the add-on over that socket. **Blender must be running with the add-on's server started** or every tool call errors.

## One-time setup (per machine)

1. Install Blender.
2. Install the add-on: `uvx blender-mcp install-addon` (copies `addon.py` into Blender's user addons dir).
3. In Blender: Preferences → Add-ons → enable **"Interface: Blender MCP"**, then click **Start MCP Server** in the 3D viewport sidebar (BlenderMCP tab).
4. Verify: `bunx mcporter list blender --brief` and `bunx mcporter call blender.get_scene_info user_prompt=...`.

## Usage

```bash
bunx mcporter call blender.get_scene_info user_prompt="describe goal verbatim"
bunx mcporter call blender.get_object_info object_name=Insole user_prompt="..."
bunx mcporter call blender.get_viewport_screenshot max_size=1000 user_prompt="..."
bunx mcporter call blender.execute_blender_code code="bpy.data.objects['Insole'].scale = (1.1,1,1)" user_prompt="..."
```

`execute_blender_code` is the workhorse — tell the agent to build geometry in
small bpy steps (step-by-step, per blender-mcp guidance) so failures are
isolated and you can watch each step land in the viewport.

## WSL wrapper — required

`~/.mcporter/mcporter.json` runs the server via
`uvx --with blender-mcp --python 3.12 python /home/nfisher/.local/lib/blender-mcp-wrapper.py`
(+ `DISABLE_TELEMETRY=1`).

**Why:** on this WSL box, `connect()` to a *closed* localhost port hangs
forever instead of returning ECONNREFUSED. Without the wrapper, blender-mcp's
startup connect check blocks and the MCP handshake never completes (mcporter
times out). The wrapper (a ~20-line script) patches the socket connect with a
3s timeout so a missing Blender fails fast; a live Blender addon is unaffected.
Keep the wrapper at that path — the mcporter config references it.

## Gotchas

- Start order: **Blender first** (add-on + Start MCP Server), then the mcporter call.
- Tool listing/startup adds ~3s (the failed-connect wait) when Blender isn't running.
- Telemetry is disabled via env var; consent prompts should be ignored/denied.
- To update the add-on later: `uvx blender-mcp install-addon`, then disable/re-enable it in Blender prefs.
- If the add-on version is behind the server, `get_addon_status` reports it.
