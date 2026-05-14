# AlanPOS Printer Setup Guide

Complete guide for connecting a thermal receipt printer to Alan Cafe OS.

---

## Quick Start (Recommended Path)

1. **Run `install-as-startup.bat`** — installs the print server once, runs forever
2. **Open the POS on HTTP** — `http://localhost:3000/pos` or your local IP
3. **Test a print** — POS Settings → Test Print

---

## How It Works

```
Browser (POS)  ──HTTP──>  AlanPOS Print Server  ──RAW ESC/POS──>  Thermal Printer
(port 3000)              (port 12345, localhost)                    (USB / WiFi)
```

The print server is a tiny Node.js app that runs in the background. It receives
ESC/POS bytes from the browser and sends them directly to your printer via
Windows winspool (no GDI driver, raw bytes, fast).

**Why HTTP?** Browsers block HTTPS pages from connecting to HTTP local services
(mixed-content rule). The POS must be accessed via `http://` for printing to work.

---

## Installation Methods

### Method A — install-as-startup.bat (Recommended, no admin required)

Copies the server to `%APPDATA%\AlanPOS` and creates a Startup shortcut.
The server starts automatically every time Windows boots.

```
print-server\
  install-as-startup.bat  <-- run this once
```

**Steps:**
1. Open `print-server` folder
2. Double-click `install-as-startup.bat`
3. Wait for "Install complete!" message
4. Done — server starts on every boot

```
[screenshot: install-as-startup.bat running in a cmd window showing 6 steps]
```

**What it installs:**
```
%APPDATA%\AlanPOS\
  server.js          (the print server)
  package.json
  node_modules\
  config.json        (printer name, paper width)
  launch.bat         (restart loop)
  run-hidden.vbs     (hides the cmd window)
  logs\
    server.log       (all output goes here)

%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\
  AlanPOS-Tray.lnk  (or AlanPOS-PrintServer.lnk)
```

---

### Method B — Windows Service (install.bat, requires Administrator)

Installs as a proper Windows Service using WinSW. More robust, survives
session logouts, restarts on failure automatically.

```
print-server\
  install.bat   <-- right-click → Run as administrator
```

**Steps:**
1. Right-click `install.bat` → **Run as administrator**
2. Follow the prompts
3. Service `AlanPOS-PrintServer` appears in Services (services.msc)

---

### Method C — System Tray App (AlanPOS-Tray.exe)

A Windows tray icon that manages the server with a right-click menu.

```
[screenshot: Windows notification area showing green dot tray icon]

Right-click menu:
┌─────────────────────────────┐
│ AlanPOS Print Server v2.0   │
│ ● Running  (port 12345)     │
├─────────────────────────────┤
│   Restart Server            │
│   View Logs                 │
├─────────────────────────────┤
│   Settings...               │
├─────────────────────────────┤
│   Quit                      │
└─────────────────────────────┘
```

**Build it:**
```
cd print-server\tray
build.bat
```
Requires internet on first run (downloads `ps2exe` from PowerShell Gallery).
Produces `print-server\AlanPOS-Tray.exe`.

Then run `install-as-startup.bat` — it will detect the .exe and use the tray
app as the startup item instead of the headless launcher.

---

## Printer Connection

### USB (Most common)

Plug the thermal printer into any USB port. The server auto-detects USB001–USB005.

```
[screenshot: Windows Device Manager showing Xprinter USB Serial Port]
```

**If auto-detect fails:**
1. Open **Device Manager** → **Printers**
2. Find your printer name (e.g. `XP-T80A`)
3. In POS: Settings → Printer Name → type the exact name

### WiFi / Network Printer

In POS Settings, enter the printer's IP address (e.g. `192.168.1.100`).
The server connects via TCP port 9100.

```
[screenshot: POS Settings panel showing Printer IP field]
```

### Named Printer (Windows Spooler)

If the printer has a Windows driver installed:
1. POS Settings → Printer Name → enter the Windows printer name exactly
2. The server uses `winspool.drv` RAW mode (bypasses GDI, sends ESC/POS directly)

---

## Accessing the POS on HTTP

The POS must be accessed via **HTTP** for the print server to work.

### Local development

```
http://localhost:3000/pos
```

### LAN access (other devices on same network)

```
http://192.168.x.x:3000/pos
```

Find your PC's IP: open Command Prompt → `ipconfig` → look for IPv4 Address.

```
[screenshot: ipconfig output highlighting IPv4 Address]
```

### HTTPS warning banner

If you open the POS on HTTPS, a yellow banner appears at the top:

```
⚠️ Print server blocked. Running on HTTPS prevents the local print server
   from connecting. Switch to HTTP to enable printing.
   [Switch to HTTP →]  [Always HTTP]  [×]
```

Click **Switch to HTTP** to reload on HTTP. Click **Always HTTP** to auto-redirect
every time you open the POS.

---

## Paper Width

| Model       | Width | Setting |
|-------------|-------|---------|
| XP-58 / 58L | 58mm  | 58      |
| XP-80 / T80 | 80mm  | **80** (default) |
| XP-Q90EC    | 80mm  | 80      |

Set in: POS Settings → Paper Width (mm)

---

## Troubleshooting

### Server not responding

1. Check `%APPDATA%\AlanPOS\logs\server.log` for errors
2. Open `http://localhost:12345/status` in browser — should show `{"ok":true}`
3. Restart via tray icon right-click → Restart Server
4. Or manually: open `%APPDATA%\AlanPOS` and run `launch.bat`

### "Port 12345 already in use"

Another instance is running. Options:
- Open Task Manager → find `node.exe` → End task
- Restart your PC

### Print job sent but nothing prints

1. Check **printer is powered on and online** (green LED)
2. Try the Test Print button in POS Settings
3. Verify printer name matches exactly (case-sensitive on some models)
4. Try USB cable swap or different USB port
5. Check `server.log` for "WritePrinter failed" error

### Chinese/garbled characters on receipt

The print server sends raw ASCII (PC437 code page). Thai/Lao characters are
stripped for thermal print — this is correct behavior. The receipt preview in
the browser shows your selected language; the physical receipt is always ASCII.

### Printer detected but wrong paper width

In POS Settings, change Paper Width to match your printer (58 or 80 mm).
Incorrect width causes text to wrap or be cut off.

---

## Uninstall

1. Delete the Startup shortcut:
   `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\AlanPOS-Tray.lnk`
   (or `AlanPOS-PrintServer.lnk`)

2. Delete the app folder:
   `%APPDATA%\AlanPOS\`

3. If installed as Windows Service (Method B):
   Open Command Prompt as Administrator → `sc delete AlanPOS-PrintServer`

---

## File Reference

```
print-server/
  server.js              Main print server (Node.js, HTTP on port 12345)
  install-as-startup.bat Install for current user, no admin required
  install.bat            Install as Windows Service (requires admin)
  uninstall.bat          Remove Windows Service
  installer.bat          Simple installer for AlanPOS-PrintServer.exe
  AlanPOS-PrintServer.exe Pre-built standalone exe (no Node.js required)
  winsw.exe              Windows Service Wrapper (used by install.bat)
  tray/
    tray.ps1             PowerShell tray app source
    build.bat            Compiles tray.ps1 to AlanPOS-Tray.exe
```

---

*Last updated: May 2026*
