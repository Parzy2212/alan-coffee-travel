#Requires -Version 5.0
# AlanPOS Print Server - System Tray Manager
# Manages the print server process and shows a Windows system tray icon.
# Build to .exe with: build.bat (uses ps2exe)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$APP_DIR   = "$env:APPDATA\AlanPOS"
$LOG_DIR   = "$APP_DIR\logs"
$LOG_FILE  = "$LOG_DIR\server.log"
$TRAY_LOG  = "$LOG_DIR\tray.log"
$CONF_FILE = "$APP_DIR\config.json"
$SERVER_JS = "$APP_DIR\server.js"
$PORT      = 12345

[System.IO.Directory]::CreateDirectory($LOG_DIR) | Out-Null

# ── Logging ───────────────────────────────────────────────────────────────────

function Write-TrayLog {
    param([string]$msg)
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    try { Add-Content -Path $TRAY_LOG -Value "[$ts] $msg" -ErrorAction Stop } catch {}
}

# ── Config ────────────────────────────────────────────────────────────────────

function Get-Config {
    try {
        $raw = Get-Content $CONF_FILE -Raw -ErrorAction Stop
        return $raw | ConvertFrom-Json
    } catch {}
    return [PSCustomObject]@{ printerName = ''; paperWidth = '80' }
}

function Save-Config {
    param($cfg)
    try { $cfg | ConvertTo-Json | Set-Content $CONF_FILE -Encoding UTF8 } catch {}
}

# ── Icons (drawn in-memory, no .ico file required) ───────────────────────────

function New-DotIcon {
    param([System.Drawing.Color]$color)
    $bmp = New-Object System.Drawing.Bitmap 16, 16
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)
    $brush = New-Object System.Drawing.SolidBrush $color
    $pen   = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(60,0,0,0)), 1
    $g.FillEllipse($brush, 2, 2, 11, 11)
    $g.DrawEllipse($pen,   2, 2, 11, 11)
    $g.Dispose(); $brush.Dispose(); $pen.Dispose()
    $handle = $bmp.GetHicon()
    $icon   = [System.Drawing.Icon]::FromHandle($handle)
    $bmp.Dispose()
    return $icon
}

$ICON_GREEN  = New-DotIcon ([System.Drawing.Color]::FromArgb(74,  186, 127))
$ICON_RED    = New-DotIcon ([System.Drawing.Color]::FromArgb(239, 83,  80))
$ICON_YELLOW = New-DotIcon ([System.Drawing.Color]::FromArgb(245, 158, 11))

# ── Server process management ─────────────────────────────────────────────────

$script:proc         = $null
$script:autoRestart  = $true
$script:restartCount = 0
$MAX_RESTARTS        = 20

function Start-PrintServer {
    if ($script:proc -and -not $script:proc.HasExited) { return }
    if (-not (Test-Path $SERVER_JS)) {
        Write-TrayLog "ERROR: server.js not found at $SERVER_JS"
        [System.Windows.Forms.MessageBox]::Show(
            "server.js not found at:`n$SERVER_JS`n`nRun install-as-startup.bat first.",
            "AlanPOS - Missing server",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        ) | Out-Null
        return
    }

    try { $nodeExe = (Get-Command node -ErrorAction Stop).Source } catch {
        Write-TrayLog "ERROR: node.exe not found in PATH"
        [System.Windows.Forms.MessageBox]::Show(
            "Node.js not found. Install from nodejs.org",
            "AlanPOS - Missing Node.js",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        ) | Out-Null
        return
    }

    $cfg = Get-Config
    Write-TrayLog "Starting server (attempt $($script:restartCount + 1), printer='$($cfg.printerName)')"

    $tray.Icon = $ICON_YELLOW
    $tray.Text = "AlanPOS - Starting..."

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName               = $nodeExe
    $psi.Arguments              = "`"$SERVER_JS`""
    $psi.WorkingDirectory       = $APP_DIR
    $psi.UseShellExecute        = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError  = $true
    $psi.CreateNoWindow         = $true

    if ($cfg.printerName) { $psi.EnvironmentVariables['PRINTER_NAME'] = $cfg.printerName }
    if ($cfg.paperWidth)  { $psi.EnvironmentVariables['PAPER_WIDTH']  = $cfg.paperWidth  }

    try {
        $script:proc = [System.Diagnostics.Process]::Start($psi)

        # Pipe stdout/stderr to log file
        $srvLog = $LOG_FILE
        Register-ObjectEvent -InputObject $script:proc -EventName OutputDataReceived -Action {
            if ($Event.SourceEventArgs.Data) {
                try { Add-Content -Path $srvLog -Value $Event.SourceEventArgs.Data } catch {}
            }
        } | Out-Null
        Register-ObjectEvent -InputObject $script:proc -EventName ErrorDataReceived -Action {
            if ($Event.SourceEventArgs.Data) {
                try { Add-Content -Path $srvLog -Value "[ERR] $($Event.SourceEventArgs.Data)" } catch {}
            }
        } | Out-Null
        $script:proc.BeginOutputReadLine()
        $script:proc.BeginErrorReadLine()

        Write-TrayLog "Server started (PID $($script:proc.Id))"
        Update-TrayIcon
    } catch {
        Write-TrayLog "Failed to start server: $_"
        $script:proc = $null
        Update-TrayIcon
    }
}

function Stop-PrintServer {
    $script:autoRestart = $false
    if ($script:proc -and -not $script:proc.HasExited) {
        Write-TrayLog "Stopping server (PID $($script:proc.Id))"
        try { $script:proc.Kill(); $script:proc.WaitForExit(3000) } catch {}
        $script:proc = $null
    }
    Update-TrayIcon
}

function Restart-PrintServer {
    Write-TrayLog "Restart requested"
    $script:autoRestart  = $true
    $script:restartCount = 0
    if ($script:proc -and -not $script:proc.HasExited) {
        try { $script:proc.Kill(); $script:proc.WaitForExit(3000) } catch {}
        $script:proc = $null
    }
    Start-Sleep -Milliseconds 800
    Start-PrintServer
}

function Update-TrayIcon {
    $running = $script:proc -and -not $script:proc.HasExited
    if ($running) {
        $tray.Icon = $ICON_GREEN
        $tray.Text = "AlanPOS Print Server - Running :12345"
        $mnuStatus.Text = [char]0x25CF + " Running  (port $PORT)"
        $mnuStatus.ForeColor = [System.Drawing.Color]::FromArgb(74, 186, 127)
    } else {
        $tray.Icon = $ICON_RED
        $tray.Text = "AlanPOS Print Server - Stopped"
        $mnuStatus.Text = [char]0x2715 + " Stopped"
        $mnuStatus.ForeColor = [System.Drawing.Color]::FromArgb(239, 83, 80)
    }
}

# ── Tray UI ───────────────────────────────────────────────────────────────────

$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Icon    = $ICON_RED
$tray.Text    = "AlanPOS Print Server"
$tray.Visible = $true

$menu        = New-Object System.Windows.Forms.ContextMenuStrip
$mnuHeader   = New-Object System.Windows.Forms.ToolStripLabel  "AlanPOS Print Server v2.0"
$mnuStatus   = New-Object System.Windows.Forms.ToolStripMenuItem "✗ Stopped"
$mnuSep1     = New-Object System.Windows.Forms.ToolStripSeparator
$mnuRestart  = New-Object System.Windows.Forms.ToolStripMenuItem "Restart Server"
$mnuLogs     = New-Object System.Windows.Forms.ToolStripMenuItem "View Logs"
$mnuSep2     = New-Object System.Windows.Forms.ToolStripSeparator
$mnuSettings = New-Object System.Windows.Forms.ToolStripMenuItem "Settings..."
$mnuSep3     = New-Object System.Windows.Forms.ToolStripSeparator
$mnuQuit     = New-Object System.Windows.Forms.ToolStripMenuItem "Quit"

$mnuHeader.Font    = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$mnuStatus.Enabled = $false

$menu.Items.AddRange(@(
    $mnuHeader, $mnuStatus, $mnuSep1,
    $mnuRestart, $mnuLogs, $mnuSep2,
    $mnuSettings, $mnuSep3, $mnuQuit
))
$tray.ContextMenuStrip = $menu

# ── Menu click handlers ───────────────────────────────────────────────────────

$mnuRestart.add_Click({ Restart-PrintServer })

$mnuLogs.add_Click({
    $f = $LOG_FILE
    if (-not (Test-Path $f)) { [System.IO.File]::WriteAllText($f, "(no log yet)`n") }
    Start-Process notepad $f
})

$mnuSettings.add_Click({
    $cfg = Get-Config

    $form = New-Object System.Windows.Forms.Form
    $form.Text            = "AlanPOS Print Server - Settings"
    $form.Size            = New-Object System.Drawing.Size(360, 230)
    $form.StartPosition   = "CenterScreen"
    $form.FormBorderStyle = "FixedDialog"
    $form.MaximizeBox     = $false
    $form.MinimizeBox     = $false

    $lblP = New-Object System.Windows.Forms.Label
    $lblP.Text = "Printer Name:"; $lblP.Location = "12,18"; $lblP.Size = "110,20"; $lblP.TextAlign = "MiddleLeft"
    $txtP = New-Object System.Windows.Forms.TextBox
    $txtP.Text = $cfg.printerName; $txtP.Location = "130,15"; $txtP.Size = "200,22"

    $lblW = New-Object System.Windows.Forms.Label
    $lblW.Text = "Paper Width:"; $lblW.Location = "12,52"; $lblW.Size = "110,20"; $lblW.TextAlign = "MiddleLeft"
    $cmbW = New-Object System.Windows.Forms.ComboBox
    $cmbW.Location = "130,49"; $cmbW.Size = "80,22"; $cmbW.DropDownStyle = "DropDownList"
    [void]$cmbW.Items.AddRange(@("58", "80"))
    $cmbW.SelectedItem = if ($cfg.paperWidth) { $cfg.paperWidth } else { "80" }

    $lblHint = New-Object System.Windows.Forms.Label
    $lblHint.Text = "Leave Printer Name empty for USB auto-detect."
    $lblHint.Location = "12,82"; $lblHint.Size = "320,35"
    $lblHint.ForeColor = [System.Drawing.Color]::Gray

    $btnSave = New-Object System.Windows.Forms.Button
    $btnSave.Text     = "Save && Restart Server"
    $btnSave.Location = "90,148"; $btnSave.Size = "170,32"
    $btnSave.add_Click({
        Save-Config ([PSCustomObject]@{
            printerName = $txtP.Text.Trim()
            paperWidth  = $cmbW.SelectedItem
        })
        $form.Close()
        Restart-PrintServer
    })

    $btnCancel = New-Object System.Windows.Forms.Button
    $btnCancel.Text     = "Cancel"
    $btnCancel.Location = "268,148"; $btnCancel.Size = "70,32"
    $btnCancel.add_Click({ $form.Close() })

    $form.Controls.AddRange(@($lblP, $txtP, $lblW, $cmbW, $lblHint, $btnSave, $btnCancel))
    $form.ShowDialog() | Out-Null
})

$mnuQuit.add_Click({
    Write-TrayLog "Quit requested by user"
    $watchTimer.Stop()
    Stop-PrintServer
    $tray.Visible = $false
    $tray.Dispose()
    [System.Windows.Forms.Application]::Exit()
    [System.Environment]::Exit(0)
})

# Double-click: open browser status page
$tray.add_DoubleClick({
    Start-Process "http://127.0.0.1:$PORT/status"
})

# ── Auto-restart watchdog timer ───────────────────────────────────────────────

$watchTimer = New-Object System.Windows.Forms.Timer
$watchTimer.Interval = 5000
$watchTimer.add_Tick({
    $died = ($script:proc -eq $null) -or $script:proc.HasExited
    if ($script:autoRestart -and $died -and ($script:restartCount -lt $MAX_RESTARTS)) {
        $script:restartCount++
        Write-TrayLog "Watchdog: auto-restart #$($script:restartCount)"
        Start-PrintServer
    } elseif ($died -and $script:restartCount -ge $MAX_RESTARTS) {
        $tray.Icon = $ICON_RED
        $tray.Text = "AlanPOS - Stopped (max restarts reached)"
        $mnuStatus.Text = "! Max restarts reached"
    }
    Update-TrayIcon
})
$watchTimer.Start()

# ── Start ─────────────────────────────────────────────────────────────────────

Write-TrayLog "AlanPOS Tray starting"
Start-PrintServer

Start-Sleep -Milliseconds 1200
$tray.BalloonTipTitle = "AlanPOS Print Server"
$tray.BalloonTipText  = "Running on port $PORT. Right-click for options."
$tray.BalloonTipIcon  = "Info"
$tray.ShowBalloonTip(3000)

[System.Windows.Forms.Application]::Run()
