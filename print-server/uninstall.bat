@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title AlanPOS Print Server — Uninstaller

echo.
echo  ============================================================
echo    AlanPOS Print Server  ^|  ถอนการติดตั้ง Windows Service
echo  ============================================================
echo.

:: Must run as Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  [!]  ต้องรันในฐานะ Administrator
    echo.
    echo       คลิกขวา  uninstall.bat
    echo       แล้วเลือก "Run as administrator"
    echo.
    pause
    exit /b 1
)

set "INSTALL_DIR=C:\AlanPOS"
set "SVC_ID=AlanPOS-PrintServer"

:: ──────────────────────────────────────────────────────────────
::  STEP 1 — Stop and uninstall the Windows Service
:: ──────────────────────────────────────────────────────────────
echo  [1/2]  หยุดและถอนการติดตั้ง Service...

if not exist "%INSTALL_DIR%\winsw.exe" (
    echo.
    echo  [!]  ไม่พบ winsw.exe ใน %INSTALL_DIR%
    echo       ลองถอนติดตั้งด้วย sc.exe...
    sc stop "%SVC_ID%" >nul 2>&1
    sc delete "%SVC_ID%" >nul 2>&1
    goto :delete_files
)

cd /d "%INSTALL_DIR%"
winsw.exe stop    >nul 2>&1
timeout /t 3 /nobreak >nul
winsw.exe uninstall >nul 2>&1

:: Verify service is gone
sc query "%SVC_ID%" >nul 2>&1
if %errorLevel% neq 0 (
    echo         Service ถอนการติดตั้งสำเร็จ
) else (
    echo         ลองด้วย sc.exe...
    sc stop "%SVC_ID%" >nul 2>&1
    sc delete "%SVC_ID%" >nul 2>&1
)

:delete_files
:: ──────────────────────────────────────────────────────────────
::  STEP 2 — Ask whether to delete C:\AlanPOS folder
:: ──────────────────────────────────────────────────────────────
echo.
echo  [2/2]  ลบโฟลเดอร์ %INSTALL_DIR%?
echo.
echo         [Y]  ใช่ — ลบไฟล์ทั้งหมด (รวม logs)
echo         [N]  ไม่ — เก็บโฟลเดอร์ไว้ (เก็บ logs)
echo.
set /p "DEL_CHOICE=  กรุณาเลือก Y หรือ N: "

if /i "!DEL_CHOICE!"=="Y" (
    cd /d "C:\"
    rd /s /q "%INSTALL_DIR%" 2>nul
    if exist "%INSTALL_DIR%" (
        echo.
        echo  [!]  ลบโฟลเดอร์ไม่สำเร็จ (อาจมีไฟล์ที่ถูกล็อก)
        echo       ลบด้วยตนเองที่: %INSTALL_DIR%
    ) else (
        echo         ลบ %INSTALL_DIR% สำเร็จ
    )
) else (
    echo         เก็บโฟลเดอร์ไว้ที่ %INSTALL_DIR%
)

echo.
echo  ============================================================
echo   [OK]  ถอนการติดตั้ง AlanPOS Print Server สำเร็จ
echo  ============================================================
echo.
echo    Service "AlanPOS-PrintServer" ถูกลบออกจากระบบแล้ว
echo    Port 12345 ว่างแล้ว
echo.

pause
endlocal
