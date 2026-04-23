'use strict'

// AlanPOS Print Server v1.1
// Listens on http://127.0.0.1:12345
// Named-printer path: strips ESC/POS bytes → plain text → Out-Printer
// USB path: raw binary via `copy /b` (direct port, no GDI driver)
// WiFi path: raw TCP socket to port 9100

const http = require('http')
const net  = require('net')
const fs   = require('fs')
const os   = require('os')
const path = require('path')
const { execFile } = require('child_process')

const PORT      = 12345
const USB_PORTS = ['USB001', 'USB002', 'USB003', 'USB004', 'USB005']
const WIFI_PORT = 9100

let cachedUsbPort = null

// ── Thai label → ASCII substitution table ────────────────────────────────────
// Courier New has no Thai glyphs — replace known receipt labels with English.
// Longer strings must come before shorter ones to avoid partial replacements.
const THAI_MAP = [
  // Footer
  ['ขอบคุณที่ใช้บริการ', 'THANK YOU FOR VISITING'],
  // Totals
  ['ยอดสุทธิ',           'TOTAL'],
  ['ยอดรวม',             'SUBTOTAL'],
  ['ส่วนลด',             'DISCOUNT'],
  // Payment labels
  ['ชำระด้วย:',          'PAYMENT:'],
  ['ชำระด้วย',           'PAYMENT'],
  ['เงินทอน:',           'CHANGE:'],
  ['เงินทอน',            'CHANGE'],
  ['รับมา:',             'RECEIVED:'],
  ['รับมา',              'RECEIVED'],
  // Payment methods
  ['เงินสด',             'CASH'],
  ['โอนเงิน',            'TRANSFER'],
  // Queue
  ['** คิว / QUEUE **',  '** QUEUE **'],
  ['คิว',                'QUEUE'],
  // Staff
  ['พนักงาน:',           'STAFF:'],
  ['พนักงาน',            'STAFF'],
  // Generic thank-you
  ['ขอบคุณ',             'THANK YOU'],
  // Special chars not in Courier New
  ['\u00B7', '-'],   // · middle dot
  ['\u2022', '*'],   // • bullet
  ['\u00D7', 'x'],   // × multiplication sign
  ['\u2013', '-'],   // – en dash
  ['\u2014', '-'],   // — em dash
]

function applyThaiMap(text) {
  let out = text
  for (const [thai, ascii] of THAI_MAP) out = out.split(thai).join(ascii)
  return out
}

// Re-format two-column lines after Thai→ASCII label substitution.
// Thai labels are shorter in TIS-620 bytes than their ASCII replacements, so
// the original spacing (computed client-side for Thai byte widths) is too wide.
// Detect lines with pattern "label  <2+ spaces>  price" and recompute spacing.
function reformatTwoCol(text, W) {
  const re = /^(.+?)\s{2,}(-?[\d,]+)\s*$/
  return text.split('\n').map(ln => {
    const m = ln.match(re)
    if (!m) return ln
    const label = m[1].trimEnd()
    const price = m[2]
    const spaces = W - label.length - price.length
    if (spaces < 1) return label.substring(0, W - price.length - 1) + ' ' + price
    return label + ' '.repeat(spaces) + price
  }).join('\n')
}

// Replace any Unicode Thai chars not handled by THAI_MAP — Courier New has no
// Thai glyphs so they render as boxes. Customization fields may contain arbitrary Thai.
function dropRemainingThai(text) {
  return text.replace(/[\u0E00-\u0E7F]/g, '?')
}

// Truncate any line that still exceeds W chars after all reformatting.
function clampLines(text, W) {
  return text.split('\n').map(ln => {
    if (ln.length > W) {
      console.warn(`[alan-pos] Line overflow (${ln.length}>${W}): "${ln.substring(0, 40)}"`)
      return ln.substring(0, W)
    }
    return ln
  }).join('\n')
}

// ── ESC/POS → plain text converter ───────────────────────────────────────────
// Strips all ESC/GS control sequences and returns a Unicode string.
// TIS-620 high bytes (0xA1-0xFB) are decoded to Unicode Thai U+0E01-U+0E5B.

function escPosToText(buf) {
  const ESC = 0x1B
  const GS  = 0x1D
  const LF  = 0x0A

  let i   = 0
  let out = ''

  while (i < buf.length) {
    const b = buf[i]

    if (b === ESC) {
      const cmd = buf[i + 1]
      if      (cmd === 0x40) i += 2           // ESC @  reset
      else if (cmd === 0x61) i += 3           // ESC a N  align
      else if (cmd === 0x74) i += 3           // ESC t N  code page
      else if (cmd === 0x45) i += 3           // ESC E N  bold
      else if (cmd === 0x4D) i += 3           // ESC M N  font
      else if (cmd === 0x21) i += 3           // ESC ! N  font select
      else if (cmd === 0x32) i += 2           // ESC 2    line spacing default
      else if (cmd === 0x33) i += 3           // ESC 3 N  line spacing
      else if (cmd === 0x64) i += 3           // ESC d N  feed N lines
      else                   i += 2           // unknown — skip cmd byte
    } else if (b === GS) {
      const cmd = buf[i + 1]
      if      (cmd === 0x56) i += 3           // GS V N  cut
      else if (cmd === 0x68) i += 3           // GS h N  barcode height
      else if (cmd === 0x77) i += 3           // GS w N  barcode width
      else if (cmd === 0x21) i += 3           // GS ! N  magnify
      else                   i += 2
    } else if (b === LF) {
      out += '\n'
      i++
    } else if (b >= 0x20 && b <= 0x7E) {
      out += String.fromCharCode(b)
      i++
    } else if (b >= 0xA1 && b <= 0xFB) {
      // TIS-620 Thai byte → Unicode: codepoint = byte + 0x0D60
      out += String.fromCodePoint(b + 0x0D60)
      i++
    } else {
      i++ // skip other control / non-printable bytes
    }
  }

  return out
}

// ── Plain-text receipt builder ────────────────────────────────────────────────
// width: 48 for 80mm paper, 32 for 58mm paper

function buildTextTestJob(width = 48) {
  const W       = width
  const center  = s => s.padStart(Math.floor((W + s.length) / 2)).padEnd(W)
  const divider = c => c.repeat(W)

  return [
    divider('='),
    center('ALAN POS - TEST PRINT'),
    divider('='),
    center(`Paper: ${W === 48 ? '80mm (48 chars)' : '58mm (32 chars)'}`),
    center('If you see this, Out-Printer works!'),
    divider('-'),
    'Printer: OK',
    'Spooler: OK',
    'Driver:  OK',
    divider('='),
    '',
    '',
    '',
    '',
  ].join('\r\n')
}

// ── Named-printer via System.Drawing.Printing (GDI, fixed-width font, zero margins) ──
//
// Out-Printer uses Windows default font (~12pt) with large margins → text fills
// only the center 1/3 of 80mm paper.  System.Drawing lets us specify:
//   • Courier New 8pt  — monospace, ~48 chars fit on 80mm at 0 margin
//   • Margins = 0      — no left/right padding
//   • Custom paper size matching the roll width

function printTextByName(text, printerName, paperMm) {
  return new Promise((resolve, reject) => {
    const ts       = Date.now()
    const tmp      = path.join(os.tmpdir(), `alan_pos_${ts}.txt`)
    const ps1      = path.join(os.tmpdir(), `alan_pos_${ts}.ps1`)
    const safeName = printerName.replace(/'/g, "''")
    // Paper width in 1/100 inch: 80mm = 315, 58mm = 228
    const paperW   = (paperMm === 58) ? 228 : 315
    // Estimate height: ~14 hundredths/line + buffer (thermal cuts at content end)
    const lineCount = text.split('\n').length
    const paperH   = Math.max(lineCount * 14 + 150, 300)

    try { fs.writeFileSync(tmp, text, 'utf8') } catch (e) { return reject(e) }

    // PS uses $script: scope so event handler can read the variables.
    // Single-quoted strings: backslashes are literal — no escaping needed for paths.
    const script = `
Add-Type -AssemblyName System.Drawing
$script:pLines = [System.IO.File]::ReadAllLines('${tmp}', [System.Text.Encoding]::UTF8)
$script:pFont  = New-Object System.Drawing.Font('Courier New', 8, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Point)
$pd = New-Object System.Drawing.Printing.PrintDocument
$pd.PrinterSettings.PrinterName = '${safeName}'
$pd.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
$pd.DefaultPageSettings.PaperSize = New-Object System.Drawing.Printing.PaperSize('Receipt', ${paperW}, ${paperH})
$pd.add_PrintPage({
    param($s, $e)
    $lh = [Math]::Max($script:pFont.GetHeight($e.Graphics), 8)
    $y  = [float]0
    foreach ($ln in $script:pLines) {
        $e.Graphics.DrawString($ln, $script:pFont, [System.Drawing.Brushes]::Black, [float]0, $y)
        $y += $lh
    }
    $e.HasMorePages = $false
})
$pd.Print()
$script:pFont.Dispose()
$pd.Dispose()
Write-Output 'OK'
`.trim()

    try { fs.writeFileSync(ps1, script, 'utf8') } catch (e) { return reject(e) }

    execFile(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1],
      (err, stdout, stderr) => {
        try { fs.unlinkSync(tmp) } catch {}
        try { fs.unlinkSync(ps1) } catch {}
        if (err) return reject(new Error(`Print failed: ${stderr.trim() || err.message}`))
        if (!stdout.trim().includes('OK')) return reject(new Error(`Spool error: ${stdout.trim() || stderr.trim()}`))
        resolve()
      }
    )
  })
}

async function printByName(data, printerName, paperMm = 80) {
  const W = paperMm === 58 ? 32 : 48
  console.log(`[alan-pos] printByName paperMm=${paperMm} W=${W}`)
  let text = escPosToText(data)
  text = applyThaiMap(text)           // known Thai labels → ASCII
  text = reformatTwoCol(text, W)      // fix two-col spacing after label expansion
  text = dropRemainingThai(text)      // remaining Thai glyphs → '?' (Courier New has none)
  text = clampLines(text, W)          // final safety clamp
  text.split('\n').forEach((ln, i) => {
    const flag = ln.length > W ? ' *** OVERFLOW ***' : ''
    console.log(`[alan-pos] L${String(i + 1).padStart(2, '0')} (${ln.length}/${W}): "${ln}"${flag}`)
  })
  await printTextByName(text, printerName, paperMm)
  console.log(`[alan-pos] Printed "${printerName}" via System.Drawing (${paperMm}mm)`)
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
  // Chrome Private Network Access: required when an https page calls http://127.0.0.1
  res.setHeader('Access-Control-Allow-Private-Network', 'true')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  if (req.method === 'GET' && req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, version: '1.1.0', usbPort: cachedUsbPort }))
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

  // GET /test-ascii?printer=XP-T80A&width=80 — sends plain-text test job via Out-Printer
  if (req.method === 'GET' && req.url.startsWith('/test-ascii')) {
    const qs          = new URL(req.url, 'http://localhost').searchParams
    const printerName = qs.get('printer') || ''
    const paperMm     = parseInt(qs.get('width') || '80', 10)
    const charWidth   = paperMm === 58 ? 32 : 48
    const testText    = buildTextTestJob(charWidth)

    try {
      if (printerName) {
        await printTextByName(testText, printerName, paperMm)
      } else {
        // Fall back to USB raw for port-based printers
        await printToUsb(Buffer.from(testText, 'ascii'))
      }
      console.log(`[alan-pos] Text test sent to "${printerName || 'USB auto-detect'}"`)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, msg: 'Text test job sent', printer: printerName || 'USB auto-detect' }))
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
  console.log('║   AlanPOS Print Server v1.1          ║')
  console.log(`║   http://127.0.0.1:${PORT}           ║`)
  console.log('║   Out-Printer mode (GDI-safe)        ║')
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
