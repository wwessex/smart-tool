param(
  [ValidateSet("run", "debug", "logs", "telemetry", "verify")]
  [string]$Mode = "run"
)

$ErrorActionPreference = "Stop"

$AppName = "SMART Tool"
$RootDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$WinUnpackedExe = Join-Path $RootDir "release\win-unpacked\SMART Tool.exe"
$ProcessNames = @($AppName, "electron")

Set-Location $RootDir

foreach ($ProcessName in $ProcessNames) {
  Get-Process -Name $ProcessName -ErrorAction SilentlyContinue | Stop-Process -Force
}

switch ($Mode) {
  "run" {
    npm run desktop:dev
  }
  "debug" {
    $env:ELECTRON_ENABLE_LOGGING = "1"
    npm run desktop:dev
  }
  "logs" {
    $env:ELECTRON_ENABLE_LOGGING = "1"
    npm run desktop:dev
  }
  "telemetry" {
    $env:ELECTRON_ENABLE_LOGGING = "1"
    npm run desktop:dev
  }
  "verify" {
    npm run desktop:build

    if (-not (Test-Path $WinUnpackedExe)) {
      throw "Expected Windows desktop artifact not found at $WinUnpackedExe"
    }

    $process = Start-Process -FilePath $WinUnpackedExe -PassThru
    Start-Sleep -Seconds 2
    Get-Process -Id $process.Id -ErrorAction Stop | Out-Null
    Write-Host "Verified Windows desktop executable at $WinUnpackedExe"
  }
}
