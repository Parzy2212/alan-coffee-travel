@echo off
chcp 65001 >nul
title AlanPOS Print Server — ติดตั้งโปรแกรม

echo.
echo  =============================================
echo    AlanPOS Print Server - ติดตั้งโปรแกรม
echo  =============================================
echo.

:: Check for administrator rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  [!] กรุณาคลิกขวา installer.bat
    echo      แล้วเลือก "Run as administrator"
    echo.
    pause
    exit /b 1
)

set TARGET=C:\AlanPOS
set EXE=AlanPOS-PrintServer.exe
set STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup

:: Create install directory
echo  [1/4] สร้างโฟลเดอร์ %TARGET% ...
mkdir "%TARGET%" 2>nul

:: Copy executable
echo  [2/4] คัดลอกโปรแกรม ...
copy /y "%~dp0%EXE%" "%TARGET%\%EXE%" >nul
if errorlevel 1 (
    echo.
    echo  [!] ผิดพลาด: ไม่สามารถคัดลอก %EXE% ได้
    echo      ตรวจสอบว่าไฟล์ %EXE% อยู่ในโฟลเดอร์เดียวกับ installer.bat
    echo.
    pause
    exit /b 1
)

:: Create Windows Startup shortcut
echo  [3/4] ตั้งค่าให้เริ่มอัตโนมัติเมื่อเปิดเครื่อง ...
powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell; ^
   $s  = $ws.CreateShortcut('%STARTUP%\AlanPOS-PrintServer.lnk'); ^
   $s.TargetPath      = '%TARGET%\%EXE%'; ^
   $s.WorkingDirectory = '%TARGET%'; ^
   $s.WindowStyle     = 7; ^
   $s.Description     = 'AlanPOS Print Server'; ^
   $s.Save()"

:: Start server immediately (minimized)
echo  [4/4] เริ่มโปรแกรมทันที ...
start "" /min "%TARGET%\%EXE%"

echo.
echo  =============================================
echo   ติดตั้งสำเร็จ! เครื่องพิมพ์พร้อมใช้งาน
echo  =============================================
echo.
echo   - โปรแกรมทำงานอยู่ใน system tray แล้ว
echo   - จะเริ่มอัตโนมัติทุกครั้งที่เปิดเครื่อง
echo   - เปิด Chrome แล้วไปที่ POS ได้เลย
echo.
pause
