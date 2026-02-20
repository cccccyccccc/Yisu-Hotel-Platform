Add-Type -AssemblyName System.Drawing

function Create-TabIcon([string]$filePath, [string]$color, [string]$text) {
    $bmp = New-Object System.Drawing.Bitmap(81, 81)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.TextRenderingHint = 'AntiAlias'
    $g.Clear([System.Drawing.Color]::Transparent)
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($color))
    $font = New-Object System.Drawing.Font('Segoe UI', 24, [System.Drawing.FontStyle]::Regular)
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = 'Center'
    $sf.LineAlignment = 'Center'
    $rect = New-Object System.Drawing.RectangleF(0, 0, 81, 81)
    $g.DrawString($text, $font, $brush, $rect, $sf)
    $g.Dispose()
    $bmp.Save($filePath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

$tabDir = 'E:\byteWorld\xc\Yisu-Hotel-Platform\client\src\assets\tab'
Create-TabIcon "$tabDir\home.png" '#999999' 'H'
Create-TabIcon "$tabDir\home-active.png" '#2196f3' 'H'
Create-TabIcon "$tabDir\order.png" '#999999' 'O'
Create-TabIcon "$tabDir\order-active.png" '#2196f3' 'O'
Create-TabIcon "$tabDir\favorite.png" '#999999' 'F'
Create-TabIcon "$tabDir\favorite-active.png" '#2196f3' 'F'
Create-TabIcon "$tabDir\mine.png" '#999999' 'M'
Create-TabIcon "$tabDir\mine-active.png" '#2196f3' 'M'
Write-Host 'Tab icons created!'


