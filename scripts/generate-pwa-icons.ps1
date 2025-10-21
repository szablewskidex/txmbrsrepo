Add-Type -AssemblyName System.Drawing

$basePath = Join-Path $PSScriptRoot '..\public\icons'
if (-not (Test-Path $basePath)) {
    New-Item -ItemType Directory -Path $basePath | Out-Null
}

function New-Icon {
    param (
        [string]$FileName,
        [int]$Size
    )

    $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

    $rect = New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)
    $gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.Color]::FromArgb(255, 17, 24, 39),
        [System.Drawing.Color]::FromArgb(255, 2, 6, 23),
        135
    )
    $graphics.FillRectangle($gradient, $rect)

    $barBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(150, 39, 39, 42))
    $barHeight = [Math]::Max([int]($Size * 0.05), 6)
    $barOffsets = @(0.22, 0.34, 0.46)
    $barWidths = @(0.78, 0.72, 0.55)

    for ($i = 0; $i -lt $barOffsets.Count; $i++) {
        $y = [int]($Size * $barOffsets[$i])
        $width = [int]($Size * $barWidths[$i])
        $x = [int]($Size * 0.11)
        $graphics.FillRectangle($barBrush, $x, $y, $width, $barHeight)
    }

    $fontSize = [Math]::Max([int]($Size * 0.22), 28)
    $font = New-Object System.Drawing.Font('Segoe UI Semibold', $fontSize, [System.Drawing.FontStyle]::Bold)

    $whiteBrush = [System.Drawing.Brushes]::White
    $greenBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 34, 197, 94))

    $label = 'PianoRoll'
    $labelSize = $graphics.MeasureString($label, $font)
    $textX = [int](($Size - $labelSize.Width - ($Size * 0.14)) / 2)
    $textY = [int]($Size * 0.70) - $fontSize
    if ($textX -lt ($Size * 0.08)) {
        $textX = [int]($Size * 0.08)
    }

    $graphics.DrawString($label, $font, $whiteBrush, $textX, $textY)

    $aiX = $textX + $labelSize.Width + ($Size * 0.02)
    $graphics.DrawString('AI', $font, $greenBrush, $aiX, $textY)

    $outputPath = Join-Path $basePath $FileName
    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $graphics.Dispose()
    $bitmap.Dispose()
    $gradient.Dispose()
    $barBrush.Dispose()
    $greenBrush.Dispose()
    $font.Dispose()
}

New-Icon 'icon-192.png' 192
New-Icon 'icon-512.png' 512
