# Sincroniza DATABASE_URL y PADRON_DATABASE_URL en Vercel (production).
# Lee .env.local — no commitear.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '.env.local'
if (-not (Test-Path $envFile)) { throw "No existe .env.local" }

function Get-EnvVal($name) {
  foreach ($line in Get-Content $envFile) {
    if ($line -match "^\s*$name=(.+)$") { return $matches[1].Trim() }
  }
  return $null
}

$database = Get-EnvVal 'DATABASE_URL'
$padron = Get-EnvVal 'PADRON_DATABASE_URL'
if (-not $database -or -not $padron) { throw 'Faltan DATABASE_URL o PADRON_DATABASE_URL' }

Set-Location $root
Write-Host "Vercel: DATABASE_URL ->" ($database -replace ':([^@]+)@', ':***@')
Write-Host "Vercel: PADRON_DATABASE_URL ->" ($padron -replace ':([^@]+)@', ':***@')

foreach ($name in @('DATABASE_URL', 'PADRON_DATABASE_URL', 'JWT_SECRET')) {
  $val = if ($name -eq 'JWT_SECRET') { Get-EnvVal 'JWT_SECRET' } elseif ($name -eq 'PADRON_DATABASE_URL') { $padron } else { $database }
  if (-not $val) { continue }
  echo $val | npx vercel env rm $name production -y 2>$null
  echo $val | npx vercel env add $name production --force 2>&1
}

Write-Host "Listo. Ejecutá: npx vercel deploy --prod"
