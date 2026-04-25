param(
  [string]$EnvFile = ".env"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir "..")

. (Join-Path $scriptDir "ensure-node-path.ps1")

function Parse-EnvFile([string]$path) {
  $resultado = @{}

  if (-not (Test-Path $path)) {
    return $resultado
  }

  foreach ($linea in Get-Content -Path $path) {
    $texto = $linea.Trim()
    if (-not $texto -or $texto.StartsWith("#")) {
      continue
    }

    $partes = $texto -split '=', 2
    if ($partes.Count -ne 2) {
      continue
    }

    $clave = $partes[0].Trim()
    $valor = $partes[1].Trim().Trim('"')

    if ($clave) {
      $resultado[$clave] = $valor
    }
  }

  return $resultado
}

function Add-Result([ref]$lista, [string]$nombre, [bool]$ok, [string]$detalle) {
  $lista.Value += [pscustomobject]@{
    Nombre = $nombre
    OK = $ok
    Detalle = $detalle
  }
}

function Test-HttpsUrl([string]$url) {
  if ([string]::IsNullOrWhiteSpace($url)) {
    return $false
  }

  $uri = $null
  if (-not [System.Uri]::TryCreate($url, [System.UriKind]::Absolute, [ref]$uri)) {
    return $false
  }

  return $uri.Scheme -eq "https"
}

$envPath = Join-Path $repoRoot $EnvFile
$envData = Parse-EnvFile $envPath
$resultados = @()

Write-Host "== Preflight de Produccion SAT =="
Write-Host "Repositorio: $repoRoot"
Write-Host "Env file: $envPath"

$requiredEnv = @("VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY")
foreach ($clave in $requiredEnv) {
  $valor = if ($envData.ContainsKey($clave)) { $envData[$clave] } else { "" }
  $ok = -not [string]::IsNullOrWhiteSpace($valor)
  Add-Result -lista ([ref]$resultados) -nombre "ENV:$clave" -ok $ok -detalle ($(if ($ok) { "Definida" } else { "Falta definir" }))
}

$sbUrl = if ($envData.ContainsKey("VITE_SUPABASE_URL")) { $envData["VITE_SUPABASE_URL"] } else { "" }
Add-Result -lista ([ref]$resultados) -nombre "SUPABASE_URL_HTTPS" -ok (Test-HttpsUrl $sbUrl) -detalle "La URL debe ser https valida"

$anonKey = if ($envData.ContainsKey("VITE_SUPABASE_ANON_KEY")) { $envData["VITE_SUPABASE_ANON_KEY"] } else { "" }
Add-Result -lista ([ref]$resultados) -nombre "SUPABASE_ANON_KEY_LONGITUD" -ok ($anonKey.Length -ge 20) -detalle "La anon key parece demasiado corta"

$requiredFiles = @(
  "supabase/04_security_roles_rls.sql",
  "supabase/06_storage_firmas_clientes.sql",
  "supabase/07_storage_informes_partes.sql",
  "supabase/10_security_hardening.sql",
  "supabase/11_block_anonymous_sessions.sql",
  "docs/checklist-validacion-roles.md"
)

foreach ($archivo in $requiredFiles) {
  $rutaAbs = Join-Path $repoRoot $archivo
  Add-Result -lista ([ref]$resultados) -nombre "FILE:$archivo" -ok (Test-Path $rutaAbs) -detalle "Archivo requerido para salida a produccion"
}

$okCount = ($resultados | Where-Object { $_.OK }).Count
$failCount = $resultados.Count - $okCount

Write-Host ""
Write-Host "Resultados:"
foreach ($resultado in $resultados) {
  if ($resultado.OK) {
    Write-Host "[OK]  $($resultado.Nombre) - $($resultado.Detalle)"
  } else {
    Write-Host "[FAIL] $($resultado.Nombre) - $($resultado.Detalle)" -ForegroundColor Red
  }
}

Write-Host ""
Write-Host "Resumen: $okCount OK / $failCount FAIL"

if ($failCount -gt 0) {
  Write-Error "Preflight de produccion no superado. Corrige los elementos marcados como FAIL."
  exit 1
}

Write-Host "Preflight de produccion superado." -ForegroundColor Green
