@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title AlanPOS Print Server -- Install as Startup

echo.
echo  ============================================================
echo    AlanPOS Print Server  ^|  ติดตั้งแบบไม่ต้องการสิทธิ์ Admin
echo  ============================================================
echo.
echo  ติดตั้งสำหรับผู้ใช้ปัจจุบันเท่านั้น (ไม่ต้องการ Administrator^)
echo  เซิร์ฟเวอร์จะเริ่มอัตโนมัติทุกครั้งที่เปิดเครื่อง
echo.

:: ── Paths ────────────────────────────────────────────────────────────────────
set "APP_DIR=%APPDATA%\AlanPOS"
set "LOG_DIR=%APP_DIR%\logs"
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SRC=%~dp0"

:: ── STEP 1: Check Node.js ─────────────────────────────────────────────────────
echo  [1/6]  ตรวจสอบ Node.js...
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo  [ERROR]  ไม่พบ Node.js
    echo  กรุณาติดตั้ง Node.js LTS จาก https://nodejs.org
    echo  แล้วรัน install-as-startup.bat อีกครั้ง
    echo.
    start https://nodejs.org/en/download/
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('node --version 2^>nul') do (
    if not defined NODE_VER set "NODE_VER=%%v"
)
echo         Node.js !NODE_VER! -- OK

:: ── STEP 2: Create directories ───────────────────────────────────────────────
echo.
echo  [2/6]  สร้างโฟลเดอร์ %APP_DIR%...
mkdir "%APP_DIR%" 2>nul
mkdir "%LOG_DIR%" 2>nul
echo         OK

:: ── STEP 3: Copy server files ─────────────────────────────────────────────────
echo.
echo  [3/6]  คัดลอกไฟล์เซิร์ฟเวอร์...

:: Copy only what the server needs (skip node_modules, .bat files, .exe files)
copy /y "!SRC!server.js"    "%APP_DIR%\server.js"    >nul 2>&1
copy /y "!SRC!package.json" "%APP_DIR%\package.json" >nul 2>&1
if exist "!SRC!AlanPOS-Tray.exe" (
    copy /y "!SRC!AlanPOS-Tray.exe" "%APP_DIR%\AlanPOS-Tray.exe" >nul 2>&1
    echo         Copied server.js + package.json + AlanPOS-Tray.exe
) else (
    echo         Copied server.js + package.json
)

:: npm install in app dir
echo         Running npm install...
cd /d "%APP_DIR%"
call npm install --silent --no-audit --no-fund 2>nul
if %errorLevel% neq 0 (
    echo  [WARN]  npm install returned errors. Trying with verbose output...
    call npm install --no-audit --no-fund
)
echo         Dependencies ready.

:: ── STEP 4: Auto-detect printer ──────────────────────────────────────────────
echo.
echo  [4/6]  ตรวจจับเครื่องพิมพ์...
set "PRINTER_NAME="
powershell -NoProfile -Command ^
    "try { $p = Get-Printer ^| Where-Object { $_.Name -match 'xprinter^|xp-^|thermal^|receipt^|pos' } ^| Select-Object -First 1; if ($p) { $p.Name } } catch {}" ^
    > "%TEMP%\_alan_p.txt" 2>nul
set /p PRINTER_NAME= < "%TEMP%\_alan_p.txt"
del "%TEMP%\_alan_p.txt" 2>nul
for /f "tokens=* delims= " %%p in ("!PRINTER_NAME!") do set "PRINTER_NAME=%%p"

if "!PRINTER_NAME!"=="" (
    echo         ไม่พบ Xprinter -- ใช้ USB auto-detect
) else (
    echo         พบ: !PRINTER_NAME!
)

:: Save printer name to config
echo {"printerName":"!PRINTER_NAME!","paperWidth":"80"} > "%APP_DIR%\config.json"

:: ── STEP 5: Create hidden-launch scripts ─────────────────────────────────────
echo.
echo  [5/6]  สร้าง launch scripts...

:: launch.bat -- restart loop, logs to file
(
    echo @echo off
    echo cd /d "%APP_DIR%"
    echo :LOOP
    echo for /f "tokens=1-2" %%%%d in ^('date /t ^& time /t'^) do set DT=%%%%d %%%%e
    echo echo [%%DT%%] Starting AlanPOS Print Server... ^>^> "%LOG_DIR%\server.log"
    echo node server.js ^>^> "%LOG_DIR%\server.log" 2^>^&1
    echo echo [restart] Server stopped ^(exit %%ERRORLEVEL%%^), restarting in 3s... ^>^> "%LOG_DIR%\server.log"
    echo timeout /t 3 /nobreak ^>nul
    echo goto LOOP
) > "%APP_DIR%\launch.bat"

:: run-hidden.vbs -- launches launch.bat with no visible window
powershell -NoProfile -Command ^
    "@'" ^
    > "%TEMP%\_alan_vbs.tmp" 2>nul
powershell -NoProfile -Command ^
    "$vbs = 'Set ws = CreateObject(\"WScript.Shell\")' + [char]13 + [char]10 + ^
            'ws.Run \"cmd /c \"\"' + '%APP_DIR%' + '\launch.bat\"\"\", 0, False'; ^
     Set-Content -Path '%APP_DIR%\run-hidden.vbs' -Value $vbs -Encoding ASCII" 2>nul

if not exist "%APP_DIR%\run-hidden.vbs" (
    :: Fallback: write VBS line by line
    echo Set ws = CreateObject("WScript.Shell") > "%APP_DIR%\run-hidden.vbs"
    echo ws.Run "cmd /c ""%APP_DIR%\launch.bat""", 0, False >> "%APP_DIR%\run-hidden.vbs"
)

echo         OK

:: ── STEP 6: Create Startup shortcut ──────────────────────────────────────────
echo.
echo  [6/6]  สร้าง Startup shortcut...

:: Remove old shortcut if exists
del "%STARTUP_DIR%\AlanPOS-PrintServer.lnk" 2>nul
del "%STARTUP_DIR%\AlanPOS-Tray.lnk"        2>nul

if exist "%APP_DIR%\AlanPOS-Tray.exe" (
    :: Use tray app as startup item (manages server + shows icon)
    powershell -NoProfile -Command ^
        "$ws = New-Object -ComObject WScript.Shell; ^
         $s = $ws.CreateShortcut('%STARTUP_DIR%\AlanPOS-Tray.lnk'); ^
         $s.TargetPath       = '%APP_DIR%\AlanPOS-Tray.exe'; ^
         $s.WorkingDirectory = '%APP_DIR%'; ^
         $s.Description      = 'AlanPOS Print Server Tray'; ^
         $s.WindowStyle      = 7; ^
         $s.Save()"
    echo         Startup shortcut -> AlanPOS-Tray.exe (tray mode^)
) else (
    :: Fallback: start hidden via VBScript
    powershell -NoProfile -Command ^
        "$ws = New-Object -ComObject WScript.Shell; ^
         $s = $ws.CreateShortcut('%STARTUP_DIR%\AlanPOS-PrintServer.lnk'); ^
         $s.TargetPath       = 'wscript.exe'; ^
         $s.Arguments        = '\"%APP_DIR%\run-hidden.vbs\"'; ^
         $s.WorkingDirectory = '%APP_DIR%'; ^
         $s.Description      = 'AlanPOS Print Server'; ^
         $s.WindowStyle      = 7; ^
         $s.Save()"
    echo         Startup shortcut -> run-hidden.vbs (headless mode^)
)

:: ── Start immediately ─────────────────────────────────────────────────────────
echo.
echo  กำลังเริ่มเซิร์ฟเวอร์...
if exist "%APP_DIR%\AlanPOS-Tray.exe" (
    start "" "%APP_DIR%\AlanPOS-Tray.exe"
) else (
    start "" wscript.exe "%APP_DIR%\run-hidden.vbs"
)

:: Verify port responds
timeout /t 4 /nobreak >nul
powershell -NoProfile -Command ^
    "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:12345/status' -TimeoutSec 3 -UseBasicParsing; ^
           if ($r.StatusCode -eq 200) { Write-Host '  [OK] Port 12345 responding' } ^
    } catch { Write-Host '  [..] Server starting (check logs if it fails)' }" 2>nul

echo.
echo  ============================================================
echo   ติดตั้งสำเร็จ!
echo  ============================================================
echo.
echo   ติดตั้งที่  :  %APP_DIR%
echo   Startup    :  %STARTUP_DIR%
echo   Logs       :  %LOG_DIR%\server.log
echo   Printer    :  !PRINTER_NAME!
if "!PRINTER_NAME!"=="" echo             ^(USB auto-detect^)
echo.
echo   เซิร์ฟเวอร์จะเริ่มอัตโนมัติทุกครั้งที่บูตเครื่อง
echo   ตรวจสอบ:  http://localhost:12345/status
echo.
echo   ถอนการติดตั้ง:  ลบ shortcut ใน %STARTUP_DIR%
echo                    และโฟลเดอร์ %APP_DIR%
echo.
pause
endlocal
