$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCmd) {
  Write-Host "Node disponible en PATH: $($nodeCmd.Source)"
  node -v
  $npmCmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($npmCmd) {
    & $npmCmd.Source -v
  }
  else {
    npm -v
  }
  return
}

$fnmNodeVersionsRoot = Join-Path $env:APPDATA "fnm\node-versions"
if (Test-Path $fnmNodeVersionsRoot) {
  $instalacionesFnm = Get-ChildItem -Path $fnmNodeVersionsRoot -Directory -ErrorAction SilentlyContinue |
    ForEach-Object { Join-Path $_.FullName "installation" } |
    Where-Object {
      (Test-Path (Join-Path $_ "node.exe")) -and (Test-Path (Join-Path $_ "npm.cmd"))
    }

  if ($instalacionesFnm) {
    $instalacionMasReciente = $instalacionesFnm |
      Sort-Object { (Get-Item (Join-Path $_ "node.exe")).LastWriteTime } -Descending |
      Select-Object -First 1

    $pathActual = $env:Path -split ';'
    if ($pathActual -notcontains $instalacionMasReciente) {
      $env:Path = "$instalacionMasReciente;$env:Path"
    }

    Write-Host "Node disponible via fnm en: $instalacionMasReciente"
    Set-Alias -Name npm -Value (Join-Path $instalacionMasReciente "npm.cmd") -Scope Global
    Set-Alias -Name npx -Value (Join-Path $instalacionMasReciente "npx.cmd") -Scope Global
    node -v
    & (Join-Path $instalacionMasReciente "npm.cmd") -v
    return
  }
}

$candidatos = @(
  "C:\Program Files\nodejs",
  "C:\Program Files (x86)\nodejs",
  "$env:LOCALAPPDATA\Programs\nodejs"
) | Where-Object { $_ -and (Test-Path (Join-Path $_ "node.exe")) }

if (-not $candidatos -or $candidatos.Count -eq 0) {
  Write-Error "No se encontró node.exe ni en PATH ni en ubicaciones típicas. Instala Node.js o añade node.exe al PATH."
  exit 1
}

$nodePath = $candidatos[0]
$pathActual = $env:Path -split ';'
if ($pathActual -notcontains $nodePath) {
  $env:Path = "$nodePath;$env:Path"
}

Write-Host "Node disponible en: $nodePath"
Set-Alias -Name npm -Value (Join-Path $nodePath "npm.cmd") -Scope Global
Set-Alias -Name npx -Value (Join-Path $nodePath "npx.cmd") -Scope Global
node -v
& (Join-Path $nodePath "npm.cmd") -v
