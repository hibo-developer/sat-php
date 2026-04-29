param(
  [switch]$Clean
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir "..")

. (Join-Path $scriptDir "ensure-node-path.ps1")

function Remove-DirSafe([string]$path) {
  if (-not (Test-Path $path)) {
    return
  }

  try {
    Remove-Item -Recurse -Force -Path $path -ErrorAction Stop
  }
  catch {
    Write-Warning "No se pudo limpiar '$path': $($_.Exception.Message)"
  }
}

function Sync-CapacitorAndroid([string]$repoRoot) {
  npx cap sync android
  if ($LASTEXITCODE -eq 0) {
    return
  }

  Write-Warning "cap sync falló. Intentando recuperación de carpetas bloqueadas y reintento..."
  Remove-DirSafe (Join-Path $repoRoot "android\capacitor-cordova-android-plugins\build\intermediates")
  Remove-DirSafe (Join-Path $repoRoot "android\app\build\intermediates")

  npx cap sync android
  if ($LASTEXITCODE -ne 0) {
    throw "Fallo en 'npx cap sync android' tras reintento (exit code $LASTEXITCODE)."
  }
}

function Build-GradleRelease([string]$androidRoot, [bool]$forceClean) {
  $gradleArgs = @('assembleRelease', '--quiet')
  if ($forceClean) {
    $gradleArgs = @('clean', 'assembleRelease', '--quiet')
  }

  .\gradlew.bat @gradleArgs
  if ($LASTEXITCODE -eq 0) {
    return
  }

  Write-Warning "Gradle assembleRelease falló. Intentando desbloqueo de artefactos y reintento..."
  .\gradlew.bat --stop | Out-Null

  Remove-DirSafe (Join-Path $androidRoot "app\build\intermediates\incremental\packageRelease\tmp")
  Remove-DirSafe (Join-Path $androidRoot "app\build\intermediates")
  Remove-DirSafe (Join-Path $androidRoot "build")
  Remove-DirSafe (Join-Path $androidRoot "capacitor-cordova-android-plugins\build\intermediates")

  .\gradlew.bat @gradleArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Fallo en Gradle assembleRelease tras reintento (exit code $LASTEXITCODE). Cierra Android Studio/Explorer sobre carpeta android y pausa OneDrive temporalmente."
  }
}

function Ensure-Dir([string]$path) {
  if (-not (Test-Path $path)) {
    New-Item -ItemType Directory -Path $path | Out-Null
  }
}

function Publish-ReleaseArtifact([string]$repoRoot, [string]$artifactPath) {
  $releaseRoot = Join-Path $repoRoot "release"
  $stamp = Get-Date -Format "yyyy-MM-dd_HHmm"
  $releaseFolder = Join-Path $releaseRoot $stamp

  Ensure-Dir $releaseRoot
  Ensure-Dir $releaseFolder

  $artifactName = Split-Path $artifactPath -Leaf
  $destPath = Join-Path $releaseFolder $artifactName
  Copy-Item -Path $artifactPath -Destination $destPath -Force

  return $destPath
}

Push-Location $repoRoot
try {
  Write-Host "[1/3] Build web (Vite)..."
  npm run build
  if ($LASTEXITCODE -ne 0) {
    throw "Fallo en 'npm run build' (exit code $LASTEXITCODE)."
  }

  Write-Host "[2/3] Sync Capacitor Android..."
  Sync-CapacitorAndroid $repoRoot

  if ($Clean) {
    Write-Host "[3/3] Build APK release (clean)..."
  }
  else {
    Write-Host "[3/3] Build APK release..."
  }
  $apkPath = Join-Path $repoRoot "android\app\build\outputs\apk\release\app-release.apk"
  $apkPrevio = if (Test-Path $apkPath) { Get-Item $apkPath } else { $null }

  Push-Location (Join-Path $repoRoot "android")
  try {
    Build-GradleRelease (Join-Path $repoRoot "android") $Clean.IsPresent
  }
  finally {
    Pop-Location
  }

  if (-not (Test-Path $apkPath)) {
    throw "No se encontró el APK release en: $apkPath"
  }

  $apkActual = Get-Item $apkPath
  if ($Clean) {
    Write-Host "Compilacion limpia completada."
  }
  elseif ($apkPrevio -and $apkActual.LastWriteTime -le $apkPrevio.LastWriteTime) {
    Write-Warning "Gradle terminó sin generar un APK nuevo (UP-TO-DATE). Se reutiliza el APK existente."
  }

  Write-Host "APK generado correctamente:"
  $apkActual | Select-Object FullName, Length, LastWriteTime | Format-List

  $releaseArtifactPath = Publish-ReleaseArtifact $repoRoot $apkPath
  Write-Host "Publicacion en release completada:"
  Get-Item $releaseArtifactPath | Select-Object FullName, Length, LastWriteTime | Format-List
}
finally {
  Pop-Location
}
