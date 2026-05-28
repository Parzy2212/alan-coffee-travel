'use strict'

// AlanPOS Print Server v2.0
// Named-printer path: RAW ESC/POS bytes via Win32 winspool.drv P/Invoke
// USB path: raw binary via `copy /b` (direct port, no GDI driver)
// WiFi path: raw TCP socket to port 9100

const http = require('http')
const net  = require('net')
const fs   = require('fs')
const os   = require('os')
const path = require('path')
const { execFile } = require('child_process')

const PORT      = 12345
const USB_PORTS = Array.from({ length: 20 }, (_, i) => `USB${String(i + 1).padStart(3, '0')}`)
const WIFI_PORT = 9100

let cachedUsbPort = null

// ── ESC/POS test job ──────────────────────────────────────────────────────────

function buildRawTestJob(paperMm = 80) {
  const ESC = 0x1B
  const GS  = 0x1D
  const W   = paperMm === 58 ? 32 : 48
  const div = (c) => Buffer.from(c.repeat(W) + '\n', 'ascii')
  const cen = (s) => Buffer.from(s.padStart(Math.floor((W + s.length) / 2)).padEnd(W) + '\n', 'ascii')
  const lft = (s) => Buffer.from(s + '\n', 'ascii')
  return Buffer.concat([
    Buffer.from([ESC, 0x40]),
    Buffer.from([ESC, 0x61, 0x01]),
    div('='),
    cen('ALAN POS - TEST PRINT'),
    cen(`${paperMm}mm / Font A / ${W} chars`),
    cen('RAW ESC/POS via winspool.drv'),
    div('='),
    Buffer.from([ESC, 0x61, 0x00]),
    lft('Printer: OK'),
    lft('Spooler: OK (RAW)'),
    lft('Driver:  OK'),
    div('='),
    Buffer.from('\n\n\n\n', 'ascii'),
    Buffer.from([GS, 0x56, 0x01]),
  ])
}

// ── Named-printer via Win32 winspool.drv RAW P/Invoke ────────────────────────
// ESC/POS bytes go directly to the printer; it renders text with its native Font A.
// OpenPrinter → StartDocPrinter("RAW") → WritePrinter → EndDocPrinter

function printRawByName(data, printerName) {
  return new Promise((resolve, reject) => {
    const ts       = Date.now()
    const bin      = path.join(os.tmpdir(), `alan_pos_${ts}.bin`)
    const ps1      = path.join(os.tmpdir(), `alan_pos_${ts}.ps1`)
    const safeName = printerName.replace(/'/g, "''")

    try { fs.writeFileSync(bin, data) } catch (e) { return reject(e) }

    const script = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class WinSpool {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }
    [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi)]
    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);
    [DllImport("winspool.Drv", EntryPoint="ClosePrinter")]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi)]
    public static extern int StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
    [DllImport("winspool.Drv", EntryPoint="EndDocPrinter")]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
}
'@
$bytes = [System.IO.File]::ReadAllBytes('${bin}')
$hPrinter = [IntPtr]::Zero
if (-not [WinSpool]::OpenPrinter('${safeName}', [ref]$hPrinter, [IntPtr]::Zero)) {
    throw "OpenPrinter failed: error $([System.Runtime.InteropServices.Marshal]::GetLastWin32Error())"
}
try {
    $di = New-Object WinSpool+DOCINFOA
    $di.pDocName  = 'AlanPOS'
    $di.pDataType = 'RAW'
    $jobId = [WinSpool]::StartDocPrinter($hPrinter, 1, $di)
    if ($jobId -le 0) { throw "StartDocPrinter failed: error $([System.Runtime.InteropServices.Marshal]::GetLastWin32Error())" }
    $ptr = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
    try {
        [System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $ptr, $bytes.Length)
        $written = 0
        if (-not [WinSpool]::WritePrinter($hPrinter, $ptr, $bytes.Length, [ref]$written)) {
            throw "WritePrinter failed: error $([System.Runtime.InteropServices.Marshal]::GetLastWin32Error())"
        }
    } finally {
        [System.Runtime.InteropServices.Marshal]::FreeHGlobal($ptr)
    }
    [WinSpool]::EndDocPrinter($hPrinter) | Out-Null
    Write-Output "OK $written"
} finally {
    [WinSpool]::ClosePrinter($hPrinter) | Out-Null
}
`.trim()

    try { fs.writeFileSync(ps1, script, 'utf8') } catch (e) { return reject(e) }

    execFile(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1],
      (err, stdout, stderr) => {
        try { fs.unlinkSync(bin) } catch {}
        try { fs.unlinkSync(ps1) } catch {}
        if (err) return reject(new Error(`Print failed: ${stderr.trim() || err.message}`))
        if (!stdout.trim().startsWith('OK')) return reject(new Error(`Spool error: ${stdout.trim() || stderr.trim()}`))
        resolve()
      }
    )
  })
}

async function printByName(data, printerName, paperMm = 80) {
  console.log(`[alan-pos] printByName printer="${printerName}" paperMm=${paperMm} bytes=${data.length}`)
  await printRawByName(data, printerName)
  console.log(`[alan-pos] Printed "${printerName}" via RAW winspool (${paperMm}mm)`)
}

// ── USB printing via Windows copy /b ─────────────────────────────────────────

function tryUsbPort(portName, data) {
  return new Promise((resolve, reject) => {
    const tmp = path.join(os.tmpdir(), `alan_pos_${Date.now()}.bin`)
    fs.writeFileSync(tmp, data)
    execFile('cmd.exe', ['/c', `copy /b "${tmp}" ${portName}: >nul 2>&1`], (err) => {
      try { fs.unlinkSync(tmp) } catch {}
      if (err) reject(new Error(`${portName} failed`))
      else resolve(portName)
    })
  })
}

async function printToUsb(data) {
  if (cachedUsbPort) {
    try {
      await tryUsbPort(cachedUsbPort, data)
      return
    } catch {
      cachedUsbPort = null
    }
  }
  for (const port of USB_PORTS) {
    try {
      await tryUsbPort(port, data)
      cachedUsbPort = port
      console.log(`[alan-pos] Printed via ${port}`)
      return
    } catch { /* try next */ }
  }
  throw new Error(`No USB printer port found. Tried: ${USB_PORTS.join(', ')}`)
}

// ── WiFi/TCP printing ─────────────────────────────────────────────────────────

function printToTcp(data, ip) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket()
    socket.setTimeout(5000)
    socket.connect(WIFI_PORT, ip, () => {
      socket.write(data, () => { socket.end(); resolve() })
    })
    socket.on('error', e => reject(new Error(`TCP ${ip}:${WIFI_PORT} — ${e.message}`)))
    socket.on('timeout', () => {
      socket.destroy()
      reject(new Error(`TCP timeout connecting to ${ip}:${WIFI_PORT}`))
    })
  })
}

// ── HTTP server ───────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Printer-IP, X-Printer-Name, X-Paper-Width')
  res.setHeader('Access-Control-Allow-Private-Network', 'true')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  if (req.method === 'GET' && req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, version: '2.0.0', usbPort: cachedUsbPort }))
    return
  }

  if (req.method === 'GET' && req.url === '/printers') {
    execFile(
      'powershell',
      ['-NoProfile', '-Command', 'Get-Printer | Select-Object -ExpandProperty Name'],
      (err, stdout, stderr) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: stderr.trim() || err.message }))
          return
        }
        const printers = stdout.split('\n').map(l => l.trim()).filter(Boolean)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, printers }))
      }
    )
    return
  }

  // GET /test-ascii?printer=XP-T80A&width=80
  if (req.method === 'GET' && req.url.startsWith('/test-ascii')) {
    const qs          = new URL(req.url, 'http://localhost').searchParams
    const printerName = qs.get('printer') || ''
    const paperMm     = parseInt(qs.get('width') || '80', 10)
    const testData    = buildRawTestJob(paperMm)

    try {
      if (printerName) {
        await printRawByName(testData, printerName)
      } else {
        await printToUsb(testData)
      }
      console.log(`[alan-pos] RAW test sent to "${printerName || 'USB auto-detect'}"`)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, msg: 'RAW test job sent', printer: printerName || 'USB auto-detect' }))
    } catch (err) {
      console.error('[alan-pos] Test failed:', err.message)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: err.message }))
    }
    return
  }

  if (req.method === 'POST' && req.url === '/print') {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end', async () => {
      const data        = Buffer.concat(chunks)
      const printerIp   = req.headers['x-printer-ip']   || ''
      const printerName = req.headers['x-printer-name'] || ''
      const paperMm     = parseInt(req.headers['x-paper-width'] || '80', 10)

      let sent = false
      try {
        if (printerName) {
          await printByName(data, printerName, paperMm)
        } else if (printerIp) {
          await printToTcp(data, printerIp)
          console.log(`[alan-pos] Printed via WiFi TCP ${printerIp} (${paperMm}mm)`)
        } else {
          await printToUsb(data)
          console.log(`[alan-pos] Printed via USB auto-detect (${paperMm}mm)`)
        }
        sent = true
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, paperMm }))
      } catch (err) {
        console.error('[alan-pos] Print failed:', err.message)
        if (!sent) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: err.message }))
        }
      }
    })
    return
  }

  res.writeHead(404)
  res.end()
})

server.listen(PORT, '127.0.0.1', () => {
  console.log('╔══════════════════════════════════════╗')
  console.log('║   AlanPOS Print Server v2.0          ║')
  console.log(`║   http://127.0.0.1:${PORT}           ║`)
  console.log('║   RAW ESC/POS mode (winspool.drv)    ║')
  console.log('╚══════════════════════════════════════╝')
})

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use — print server may already be running`)
  } else {
    console.error('Server error:', err.message)
  }
  process.exit(1)
})
