# Diagnostic for the e2e CI job: records, once per process, the command line
# of the app, WebView2 and msedgedriver processes while the tests run.
param(
  [Parameter(Mandatory)] [string] $LogPath,
  [int] $Iterations = 400,
  [int] $IntervalSeconds = 3
)

$names = @('builderz.exe', 'msedgewebview2.exe', 'msedgedriver.exe')
$seen = @{}
for ($i = 0; $i -lt $Iterations; $i++) {
  Get-CimInstance Win32_Process | Where-Object { $names -contains $_.Name } | ForEach-Object {
    if (-not $seen.ContainsKey($_.ProcessId)) {
      $seen[$_.ProcessId] = $true
      $line = "[{0}] {1} pid={2} parent={3}`n  {4}" -f (Get-Date -Format o), $_.Name, $_.ProcessId, $_.ParentProcessId, $_.CommandLine
      Add-Content -Path $LogPath -Value $line
    }
  }
  Start-Sleep -Seconds $IntervalSeconds
}
