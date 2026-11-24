# ============================================================
#  รัน migration บนฐานข้อมูลจริง ทีละขั้น พร้อมบันทึกผล
#
#  วิธีใช้ (เปิด PowerShell ธรรมดา ไม่ใช่ใน Claude Code, เปิด Docker Desktop ไว้ก่อน):
#    cd D:\alan-coffee-travel
#    powershell -ExecutionPolicy Bypass -File .\scripts\run-migration.ps1 073
#
#  สคริปต์จะถาม 3 อย่าง (หาได้ที่ Supabase -> ปุ่ม "Connect" ด้านบน -> "Session pooler"):
#    host     เช่น aws-0-xxxx.pooler.supabase.com
#    user     กด Enter = postgres.fmsdfcsqdpdlppucuptn
#    รหัสผ่านฐานข้อมูล  พิมพ์แล้วไม่ขึ้นบนจอ ใช้ครั้งเดียวทั้งสคริปต์ ไม่ถูกเก็บลงไฟล์
#
#  ขั้นตอนที่สคริปต์ทำ (หยุดทันทีถ้าขั้นไหนไม่ผ่าน):
#    1. หาไฟล์ตามเลข: docs\check-073-*.sql (มีหรือไม่มีก็ได้), docs\test-073-*.sql และ
#       supabase\migrations\073_*.sql (ต้องมีอย่างละ 1 ไฟล์พอดี)
#    2. สำรองข้อมูล (scripts\backup-db.ps1) ไปไว้ที่ D:\alan-backups
#    3. รันไฟล์ check (บังคับอ่านอย่างเดียว) แสดงผล แล้วถามว่าไปต่อไหม (y/n)
#    4. รันไฟล์ test (ครอบด้วยการย้อนกลับ ไม่เปลี่ยนข้อมูล) นับ PASS/FAIL
#       มี FAIL หรือไม่มี PASS เลย = หยุด; สำเนา migration ในไฟล์ test ต้องตรงกับไฟล์ migration
#    5. ถามให้พิมพ์ yes เต็มคำ แล้วรัน migration จริง (หยุดที่ error แรก; ถ้าไฟล์ไม่มี
#       BEGIN/COMMIT ของตัวเอง จะรันเป็นก้อนเดียว พังกลางทาง = ไม่มีอะไรเปลี่ยน)
#    ทุกขั้นบันทึกลง D:\alan-hq\office\migration-log.md (ไม่มีรหัสผ่าน) ให้ Claude อ่านเองได้
#    เลขที่เคยรันสำเร็จแล้วจะไม่รันซ้ำ ถ้าตั้งใจรันซ้ำจริงให้เติม -Again ท้ายคำสั่ง
#    ช่อง host ใส่แค่ชื่อ ห้ามวางทั้งบรรทัด postgresql://... (บรรทัดนั้นอาจมีรหัสผ่าน)
#
#  ตัวเลือกสำหรับทดสอบกับสำเนาในเครื่องเท่านั้น: -PgHost -PgUser -Database -SslMode -BackupDir -LogPath
#  (ถ้ามี PGPASSWORD ตั้งไว้ก่อนแล้ว จะไม่ถามรหัส แบบเดียวกับ backup-db.ps1)
# ============================================================

param(
  [Parameter(Mandatory = $true, Position = 0)][string]$Number,
  [string]$PgHost,
  [string]$PgUser,
  [int]$Port = 5432,
  [string]$Database = 'postgres',
  [string]$SslMode = 'require',
  [string]$BackupDir = 'D:\alan-backups',
  [string]$LogPath = 'D:\alan-hq\office\migration-log.md',
  [switch]$Again
)

[Console]::OutputEncoding = [Text.Encoding]::UTF8
$repo = Split-Path -Parent $PSScriptRoot
$utf8 = New-Object Text.UTF8Encoding($false)

function Write-Log([string]$text) {
  $dir = Split-Path -Parent $LogPath
  if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
  [IO.File]::AppendAllText($LogPath, $text + "`r`n", $utf8)
}
function Stop-Run([string]$why) {
  Write-Host ''
  Write-Host "หยุด: $why" -ForegroundColor Red
  Write-Log "**ผล: หยุด** — $why"
  Write-Log ''
  exit 1
}

# runs one .sql file through psql in Docker; returns @{ Code; Lines }
# mode: 'check' = inside a READ ONLY transaction then ROLLBACK (a check file that writes fails);
#       'test'  = inside BEGIN ... ROLLBACK, so a test file that forgot its final RAISE still changes nothing;
#       'run'   = the real migration
function Invoke-SqlFile([string]$file, [string]$mode, [bool]$singleTx) {
  $rel = $file.Substring($repo.Length + 1).Replace('\', '/')
  $psqlArgs = @('run', '--rm', '-e', 'PGPASSWORD', '-e', 'PGSSLMODE', '-e', 'PGCLIENTENCODING=UTF8',
    '-v', "${repo}:/repo:ro", 'postgres:17',
    'psql', '-h', $PgHost, '-p', "$Port", '-U', $PgUser, '-d', $Database, '-X')
  switch ($mode) {
    'check' { $psqlArgs += @('-v', 'ON_ERROR_STOP=1', '-c', 'BEGIN READ ONLY', '-f', "/repo/$rel", '-c', 'ROLLBACK') }
    'test'  { $psqlArgs += @('-c', 'BEGIN', '-f', "/repo/$rel", '-c', 'ROLLBACK') }
    default { $psqlArgs += @('-v', 'ON_ERROR_STOP=1', '-f', "/repo/$rel"); if ($singleTx) { $psqlArgs += '--single-transaction' } }
  }
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $lines = @(& docker $psqlArgs 2>&1 | ForEach-Object { "$_" })
  $code = $LASTEXITCODE
  $ErrorActionPreference = $prev
  return @{ Code = $code; Lines = $lines }
}

function Find-One([string]$dir, [string]$pattern, [bool]$required, [string]$what) {
  $found = @(Get-ChildItem -Path (Join-Path $repo $dir) -Filter $pattern -File -ErrorAction SilentlyContinue)
  if ($found.Count -gt 1) {
    Stop-Run ("เจอไฟล์ $what มากกว่า 1 ไฟล์ ($($found.Name -join ', ')) ไม่รู้จะใช้ไฟล์ไหน")
  }
  if ($found.Count -eq 0) {
    if ($required) { Stop-Run "ไม่เจอไฟล์ $what ($dir\$pattern)" }
    return $null
  }
  return $found[0].FullName
}

if ($Number -notmatch '^\d{3}$') {
  Write-Host 'ใส่เลข migration 3 หลัก เช่น 073' -ForegroundColor Red
  exit 1
}

Write-Log ''
Write-Log "## $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') — migration $Number"

# 1) files
$check = Find-One 'docs' "check-$Number-*.sql" $false 'check'
$test  = Find-One 'docs' "test-$Number-*.sql" $true 'test'
$mig   = Find-One 'supabase\migrations' "${Number}_*.sql" $true 'migration'
$names = "check: $(if ($check) { Split-Path -Leaf $check } else { '(ไม่มี)' }) · test: $(Split-Path -Leaf $test) · migration: $(Split-Path -Leaf $mig)"
Write-Host "ไฟล์ที่จะใช้ — $names"
Write-Log "- ไฟล์: $names"

# a test built by scripts/build-migration-test.sh carries a copy of the migration: it must be the
# file that will run, or the test proved an older text
$norm = { param($t) ($t -replace "`r", '').Trim() }
$testText = [IO.File]::ReadAllText($test)
if ($testText.Contains('$body$')) {
  if (-not (& $norm $testText).Contains((& $norm ([IO.File]::ReadAllText($mig))))) {
    Stop-Run 'ไฟล์ test มีสำเนา migration ที่ไม่ตรงกับไฟล์ migration ปัจจุบัน (ต้องสร้างไฟล์ test ใหม่ก่อน) ให้ Claude แก้'
  }
  Write-Log '- สำเนา migration ในไฟล์ test ตรงกับไฟล์ migration'
}

# already done = do not run again by accident
if ((Test-Path $LogPath) -and ([IO.File]::ReadAllText($LogPath).Contains("**ผล: สำเร็จ** — migration $Number รันแล้ว")) -and -not $Again) {
  Stop-Run "migration $Number เคยรันสำเร็จแล้ว (ดู migration-log.md) ถ้าตั้งใจรันซ้ำจริง ให้เติม -Again ท้ายคำสั่ง"
}

# connection (the password stays in this process only, and is removed at the end)
if (-not $PgHost) { $PgHost = (Read-Host 'Session pooler host').Trim() }
if (-not $PgUser) {
  $PgUser = (Read-Host 'User [postgres.fmsdfcsqdpdlppucuptn]').Trim()
  if (-not $PgUser) { $PgUser = 'postgres.fmsdfcsqdpdlppucuptn' }
}
if (-not $PgHost) { Stop-Run 'ไม่ได้ใส่ host' }
# a pasted connection string (postgresql://user:password@host...) would put the password in the log
if ($PgHost -notmatch '^[A-Za-z0-9.-]+$' -or $PgUser -notmatch '^[A-Za-z0-9._-]+$') {
  Write-Host 'host / user ต้องเป็นชื่ออย่างเดียว เช่น aws-0-xxxx.pooler.supabase.com (ห้ามวางทั้งบรรทัด postgresql://...)' -ForegroundColor Red
  Write-Log '**ผล: หยุด** — host หรือ user ไม่ใช่ชื่ออย่างเดียว (ไม่บันทึกค่าที่พิมพ์)'
  exit 1
}
Write-Log "- ต่อที่: $PgHost / $PgUser / ฐาน $Database"

$hadPassword = [bool]$env:PGPASSWORD
if (-not $hadPassword) {
  $secure = Read-Host 'รหัสผ่านฐานข้อมูล (พิมพ์แล้วไม่ขึ้นบนจอ)' -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  if (-not $env:PGPASSWORD) { Stop-Run 'ไม่ได้ใส่รหัสผ่าน' }
}
$env:PGSSLMODE = $SslMode
$started = Get-Date

try {
  # 2) backup
  Write-Host ''
  Write-Host '== ขั้น 1/4 สำรองข้อมูล ==' -ForegroundColor Cyan
  & (Join-Path $PSScriptRoot 'backup-db.ps1') -PgHost $PgHost -PgUser $PgUser -Port $Port -Database $Database -SslMode $SslMode -OutDir $BackupDir | Out-Host
  $backupOk = $? -and $LASTEXITCODE -eq 0
  # backup-db.ps1 clears it when it ends
  $env:PGSSLMODE = $SslMode
  $latest = Get-ChildItem $BackupDir -Filter 'alan-db_*.dump' -ErrorAction SilentlyContinue | Where-Object { $_.Name -notmatch 'logins' } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  # an older dump in the folder must not pass for this run's backup
  if (-not $backupOk -or -not $latest -or $latest.LastWriteTime -lt $started -or $latest.Length -eq 0) {
    Stop-Run 'สำรองข้อมูลไม่สำเร็จ (ดูข้อความด้านบน) ยังไม่ได้แตะฐานข้อมูล'
  }
  Write-Log "- ขั้น 1 สำรองข้อมูล: สำเร็จ ($($latest.FullName), $([math]::Round($latest.Length / 1KB)) KB)"

  # 3) read-only check
  Write-Host ''
  Write-Host '== ขั้น 2/4 ไฟล์เทียบ (อ่านอย่างเดียว) ==' -ForegroundColor Cyan
  if ($check) {
    $r = Invoke-SqlFile $check 'check' $false
    $r.Lines | ForEach-Object { Write-Host $_ }
    Write-Log "- ขั้น 2 ไฟล์เทียบ $(Split-Path -Leaf $check): exit $($r.Code)"
    Write-Log ''
    Write-Log '```'
    $r.Lines | ForEach-Object { Write-Log $_ }
    Write-Log '```'
    if ($r.Code -ne 0) { Stop-Run 'ไฟล์เทียบรันไม่ผ่าน (ดูข้อความด้านบน) ยังไม่ได้เปลี่ยนอะไร' }
    $ans = (Read-Host 'ดูผลด้านบนแล้ว ไปต่อไหม? (y/n)').Trim().ToLower()
    Write-Log "- ตอบไปต่อหลังไฟล์เทียบ: $(if ($ans -eq 'y') { 'y' } else { '(ไม่ใช่ y)' })"
    if ($ans -ne 'y') { Stop-Run 'บอสตอบไม่ไปต่อหลังไฟล์เทียบ ยังไม่ได้เปลี่ยนอะไร' }
  } else {
    Write-Host 'ไม่มีไฟล์เทียบสำหรับเลขนี้ ข้ามขั้นนี้'
    Write-Log '- ขั้น 2 ไฟล์เทียบ: ไม่มี ข้าม'
  }

  # 4) rollback test: ends with an error on purpose, so only the PASS/FAIL lines decide
  Write-Host ''
  Write-Host '== ขั้น 3/4 ไฟล์ทดสอบ (ย้อนกลับเองทั้งหมด) ==' -ForegroundColor Cyan
  $r = Invoke-SqlFile $test 'test' $false
  $pass = @($r.Lines | Where-Object { $_ -match '^\s*PASS\b' })
  $fail = @($r.Lines | Where-Object { $_ -match '^\s*FAIL\b' })
  $skip = @($r.Lines | Where-Object { $_ -match '^\s*SKIP\b' })
  # the PASS lines must come from the test's own report (its final RAISE ... TEST RESULTS)
  $report = @($r.Lines | Where-Object { $_ -match 'ERROR:.*TEST RESULTS' })
  $r.Lines | ForEach-Object { Write-Host $_ }
  Write-Log "- ขั้น 3 ไฟล์ทดสอบ $(Split-Path -Leaf $test): PASS $($pass.Count) / FAIL $($fail.Count) / SKIP $($skip.Count)"
  Write-Log ''
  Write-Log '```'
  $r.Lines | ForEach-Object { Write-Log $_ }
  Write-Log '```'
  if ($fail.Count -gt 0) { Stop-Run "ไฟล์ทดสอบมี FAIL $($fail.Count) ข้อ ยังไม่ได้รัน migration" }
  if ($pass.Count -eq 0 -or $report.Count -ne 1) { Stop-Run 'ไฟล์ทดสอบไม่มีผลสรุป PASS (น่าจะหยุดกลางทาง ดูข้อความด้านบน) ยังไม่ได้รัน migration' }
  Write-Host "ไฟล์ทดสอบผ่าน: PASS $($pass.Count) ข้อ ไม่มี FAIL$(if ($skip.Count) { " (SKIP $($skip.Count) ข้อ ดูด้านบน)" })" -ForegroundColor Green

  # 5) the real migration
  Write-Host ''
  Write-Host '== ขั้น 4/4 รัน migration จริง ==' -ForegroundColor Cyan
  $ans = (Read-Host "พิมพ์ yes เต็มคำ เพื่อรัน $(Split-Path -Leaf $mig) บนฐานข้อมูลจริง").Trim()
  Write-Log "- ยืนยันก่อนรัน migration: $(if ($ans -ceq 'yes') { 'yes' } else { '(ไม่ใช่ yes)' })"
  if ($ans -cne 'yes') { Stop-Run 'ไม่ได้พิมพ์ yes ยังไม่ได้รัน migration' }
  $own = [regex]::IsMatch([IO.File]::ReadAllText($mig), '(?im)^\s*(BEGIN|COMMIT)\s*;')
  $r = Invoke-SqlFile $mig 'run' (-not $own)
  $r.Lines | ForEach-Object { Write-Host $_ }
  Write-Log "- ขั้น 4 migration $(Split-Path -Leaf $mig): exit $($r.Code) ($(if ($own) { 'ไฟล์มี BEGIN/COMMIT ของตัวเอง' } else { 'รันเป็นก้อนเดียว' }))"
  Write-Log ''
  Write-Log '```'
  $r.Lines | ForEach-Object { Write-Log $_ }
  Write-Log '```'
  if ($r.Code -ne 0) {
    # psql exit 3 = an SQL error inside the script; anything else (lost connection, docker) leaves
    # it unknown whether the final COMMIT got through
    $tail = if ($r.Code -ne 3) { 'การเชื่อมต่อหรือ Docker มีปัญหา ไม่แน่ใจว่าเปลี่ยนไปแล้วหรือยัง ห้ามรันซ้ำ ส่ง migration-log.md ให้ Claude ดู' }
            elseif ($own) { 'ส่วนที่รันไปแล้วก่อน error อาจค้างอยู่ ส่ง migration-log.md ให้ Claude ดู' }
            else { 'ทั้งไฟล์ถูกย้อนกลับ ไม่มีอะไรเปลี่ยน' }
    Stop-Run "migration error ($tail)"
  }
  Write-Host ''
  Write-Host "สำเร็จ: รัน migration $Number บนฐานข้อมูลแล้ว ขั้นต่อไป = push โค้ด" -ForegroundColor Green
  Write-Log "**ผล: สำเร็จ** — migration $Number รันแล้ว"
  Write-Log ''
  exit 0
}
finally {
  if (-not $hadPassword) { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
  Remove-Item Env:PGSSLMODE -ErrorAction SilentlyContinue
}
