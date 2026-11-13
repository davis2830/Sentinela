# Advanced scripted installation using the portal's versioned, non-secret profile.
param (
    [Parameter(Mandatory)][string]$ProfileFile,
    [Parameter(Mandatory)][string]$TokenFile,
    [string]$ControlCaFile,
    [string]$TargetCaFile,
    [switch]$Development,
    [switch]$AllowHttp
)
$ErrorActionPreference = 'Stop'
$profilePath = (Resolve-Path -LiteralPath $ProfileFile).Path
$tokenPath = (Resolve-Path -LiteralPath $TokenFile).Path
$env:SENTININE_ENV = if ($Development) { 'development' } else { 'production' }
$env:SENTININE_ALLOW_HTTP = if ($AllowHttp) { 'true' } else { 'false' }
if ($ControlCaFile) { $env:SENTININE_CONTROL_CA_FILE = (Resolve-Path -LiteralPath $ControlCaFile).Path }
if ($TargetCaFile) { $env:SENTININE_TARGET_CA_FILE = (Resolve-Path -LiteralPath $TargetCaFile).Path }
$installer = Join-Path $PSScriptRoot 'senti9-installer.pyz'
if (-not (Test-Path -LiteralPath $installer -PathType Leaf)) { $installer = Join-Path $PSScriptRoot 'install.py' }
python $installer --profile $profilePath --token-file $tokenPath
if ($LASTEXITCODE -ne 0) { throw 'Instalación no completada. Conserva el perfil y revisa el diagnóstico.' }
