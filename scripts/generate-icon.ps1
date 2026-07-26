Add-Type -AssemblyName System.Drawing

$projectDirectory = Split-Path -Parent $PSScriptRoot
$buildDirectory = Join-Path $projectDirectory "build"
$masterPath = Join-Path $buildDirectory "icon-master.png"
$pngPath = Join-Path $buildDirectory "icon.png"
$icoPath = Join-Path $buildDirectory "icon.ico"
$iconSizes = @(16, 20, 24, 32, 40, 48, 64, 128, 256)

if (-not (Test-Path -LiteralPath $masterPath)) {
  throw "Nie znaleziono pliku zrodlowego ikony: $masterPath"
}

function New-ResizedIcon {
  param(
    [System.Drawing.Image]$Source,
    [int]$Size
  )

  $bitmap = [System.Drawing.Bitmap]::new(
    $Size,
    $Size,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  )
  $bitmap.SetResolution(96, 96)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $graphics.CompositingMode =
    [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
  $graphics.CompositingQuality =
    [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.InterpolationMode =
    [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode =
    [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.SmoothingMode =
    [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.DrawImage($Source, 0, 0, $Size, $Size)
  $graphics.Dispose()
  return $bitmap
}

$source = [System.Drawing.Image]::FromFile($masterPath)
$preview = New-ResizedIcon -Source $source -Size 512
$preview.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
$preview.Dispose()

$frames = @()
foreach ($size in $iconSizes) {
  $bitmap = New-ResizedIcon -Source $source -Size $size
  $stream = [System.IO.MemoryStream]::new()
  $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  $frames += [PSCustomObject]@{
    Size = $size
    Bytes = $stream.ToArray()
  }
  $stream.Dispose()
  $bitmap.Dispose()
}
$source.Dispose()

$fileStream = [System.IO.File]::Create($icoPath)
$writer = [System.IO.BinaryWriter]::new($fileStream)
$writer.Write([UInt16]0)
$writer.Write([UInt16]1)
$writer.Write([UInt16]$frames.Count)

$imageOffset = 6 + (16 * $frames.Count)
foreach ($frame in $frames) {
  $dimension = if ($frame.Size -ge 256) { 0 } else { $frame.Size }
  $writer.Write([byte]$dimension)
  $writer.Write([byte]$dimension)
  $writer.Write([byte]0)
  $writer.Write([byte]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]32)
  $writer.Write([UInt32]$frame.Bytes.Length)
  $writer.Write([UInt32]$imageOffset)
  $imageOffset += $frame.Bytes.Length
}

foreach ($frame in $frames) {
  $writer.Write([byte[]]$frame.Bytes)
}

$writer.Dispose()
$fileStream.Dispose()

Write-Output "Wygenerowano ikony:"
Write-Output "  $pngPath"
Write-Output "  $icoPath"
