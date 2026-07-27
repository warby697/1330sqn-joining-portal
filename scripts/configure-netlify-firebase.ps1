param(
  [switch]$Apply
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$keyPath = Join-Path $projectRoot '.secrets\joining-portal-firebase-admin.json'
$netlifyCli = Join-Path $projectRoot 'node_modules\.bin\netlify.cmd'

if (-not $Apply) {
  Write-Host 'This stores the joining portal Firebase service-account key in the linked Netlify project.'
  Write-Host 'It changes encrypted environment configuration only. It does not deploy the website.'
  Write-Host 'Run again with -Apply when ready.'
  exit 2
}

if (-not (Test-Path -LiteralPath $keyPath -PathType Leaf)) {
  throw "Firebase key not found at $keyPath"
}

if (-not (Test-Path -LiteralPath $netlifyCli -PathType Leaf)) {
  throw "Netlify CLI not found at $netlifyCli"
}

$service = Get-Content -LiteralPath $keyPath -Raw | ConvertFrom-Json
if (-not $service.project_id -or -not $service.client_email -or -not $service.private_key) {
  throw 'The Firebase service-account file is not valid.'
}
if ($service.project_id -ne 'sqn-ops') {
  throw 'The Firebase service account belongs to the wrong project.'
}

Push-Location $projectRoot
try {
  & $netlifyCli env:set FIREBASE_ADMIN_PROJECT_ID $service.project_id --context production --scope functions --force
  if ($LASTEXITCODE -ne 0) { throw 'Netlify rejected the Firebase project ID.' }

  & $netlifyCli env:set FIREBASE_ADMIN_CLIENT_EMAIL $service.client_email --context production --scope functions --secret --force
  if ($LASTEXITCODE -ne 0) { throw 'Netlify rejected the Firebase client email.' }

  # Put all options before `--` so the PEM value beginning with five hyphens is
  # treated as a value rather than another command-line option.
  & $netlifyCli env:set --context production --scope functions --secret --force -- FIREBASE_ADMIN_PRIVATE_KEY $service.private_key
  if ($LASTEXITCODE -ne 0) { throw 'Netlify rejected the Firebase private key.' }

  & $netlifyCli env:set STAFF_PIN 1918 --context production --scope functions --secret --force
  if ($LASTEXITCODE -ne 0) { throw 'Netlify rejected the staff PIN.' }

  Write-Host 'Firebase and staff PIN configuration saved. No deployment was started.'
}
finally {
  $service = $null
  Pop-Location
}
