Add-Type -AssemblyName System.Drawing

$projectDirectory = Split-Path -Parent $PSScriptRoot
$buildDirectory = Join-Path $projectDirectory "build"
$vectorPath = Join-Path $buildDirectory "icon.svg"
$pngPath = Join-Path $buildDirectory "icon.png"
$icoPath = Join-Path $buildDirectory "icon.ico"
$iconSizes = @(16, 20, 24, 32, 40, 48, 64, 128, 256)

if (-not (Test-Path -LiteralPath $vectorPath)) {
  throw "Nie znaleziono pliku zrodlowego ikony: $vectorPath"
}

function New-RoundedRectanglePath {
  param(
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )

  $diameter = $Radius * 2
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc(
    $X + $Width - $diameter,
    $Y + $Height - $diameter,
    $diameter,
    $diameter,
    0,
    90
  )
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-ResizedIcon {
  param(
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
  $graphics.CompositingQuality =
    [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.InterpolationMode =
    [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode =
    [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.SmoothingMode =
    [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $scale = $Size / 256.0
  $graphics.ScaleTransform($scale, $scale)

  $outerPath = New-RoundedRectanglePath 16 16 224 224 58
  $outerBrush = [System.Drawing.SolidBrush]::new(
    [System.Drawing.ColorTranslator]::FromHtml("#20201e")
  )
  $graphics.FillPath($outerBrush, $outerPath)

  $signalPath = New-RoundedRectanglePath 37 82 182 92 46
  $signalBrush = [System.Drawing.SolidBrush]::new(
    [System.Drawing.ColorTranslator]::FromHtml("#131312")
  )
  $signalPen = [System.Drawing.Pen]::new(
    [System.Drawing.ColorTranslator]::FromHtml("#4a4a45"),
    7
  )
  $graphics.FillPath($signalBrush, $signalPath)
  $graphics.DrawPath($signalPen, $signalPath)

  $lights = @(
    @{ X = 58; Color = "#ed5a5f"; Highlight = 68 },
    @{ X = 108; Color = "#e4a62b"; Highlight = 118 },
    @{ X = 158; Color = "#3db47a"; Highlight = 168 }
  )
  foreach ($light in $lights) {
    $brush = [System.Drawing.SolidBrush]::new(
      [System.Drawing.ColorTranslator]::FromHtml($light.Color)
    )
    $graphics.FillEllipse($brush, $light.X, 108, 40, 40)
    $brush.Dispose()

    $highlightBrush = [System.Drawing.SolidBrush]::new(
      [System.Drawing.Color]::FromArgb(82, 255, 255, 255)
    )
    $graphics.FillEllipse($highlightBrush, $light.Highlight, 116, 10, 10)
    $highlightBrush.Dispose()
  }

  $signalPen.Dispose()
  $signalBrush.Dispose()
  $signalPath.Dispose()
  $outerBrush.Dispose()
  $outerPath.Dispose()
  $graphics.Dispose()
  return $bitmap
}

$preview = New-ResizedIcon -Size 512
$preview.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
$preview.Dispose()

$frames = @()
foreach ($size in $iconSizes) {
  $bitmap = New-ResizedIcon -Size $size
  $stream = [System.IO.MemoryStream]::new()
  $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  $frames += [PSCustomObject]@{
    Size = $size
    Bytes = $stream.ToArray()
  }
  $stream.Dispose()
  $bitmap.Dispose()
}

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
