@echo off
setlocal
echo ==========================================================
echo    SENTINEL PLATFORM - SUITE DE RENDIMIENTO CON k6
echo ==========================================================
echo.

set SCENARIO=%1
if "%SCENARIO%"=="" set SCENARIO=noc

powershell -ExecutionPolicy Bypass -File "%~dp0run_perf.ps1" -Scenario %SCENARIO%

endlocal
