Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class NativeIcon {
  [DllImport("user32.dll", CharSet = CharSet.Auto)]
  public static extern bool DestroyIcon(IntPtr handle);
}
"@

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

$buildDirectory = Split-Path -Parent $PSScriptRoot
$iconDirectory = Join-Path $buildDirectory "build"
$pngPath = Join-Path $iconDirectory "icon.png"
$icoPath = Join-Path $iconDirectory "icon.ico"

$bitmap = [System.Drawing.Bitmap]::new(
  256,
  256,
  [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::Transparent)

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
  @{ X = 58; Color = "#ed5a5f" },
  @{ X = 108; Color = "#e4a62b" },
  @{ X = 158; Color = "#3db47a" }
)
foreach ($light in $lights) {
  $brush = [System.Drawing.SolidBrush]::new(
    [System.Drawing.ColorTranslator]::FromHtml($light.Color)
  )
  $graphics.FillEllipse($brush, $light.X, 108, 40, 40)
  $brush.Dispose()
}

$bitmap.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
$iconHandle = $bitmap.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($iconHandle)
$stream = [System.IO.File]::Create($icoPath)
$icon.Save($stream)
$stream.Dispose()
$icon.Dispose()
[NativeIcon]::DestroyIcon($iconHandle) | Out-Null

$signalPen.Dispose()
$signalBrush.Dispose()
$signalPath.Dispose()
$outerBrush.Dispose()
$outerPath.Dispose()
$graphics.Dispose()
$bitmap.Dispose()
