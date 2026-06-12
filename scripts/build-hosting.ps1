$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir "..")

. (Join-Path $scriptDir "ensure-node-path.ps1")

function Ensure-Dir([string]$path) {
  if (-not (Test-Path $path)) {
    New-Item -ItemType Directory -Path $path | Out-Null
  }
}

Push-Location $repoRoot
try {
  Write-Host "[1/2] Build web para hosting (Vite)..."
  npm run build:web:hosting
  if ($LASTEXITCODE -ne 0) {
    throw "Fallo en 'npm run build:web:hosting' (exit code $LASTEXITCODE)."
  }

  $distHosting = Join-Path $repoRoot "dist-hosting"
  if (-not (Test-Path $distHosting)) {
    throw "No existe '$distHosting'."
  }

  Write-Host "[2/2] Preparando paquete para Dondominio (PHP + estático)..."
  $releaseRoot = Join-Path $repoRoot "release"
  $stamp = Get-Date -Format "yyyy-MM-dd_HHmm"
  $releaseFolder = Join-Path $releaseRoot ($stamp + "_hosting")
  Ensure-Dir $releaseRoot
  Ensure-Dir $releaseFolder

  Copy-Item -Path (Join-Path $distHosting "*") -Destination $releaseFolder -Recurse -Force
  Copy-Item -Path (Join-Path $repoRoot "deploy\dondominio\index.php") -Destination $releaseFolder -Force
  Copy-Item -Path (Join-Path $repoRoot "deploy\dondominio\.htaccess") -Destination $releaseFolder -Force
  Copy-Item -Path (Join-Path $repoRoot "api") -Destination $releaseFolder -Recurse -Force
  Copy-Item -Path (Join-Path $repoRoot "config") -Destination $releaseFolder -Recurse -Force
  Copy-Item -Path (Join-Path $repoRoot "sql") -Destination $releaseFolder -Recurse -Force

  Write-Host "Paquete listo para subir (contenido de '$releaseFolder')."
}
finally {
  Pop-Location
}
