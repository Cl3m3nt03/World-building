# Downloads the Microsoft Edge WebDriver (msedgedriver.exe) matching the
# installed WebView2 runtime, into e2e/.bin/. tauri-driver needs both
# versions to match exactly. Used by `pnpm test:e2e` and the CI e2e job.
$ErrorActionPreference = 'Stop'

$webview2 = '{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
$keys = @(
  "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\$webview2",
  "HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\$webview2",
  "HKCU:\Software\Microsoft\EdgeUpdate\Clients\$webview2"
)
$version = $null
foreach ($key in $keys) {
  $value = (Get-ItemProperty -Path $key -Name pv -ErrorAction SilentlyContinue).pv
  if ($value -and $value -ne '0.0.0.0') { $version = $value; break }
}
if (-not $version) { throw 'WebView2 runtime not found in the registry.' }

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
