# Alan POS: one icon that opens the POS as an app window and prints receipts
# straight to the receipt printer (no print dialog). The Windows default
# printer is NOT changed: the POS window remembers its own printer.
#
# Run once per POS computer, after the Xprinter driver is installed, as the
# normal (non-admin) user, with every "Alan POS" window closed:
#   powershell -ExecutionPolicy Bypass -File create-pos-shortcut.ps1
# Run it again after renaming or reinstalling the printer.
# Undo: delete the "Alan POS" shortcuts (Desktop + Start menu) and the folder
# %LOCALAPPDATA%\AlanPOS.
# -Url / -Name / -Printer are for testing another address or a printer whose
# name does not contain Xprinter / XP-80 / POS-80.

param(
  [string]$Url     = 'https://alancoffeetravel.com/pos',
  [string]$Name    = 'Alan POS',
  [string]$Printer = ''
)

$ErrorActionPreference = 'Stop'
$appDir      = Join-Path $env:LOCALAPPDATA 'AlanPOS'
$edgeProfile = Join-Path $appDir (($Name -replace '[^A-Za-z0-9]', '') + 'Profile')

$edge = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw 'Microsoft Edge not found' }

if (-not $Printer) {
  $Printer = (Get-CimInstance Win32_Printer | Where-Object { $_.Name -match 'Xprinter|XP-?80|POS-?80' } | Select-Object -First 1).Name
}
if (-not $Printer) { throw 'No Xprinter print queue found. Install the Xprinter driver first, then run this script again.' }

$running = Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like "*$edgeProfile*" }
if ($running) { throw "Close the '$Name' window first, then run this script again." }

# Remember the receipt printer in the POS window's own Edge profile
# (print preview "recent destination"; --kiosk-printing uses it).
$prefDir  = Join-Path $edgeProfile 'Default'
$prefFile = Join-Path $prefDir 'Preferences'
New-Item -ItemType Directory -Force -Path $prefDir | Out-Null
Add-Type -AssemblyName System.Web.Extensions
$json = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$json.MaxJsonLength = [int]::MaxValue
$prefs = if (Test-Path $prefFile) { $json.DeserializeObject([IO.File]::ReadAllText($prefFile)) } else { @{} }
if (-not $prefs) { $prefs = @{} }
if (-not $prefs.ContainsKey('printing')) { $prefs['printing'] = @{} }
$appState = @{
  version               = 2
  recentDestinations    = @(@{ id = $Printer; origin = 'local'; account = ''; displayName = $Printer; extensionId = ''; extensionName = '' })
  isHeaderFooterEnabled = $false
  scaling               = '100'
  scalingType           = 0
}
$prefs['printing']['print_preview_sticky_settings'] = @{ appState = $json.Serialize($appState) }
[IO.File]::WriteAllText($prefFile, $json.Serialize($prefs), (New-Object System.Text.UTF8Encoding $false))
"Receipt printer: $Printer"

$icon = Join-Path $appDir 'alan.ico'
try { Invoke-WebRequest -UseBasicParsing 'https://alancoffeetravel.com/favicon.ico' -OutFile $icon } catch { $icon = $edge }

# Own profile folder: this Edge instance is only ever started by this icon, so
# --kiosk-printing always applies (flags are ignored if the profile is already open).
$edgeArgs = "--user-data-dir=`"$edgeProfile`" --kiosk-printing --no-first-run --app=$Url"

$shell = New-Object -ComObject WScript.Shell
foreach ($folder in 'Desktop', 'Programs') {
  $lnk = Join-Path ([Environment]::GetFolderPath($folder)) "$Name.lnk"
  $s = $shell.CreateShortcut($lnk)
  $s.TargetPath       = $edge
  $s.Arguments        = $edgeArgs
  $s.IconLocation     = $icon
  $s.WorkingDirectory = Split-Path $edge
  $s.Description      = 'Alan Cafe POS'
  $s.Save()
  "Created: $lnk"
}
