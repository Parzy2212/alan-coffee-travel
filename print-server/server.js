'use strict'

// AlanPOS Print Server v1.0
// Listens on http://127.0.0.1:12345
// Receives raw ESC/POS binary from browser, writes to Windows USB printer port.
// Optionally forwards to a WiFi printer via TCP when X-Printer-IP header is set.

const http = require('http')
const net  = require('net')
const fs   = require('fs')
const os   = require('os')
const path = require('path')
const { execFile } = require('child_process')

const PORT         = 12345
const USB_PORTS    = ['USB001', 'USB002', 'USB003', 'USB004', 'USB005']
const WIFI_PORT    = 9100  // standard raw ESC/POS TCP port on network printers

let cachedUsbPort = null

// ── USB printing via Windows copy command ─────────────────────────────────────

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
      socket.write(data, () => {
        socket.end()
        resolve()
      })
    })
    socket.on('error', (e) => reject(new Error(`TCP ${ip}:${WIFI_PORT} — ${e.message}`)))
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Printer-IP')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  if (req.method === 'GET' && req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, version: '1.0.0', usbPort: cachedUsbPort }))
    return
  }

  if (req.method === 'POST' && req.url === '/print') {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end', async () => {
      const data      = Buffer.concat(chunks)
      const printerIp = req.headers['x-printer-ip'] || ''

      try {
        if (printerIp) {
          await printToTcp(data, printerIp)
          console.log(`[alan-pos] Printed via WiFi TCP ${printerIp}`)
        } else {
          await printToUsb(data)
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      } catch (err) {
        console.error('[alan-pos] Print failed:', err.message)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: err.message }))
      }
    })
    return
  }

  res.writeHead(404)
  res.end()
})

server.listen(PORT, '127.0.0.1', () => {
  console.log('╔══════════════════════════════════════╗')
  console.log('║   AlanPOS Print Server v1.0          ║')
  console.log(`║   http://127.0.0.1:${PORT}           ║`)
  console.log('║   พร้อมรับงานพิมพ์แล้ว...           ║')
  console.log('╚══════════════════════════════════════╝')
})

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} ถูกใช้งานอยู่แล้ว — print server อาจกำลังทำงานอยู่`)
  } else {
    console.error('Server error:', err.message)
  }
  process.exit(1)
})
