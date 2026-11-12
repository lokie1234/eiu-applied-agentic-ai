param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$PrivateRender
)
$ErrorActionPreference = 'Stop'
$sourcePath = (Resolve-Path -LiteralPath $Source).Path
$renderPath = [IO.Path]::GetFullPath($PrivateRender)
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$privateRoot = Join-Path $workspace 'tmp'
if (-not $renderPath.StartsWith($privateRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Intermediate render must remain inside the ignored workspace tmp directory.'
}
New-Item -ItemType Directory -Force -Path ([IO.Path]::GetDirectoryName($renderPath)) | Out-Null
$powerPoint = $null
$presentation = $null
try {
    $powerPoint = New-Object -ComObject PowerPoint.Application
    $presentation = $powerPoint.Presentations.Open($sourcePath, -1, 0, 0)
    foreach ($slide in $presentation.Slides) { $slide.SlideShowTransition.Hidden = 0 }
    $presentation.SaveAs($renderPath, 32)
    $presentation.Saved = -1
    Write-Output "Rendered all $($presentation.Slides.Count) slides privately; source PPTX unchanged."
} finally {
    if ($presentation) { $presentation.Close(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($presentation) }
    if ($powerPoint) { $powerPoint.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($powerPoint) }
}
