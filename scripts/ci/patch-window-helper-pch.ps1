# Change PCH only in the ephemeral checked-out ARM64 helper project.
# The original MIT-licensed upstream mirror is never modified.
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$ProjectFile,
    [Parameter(Mandatory)]
    [ValidateSet('ARM64', 'x64', 'Win32')]
    [string]$Platform
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($Platform -ne 'ARM64') {
    Write-Host "Keeping the original precompiled headers for $Platform."
    return
}

$absolute = (Resolve-Path -LiteralPath $ProjectFile -ErrorAction Stop).Path
[xml]$xml = Get-Content -LiteralPath $absolute -Raw -Encoding UTF8
$namespace = [System.Xml.XmlNamespaceManager]::new($xml.NameTable)
$namespace.AddNamespace('msb', 'http://schemas.microsoft.com/developer/msbuild/2003')

# Both the configuration-level setting (Use) and the pch.cpp override (Create)
# must be changed; changing only one leaves /Yu or /Yc active.
$definitions = $xml.SelectNodes(
    "//msb:ItemDefinitionGroup[contains(@Condition, '|ARM64')]/msb:ClCompile/msb:PrecompiledHeader",
    $namespace
)
$perFileOverrides = $xml.SelectNodes(
    "//msb:ItemGroup/msb:ClCompile/msb:PrecompiledHeader[contains(@Condition, '|ARM64')]",
    $namespace
)

if ($definitions.Count -ne 2 -or $perFileOverrides.Count -ne 2) {
    throw "Unexpected upstream helper project PCH layout: ARM64 definitions=$($definitions.Count), file overrides=$($perFileOverrides.Count)"
}

foreach ($setting in $definitions) {
    if ($setting.InnerText -notin @('Use', 'NotUsing')) {
        throw "Unexpected PCH configuration: $($setting.InnerText)"
    }
    $setting.InnerText = 'NotUsing'
}
foreach ($setting in $perFileOverrides) {
    if ($setting.InnerText -notin @('Create', 'NotUsing')) {
        throw "Unexpected per-file PCH setting: $($setting.InnerText)"
    }
    $setting.InnerText = 'NotUsing'
}

$xml.Save($absolute)
[xml]$verify = Get-Content -LiteralPath $absolute -Raw -Encoding UTF8
$check = [System.Xml.XmlNamespaceManager]::new($verify.NameTable)
$check.AddNamespace('msb', 'http://schemas.microsoft.com/developer/msbuild/2003')
$remaining = $verify.SelectNodes(
    "//msb:PrecompiledHeader[contains(@Condition, '|ARM64') and text() != 'NotUsing']",
    $check
)
if ($remaining.Count -ne 0) {
    throw 'ARM64 precompiled headers were not disabled successfully'
}
Write-Host 'Verified ARM64 helper without /Yc and /Yu PCH requirements; other platforms unchanged.'
