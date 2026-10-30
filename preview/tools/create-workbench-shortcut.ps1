param()
$ErrorActionPreference = 'Stop'
$taskProject = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$taskPreview = Join-Path $taskProject 'preview'
$taskAssets = Join-Path $taskPreview 'dist\assets'
$taskShortcutDir = Join-Path $taskPreview 'local-data\shortcuts'
if ([IO.Path]::GetPathRoot($taskProject) -notin @('D:\','E:\')) { throw '输出必须位于D或E盘。' }
$taskPng = Join-Path $taskAssets 'workbench-app.png'
$taskIco = Join-Path $taskAssets 'workbench-app.ico'
$taskSvg = Join-Path $taskAssets 'workbench-app.svg'
$taskLink = Join-Path $taskShortcutDir '个人工作台.lnk'
$taskNode = 'E:\Ai\node.js\node.exe'
$taskStarter = Join-Path $taskPreview 'start.cjs'
$taskShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
foreach ($taskRequired in @($taskNode,$taskStarter,$taskShell)) { if (-not (Test-Path -LiteralPath $taskRequired)) { throw '启动所需文件不存在。' } }
$taskExistingAssets = @(@($taskPng,$taskIco,$taskSvg) | Where-Object { Test-Path -LiteralPath $_ })
if ($taskExistingAssets.Count -notin @(0,3)) { throw '图标文件不完整，请核对已有资产，不覆盖零散文件。' }
New-Item -ItemType Directory -Path $taskShortcutDir -Force | Out-Null
Add-Type -AssemblyName System.Drawing
$taskSizes = @(256,128,64,48,32,24,16)
if ($taskExistingAssets.Count -eq 0) {
$taskSvgText = @'
<!-- Derived from Lucide compass v0.468.0 (ISC), license in LUCIDE-LICENSE.txt. -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
 <defs><linearGradient id="blue" x2="1" y2="1"><stop stop-color="#355ce7"/><stop offset="1" stop-color="#2443c7"/></linearGradient></defs>
 <rect x="8" y="8" width="496" height="496" rx="104" fill="url(#blue)"/>
 <g fill="none" stroke="#fff" stroke-width="24" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="256" cy="256" r="148"/>
  <path d="M320 192L293 273Q288 288 273 293L192 320L219 239Q224 224 239 219Z"/>
 </g>
</svg>
'@
[IO.File]::WriteAllText($taskSvg,$taskSvgText,[Text.UTF8Encoding]::new($false))
$taskBitmap = [Drawing.Bitmap]::new(512,512,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
$taskGraphics = [Drawing.Graphics]::FromImage($taskBitmap)
$taskGraphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
$taskGraphics.Clear([Drawing.Color]::Transparent)
$taskRound = [Drawing.Drawing2D.GraphicsPath]::new()
$taskRadius = 104
$taskDiameter = 2*$taskRadius
$taskRound.AddArc(8,8,$taskDiameter,$taskDiameter,180,90)
$taskRound.AddArc(504-$taskDiameter,8,$taskDiameter,$taskDiameter,270,90)
$taskRound.AddArc(504-$taskDiameter,504-$taskDiameter,$taskDiameter,$taskDiameter,0,90)
$taskRound.AddArc(8,504-$taskDiameter,$taskDiameter,$taskDiameter,90,90)
$taskRound.CloseFigure()
$taskBrush = [Drawing.Drawing2D.LinearGradientBrush]::new([Drawing.Rectangle]::new(8,8,496,496),[Drawing.ColorTranslator]::FromHtml('#355ce7'),[Drawing.ColorTranslator]::FromHtml('#2443c7'),[single]45)
$taskGraphics.FillPath($taskBrush,$taskRound)
$taskPen = [Drawing.Pen]::new([Drawing.Color]::White,[single]24)
$taskPen.LineJoin = [Drawing.Drawing2D.LineJoin]::Round
$taskPen.StartCap = [Drawing.Drawing2D.LineCap]::Round
$taskPen.EndCap = [Drawing.Drawing2D.LineCap]::Round
$taskGraphics.DrawEllipse($taskPen,[single]108,[single]108,[single]296,[single]296)
$taskNeedle = [Drawing.Drawing2D.GraphicsPath]::new()
$taskNeedle.AddLine([single]320,[single]192,[single]293,[single]273)
$taskNeedle.AddBezier([single]293,[single]273,[single]289.667,[single]283,[single]283,[single]289.667,[single]273,[single]293)
$taskNeedle.AddLine([single]273,[single]293,[single]192,[single]320)
$taskNeedle.AddLine([single]192,[single]320,[single]219,[single]239)
$taskNeedle.AddBezier([single]219,[single]239,[single]222.333,[single]229,[single]229,[single]222.333,[single]239,[single]219)
$taskNeedle.AddLine([single]239,[single]219,[single]320,[single]192)
$taskNeedle.CloseFigure()
$taskGraphics.DrawPath($taskPen,$taskNeedle)
$taskBitmap.Save($taskPng,[Drawing.Imaging.ImageFormat]::Png)
$taskFrames = [Collections.Generic.List[byte[]]]::new()
foreach ($taskSize in $taskSizes) {
 $taskSmall = [Drawing.Bitmap]::new($taskSize,$taskSize,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
 $taskSmallGraphics = [Drawing.Graphics]::FromImage($taskSmall)
 $taskSmallGraphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
 $taskSmallGraphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
 $taskSmallGraphics.DrawImage($taskBitmap,[Drawing.Rectangle]::new(0,0,$taskSize,$taskSize))
 $taskFrameStream = [IO.MemoryStream]::new()
 $taskSmall.Save($taskFrameStream,[Drawing.Imaging.ImageFormat]::Png)
 $taskFrames.Add($taskFrameStream.ToArray())
 $taskFrameStream.Dispose(); $taskSmallGraphics.Dispose(); $taskSmall.Dispose()
}
$taskStream = [IO.MemoryStream]::new()
$taskWriter = [IO.BinaryWriter]::new($taskStream)
$taskWriter.Write([UInt16]0); $taskWriter.Write([UInt16]1); $taskWriter.Write([UInt16]$taskSizes.Count)
$taskOffset = 6+16*$taskSizes.Count
for ($taskIndex=0; $taskIndex -lt $taskSizes.Count; $taskIndex++) {
 $taskByteSize = if ($taskSizes[$taskIndex] -eq 256) {0} else {$taskSizes[$taskIndex]}
 $taskWriter.Write([byte]$taskByteSize); $taskWriter.Write([byte]$taskByteSize)
 $taskWriter.Write([byte]0); $taskWriter.Write([byte]0)
 $taskWriter.Write([UInt16]1); $taskWriter.Write([UInt16]32)
 $taskWriter.Write([UInt32]$taskFrames[$taskIndex].Length); $taskWriter.Write([UInt32]$taskOffset)
 $taskOffset += $taskFrames[$taskIndex].Length
}
foreach ($taskFrame in $taskFrames) { $taskWriter.Write([byte[]]$taskFrame) }
$taskWriter.Flush(); [IO.File]::WriteAllBytes($taskIco,$taskStream.ToArray())
$taskWriter.Dispose(); $taskStream.Dispose()
$taskNeedle.Dispose(); $taskPen.Dispose(); $taskBrush.Dispose(); $taskRound.Dispose(); $taskGraphics.Dispose(); $taskBitmap.Dispose()
}
$taskCom = New-Object -ComObject WScript.Shell
$taskShortcut = $taskCom.CreateShortcut($taskLink)
$taskShortcut.TargetPath = $taskShell
$taskShortcut.Arguments = '-NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -Command "& '''+$taskNode+''' '''+$taskStarter+'''"'
$taskShortcut.WorkingDirectory = $taskPreview
$taskShortcut.WindowStyle = 7
$taskShortcut.IconLocation = $taskIco+',0'
$taskShortcut.Description = '双击打开个人成长与业务工作台'
$taskShortcut.Save()
$taskReadback = $taskCom.CreateShortcut($taskLink)
$taskIconReadback = [Drawing.Icon]::new($taskIco,32,32)
$taskValid = $taskReadback.TargetPath -eq $taskShell -and $taskReadback.WorkingDirectory -eq $taskPreview -and $taskReadback.IconLocation -eq ($taskIco+',0') -and $taskIconReadback.Width -eq 32
$taskIconReadback.Dispose()
if (-not $taskValid) { throw '快捷方式或图标读回核对失败。' }
[pscustomobject]@{Shortcut=$taskLink;Icon=$taskIco;Preview=$taskPng;IconSizes=$taskSizes;ShortcutBytes=(Get-Item -LiteralPath $taskLink).Length;TargetPath=$taskReadback.TargetPath;Arguments=$taskReadback.Arguments;WorkingDirectory=$taskReadback.WorkingDirectory;Verified=$taskValid;DesktopWritten=$false} | ConvertTo-Json -Depth 3
