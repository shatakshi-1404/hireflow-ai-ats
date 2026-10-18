# .\scripts\smoke.ps1 -BaseUrl https://your-app.vercel.app -Password <demo password>
param(
  [Parameter(Mandatory = $true)][string]$BaseUrl,
  [Parameter(Mandatory = $true)][string]$Password,
  [string]$Email = "demo-recruiter@example.com"
)
$ErrorActionPreference = "Stop"
$BaseUrl = $BaseUrl.TrimEnd("/")
$api = "$BaseUrl/api/v1"
$failures = 0
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

function Check([string]$name, [scriptblock]$test) {
  $ok = $false
  try { $ok = [bool](& $test) } catch { Write-Host "      $($_.Exception.Message)" -ForegroundColor DarkGray }
  if ($ok) { Write-Host "PASS  $name" -ForegroundColor Green }
  else { Write-Host "FAIL  $name" -ForegroundColor Red; $script:failures++ }
}

function Status([scriptblock]$call) {
  try { (& $call).StatusCode } catch {
    if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode.value__ } else { throw }
  }
}

Write-Host "Warming up (a free host can take about a minute to wake)..." -ForegroundColor Cyan
Invoke-WebRequest "$api/health" -UseBasicParsing -TimeoutSec 150 | Out-Null

Check "API health" { (Invoke-RestMethod "$api/health").status -eq "ok" }
Check "database connected" { (Invoke-RestMethod "$api/health/db" -TimeoutSec 60).database -eq "connected" }
Check "unauthenticated request is 401" { (Status { Invoke-WebRequest "$api/candidates" -UseBasicParsing }) -eq 401 }
Check "deep link serves the app (SPA fallback)" {
  $r = Invoke-WebRequest "$BaseUrl/candidates" -UseBasicParsing
  $r.StatusCode -eq 200 -and $r.Content -match 'id="root"'
}
Check "frontend sends a CSP header" { [bool](Invoke-WebRequest "$BaseUrl/" -UseBasicParsing).Headers["Content-Security-Policy"] }
Check "API sends nosniff and no-store" {
  $h = (Invoke-WebRequest "$api/health" -UseBasicParsing).Headers
  [bool]$h["X-Content-Type-Options"] -and [bool]$h["Cache-Control"]
}
Check "cross-origin write is blocked (403)" {
  (Status {
    Invoke-WebRequest -Method Post -Uri "$api/auth/login" -UseBasicParsing -ContentType "application/json" `
      -Headers @{ Origin = "https://evil.example" } -Body '{"email":"a@example.com","password":"x"}'
  }) -eq 403
}
Check "wrong password is 401" {
  (Status {
    Invoke-WebRequest -Method Post -Uri "$api/auth/login" -UseBasicParsing -ContentType "application/json" `
      -Body (@{ email = $Email; password = "definitely-wrong" } | ConvertTo-Json)
  }) -eq 401
}

$login = Invoke-RestMethod -Method Post -Uri "$api/auth/login" -WebSession $session -ContentType "application/json" `
  -Body (@{ email = $Email; password = $Password } | ConvertTo-Json)
Check "login returns the user" { $login.email -eq $Email }
Check "session cookie works (/auth/me)" { (Invoke-RestMethod "$api/auth/me" -WebSession $session).email -eq $Email }
Check "candidates list has data" { (Invoke-RestMethod "$api/candidates" -WebSession $session).total -gt 0 }
Check "analytics overview has KPIs" { (Invoke-RestMethod "$api/analytics/overview" -WebSession $session).kpis.total_candidates -gt 0 }
Check "AI status reports a mode" { [bool](Invoke-RestMethod "$api/ai/status" -WebSession $session).mode }

$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$new = $null
Check "create a candidate" {
  $script:new = Invoke-RestMethod -Method Post -Uri "$api/candidates" -WebSession $session -ContentType "application/json" `
    -Body (@{ full_name = "Smoke Test"; email = "smoke-$stamp@example.com" } | ConvertTo-Json)
  [bool]$script:new.id
}
if ($new) {
  Check "read it back" { (Invoke-RestMethod "$api/candidates/$($new.id)" -WebSession $session).email -eq "smoke-$stamp@example.com" }
  Check "delete it" { (Status { Invoke-WebRequest -Method Delete -Uri "$api/candidates/$($new.id)" -WebSession $session -UseBasicParsing }) -eq 204 }
}

if ($failures -gt 0) { Write-Host "`n$failures check(s) failed." -ForegroundColor Red; exit 1 }
Write-Host "`nAll smoke checks passed." -ForegroundColor Green
