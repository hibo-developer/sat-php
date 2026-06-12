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
  $releasePublicHtml = Join-Path $releaseFolder "public_html"
  Ensure-Dir $releaseRoot
  Ensure-Dir $releaseFolder
  Ensure-Dir $releasePublicHtml
  Ensure-Dir (Join-Path $releasePublicHtml "api")
  Ensure-Dir (Join-Path $releasePublicHtml "api\\setup")

  Copy-Item -Path (Join-Path $distHosting "*") -Destination $releasePublicHtml -Recurse -Force
  Copy-Item -Path (Join-Path $repoRoot "deploy\dondominio\index.php") -Destination $releasePublicHtml -Force
  Copy-Item -Path (Join-Path $repoRoot "deploy\dondominio\.htaccess") -Destination $releasePublicHtml -Force
  Copy-Item -Path (Join-Path $repoRoot "deploy\dondominio\api\index.php") -Destination (Join-Path $releasePublicHtml "api") -Force
  Copy-Item -Path (Join-Path $repoRoot "deploy\dondominio\api\.htaccess") -Destination (Join-Path $releasePublicHtml "api") -Force
  Copy-Item -Path (Join-Path $repoRoot "deploy\dondominio\api\setup\create_admin.php") -Destination (Join-Path $releasePublicHtml "api\\setup") -Force
  Copy-Item -Path (Join-Path $repoRoot "api") -Destination $releaseFolder -Recurse -Force
  Copy-Item -Path (Join-Path $repoRoot "config") -Destination $releaseFolder -Recurse -Force
  Copy-Item -Path (Join-Path $repoRoot "sql") -Destination $releaseFolder -Recurse -Force
  Copy-Item -Path (Join-Path $repoRoot "DONDOMINIO.md") -Destination $releaseFolder -Force

  Write-Host "Paquete listo para subir (contenido de '$releaseFolder')."
  Write-Host "Estructura generada:"
  Write-Host " - public_html/  -> frontend estático"
  Write-Host " - public_html/api/ -> entrada web a la API"
  Write-Host " - api/             -> backend PHP (fuera de public_html)"
  Write-Host " - config/       -> configuración MySQL"
  Write-Host " - sql/          -> import SQL"
}
finally {
  Pop-Location
}
