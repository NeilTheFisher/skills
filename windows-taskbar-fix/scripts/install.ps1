# Installs a "Taskbar Fix" desktop shortcut.
#
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File install.ps1
#
# What it creates:
#   %LOCALAPPDATA%\taskbar-fix\taskbar-fix.ps1   stable copy of the repair script
#   %LOCALAPPDATA%\taskbar-fix\run.cmd           launcher (elevates via sudo.exe, then pauses)
#   Desktop\Taskbar Fix.lnk                      the shortcut
#
# No admin needed to install. Each run of the shortcut raises one UAC consent,
# because killing dwm.exe cannot be done without elevation. There is
# deliberately no scheduled task.

$ErrorActionPreference = 'Stop'

$here = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$source = Join-Path $here 'taskbar-fix.ps1'
if (-not (Test-Path $source)) { throw "taskbar-fix.ps1 not found next to install.ps1 ($here)" }

$dest = Join-Path $env:LOCALAPPDATA 'taskbar-fix'
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item -Path $source -Destination (Join-Path $dest 'taskbar-fix.ps1') -Force

$launcher = @'
@echo off
setlocal
sudo.exe powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%LOCALAPPDATA%\taskbar-fix\taskbar-fix.ps1" %*
echo.
echo Log: %TEMP%\taskbar-fix-*.log
echo.
pause
'@
Set-Content -Path (Join-Path $dest 'run.cmd') -Value $launcher -Encoding ASCII

$desktop = [Environment]::GetFolderPath('Desktop')
$lnkPath = Join-Path $desktop 'Taskbar Fix.lnk'
$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut($lnkPath)
$lnk.TargetPath = Join-Path $dest 'run.cmd'
$lnk.WorkingDirectory = $dest
$lnk.IconLocation = 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe,0'
$lnk.Description = 'Repair a Windows taskbar that ignores clicks'
$lnk.WindowStyle = 1
$lnk.Save()

Write-Output ("installed script : " + (Join-Path $dest 'taskbar-fix.ps1'))
Write-Output ("installed launcher: " + (Join-Path $dest 'run.cmd'))
Write-Output ("shortcut         : " + $lnkPath)
Write-Output ("exists           : " + (Test-Path $lnkPath))
