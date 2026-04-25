<#
.SYNOPSIS
    Genera un .ico multi-resolucion (16,24,32,48,64,128,256) valido para Windows
    a partir de un PNG cuadrado de alta resolucion. Usa solo .NET (System.Drawing),
    no necesita ImageMagick ni Node.

.PARAMETER Source
    PNG de origen. Recomendado: 1024x1024 o al menos 512x512, fondo transparente.

.PARAMETER Output
    Ruta del .ico a generar. Por defecto: electron/assets/app-icon.ico

.EXAMPLE
    pwsh ./scripts/generate-app-icon.ps1 -Source ./electron/assets/app-icon.png
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string] $Source,
    [string] $Output = 'electron/assets/app-icon.ico'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $Source)) {
    throw "No existe el PNG de origen: $Source"
}

Add-Type -AssemblyName System.Drawing

$sizes = 16, 24, 32, 48, 64, 128, 256
$srcImg = [System.Drawing.Image]::FromFile((Resolve-Path $Source))

# Generar PNGs en memoria por cada tamano
$pngBytesPerSize = @{}
foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode  = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($srcImg, 0, 0, $size, $size)
    $g.Dispose()

    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngBytesPerSize[$size] = $ms.ToArray()
    $ms.Dispose()
    $bmp.Dispose()
}
$srcImg.Dispose()

# Construir ICO en binario:
# - ICONDIR (6 bytes): reservado=0, type=1 (icon), count
# - ICONDIRENTRY (16 bytes) por cada imagen
# - Datos PNG por cada imagen al final
$outDir = Split-Path -Parent $Output
if ($outDir -and -not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

$fs = [System.IO.File]::Open($Output, [System.IO.FileMode]::Create)
$bw = New-Object System.IO.BinaryWriter $fs

# ICONDIR
$bw.Write([uint16]0)            # Reserved
$bw.Write([uint16]1)            # Type = icon
$bw.Write([uint16]$sizes.Count) # Image count

# Offset inicial = 6 + 16 * count
$offset = 6 + (16 * $sizes.Count)

# ICONDIRENTRY por imagen
foreach ($size in $sizes) {
    $bytes = $pngBytesPerSize[$size]
    $w = if ($size -ge 256) { [byte]0 } else { [byte]$size }   # 0 = 256
    $h = $w
    $bw.Write([byte]$w)              # width
    $bw.Write([byte]$h)              # height
    $bw.Write([byte]0)               # color count (0 = >= 256)
    $bw.Write([byte]0)               # reserved
    $bw.Write([uint16]1)             # color planes
    $bw.Write([uint16]32)            # bits per pixel
    $bw.Write([uint32]$bytes.Length) # bytes in resource
    $bw.Write([uint32]$offset)       # offset
    $offset += $bytes.Length
}

# Datos PNG
foreach ($size in $sizes) {
    $bw.Write($pngBytesPerSize[$size])
}

$bw.Dispose()
$fs.Dispose()

$info = Get-Item $Output
Write-Host "OK: $($info.FullName)" -ForegroundColor Green
Write-Host "    Tamano: $([math]::Round($info.Length/1KB,1)) KB | Imagenes: $($sizes.Count) ($($sizes -join ','))" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Siguiente paso:" -ForegroundColor Cyan
Write-Host "  1) npm run desktop:build:win"
Write-Host "  2) Si Windows sigue mostrando icono cacheado, limpia cache de iconos:"
Write-Host "     ie4uinit.exe -show"
