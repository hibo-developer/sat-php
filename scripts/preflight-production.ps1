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

function Test-RelativeOrHttpsUrl([string]$url) {
  if ([string]::IsNullOrWhiteSpace($url)) {
    return $true
  }

  if ($url.StartsWith("/")) {
    return $true
  }

  return Test-HttpsUrl $url
}

$envPath = Join-Path $repoRoot $EnvFile
$envData = Parse-EnvFile $envPath
$resultados = @()

Write-Host "== Preflight de Produccion SAT PHP/MySQL =="
Write-Host "Repositorio: $repoRoot"
Write-Host "Env file: $envPath"

$apiBaseUrl = if ($envData.ContainsKey("VITE_API_BASE_URL")) { $envData["VITE_API_BASE_URL"] } else { "" }
Add-Result -lista ([ref]$resultados) -nombre "ENV:VITE_API_BASE_URL" -ok (Test-RelativeOrHttpsUrl $apiBaseUrl) -detalle "Debe ser relativa (/api) o https valida"

$baseUrl = if ($envData.ContainsKey("SAT_BASE_URL")) { $envData["SAT_BASE_URL"] } else { "" }
Add-Result -lista ([ref]$resultados) -nombre "ENV:SAT_BASE_URL" -ok (Test-RelativeOrHttpsUrl $baseUrl) -detalle "Si se define, debe ser https valida"

$requiredFiles = @(
  "api/index.php",
  "config/database.php",
  "deploy/dondominio/index.php",
  "deploy/dondominio/api/index.php",
  "public/app-config.js",
  "sql/dondominio_mysql.sql",
  "DONDOMINIO.md"
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
