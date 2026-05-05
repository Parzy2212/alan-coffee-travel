@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title AlanPOS Print Server — Installer

echo.
echo  ============================================================
echo    AlanPOS Print Server  ^|  ติดตั้ง Windows Service
echo  ============================================================
echo.

:: ──────────────────────────────────────────────────────────────
::  STEP 0  — Must run as Administrator
:: ──────────────────────────────────────────────────────────────
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  [!]  ต้องรันในฐานะ Administrator
    echo.
    echo       คลิกขวา  install.bat
    echo       แล้วเลือก "Run as administrator"
    echo.
    pause
    exit /b 1
)

set "SRC=%~dp0"
set "INSTALL_DIR=C:\AlanPOS"
set "SVC_ID=AlanPOS-PrintServer"
set "LOGS_DIR=%INSTALL_DIR%\logs"

:: ──────────────────────────────────────────────────────────────
::  STEP 1  — Check Node.js
:: ──────────────────────────────────────────────────────────────
echo  [1/6]  ตรวจสอบ Node.js...
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo  [ERROR]  ไม่พบ Node.js  —  กรุณาติดตั้งก่อน
    echo.
    echo           1. เปิดเบราว์เซอร์ไปที่:
    echo              https://nodejs.org/en/download/
    echo.
    echo           2. เลือก  Windows Installer (.msi)  LTS
    echo           3. ติดตั้ง แล้วรีสตาร์ทคอมพิวเตอร์
    echo           4. รัน install.bat อีกครั้ง
    echo.
    start https://nodejs.org/en/download/
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version 2^>nul') do (
    if not defined NODE_VER set "NODE_VER=%%v"
)
for /f "tokens=*" %%p in ('where node 2^>nul') do (
    if not defined NODE_EXE set "NODE_EXE=%%p"
)
echo         Node.js !NODE_VER!  —  OK

:: ──────────────────────────────────────────────────────────────
::  STEP 2  — npm install
:: ──────────────────────────────────────────────────────────────
echo.
echo  [2/6]  ติดตั้ง dependencies (npm install)...
cd /d "!SRC!"
call npm install --silent --no-audit --no-fund 2>nul
if %errorLevel% neq 0 (
    echo.
    echo  [ERROR]  npm install ล้มเหลว
    echo  ลองรัน: npm install  เพื่อดู error เพิ่มเติม
    echo.
    pause
    exit /b 1
)
echo         OK

:: ──────────────────────────────────────────────────────────────
::  STEP 3  — Auto-detect Xprinter name
:: ──────────────────────────────────────────────────────────────
echo.
echo  [3/6]  ตรวจจับเครื่องพิมพ์ Xprinter...
set "PRINTER_NAME="

:: Try to find Xprinter / thermal printer
powershell -NoProfile -Command ^
  "try { $p = Get-Printer ^| Where-Object { $_.Name -match 'xprinter^|xp-[0-9]^|xpt^|thermal^|pos.*58^|pos.*80^|receipt' } ^| Select-Object -First 1; if ($p) { $p.Name } } catch {}" ^
  > "%TEMP%\alan_printer.txt" 2>nul
set /p PRINTER_NAME= < "%TEMP%\alan_printer.txt"
del "%TEMP%\alan_printer.txt" 2>nul

:: Strip trailing whitespace/newline
for /f "tokens=* delims= " %%p in ("!PRINTER_NAME!") do set "PRINTER_NAME=%%p"

if "!PRINTER_NAME!"=="" (
    :: Broader fallback — take first installed printer
    powershell -NoProfile -Command ^
      "try { (Get-Printer ^| Select-Object -First 1).Name } catch {}" ^
      > "%TEMP%\alan_printer.txt" 2>nul
    set /p PRINTER_NAME= < "%TEMP%\alan_printer.txt"
    del "%TEMP%\alan_printer.txt" 2>nul
    for /f "tokens=* delims= " %%p in ("!PRINTER_NAME!") do set "PRINTER_NAME=%%p"
)

if "!PRINTER_NAME!"=="" (
    set "PRINTER_NAME=XPrinter"
    echo         ไม่พบเครื่องพิมพ์อัตโนมัติ — ใช้ค่า default: XPrinter
    echo         (เปลี่ยนได้ในหน้า POS Settings)
) else (
    echo         พบ: !PRINTER_NAME!
)

:: ──────────────────────────────────────────────────────────────
::  STEP 4  — Copy files to C:\AlanPOS
:: ──────────────────────────────────────────────────────────────
echo.
echo  [4/6]  คัดลอกไฟล์ไปที่ %INSTALL_DIR%...
mkdir "%INSTALL_DIR%" 2>nul
mkdir "%LOGS_DIR%" 2>nul
xcopy /e /i /y /q "!SRC!" "%INSTALL_DIR%\" >nul 2>&1
if %errorLevel% neq 0 (
    echo  [ERROR]  คัดลอกไฟล์ไม่สำเร็จ
    pause
    exit /b 1
)
echo         OK

:: ──────────────────────────────────────────────────────────────
::  STEP 5  — Create winsw.xml service config
:: ──────────────────────────────────────────────────────────────
echo.
echo  [5/6]  สร้าง service config...

:: Use PowerShell to write the XML (avoids bat echo special-char issues)
powershell -NoProfile -Command ^
  "$xml = @'" & ^
  "<?xml version=""1.0"" encoding=""UTF-8""?>" & ^
  "<service>" & ^
  "  <id>AlanPOS-PrintServer</id>" & ^
  "  <name>AlanPOS Print Server</name>" & ^
  "  <description>Alan POS Receipt Printer Service - port 12345</description>" & ^
  "  <executable>!NODE_EXE!</executable>" & ^
  "  <arguments>server.js</arguments>" & ^
  "  <workingdirectory>!INSTALL_DIR!</workingdirectory>" & ^
  "  <log mode='roll-by-size'><logpath>!LOGS_DIR!</logpath><sizeThreshold>5120</sizeThreshold><keepFiles>3</keepFiles></log>" & ^
  "  <env name='PRINTER_NAME' value='!PRINTER_NAME!'/>" & ^
  "  <onfailure action='restart' delay='5 sec'/>" & ^
  "  <onfailure action='restart' delay='15 sec'/>" & ^
  "  <onfailure action='restart' delay='60 sec'/>" & ^
  "  <resetfailure>1 day</resetfailure>" & ^
  "  <startmode>Automatic</startmode>" & ^
  "</service>" & ^
  "'@; $xml | Out-File '%INSTALL_DIR%\winsw.xml' -Encoding UTF8 -NoNewline" 2>nul

:: Simpler fallback: write XML line by line with echo
if not exist "%INSTALL_DIR%\winsw.xml" (
    (
        echo ^<?xml version="1.0" encoding="UTF-8"?^>
        echo ^<service^>
        echo   ^<id^>AlanPOS-PrintServer^</id^>
        echo   ^<name^>AlanPOS Print Server^</name^>
        echo   ^<description^>Alan POS Receipt Printer Service - port 12345^</description^>
        echo   ^<executable^>!NODE_EXE!^</executable^>
        echo   ^<arguments^>server.js^</arguments^>
        echo   ^<workingdirectory^>!INSTALL_DIR!^</workingdirectory^>
        echo   ^<log mode="roll-by-size"^>^<logpath^>!LOGS_DIR!^</logpath^>^<sizeThreshold^>5120^</sizeThreshold^>^<keepFiles^>3^</keepFiles^>^</log^>
        echo   ^<env name="PRINTER_NAME" value="!PRINTER_NAME!"^/^>
        echo   ^<onfailure action="restart" delay="5 sec"/^>
        echo   ^<onfailure action="restart" delay="15 sec"/^>
        echo   ^<onfailure action="restart" delay="60 sec"/^>
        echo   ^<resetfailure^>1 day^</resetfailure^>
        echo   ^<startmode^>Automatic^</startmode^>
        echo ^</service^>
    ) > "%INSTALL_DIR%\winsw.xml"
)
echo         OK

:: ──────────────────────────────────────────────────────────────
::  STEP 6  — Install Windows Service
:: ──────────────────────────────────────────────────────────────
echo.
echo  [6/6]  ติดตั้ง Windows Service...

:: Uninstall any previous version cleanly
cd /d "%INSTALL_DIR%"
winsw.exe stop    >nul 2>&1
winsw.exe uninstall >nul 2>&1
timeout /t 2 /nobreak >nul

:: Install
winsw.exe install
if %errorLevel% neq 0 (
    echo.
    echo  [ERROR]  ติดตั้ง Service ล้มเหลว
    echo  ตรวจสอบ: %LOGS_DIR%\winsw.err.log
    echo.
    pause
    exit /b 1
)

:: Start
winsw.exe start
if %errorLevel% neq 0 (
    echo.
    echo  [!]  Service ติดตั้งแล้ว แต่เริ่มไม่ได้ทันที
    echo  Windows จะเริ่ม Service เมื่อรีสตาร์ทคอมพิวเตอร์
    echo  หรือเปิด Services และ Start "AlanPOS-PrintServer" ด้วยตนเอง
    echo.
)

:: Wait and verify
timeout /t 4 /nobreak >nul
sc query "AlanPOS-PrintServer" | findstr /i "RUNNING" >nul 2>&1
if %errorLevel% equ 0 (
    echo.
    echo  ============================================================
    echo   [OK]  ติดตั้งสำเร็จ!
    echo  ============================================================
    echo.
    echo    Service  :  AlanPOS-PrintServer
    echo    Status   :  RUNNING  (กำลังทำงาน)
    echo    Port     :  http://localhost:12345/status
    echo    Printer  :  !PRINTER_NAME!
    echo    Logs     :  %LOGS_DIR%
    echo.
    echo    Print Server จะเริ่มอัตโนมัติทุกครั้งที่บูตเครื่อง
    echo    หากเครื่องพิมพ์ไม่ทำงาน ตรวจสอบ:
    echo    http://localhost:12345/status
    echo.
) else (
    echo.
    echo  ============================================================
    echo   [OK]  ติดตั้ง Service สำเร็จ
    echo  ============================================================
    echo.
    echo    Service จะเริ่มอัตโนมัติเมื่อรีสตาร์ทเครื่อง
    echo    หรือเปิด Services.msc แล้ว Start "AlanPOS-PrintServer"
    echo.
    echo    Logs: %LOGS_DIR%
    echo.
)

pause
endlocal
