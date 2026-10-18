# Run from anywhere: .\scripts\check.ps1   (Postgres container must be running)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

function Step([string]$name, [scriptblock]$block) {
  Write-Host "`n== $name ==" -ForegroundColor Cyan
  & $block
  if ($LASTEXITCODE -ne 0) { throw "$name failed" }
}

Push-Location "$root\backend"
try {
  Step "backend lint (ruff)" { & .\.venv\Scripts\python.exe -m ruff check app }
  Step "backend tests (pytest)" { & .\.venv\Scripts\python.exe -m pytest -q }
} finally { Pop-Location }

Push-Location "$root\frontend"
try {
  Step "frontend lint" { npm run lint }
  Step "frontend build (tsc + vite)" { npm run build }
  Step "frontend tests (vitest)" { npm test }
} finally { Pop-Location }

Step "secret scan" { python "$root\scripts\check_secrets.py" }
Write-Host "`nAll checks passed." -ForegroundColor Green
