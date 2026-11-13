# Backup of the Supabase database to files on this PC, before package F.
# Covers every table, function and policy. It does NOT copy the files in
# Storage (menu pictures, receipts, staff photos): only their list.
#
# Holds no key and no password. It asks for the DATABASE password (not the
# service key) and keeps it only in memory for this one run.
# Needs Docker Desktop running. Reads only; changes nothing in the database.
#
# Run in a normal PowerShell window (not inside Claude Code):
#   powershell -ExecutionPolicy Bypass -File D:\alan-coffee-travel\scripts\backup-db.ps1
#
# Where to find the two answers it asks for:
#   Supabase dashboard -> "Connect" (top bar) -> "Session pooler"
#     host: looks like  aws-0-xxxx.pooler.supabase.com
#     user: looks like  postgres.fmsdfcsqdpdlppucuptn
#   password: the database password. If it is forgotten it can be reset in
#     Project Settings -> Database. The website and POS do not use it, but
#     any other tool that connects with it would need the new one.

param(
  [string]$PgHost,
  [string]$PgUser,
  [int]$Port = 5432,
  [string]$OutDir = 'D:\alan-backups',
  [string]$SslMode = 'require'
)

if (-not $PgHost) { $PgHost = (Read-Host 'Session pooler host').Trim() }
if (-not $PgUser) {
  $PgUser = (Read-Host 'User [postgres.fmsdfcsqdpdlppucuptn]').Trim()
  if (-not $PgUser) { $PgUser = 'postgres.fmsdfcsqdpdlppucuptn' }
}
if (-not $PgHost) { Write-Host 'No host given. Stopped.'; exit 1 }

$hadPassword = [bool]$env:PGPASSWORD
if (-not $hadPassword) {
  $secure = Read-Host 'Database password (hidden while typing)' -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
$env:PGSSLMODE = $SslMode

New-Item -ItemType Directory -Force $OutDir | Out-Null
$stamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$mainName = "alan-db_$stamp.dump"
$extraName = "alan-db_${stamp}_logins-and-file-list.dump"
$mainFile = Join-Path $OutDir $mainName
$extraFile = Join-Path $OutDir $extraName

function Invoke-Dump([string]$name, [string[]]$schemas) {
  $dumpArgs = @('run', '--rm', '-e', 'PGPASSWORD', '-e', 'PGSSLMODE', '-v', "${OutDir}:/out", 'postgres:17',
    'pg_dump', '-h', $PgHost, '-p', "$Port", '-U', $PgUser, '-d', 'postgres',
    '--format=custom', '--no-owner', "--file=/out/$name")
  foreach ($s in $schemas) { $dumpArgs += "--schema=$s" }
  & docker $dumpArgs | Out-Host
  $path = Join-Path $OutDir $name
  $good = ($LASTEXITCODE -eq 0) -and (Test-Path $path) -and ((Get-Item $path).Length -gt 0)
  if (-not $good -and (Test-Path $path)) { Remove-Item $path -Force }
  return $good
}

$ok = $false
$extraOk = $false
try {
  Write-Host "Backing up shop data to $mainFile ..."
  if (Invoke-Dump $mainName @('public')) {
    $list = docker run --rm -v "${OutDir}:/out" postgres:17 pg_restore --list "/out/$mainName"
    $tables = @($list | Where-Object { $_ -match ' TABLE DATA public ' }).Count
    $funcs = @($list | Where-Object { $_ -match ' FUNCTION public ' }).Count
    $policies = @($list | Where-Object { $_ -match ' POLICY public ' }).Count
    $ok = $tables -gt 0
    if (-not $ok) { Remove-Item $mainFile -Force }
  }
  if ($ok) {
    Write-Host 'Backing up login accounts and the list of stored files ...'
    $extraOk = Invoke-Dump $extraName @('auth', 'storage')
  }
}
finally {
  if (-not $hadPassword) { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
  Remove-Item Env:PGSSLMODE -ErrorAction SilentlyContinue
}

Write-Host ''
if (-not $ok) {
  Write-Host 'BACKUP FAILED. No file was kept. Read the text above:'
  Write-Host '  "password authentication failed" = wrong password or user'
  Write-Host '  "could not translate host name"  = wrong host'
  Write-Host '  "permission denied"              = send the text to Claude'
  Write-Host '  "docker: ..."                    = Docker Desktop is not running'
  exit 1
}

$kb = [math]::Round((Get-Item $mainFile).Length / 1KB)
Write-Host "BACKUP OK (shop data)  $mainFile  ($kb KB)"
Write-Host "  tables with data: $tables   functions: $funcs   policies: $policies"
if ($extraOk) {
  Write-Host "BACKUP OK (login accounts + file list)  $extraFile"
} else {
  Write-Host 'NOT backed up: login accounts and the file list (see the text above).'
  Write-Host '  The shop data file above is complete without them.'
}
Write-Host 'NOT in this backup: the files in Storage (pictures, receipts, photos).'
exit 0
