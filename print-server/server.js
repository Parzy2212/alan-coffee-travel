'use strict'

const express = require('express')
const cors    = require('cors')
const { ThermalPrinter, PrinterTypes, CharacterSet } = require('node-thermal-printer')

const app  = express()
const PORT = 12345

// ── Config ────────────────────────────────────────────────────────────────────
// Set PRINTER_INTERFACE env var to override.
// Windows USB (driver installed): "printer:XP-58"  ← change to your printer name
// Network printer:                "tcp://192.168.1.100"
// Linux USB direct:               "/dev/usb/lp0"
const PRINTER_INTERFACE = process.env.PRINTER_INTERFACE || 'printer:XP-58'
const WIDTH = 32   // 58mm paper = 32 chars at standard font

app.use(cors({ origin: '*' }))
app.use(express.json())

// ── Helpers ───────────────────────────────────────────────────────────────────

function padR(str, len) {
  const s = String(str ?? '')
  return s.length >= len ? s.substring(0, len) : s + ' '.repeat(len - s.length)
}

function twoCol(left, right) {
  const l = String(left  ?? '')
  const r = String(right ?? '')
  const spaces = WIDTH - l.length - r.length
  return l + (spaces > 0 ? ' '.repeat(spaces) : ' ') + r
}

function fmtLak(n) {
  return Number(n || 0).toLocaleString('en-US')
}

function makePrinter() {
  return new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: PRINTER_INTERFACE,
    // PC874_THAI = TIS-620 code page for Thai text (code page 20)
    // Change to CharacterSet.PC437_USA if your printer does not support Thai
    characterSet: CharacterSet.PC874_THAI,
    removeSpecialCharacters: false,
    lineCharacter: '-',
    options: { timeout: 3000 },
  })
}

// ── POST /print ───────────────────────────────────────────────────────────────
// Expected body:
// {
//   shop_name, queue, receipt, table, customer,
//   cartSnapshot: [{ qty, recipe: { product_name, price_lak }, customization }],
//   subtotal, discountAmt, discount_reason, finalTotal,
//   method, received, change, vat_percent
// }

app.post('/print', async (req, res) => {
  const d = req.body
  if (!d || !Array.isArray(d.cartSnapshot)) {
    return res.status(400).json({ error: 'Invalid receipt data: missing cartSnapshot' })
  }

  let printer
  try {
    printer = makePrinter()
  } catch (e) {
    return res.status(500).json({ error: 'Cannot init printer: ' + e.message })
  }

  try {
    const shopName = (d.shop_name || 'ALAN COFFEE & TRAVEL').substring(0, WIDTH)
    const now      = new Date()
    const dateStr  = now.toLocaleDateString('en-GB')    // DD/MM/YYYY
    const timeStr  = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    const payLabel = d.method === 'cash' ? 'เงินสด'
                   : d.method === 'qr'   ? 'QR Code'
                   : 'โอนเงิน'
    const sep1 = '='.repeat(WIDTH)
    const sep2 = '-'.repeat(WIDTH)

    // ── Header
    printer.alignCenter()
    printer.bold(true)
    printer.println(shopName)
    printer.bold(false)
    printer.println(sep1)
    printer.println(`${dateStr} ${timeStr}`)

    const orderParts = [`Order #${d.receipt || '—'}`]
    if (d.table) orderParts.push(`Table: ${d.table}`)
    printer.println(orderParts.join('  '))

    // ── Items
    printer.alignLeft()
    printer.println(sep2)

    for (const item of d.cartSnapshot) {
      const name  = item.recipe?.product_name || '?'
      const price = fmtLak((item.recipe?.price_lak || 0) * item.qty)
      const qty   = `x${item.qty}`

      // Row 1: "Americano เย็น         x1"
      const nameWidth = WIDTH - qty.length - 1
      printer.println(padR(name, nameWidth) + ' ' + qty)

      // Row 2: "  หวานน้อย          15,000"
      const cust = item.customization ? `  ${item.customization}` : ''
      const custWidth = WIDTH - price.length - 1
      printer.println(padR(cust, custWidth) + ' ' + price)
    }

    // ── Totals
    printer.println(sep2)
    printer.println(twoCol('ยอดรวม', fmtLak(d.subtotal)))

    if (Number(d.discountAmt) > 0) {
      const lbl = d.discount_reason ? `ส่วนลด (${d.discount_reason})` : 'ส่วนลด'
      printer.println(twoCol(lbl, fmtLak(d.discountAmt)))
    } else {
      printer.println(twoCol('ส่วนลด', '0'))
    }

    printer.bold(true)
    printer.println(twoCol('ยอดสุทธิ', fmtLak(d.finalTotal)))
    printer.bold(false)

    // ── Payment
    printer.println(sep1)
    printer.println(twoCol('ชำระด้วย:', payLabel))
    if (d.method === 'cash' && Number(d.received) > 0) {
      printer.println(twoCol('รับมา:', fmtLak(d.received)))
      printer.println(twoCol('เงินทอน:', fmtLak(d.change)))
    }

    // ── Footer
    printer.println(sep1)
    printer.alignCenter()
    printer.println('ขอบคุณที่ใช้บริการ')
    printer.println('Thank you & come back')
    printer.println(sep1)
    printer.cut()

    await printer.execute()
    console.log(`[PRINT] Receipt ${d.receipt || '—'} queue #${d.queue || '—'} printed OK`)
    res.json({ success: true })

  } catch (err) {
    console.error('[PRINT ERROR]', err.message)
    res.status(500).json({ error: err.message || 'Print failed' })
  }
})

// ── GET /status ───────────────────────────────────────────────────────────────

app.get('/status', async (req, res) => {
  try {
    const printer   = makePrinter()
    const connected = await printer.isPrinterConnected().catch(() => false)
    res.json({ connected, interface: PRINTER_INTERFACE })
  } catch (e) {
    res.json({ connected: false, error: e.message })
  }
})

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  Print server  →  http://localhost:${PORT}`)
  console.log(`  Interface:       ${PRINTER_INTERFACE}`)
  console.log(`  POST /print      send receipt JSON`)
  console.log(`  GET  /status     check printer connection\n`)
  console.log(`  To change printer name:`)
  console.log(`    set PRINTER_INTERFACE=printer:YourPrinterName && node server.js\n`)
})
