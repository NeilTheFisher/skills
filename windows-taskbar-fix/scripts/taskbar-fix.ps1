param(
    [switch]$DryRun,
    [int]$Pairs = 3
)

$ErrorActionPreference = 'SilentlyContinue'

try {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public class TBFix {
    [StructLayout(LayoutKind.Sequential)] public struct PT { public int X, Y; }
    [StructLayout(LayoutKind.Sequential)] public struct R { public int L, T, Rt, B; }
    [StructLayout(LayoutKind.Sequential)]
    public struct APPBARDATA {
        public int cbSize; public IntPtr hWnd; public uint uCallbackMessage;
        public uint uEdge; public R rc; public IntPtr lParam;
    }

    [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr FindWindowW(string cls, string title);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out R r);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern bool GetCursorPos(out PT p);
    [DllImport("user32.dll")] public static extern void mouse_event(uint flags, int dx, int dy, uint data, IntPtr extra);
    [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, IntPtr extra);
    [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr parent, EnumProc cb, IntPtr l);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassNameW(IntPtr h, StringBuilder s, int n);
    [DllImport("shell32.dll")] public static extern IntPtr SHAppBarMessage(uint msg, ref APPBARDATA d);

    public delegate bool EnumProc(IntPtr h, IntPtr l);
    public static PT StartBtn = new PT { X = 0, Y = 0 };

    static string Cls(IntPtr h) {
        var sb = new StringBuilder(200);
        GetClassNameW(h, sb, 200);
        return sb.ToString();
    }

    [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(PT p);

    public static string ClassAt(int x, int y) {
        PT p; p.X = x; p.Y = y;
        return Cls(WindowFromPoint(p));
    }

    public static string Fg() {
        IntPtr h = GetForegroundWindow();
        return h == IntPtr.Zero ? "<none>" : Cls(h);
    }

    static string ProcOf(IntPtr h) {
        uint pid;
        GetWindowThreadProcessId(h, out pid);
        try { return System.Diagnostics.Process.GetProcessById((int)pid).ProcessName; }
        catch { return "?"; }
    }

    public static bool IsStartMenu() {
        IntPtr h = GetForegroundWindow();
        if (h == IntPtr.Zero) return false;
        if (!IsWindowVisible(h)) return false;
        return Cls(h).Contains("CoreWindow");
    }

    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);

    // Poll instead of sleeping a fixed interval: a working bar responds in
    // well under a second, and a cold StartMenuExperienceHost can take two.
    public static bool WaitMenu(bool wantOpen, int timeoutMs) {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        while (sw.ElapsedMilliseconds < timeoutMs) {
            if (IsStartMenu() == wantOpen) return true;
            System.Threading.Thread.Sleep(80);
        }
        return false;
    }

    static APPBARDATA Init() {
        var d = new APPBARDATA();
        d.cbSize = Marshal.SizeOf(typeof(APPBARDATA));
        d.hWnd = FindWindowW("Shell_TrayWnd", null);
        return d;
    }

    public static long GetState() { var d = Init(); return (long)SHAppBarMessage(4, ref d); }

    public static void SetState(int value) {
        var d = Init();
        d.lParam = (IntPtr)value;
        SHAppBarMessage(0x0A, ref d);
    }

    public static string Rect() {
        IntPtr h = FindWindowW("Shell_TrayWnd", null);
        if (h == IntPtr.Zero) return "MISSING";
        R r; GetWindowRect(h, out r);
        return "(" + r.L + "," + r.T + ")-(" + r.Rt + "," + r.B + ")";
    }

    public static void FindStart() {
        // The bar animates in, and the Start child can briefly report a
        // 1-pixel rect. Wait for a usable one, then hit-test the point so a
        // click can never land on the window behind the bar.
        for (int attempt = 0; attempt < 25; attempt++) {
            StartBtn.X = 0; StartBtn.Y = 0;
            EnumChildWindows(FindWindowW("Shell_TrayWnd", null), (c, l) => {
                if (Cls(c) == "Start") {
                    R r; GetWindowRect(c, out r);
                    if ((r.Rt - r.L) >= 20) { StartBtn.X = (r.L + r.Rt) / 2; StartBtn.Y = (r.T + r.B) / 2; }
                }
                return true;
            }, IntPtr.Zero);

            if (StartBtn.X > 0) {
                for (int nudge = 0; nudge < 6; nudge++) {
                    string cls = ClassAt(StartBtn.X, StartBtn.Y);
                    if (cls == "Start" || cls == "Shell_TrayWnd") return;
                    StartBtn.X += 10;
                }
                return;
            }
            System.Threading.Thread.Sleep(200);
        }
        StartBtn.X = 30; StartBtn.Y = 1056;
    }

    public static void ClickAt(int x, int y) {
        SetCursorPos(x, y);
        System.Threading.Thread.Sleep(180);
        mouse_event(0x0002, 0, 0, 0, IntPtr.Zero);
        System.Threading.Thread.Sleep(50);
        mouse_event(0x0004, 0, 0, 0, IntPtr.Zero);
    }

    public static void Esc() {
        keybd_event(0x1B, 0, 0, IntPtr.Zero);
        System.Threading.Thread.Sleep(25);
        keybd_event(0x1B, 0, 2, IntPtr.Zero);
    }

    [StructLayout(LayoutKind.Sequential)] public struct LII { public uint cbSize; public uint dwTime; }
    [DllImport("user32.dll")] static extern bool GetLastInputInfo(ref LII l);
    [DllImport("kernel32.dll")] static extern uint GetTickCount();

    public static uint IdleMs() {
        var l = new LII();
        l.cbSize = (uint)Marshal.SizeOf(typeof(LII));
        return GetLastInputInfo(ref l) ? (uint)(GetTickCount() - l.dwTime) : 0;
    }

    public static IntPtr FgHandle() { return GetForegroundWindow(); }

    // A session with no attached input reports no foreground window and a
    // cursor pinned at 0,0 that SetCursorPos cannot move. That is the state
    // right after the user walks away from an RDP session, and every click
    // test in it is a false negative.
    public static bool InputAttached() {
        if (GetForegroundWindow() == IntPtr.Zero) {
            PT before; GetCursorPos(out before);
            if (!SetCursorPos(before.X + 40, before.Y + 40)) return false;
            System.Threading.Thread.Sleep(120);
            PT after; GetCursorPos(out after);
            SetCursorPos(before.X, before.Y);
            if (after.X == before.X && after.Y == before.Y) return false;
        }
        return true;
    }
}
'@
} catch {
    Write-Host "taskbar-fix: failed to compile the Win32 helpers - nothing was changed."
    Write-Host $_.Exception.Message
    exit 2
}
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$log = Join-Path $env:TEMP ("taskbar-fix-$stamp.log")

function Say([string]$s) {
    # Console, not Write-Output: a pipeline write would pollute the return
    # value of Test-Clicks and make `if ($working)` always true.
    [Console]::Out.WriteLine($s)
    Add-Content -Path $log -Value $s
}

function Test-Clicks([int]$pairs) {
    [TBFix]::SetState(2)          # force the bar visible; 2 = always on top, no auto-hide
    Start-Sleep -Milliseconds 1500
    [TBFix]::FindStart()
    Say ("   start button at {0},{1}  taskbar={2}" -f [TBFix]::StartBtn.X, [TBFix]::StartBtn.Y, [TBFix]::Rect())

    # Warm-up: the first click of a session pays for StartMenuExperienceHost
    # starting up, which otherwise reads as a dead taskbar.
    [TBFix]::ClickAt([TBFix]::StartBtn.X, [TBFix]::StartBtn.Y)
    [void][TBFix]::WaitMenu($true, 4000)
    [TBFix]::ClickAt([TBFix]::StartBtn.X, [TBFix]::StartBtn.Y)
    [void][TBFix]::WaitMenu($false, 4000)
    if ([TBFix]::IsStartMenu()) { Say "   warm-up left the menu open; closing"; [TBFix]::ClickAt([TBFix]::StartBtn.X, [TBFix]::StartBtn.Y); [void][TBFix]::WaitMenu($false, 4000) }

    $good = 0
    for ($i = 0; $i -lt $pairs; $i++) {
        [TBFix]::ClickAt([TBFix]::StartBtn.X, [TBFix]::StartBtn.Y)
        $opened = [TBFix]::WaitMenu($true, 4000)

        [TBFix]::ClickAt([TBFix]::StartBtn.X, [TBFix]::StartBtn.Y)
        $closed = [TBFix]::WaitMenu($false, 4000)

        if ($opened -and $closed) { $good++ }
        Say ("   pair {0}: opened={1} closed={2}" -f ($i + 1), $opened, $closed)
    }
    [TBFix]::Esc()
    return $good
}

function Test-Working {
    $good = Test-Clicks $Pairs
    Say ("   {0}/{1} click pairs behaved" -f $good, $Pairs)
    return ($good -ge 2)
}

function Restart-Explorer {
    $before = (Get-Process explorer | ForEach-Object { $_.Id }) -join ','
    Get-Process explorer | ForEach-Object { Stop-Process -Id $_.Id -Force }
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Milliseconds 500
        if (([TBFix]::Rect()) -ne 'MISSING') { break }
    }
    Start-Sleep -Seconds 4
    $after = (Get-Process explorer | ForEach-Object { $_.Id }) -join ','
    Say ("   explorer {0} -> {1}" -f $before, $after)
}

# ---------------------------------------------------------------- preflight
# Refuse to test (let alone "repair") a session with no attached input: every
# click test in that state is a false negative, and the fix is to reconnect the
# RDP client, not to restart anything.
if (-not [TBFix]::InputAttached()) {
    Say ("no interactive input attached: fg=0x{0:X}, idle={1}ms" -f [int64][TBFix]::FgHandle(), [TBFix]::IdleMs())
    Say "the session is input-suspended (typical right after leaving an RDP session)."
    Say "reconnect / re-focus the session, move the mouse, then re-run. Nothing was changed."
    exit 3
}

# ---------------------------------------------------------------- snapshot
$elevated = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole('Administrators')
$autoHideWas = [int]([TBFix]::GetState())
$cursorWas = New-Object TBFix+PT
[void][TBFix]::GetCursorPos([ref]$cursorWas)

Say ("taskbar-fix {0}{1}" -f $stamp, $(if ($DryRun) { ' (dry run)' } else { '' }))
Say ("   elevated={0}  autohide state={1}  taskbar={2}" -f $elevated, $autoHideWas, [TBFix]::Rect())
Say ("   dwm      = {0}" -f (((Get-Process dwm | ForEach-Object { "$($_.Id)@s$($_.SessionId)" })) -join ', '))
Say ("   explorer = {0}" -f (((Get-Process explorer | ForEach-Object { $_.Id })) -join ', '))
Say ("   windhawk = {0} (service), mods in explorer={1}" -f (Get-Service Windhawk).Status, (((Get-Process explorer | ForEach-Object { ($_.Modules | Where-Object { $_.FileName -like '*Windhawk*' -and $_.FileName -notlike '*.whl' } | Measure-Object).Count })) -join ','))

# ---------------------------------------------------------------- step 0
Say "`n[0] click test"
$working = Test-Working
if ($working) {
    Say "   taskbar dispatches clicks - nothing to repair"
    [TBFix]::SetState($autoHideWas)
    [void][TBFix]::SetCursorPos($cursorWas.X, $cursorWas.Y)
    Say "log: $log"
    exit 0
}
Say "   taskbar is NOT dispatching clicks"

if ($DryRun) {
    Say "`n   dry run: stopping before any repair"
    [TBFix]::SetState($autoHideWas)
    [void][TBFix]::SetCursorPos($cursorWas.X, $cursorWas.Y)
    Say "log: $log"
    exit 1
}

# ---------------------------------------------------------------- step 1
# DWM first: this is the step that actually restored clicks in the field, and
# an explorer restart alone leaves the wedged compositor in place.
Say "`n[1] DWM (compositor) restart"
if (-not $elevated) {
    Say "   skipped: needs admin. Re-run with sudo.exe powershell.exe -File <this script>"
} else {
    Get-Process dwm | Where-Object { $_.SessionId -eq (Get-Process -Id $PID).SessionId } | ForEach-Object {
        Say ("   killing dwm {0}" -f $_.Id)
        Stop-Process -Id $_.Id -Force
    }
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Milliseconds 700
        if (Get-Process dwm | Where-Object { $_.SessionId -eq (Get-Process -Id $PID).SessionId }) { break }
    }
    Start-Sleep -Seconds 5
    Say ("   dwm now = {0}" -f (((Get-Process dwm | ForEach-Object { "$($_.Id)@s$($_.SessionId)" })) -join ', '))
    if (Test-Working) { Say "   FIXED at step 1 (DWM restart)"; $fixedBy = 1 }
}

# ---------------------------------------------------------------- step 2
if (-not $fixedBy) {
    Say "`n[2] clean explorer restart"
    Restart-Explorer
    if (Test-Working) { Say "   FIXED at step 2 (explorer restart)"; $fixedBy = 2 }
}

# ---------------------------------------------------------------- step 3
if (-not $fixedBy) {
    Say "`n[3] mod-free shell (stop Windhawk, restart explorer)"
    if (-not $elevated) {
        Say "   skipped: needs admin. Re-run with sudo.exe powershell.exe -File <this script>"
    } else {
        Stop-Service Windhawk -Force
        Start-Sleep -Seconds 2
        Restart-Explorer
        if (Test-Working) { Say "   FIXED at step 3 (mod-free shell)"; $fixedBy = 3 }
    }
}

# ---------------------------------------------------------------- restore
if ($elevated -and (Get-Service Windhawk).Status -ne 'Running') {
    Start-Service Windhawk
    Start-Sleep -Seconds 2
    Say ("`n   Windhawk service restarted: {0}" -f (Get-Service Windhawk).Status)
}
[TBFix]::SetState($autoHideWas)
[void][TBFix]::SetCursorPos($cursorWas.X, $cursorWas.Y)
Start-Sleep -Milliseconds 500
Say ("   restored autohide state={0}  taskbar={1}  cursor={2},{3}" -f $autoHideWas, [TBFix]::Rect(), $cursorWas.X, $cursorWas.Y)

Say "`nresult: $(if ($fixedBy) { "fixed at step $fixedBy" } else { 'still broken - reboot or sign out' })"
Say "log: $log"
exit $(if ($fixedBy) { 0 } else { 1 })
