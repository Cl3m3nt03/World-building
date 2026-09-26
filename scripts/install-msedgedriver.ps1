# Downloads the Microsoft Edge WebDriver (msedgedriver.exe) matching the
# installed WebView2 runtime, into e2e/.bin/. tauri-driver needs both
# versions to match exactly. Used by `pnpm test:e2e` and the CI e2e job.
#
# The version is read from the runtime folders on disk first: WebView2 loads
# the highest installed version, and the EdgeUpdate registry value can lag
# behind it (e.g. on CI images). The registry is only a fallback.
$ErrorActionPreference = 'Stop'

function Get-VersionsInFolder([string]$folder) {
  if (-not (Test-Path $folder)) { return @() }
  Get-ChildItem -Path $folder -Directory |
    Where-Object { $_.Name -match '^\d+\.\d+\.\d+\.\d+$' -and (Test-Path (Join-Path $_.FullName 'msedgewebview2.exe')) } |
    ForEach-Object { [version]$_.Name }
}

$folders = @(
  "${env:ProgramFiles(x86)}\Microsoft\EdgeWebView\Application",
  "$env:ProgramFiles\Microsoft\EdgeWebView\Application"
)
$onDisk = @($folders | ForEach-Object { Get-VersionsInFolder $_ })

$webview2 = '{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
$registry = @(
  "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\$webview2",
  "HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\$webview2",
  "HKCU:\Software\Microsoft\EdgeUpdate\Clients\$webview2"
) | ForEach-Object { (Get-ItemProperty -Path $_ -Name pv -ErrorAction SilentlyContinue).pv } |
  Where-Object { $_ -and $_ -ne '0.0.0.0' }

Write-Host "WebView2 runtime versions on disk: $($onDisk -join ', ')"
Write-Host "WebView2 runtime versions in the registry: $($registry -join ', ')"

if ($onDisk.Count -gt 0) {
  $version = ($onDisk | Sort-Object -Descending | Select-Object -First 1).ToString()
} elseif ($registry) {
  $version = @($registry)[0]
} else {
  throw 'WebView2 runtime not found (neither on disk nor in the registry).'
}
Write-Host "Using WebView2 version $version"

$binDir = Join-Path $PSScriptRoot '..\e2e\.bin'
$driver = Join-Path $binDir 'msedgedriver.exe'
$stamp = Join-Path $binDir 'msedgedriver.version'
if ((Test-Path $driver) -and (Test-Path $stamp) -and ((Get-Content $stamp -Raw).Trim() -eq $version)) {
  Write-Host "msedgedriver $version already installed."
  exit 0
}

New-Item -ItemType Directory -Force -Path $binDir | Out-Null
$zip = Join-Path $env:TEMP "edgedriver_win64_$version.zip"
$url = "https://msedgedriver.microsoft.com/$version/edgedriver_win64.zip"
Write-Host "Downloading msedgedriver $version from $url"
Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $zip

$extract = Join-Path $env:TEMP "edgedriver_$version"
Expand-Archive -Path $zip -DestinationPath $extract -Force
Copy-Item -Path (Join-Path $extract 'msedgedriver.exe') -Destination $driver -Force
Set-Content -Path $stamp -Value $version -Encoding ascii
Remove-Item -Recurse -Force $zip, $extract
Write-Host "msedgedriver $version installed in $binDir"
