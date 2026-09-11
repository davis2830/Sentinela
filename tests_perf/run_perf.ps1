param(
    [ValidateSet("noc", "read", "crud", "spike", "soak", "all")]
    [string]$Scenario = "noc",
    [string]$BaseUrl = "http://[::1]:8000",
    [string]$Email = "test_perf@sentinel.local",
    [string]$Password = "SentinelPerf2026!"
)

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "    SENTINEL PLATFORM - SUITE DE RENDIMIENTO CON k6       " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Backend Target: $BaseUrl" -ForegroundColor Gray
Write-Host "Escenario:      $Scenario" -ForegroundColor Yellow
Write-Host ""

$reportsDir = Join-Path $PSScriptRoot "reports"
if (-not (Test-Path $reportsDir)) {
    New-Item -ItemType Directory -Force -Path $reportsDir | Out-Null
}

$env:BASE_URL = $BaseUrl
$env:PERF_EMAIL = $Email
$env:PERF_PASSWORD = $Password

function Run-K6Scenario {
    param(
        [string]$ScriptPath,
        [string]$Name
    )
    Write-Host ""
    Write-Host ">>> Ejecutando escenario: $Name" -ForegroundColor Cyan
    Write-Host "    Script: $ScriptPath" -ForegroundColor DarkGray
    Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray

    $fullPath = Join-Path $PSScriptRoot $ScriptPath
    k6 run $fullPath

    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Escenario [$Name] completado exitosamente dentro de los umbrales SLA." -ForegroundColor Green
    } else {
        Write-Host "[WARN] Escenario [$Name] finalizo con alertas de umbrales cruzados o advertencias." -ForegroundColor Yellow
    }
}

switch ($Scenario) {
    "noc" {
        Run-K6Scenario -ScriptPath "scenarios\01_noc_dashboard_stress.js" -Name "NOC Dashboard Telemetria"
    }
    "read" {
        Run-K6Scenario -ScriptPath "scenarios\02_full_platform_read_heavy.js" -Name "Lectura Multi-Modulo Intensiva"
    }
    "crud" {
        Run-K6Scenario -ScriptPath "scenarios\03_monitoring_crud_stress.js" -Name "CRUD Transaccional de Targets"
    }
    "spike" {
        Run-K6Scenario -ScriptPath "scenarios\04_spike_stress_test.js" -Name "Spike / Rafaga Repentina de Carga"
    }
    "soak" {
        Run-K6Scenario -ScriptPath "scenarios\05_soak_endurance_test.js" -Name "Soak / Resistencia Continua"
    }
    "all" {
        Write-Host "Iniciando ejecucion de TODOS los escenarios de rendimiento..." -ForegroundColor Magenta
        Run-K6Scenario -ScriptPath "scenarios\01_noc_dashboard_stress.js" -Name "01 - NOC Dashboard Telemetria"
        Run-K6Scenario -ScriptPath "scenarios\02_full_platform_read_heavy.js" -Name "02 - Lectura Multi-Modulo"
        Run-K6Scenario -ScriptPath "scenarios\03_monitoring_crud_stress.js" -Name "03 - CRUD Transaccional"
        Run-K6Scenario -ScriptPath "scenarios\04_spike_stress_test.js" -Name "04 - Spike Test"
        Run-K6Scenario -ScriptPath "scenarios\05_soak_endurance_test.js" -Name "05 - Soak Test"
    }
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Reportes HTML disponibles en: tests_perf\reports\       " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""
