---
name: windows-taskbar-fix
description: Repair a Windows taskbar whose window is visible but which ignores mouse clicks (keyboard still works, e.g. the Win key opens Start, but clicking icons/Start does nothing). Runs a short escalation ladder — DWM (compositor) restart first, then a clean explorer restart, then a mod-free shell — verifying with a synthetic Start-button click after each step, and restores auto-hide and Windhawk state on exit. Use when the user says the taskbar is dead/frozen/unclickable, clicks do nothing, or "only the keyboard works". Works on Windows 11 from WSL via powershell.exe and sudo.exe.
---

# Taskbar fix (Windows 11)

The taskbar is drawn but ignores clicks. The usual cause is **not** input: the session keeps receiving clicks (they land on the right windows, other apps respond), but the taskbar's XAML content bridge — a composition surface owned by `dwm.exe` — keeps stale input bindings after DWM has crashed or been rebuilt. Restarting `explorer.exe` rebuilds the shell *on top of* the surviving compositor, so it often changes nothing.

The ladder below goes cheapest to deepest and stops at the first step that makes clicks dispatch.

## Run it

```bash
SKILL=~/.agents/skills/windows-taskbar-fix
TMP=/mnt/c/Users/$USERNAME/AppData/Local/Temp   # or %TEMP% as reported by Windows
cp "$SKILL/scripts/taskbar-fix.ps1" "$TMP/taskbar-fix.ps1"

# detect only, changes nothing
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\Users\<you>\AppData\Local\Temp\taskbar-fix.ps1' -DryRun

# repair (needs admin: sudo.exe is inline mode on this machine)
sudo.exe powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\Users\<you>\AppData\Local\Temp\taskbar-fix.ps1'
```

If PowerShell refuses to run it from `\\wsl.localhost\...`, the copy above is why — always copy into the Windows temp first.

## The ladder

| Step | Action | Needs admin |
|---|---|---|
| 0 | Preflight: if input is suspended, stop (exit 3) and tell the user to reconnect. Then click-test the Start button. Working → report and exit, change nothing. | no |
| 1 | `taskkill /f /im dwm.exe` for the user's session, wait for the new PID, test. **This is the step that has actually fixed it.** | yes |
| 2 | Kill **all** explorer instances and let Windows relaunch one. Never start your own. | no |
| 3 | `Stop-Service Windhawk`, restart explorer (shell comes up with 0 mods), test. | yes |
| 4 | Restore Windhawk service and auto-hide state, print what changed. | yes |

Step 1 is the one that actually fixed it the first time this was diagnosed, so it now runs first: an explorer restart rebuilds the shell but leaves a wedged compositor in place. Screen flashes for a second or two; apps keep running; an RDP session may blink and reconnect.

## Verifying clicks

Click the Start button twice: the foreground class must go `Windows.UI.Core.CoreWindow` (Start menu open) and then back to the previous window (closed). `scripts/taskbar-fix.ps1` does this and calls the taskbar broken if any transition misbehaves.

Two traps that produced false "still broken" readings during diagnosis:

1. **Never hand-roll `SendInput` in PowerShell.** An `INPUT` struct built without the 8-byte union padding is 48 bytes instead of 40, so `SendInput` returns 0 and *no click happens at all*. Use `mouse_event` (`scripts/taskbar-fix.ps1` does).
2. **Do not detect success by diffing the visible-window list.** Flyouts often already exist hidden, and `Esc` does not always dismiss the Start menu, so the diff reports "nothing" while the menu is plainly open. Use foreground-class transitions instead.

## Gotchas

- **Auto-hide makes the bar untestable by hand.** When hidden, `Shell_TrayWnd` sits at `(0,1078)-(1920,1126)` on a 1080p screen — a 2 px strip. The script forces it visible with `SHAppBarMessage(ABM_SETSTATE)` and restores the previous state afterwards. If the user's bar is meant to auto-hide, always put it back.
- **Two explorer instances are normal-ish and harmless**; you get one from the shell watchdog plus one if you start your own. Don't; just kill and wait.
- **Windhawk mods are not the cause** (measured: a mod-free shell still failed 3/9 clicks). Stopping the service is only useful to get a clean shell for testing, and because 20 injected DLLs make the shell's XAML thread less forgiving.
- **Check for attached input before anything else.** A session the user has walked away from reports `GetForegroundWindow() == 0`, a cursor pinned at `0,0`, and `SetCursorPos` returning false. In that state every click test is a false negative — the script exits 3 and tells the agent to reconnect the session rather than restart anything. This is also the state that produces the user's "it happens after I leave and come back" symptom, so confirm whether the input was suspended *before* blaming the taskbar.
- **This is a repair, not a cure.** If the user's session gets rebuilt by display sleep or a lock, the bar can wedge again. That is what makes it worth re-running rather than rebooting.
- A separate, unrelated bug on machines with a MikeTheTech Virtual Display Driver at 125 %: clicks land ~200 px off **on that monitor only**. Don't chase it with this skill.

## Reporting

End with: which step fixed it, what was restarted (PIDs before/after), whether the Windhawk service and auto-hide were restored, and the log path (`%TEMP%\taskbar-fix-<timestamp>.log`).
