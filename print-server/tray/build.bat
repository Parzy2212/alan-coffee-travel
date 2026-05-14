@echo off
chcp 65001 >nul
title AlanPOS Tray -- Build AlanPOS-Tray.exe

echo.
echo  ============================================================
echo    AlanPOS Tray  ^|  Build Script
echo    Compiles tray.ps1 -> AlanPOS-Tray.exe using ps2exe
echo  ============================================================
echo.
echo  Requirements:
echo    - PowerShell 5.1+  (built into Windows 10/11)
echo    - Internet access  (to download ps2exe first time^)
echo.

:: ── Check PowerShell version ──────────────────────────────────────────────────
powershell -NoProfile -Command "if ($PSVersionTable.PSVersion.Major -lt 5) { exit 1 }"
if %errorLevel% neq 0 (
    echo  [ERROR]  PowerShell 5.1+ required. Current version is too old.
    pause & exit /b 1
)
echo  [OK]  PowerShell version check passed.
echo.

:: ── Install ps2exe from PowerShell Gallery ────────────────────────────────────
echo  Installing ps2exe (only downloads once^)...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "if (-not (Get-Module ps2exe -ListAvailable)) { ^
        Write-Host '  Downloading ps2exe from PSGallery...' ; ^
        Install-Module ps2exe -Scope CurrentUser -Force -AllowClobber -ErrorAction Stop ^
    } else { ^
        Write-Host '  ps2exe already installed.' ^
    }"
if %errorLevel% neq 0 (
    echo.
    echo  [ERROR]  Could not install ps2exe.
    echo  Manual install: Open PowerShell and run:
    echo    Install-Module ps2exe -Scope CurrentUser -Force
    echo.
    pause & exit /b 1
)
echo.

:: ── Compile ──────────────────────────────────────────────────────────────────
echo  Compiling tray.ps1...
set "OUT=%~dp0..\AlanPOS-Tray.exe"
set "SRC=%~dp0tray.ps1"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "Import-Module ps2exe; ^
     Invoke-ps2exe -InputFile '%SRC%' -OutputFile '%OUT%' ^
       -noConsole ^
       -title 'AlanPOS Print Server' ^
       -description 'AlanPOS Print Server System Tray Manager' ^
       -company 'Alan Coffee and Travel' ^
       -version '2.0.0' ^
       -ErrorAction Stop"

if exist "%~dp0..\AlanPOS-Tray.exe" (
    echo.
    echo  ============================================================
    echo   [OK]  Build complete!
    echo  ============================================================
    echo.
    echo   Output:  %~dp0..\AlanPOS-Tray.exe
    echo.
    echo   Next steps:
    echo     1. Run install-as-startup.bat  (copies exe + server to %%APPDATA%%\AlanPOS^)
    echo     2. The tray icon appears in the Windows notification area
    echo     3. Right-click the tray icon to manage the server
    echo.
) else (
    echo.
    echo  [ERROR]  Build failed. Check the output above for errors.
    echo.
    echo  Common fixes:
    echo    - Run as Administrator if permission errors occur
    echo    - Try: Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
    echo    - Re-run this build.bat
    echo.
)
pause
