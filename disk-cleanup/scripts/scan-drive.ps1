param([string]$Drive = 'C')
$ErrorActionPreference = 'SilentlyContinue'
$root = "${Drive}:\"
if (-not (Test-Path -LiteralPath $root)) { Write-Error "Drive $root not found"; exit 1 }

# Reparse-safe tree size: skips reparse points (junctions/symlinks) to avoid
# loops, and catches per-entry errors. Plain `Get-ChildItem -Recurse` can abort
# on a reparse point and silently return a tiny wrong size.
function Get-TreeSize([string]$Path) {
  $sum = [long]0
  $stack = New-Object System.Collections.Stack
  $stack.Push($Path)
  while ($stack.Count) {
    $dir = $stack.Pop()
    try { $entries = [System.IO.Directory]::EnumerateFileSystemEntries($dir) } catch { continue }
    foreach ($e in $entries) {
      try {
        $a = [System.IO.File]::GetAttributes($e)
        if ($a -band [System.IO.FileAttributes]::Directory) {
          if ($a -band [System.IO.FileAttributes]::ReparsePoint) { continue }
          $stack.Push($e)
        } else {
          $sum += (New-Object System.IO.FileInfo($e)).Length
        }
      } catch {}
    }
  }
  return $sum
}

Get-ChildItem $root -Force -Directory -ErrorAction SilentlyContinue |
  ForEach-Object {
    [pscustomobject]@{ GB = [math]::Round((Get-TreeSize $_.FullName) / 1GB, 2); Name = $_.Name }
  } | Sort-Object GB -Descending | Select-Object -First 30 | Format-Table -AutoSize

Write-Host "`nRoot files (pagefile/hiberfil/swapfile live here; excluded from folders above):"
Get-ChildItem $root -Force -File -ErrorAction SilentlyContinue |
  Sort-Object Length -Descending | Select-Object -First 10 |
  ForEach-Object { '{0,10:N2} GB  {1}' -f ($_.Length / 1GB), $_.Name }
