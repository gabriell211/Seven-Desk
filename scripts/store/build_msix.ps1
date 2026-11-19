# Build an unsigned Windows MSIX for Store ingestion; certification and signing are separate.
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$PayloadDirectory,
    [Parameter(Mandatory)][string]$IconPath,
    [Parameter(Mandatory)][string]$PackageName,
    [Parameter(Mandatory)][string]$Publisher,
    [Parameter(Mandatory)][string]$PublisherDisplayName,
    [Parameter(Mandatory)][string]$Version,
    [Parameter(Mandatory)][ValidateSet('x64','arm64')][string]$Architecture,
    [Parameter(Mandatory)][string]$OutputPath
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Find-MakeAppx {
    $root = Join-Path ([Environment]::GetFolderPath('ProgramFilesX86')) 'Windows Kits\10\bin'
    if (-not (Test-Path -LiteralPath $root)) { throw 'Windows SDK is missing' }
    $items = @(Get-ChildItem -LiteralPath $root -Recurse -File -Filter 'makeappx.exe' |
        Where-Object { $_.DirectoryName -match '\\x64$' } | Sort-Object FullName -Descending)
    if ($items.Count -lt 1) { throw 'Windows SDK MakeAppx.exe unavailable' }
    return $items[0].FullName
}

function Write-SquarePng {
    param([System.Drawing.Image]$Source,[int]$Size,[string]$Path)
    $bitmap = [System.Drawing.Bitmap]::new($Size,$Size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $scale = [Math]::Min($Size / $Source.Width,$Size / $Source.Height)
        $width = [Math]::Max(1,[int][Math]::Round($Source.Width * $scale))
        $height = [Math]::Max(1,[int][Math]::Round($Source.Height * $scale))
        $x = [int][Math]::Floor(($Size - $width) / 2)
        $y = [int][Math]::Floor(($Size - $height) / 2)
        $graphics.DrawImage($Source,$x,$y,$width,$height)
        $bitmap.Save($Path,[System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $graphics.Dispose(); $bitmap.Dispose() }
}

$payload = (Resolve-Path -LiteralPath $PayloadDirectory).Path
$icon = (Resolve-Path -LiteralPath $IconPath).Path
$exe = Join-Path $payload 'SevenDesk.exe'
foreach ($required in @('SevenDesk.exe','flutter_windows.dll','librustdesk.dll','data\app.so')) {
    if (-not (Test-Path -LiteralPath (Join-Path $payload $required) -PathType Leaf)) {
        throw "Incomplete Flutter payload: missing $required"
    }
}
$bytes = [System.IO.File]::ReadAllBytes($exe)
if ($bytes.Length -lt 128 -or $bytes[0] -ne 0x4d -or $bytes[1] -ne 0x5a) { throw 'Invalid PE executable' }
$peOffset = [BitConverter]::ToInt32($bytes,0x3c)
if ($peOffset -lt 64 -or $peOffset + 6 -gt $bytes.Length) { throw 'Invalid PE header' }
$machine = [BitConverter]::ToUInt16($bytes,$peOffset + 4)
$expected = if ($Architecture -eq 'arm64') { 0xaa64 } else { 0x8664 }
if ($machine -ne $expected) { throw "PE architecture mismatch: $Architecture expected $expected, found $machine" }

$makeAppx = Find-MakeAppx
$stage = Join-Path $env:RUNNER_TEMP ("sevendesk-msix-" + [guid]::NewGuid().ToString('N'))
$verify = Join-Path $env:RUNNER_TEMP ("sevendesk-verify-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage -Force | Out-Null
try {
    foreach ($item in @(Get-ChildItem -LiteralPath $payload -Force)) {
        if ($item.Name -in @('AppxManifest.xml','AppxBlockMap.xml','AppxSignature.p7x','[Content_Types].xml')) {
            throw "Unexpected MSIX metadata in application payload: $($item.Name)"
        }
        Copy-Item -LiteralPath $item.FullName -Destination $stage -Recurse -Force
    }
    $assets = Join-Path $stage 'Assets'
    New-Item -ItemType Directory -Path $assets -Force | Out-Null
    Add-Type -AssemblyName System.Drawing
    $image = [System.Drawing.Image]::FromFile($icon)
    try {
        Write-SquarePng -Source $image -Size 44 -Path (Join-Path $assets 'Square44x44Logo.png')
        Write-SquarePng -Source $image -Size 150 -Path (Join-Path $assets 'Square150x150Logo.png')
        Write-SquarePng -Source $image -Size 50 -Path (Join-Path $assets 'StoreLogo.png')
    } finally { $image.Dispose() }

    $manifest = Join-Path $stage 'AppxManifest.xml'
    $pythonArgs = @((Join-Path $PSScriptRoot 'msix_manifest.py'),'--name',$PackageName,
      '--publisher',$Publisher,'--publisher-display-name',$PublisherDisplayName,
      '--version',$Version,'--architecture',$Architecture,'--output',$manifest)
    & python @pythonArgs
    if ($LASTEXITCODE -ne 0) { throw 'MSIX manifest validation failed' }
    $destination = [IO.Path]::GetFullPath($OutputPath)
    New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
    & $makeAppx pack /d $stage /p $destination /o /v
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $destination -PathType Leaf)) {
        throw 'MakeAppx failed to create MSIX'
    }
    New-Item -ItemType Directory -Path $verify -Force | Out-Null
    & $makeAppx unpack /p $destination /d $verify /o
    if ($LASTEXITCODE -ne 0) { throw 'MakeAppx unpack verification failed' }
    foreach ($required in @('AppxManifest.xml','SevenDesk.exe','data\app.so','Assets\Square44x44Logo.png')) {
        if (-not (Test-Path -LiteralPath (Join-Path $verify $required) -PathType Leaf)) {
            throw "MSIX round-trip missing $required"
        }
    }
    $originalHash = (Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash
    $packagedHash = (Get-FileHash -LiteralPath (Join-Path $verify 'SevenDesk.exe') -Algorithm SHA256).Hash
    if ($originalHash -ne $packagedHash) { throw 'MSIX executable digest mismatch' }
    $digest = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant()
    Set-Content -LiteralPath "$destination.sha256" -Value "$digest  $([IO.Path]::GetFileName($destination))" -Encoding ascii
    Write-Host "MSIX validated: $([IO.Path]::GetFileName($destination)); SHA256=$digest"
    Write-Warning 'Unsigned Store-submission MSIX only; do not distribute for public sideload.'
} finally {
    Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $verify -Recurse -Force -ErrorAction SilentlyContinue
}
