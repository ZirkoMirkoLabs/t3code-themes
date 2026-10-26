param(
  [string]$Origin,
  [switch]$Pair = $true,
  [string]$T3Command,
  [string]$T3Entrypoint,
  [switch]$T3ElectronNode,
  [string]$T3Home,
  [string]$Scopes,
  [switch]$NoSkin,
  [switch]$PassThru
)
$ErrorActionPreference = 'Stop'
$skinElectron = Join-Path $PSScriptRoot 'node_modules\electron\dist\electron.exe'
if (!(Test-Path -LiteralPath $skinElectron)) { throw 'Run npm install in the launcher folder first.' }
$skinArgs = @($PSScriptRoot)
if ($Origin) { $skinArgs += @('--origin', $Origin) }
if ($Pair) { $skinArgs += '--pair' }
if ($NoSkin) { $skinArgs += '--no-skin' }
if ($T3Command) { $skinArgs += @('--t3-command', $T3Command) }
if ($T3Entrypoint) { $skinArgs += @('--t3-entrypoint', $T3Entrypoint) }
if ($T3ElectronNode) { $skinArgs += '--t3-electron-node' }
if ($T3Home) { $skinArgs += @('--t3-home', $T3Home) }
if ($Scopes) { $skinArgs += @('--scopes', $Scopes) }
# Electron must run as a browser even when launched from an Electron-hosted agent.
$skinPreviousNodeMode = $env:ELECTRON_RUN_AS_NODE
try {
  Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
  # Start-Process flattens ArgumentList; quote paths containing spaces explicitly.
  foreach ($skinArg in $skinArgs) { if ($skinArg.Contains('"') -or $skinArg.Contains("`n") -or $skinArg.Contains("`r")) { throw 'Invalid launcher argument.' } }
  $skinQuotedArgs = $skinArgs | ForEach-Object { '"' + $_.TrimEnd('\') + '"' }
  $skinProcess = Start-Process -FilePath $skinElectron -ArgumentList $skinQuotedArgs -WindowStyle Hidden -PassThru
  if ($PassThru) { $skinProcess }
}
finally { $env:ELECTRON_RUN_AS_NODE = $skinPreviousNodeMode }
