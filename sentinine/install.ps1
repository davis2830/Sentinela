# Senti9 installer. Legacy -Token remains available explicitly.
param (
    [string]$TokenFile,
    [string]$Token,
    [string]$ControlCaFile,
    [string]$TargetCaFile,
    [string]$Server = 'https://sentinel.gctechops.com',
    [string]$Image = 'davis1924/senti9:1.7.0',
    [switch]$Development,
    [switch]$AllowHttp
)
$ErrorActionPreference = 'Stop'
if (-not $TokenFile -and -not $Token) { throw 'Indica -TokenFile (recomendado) o -Token.' }
$env:SENTININE_SERVER = $Server
$env:SENTININE_ENV = if ($Development) { 'development' } else { 'production' }
$env:SENTININE_ALLOW_HTTP = if ($AllowHttp) { 'true' } else { 'false' }
if ($TokenFile) { $TokenFile = (Resolve-Path -LiteralPath $TokenFile).Path }
if ($ControlCaFile) { $ControlCaFile = (Resolve-Path -LiteralPath $ControlCaFile).Path }
if ($TargetCaFile) { $TargetCaFile = (Resolve-Path -LiteralPath $TargetCaFile).Path }
if (Get-Command docker -ErrorAction SilentlyContinue) {
    docker container inspect sentinine_agent *> $null
    if ($LASTEXITCODE -eq 0) { throw 'El contenedor ya existe; actualízalo conservando el volumen.' }
    $sentiArgs = @('run','-d','--name','sentinine_agent','--restart','unless-stopped',
        '--user','10001:10001','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges:true',
        '--pids-limit','128','--memory','256m','--cpus','1',
        '--tmpfs','/tmp:rw,noexec,nosuid,size=16m,mode=1777',
        '--mount','source=sentinine_state,target=/data',
        '-e','SENTININE_SERVER','-e','SENTININE_ENV','-e','SENTININE_ALLOW_HTTP')
    if ($TokenFile) {
        $sentiArgs += @('--mount',"type=bind,source=$TokenFile,target=/run/secrets/sentinine_token,readonly",'-e','SENTININE_TOKEN_FILE=/run/secrets/sentinine_token')
    } else {
        $env:SENTININE_TOKEN = $Token
        $sentiArgs += @('-e','SENTININE_TOKEN')
    }
    if ($ControlCaFile) { $sentiArgs += @('--mount',"type=bind,source=$ControlCaFile,target=/run/certs/control.pem,readonly",'-e','SENTININE_CONTROL_CA_FILE=/run/certs/control.pem') }
    if ($TargetCaFile) { $sentiArgs += @('--mount',"type=bind,source=$TargetCaFile,target=/run/certs/target.pem,readonly",'-e','SENTININE_TARGET_CA_FILE=/run/certs/target.pem') }
    try {
        docker @sentiArgs $Image
        if ($LASTEXITCODE -ne 0) { throw 'Docker no pudo iniciar Senti9; revisar imagen y configuración.' }
    } finally { Remove-Item Env:SENTININE_TOKEN -ErrorAction SilentlyContinue }
    Write-Host 'Contenedor creado. Verifica logs y heartbeat para confirmar conectividad.'
} else {
    $env:SENTININE_TOKEN_FILE = $TokenFile
    if ($ControlCaFile) { $env:SENTININE_CONTROL_CA_FILE = $ControlCaFile }
    if ($TargetCaFile) { $env:SENTININE_TARGET_CA_FILE = $TargetCaFile }
    if (-not $TokenFile) { $env:SENTININE_TOKEN = $Token }
    try {
        python (Join-Path $PSScriptRoot 'agent.py')
        if ($LASTEXITCODE -ne 0) { throw 'Senti9 terminó con error.' }
    } finally { Remove-Item Env:SENTININE_TOKEN -ErrorAction SilentlyContinue }
}
