$ErrorActionPreference = 'SilentlyContinue'
$u = $env:USERPROFILE
$letter = $u.Substring(0, 1)
$free0 = (Get-PSDrive $letter).Free

function SizeOf($p) {
  if (Test-Path -LiteralPath $p) {
    $s = (Get-ChildItem -LiteralPath $p -Recurse -Force -File -ErrorAction SilentlyContinue |
          Measure-Object Length -Sum).Sum
    if ($s) { return [double]$s } else { return 0 }
  }
  return -1
}

$dirs = @(
  "$u\AppData\Local\NVIDIA\DXCache",
  "$u\AppData\Local\NVIDIA\GLCache",
  "$u\AppData\Local\pip\cache",
  "$u\AppData\Local\npm-cache",
  "$u\.cache\chrome-devtools-mcp",
  "$u\.cache\bluwy-giget"
)

foreach ($app in @('Code - Insiders', 'Code', 'VSCodium')) {
  $dirs += @(
    "$u\AppData\Roaming\$app\User\workspaceStorage",
    "$u\AppData\Roaming\$app\User\History",
    "$u\AppData\Roaming\$app\WebStorage",
    "$u\AppData\Roaming\$app\CachedExtensionVSIXs",
    "$u\AppData\Roaming\$app\Partitions",
    "$u\AppData\Roaming\$app\Crashpad",
    "$u\AppData\Roaming\$app\logs",
    "$u\AppData\Roaming\$app\Cache",
    "$u\AppData\Roaming\$app\Code Cache",
    "$u\AppData\Roaming\$app\GPUCache",
    "$u\AppData\Roaming\$app\CachedData",
    "$u\AppData\Roaming\$app\Service Worker",
    "$u\AppData\Roaming\$app\DawnGraphiteCache"
  )
}

foreach ($b in @('BraveSoftware\Brave-Browser', 'Google\Chrome', 'Microsoft\Edge', 'Chromium')) {
  $dirs += @(
    "$u\AppData\Local\$b\User Data\Default\Cache",
    "$u\AppData\Local\$b\User Data\Default\Code Cache",
    "$u\AppData\Local\$b\User Data\Default\GPUCache"
  )
}

foreach ($s in @('Slack', 'discord')) {
  $dirs += @(
    "$u\AppData\Roaming\$s\Cache",
    "$u\AppData\Roaming\$s\Code Cache",
    "$u\AppData\Roaming\$s\GPUCache",
    "$u\AppData\Roaming\$s\Service Worker"
  )
}

$results = @()

foreach ($d in $dirs) {
  $sz = SizeOf $d
  if ($sz -lt 0) { continue }
  Remove-Item -LiteralPath $d -Recurse -Force
  $after = SizeOf $d
  if ($after -lt 0) { $after = 0 }
  $results += [pscustomobject]@{ MB = [math]::Round(($sz - $after) / 1MB, 1); Path = $d }
}

$tmp = "$u\AppData\Local\Temp"
$t0 = SizeOf $tmp
Get-ChildItem -LiteralPath $tmp -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
$t1 = SizeOf $tmp
if ($t1 -lt 0) { $t1 = 0 }
$results += [pscustomobject]@{ MB = [math]::Round(($t0 - $t1) / 1MB, 1); Path = "$tmp\*" }

$vrw = "$u\vscode-remote-wsl"
if (Test-Path -LiteralPath $vrw) {
  Get-ChildItem $vrw -Force -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $subs = Get-ChildItem $_.FullName -Force -Directory -ErrorAction SilentlyContinue
    if (-not $subs) { return }
    $keep = $subs | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    $subs | Where-Object { $_.FullName -ne $keep.FullName } | ForEach-Object {
      $sz = SizeOf $_.FullName
      Remove-Item -LiteralPath $_.FullName -Recurse -Force
      $results += [pscustomobject]@{ MB = [math]::Round($sz / 1MB, 1); Path = $_.FullName }
    }
  }
}

$free1 = (Get-PSDrive $letter).Free
$results | Where-Object { $_.MB -gt 5 } | Sort-Object MB -Descending | Format-Table -AutoSize
'Freed (sum of items): {0:N2} GB' -f ((($results | Measure-Object MB -Sum).Sum) / 1024)
'{0}: free {1:N2} -> {2:N2} GB (delta {3:N2} GB)' -f $letter, ($free0 / 1GB), ($free1 / 1GB), (($free1 - $free0) / 1GB)
