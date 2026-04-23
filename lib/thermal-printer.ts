// lib/thermal-printer.ts
// WebUSB ESC/POS thermal printer — Chrome/Edge only.
// Falls back gracefully; call isSupported() before use.

// ── Types ─────────────────────────────────────────────────────────────────────

export type PrintReceiptData = {
  shopName:       string
  queue:          number
  receipt:        string
  table:          string
  customer:       string
  staffName?:     string
  cartSnapshot:   { qty: number; recipe: { product_name: string; price_lak: number }; customization: string }[]
  subtotal:       number
  discountAmt:    number
  discountReason: string
  finalTotal:     number
  method:         string
  received:       number
  change:         number
  vatPct:         number
  footerText?:    string
  phone?:         string
  address?:       string
}

export type ReceiptDesign = {
  showLogo:       boolean   // show shop name header
  showReceiptNum: boolean   // show order # line
  showStaff:      boolean   // show staff name line
  staffName:      string    // staff name value
  showQueueLarge: boolean   // show large queue number box
  showItemPrice:  boolean   // show price on each item line
  extraLine1:     string    // free text line before footer
  extraLine2:     string    // free text line before footer
  blankLines:     number    // blank feed lines at end (1-10)
}

export function getReceiptDesign(): ReceiptDesign {
  const g = (k: string, d: string) => {
    try { return localStorage.getItem(k) ?? d } catch { return d }
  }
  return {
    showLogo:       g('receipt_show_logo',       'true')  === 'true',
    showReceiptNum: g('receipt_show_receipt_num','true')  === 'true',
    showStaff:      g('receipt_show_staff',      'false') === 'true',
    staffName:      g('receipt_staff_name',      ''),
    showQueueLarge: g('receipt_show_queue_large','true')  === 'true',
    showItemPrice:  g('receipt_show_item_price', 'true')  === 'true',
    extraLine1:     g('receipt_extra_line_1',    ''),
    extraLine2:     g('receipt_extra_line_2',    ''),
    blankLines:     Math.min(10, Math.max(1, parseInt(g('receipt_blank_lines', '4'), 10) || 4)),
  }
}

/** Build plain-text receipt string — used for print preview and for the
 *  escPosToText path through the local print server. */
export function buildReceiptText(data: PrintReceiptData, design?: ReceiptDesign): string {
  const d       = design ?? getReceiptDesign()
  const mm      = getPaperWidth()
  const W       = charWidth(mm)
  const PRICE_W = 10
  const NAME_W  = W - PRICE_W - 1  // 37 for 80mm, 21 for 58mm
  const now     = new Date()
  const dateStr = now.toLocaleDateString('en-GB')
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const sep1    = '='.repeat(W)
  const sep2    = '-'.repeat(W)
  const ctr     = (s: string) => {
    const bl = byteLen(s)
    if (bl >= W) return s.substring(0, W)
    return ' '.repeat(Math.floor((W - bl) / 2)) + s
  }
  const tc  = (l: string, r: string) => twoCol(l, r, W)
  const pay = data.method === 'cash' ? 'เงินสด' : data.method === 'qr' ? 'QR Code' : 'โอนเงิน'

  const lines: string[] = []
  const L = (...ss: string[]) => lines.push(...ss)

  if (d.showLogo)       L(ctr(data.shopName.substring(0, W)))
  L(`${dateStr} ${timeStr}`.substring(0, W))
  if (d.showReceiptNum) {
    const orderLine = data.table ? `Order #${data.receipt}  Table: ${data.table}` : `Order #${data.receipt}`
    L(orderLine.substring(0, W))
  }
  if (data.customer)    L(data.customer.substring(0, W))
  if (d.showStaff && (d.staffName || data.staffName)) {
    L(`พนักงาน: ${(d.staffName || data.staffName || '').substring(0, W - 10)}`)
  }

  if (d.showQueueLarge) {
    L(sep1, ctr('** คิว / QUEUE **'), ctr(`#${String(data.queue).padStart(3, '0')}`), sep1)
  }

  L(sep2)
  for (const item of data.cartSnapshot) {
    const nameQty = sanitizeSpecial(item.recipe.product_name + (item.qty > 1 ? ` x${item.qty}` : ''))
    if (d.showItemPrice) {
      L(padR(nameQty, NAME_W) + ' ' + fmtLak((item.recipe.price_lak || 0) * item.qty).padStart(PRICE_W))
    } else {
      L(nameQty.substring(0, W))
    }
    if (item.customization) L(('  ' + sanitizeSpecial(thaiToReceipt(item.customization))).substring(0, W))
  }

  L(sep2)
  L(tc('ยอดรวม', fmtLak(data.subtotal)))
  if (data.discountAmt > 0) {
    const lbl = data.discountReason ? `ส่วนลด (${data.discountReason})` : 'ส่วนลด'
    L(tc(lbl, `-${fmtLak(data.discountAmt)}`))
  }
  L(tc('ยอดสุทธิ', fmtLak(data.finalTotal)))
  L(sep1)
  L(tc('ชำระด้วย:', pay))
  if (data.method === 'cash' && data.received > 0) {
    L(tc('รับมา:', fmtLak(data.received)), tc('เงินทอน:', fmtLak(data.change)))
  }
  L(sep1)
  L(ctr(data.footerText || 'ขอบคุณที่ใช้บริการ'), ctr('Thank you & come back'))
  if (data.address) L(ctr(data.address.substring(0, W)))
  if (data.phone)   L(ctr(data.phone.substring(0, W)))
  if (d.extraLine1) L(ctr(d.extraLine1.substring(0, W)))
  if (d.extraLine2) L(ctr(d.extraLine2.substring(0, W)))
  L(sep1)
  for (let i = 0; i < d.blankLines; i++) L('')

  for (const ln of lines) {
    if (ln.length > W) console.warn(`[thermal-printer] buildReceiptText overflow (${ln.length}>${W}): "${ln.substring(0, 40)}"`)
  }
  return lines.join('\n')
}

export type PrinterStatus = {
  connected:  boolean
  deviceName: string | null
}

type SavedDevice = { vendorId: number; productId: number; name: string }

// ── ESC/POS constants ─────────────────────────────────────────────────────────

const ESC = 0x1B
const GS  = 0x1D
const LF  = 0x0A

const CMD = {
  init:        [ESC, 0x40],
  alignLeft:   [ESC, 0x61, 0x00],
  alignCenter: [ESC, 0x61, 0x01],
  boldOn:      [ESC, 0x45, 0x01],
  boldOff:     [ESC, 0x45, 0x00],
  sizeNormal:  [GS,  0x21, 0x00],
  sizeLarge:   [GS,  0x21, 0x11],  // double width + double height
  codePage874: [ESC, 0x74, 0x15],  // PC874 / TIS-620 Thai
  feed3:       [ESC, 0x64, 0x03],
  cutPartial:  [GS,  0x56, 0x41, 0x10],
}

const WIDTH_58 = 32 // 58mm paper = 32 chars at standard font
const WIDTH_80 = 48 // 80mm paper = 48 chars at standard font

const PAPER_WIDTH_KEY = 'pos_paper_width'

export function getPaperWidth(): 58 | 80 {
  try { return localStorage.getItem(PAPER_WIDTH_KEY) === '80' ? 80 : 58 } catch { return 58 }
}

function charWidth(mm: 58 | 80): number {
  return mm === 80 ? WIDTH_80 : WIDTH_58
}

// ── Thai customization → English converter ────────────────────────────────────
// Converts common Thai customization phrases to English before encoding.
// Longer/more-specific phrases must come before shorter overlapping ones.

function thaiToReceipt(s: string): string {
  return s
    // Separators first
    .replace(/ · /g, ' / ')
    .replace(/ × /g, 'x')
    // Sweetness (specific before generic "ปกติ")
    .replace(/หวานน้อย/g, 'Less sugar')
    .replace(/หวานปกติ/g, 'Normal sugar')
    .replace(/หวานกลาง/g, 'Normal sugar')
    .replace(/หวานมาก/g, 'Extra sugar')
    .replace(/ไม่หวาน/g, 'No sugar')
    // Temperature
    .replace(/เย็น/g, 'Cold')
    .replace(/ร้อน/g, 'Hot')
    .replace(/อุ่น/g, 'Warm')
    // Size (specific before generic "กลาง")
    .replace(/ใหญ่/g, 'Large')
    .replace(/เล็ก/g, 'Small')
    .replace(/กลาง/g, 'Medium')
    // Generic
    .replace(/ปกติ/g, 'Normal')
}

// ── Special-character sanitiser ───────────────────────────────────────────────
// Replace Unicode chars that Courier New / TIS-620 can't render before encoding.

function sanitizeSpecial(s: string): string {
  return s
    .replace(/·/g, 'x')   // U+00B7 middle dot → x (qty separator)
    .replace(/•/g, '*')    // U+2022 bullet
    .replace(/×/g, 'x')   // U+00D7 multiplication sign
    .replace(/–/g, '-')    // U+2013 en dash
    .replace(/—/g, '-')    // U+2014 em dash
}

// ── TIS-620 encoding ──────────────────────────────────────────────────────────
// Thai Unicode U+0E01–U+0E5B → TIS-620 byte = codepoint − 0x0D60
// ASCII < 0x80 pass through. Anything else → 0x3F '?'

function encodeLine(str: string): Uint8Array {
  const bytes: number[] = []
  for (const ch of sanitizeSpecial(str)) {
    const cp = ch.codePointAt(0) ?? 0x3F
    if (cp < 0x80) {
      bytes.push(cp)
    } else if (cp >= 0x0E01 && cp <= 0x0E5B) {
      bytes.push(cp - 0x0D60)
    } else {
      bytes.push(0x3F)
    }
  }
  return new Uint8Array(bytes)
}

// TIS-620 byte length (1 Thai char = 1 byte, same as ASCII)
function byteLen(str: string): number {
  return encodeLine(str).length
}

// Pad string to exactly `len` TIS-620 bytes; truncate with "..." if too long
function padR(str: string, len: number): string {
  const bl = byteLen(str)
  if (bl <= len) return str + ' '.repeat(len - bl)
  // Truncate: fit (len-3) bytes then add "..."
  let s = '', bytes = 0
  for (const ch of str) {
    const cl = byteLen(ch)
    if (bytes + cl > len - 3) break
    s += ch; bytes += cl
  }
  return s + '...' + ' '.repeat(Math.max(0, len - bytes - 3))
}

// Two-column row: label left (clamped to w/2), value right, total = w bytes
function twoCol(left: string, right: string, w: number): string {
  const rLen   = right.length  // right is always ASCII numbers
  const maxL   = Math.floor(w / 2)
  let lStr = left, lLen = byteLen(left)
  if (lLen > maxL) {
    let s = '', bytes = 0
    for (const ch of left) {
      const cl = byteLen(ch)
      if (bytes + cl > maxL) break
      s += ch; bytes += cl
    }
    lStr = s; lLen = bytes
  }
  const spaces = Math.max(1, w - lLen - rLen)
  return lStr + ' '.repeat(spaces) + right
}

function fmtLak(n: number): string {
  return Number(n || 0).toLocaleString('en-US')
}

// ── Byte buffer helpers ───────────────────────────────────────────────────────

function concat(...parts: (number[] | Uint8Array)[]): Uint8Array {
  const arrays = parts.map(p => p instanceof Uint8Array ? p : new Uint8Array(p))
  const total  = arrays.reduce((n, a) => n + a.length, 0)
  const out    = new Uint8Array(total)
  let   pos    = 0
  for (const a of arrays) { out.set(a, pos); pos += a.length }
  return out
}

function line(str: string): Uint8Array {
  return concat(encodeLine(str), [LF])
}

// ── USB device management ─────────────────────────────────────────────────────

// We declare just enough of the WebUSB API types to avoid importing a package.
// Browsers that support WebUSB expose navigator.usb.

interface UsbEndpoint      { direction: string; type: string; endpointNumber: number; packetSize?: number }
interface UsbAlternate     { interfaceClass?: number; interfaceSubclass?: number; interfaceProtocol?: number; alternateSetting?: number; endpoints: UsbEndpoint[] }
interface UsbInterface     { interfaceNumber: number; alternates: UsbAlternate[] }
interface UsbConfiguration { configurationValue?: number; interfaces: UsbInterface[] }
interface UsbDevice {
  vendorId:         number
  productId:        number
  manufacturerName?: string
  productName?:     string
  configurations:   UsbConfiguration[]
  open():           Promise<void>
  close():          Promise<void>
  selectConfiguration(n: number): Promise<void>
  claimInterface(n: number):      Promise<void>
  releaseInterface(n: number):    Promise<void>
  transferOut(ep: number, data: BufferSource): Promise<{ status: string }>
}
interface UsbApi {
  requestDevice(opts: { filters: object[] }): Promise<UsbDevice>
  getDevices(): Promise<UsbDevice[]>
}

function usb(): UsbApi | null {
  if (typeof navigator === 'undefined') return null
  return (navigator as unknown as { usb?: UsbApi }).usb ?? null
}

let _device: UsbDevice | null = null
const STORAGE_KEY = 'pos_usb_printer'

function loadSaved(): SavedDevice | null {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') } catch { return null }
}
function persistDevice(d: UsbDevice): void {
  const s: SavedDevice = {
    vendorId:  d.vendorId,
    productId: d.productId,
    name:      d.productName || d.manufacturerName
            || `USB ${d.vendorId.toString(16).toUpperCase()}:${d.productId.toString(16).toUpperCase()}`,
  }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch { /* ignore */ }
}
function clearPersisted(): void {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}

// Log the full USB descriptor structure so we can diagnose CDC/vendor devices.
function logDeviceStructure(device: UsbDevice): void {
  console.log(`[thermal-printer] Device structure — vendorId: 0x${device.vendorId.toString(16).toUpperCase().padStart(4,'0')} productId: 0x${device.productId.toString(16).toUpperCase().padStart(4,'0')}`)
  for (const cfg of device.configurations) {
    console.log(`  configuration ${cfg.configurationValue ?? '?'} (${cfg.interfaces.length} interfaces)`)
    for (const iface of cfg.interfaces) {
      for (const alt of iface.alternates) {
        console.log(`    interface ${iface.interfaceNumber} alt ${alt.alternateSetting} class 0x${(alt.interfaceClass ?? 0).toString(16).toUpperCase()} sub 0x${(alt.interfaceSubclass ?? 0).toString(16).toUpperCase()} proto 0x${(alt.interfaceProtocol ?? 0).toString(16).toUpperCase()}`)
        for (const ep of alt.endpoints) {
          console.log(`      endpoint ${ep.endpointNumber} dir=${ep.direction} type=${ep.type} pktSize=${ep.packetSize ?? '?'}`)
        }
      }
    }
  }
}

// Scan all configurations/interfaces/alternates for any OUT endpoint.
// Pass 1: bulk-OUT (standard ESC/POS), Pass 2: any OUT (CDC/interrupt-OUT).
function findEndpoint(device: UsbDevice): { interfaceNumber: number; endpointNumber: number } | null {
  for (const wantBulk of [true, false]) {
    for (const cfg of device.configurations) {
      for (const iface of cfg.interfaces) {
        for (const alt of iface.alternates) {
          for (const ep of alt.endpoints) {
            if (ep.direction !== 'out') continue
            if (wantBulk && ep.type !== 'bulk') continue
            console.log(`[thermal-printer] Using endpoint ${ep.endpointNumber} (${ep.type}-OUT) on interface ${iface.interfaceNumber}`)
            return { interfaceNumber: iface.interfaceNumber, endpointNumber: ep.endpointNumber }
          }
        }
      }
    }
  }
  return null
}

async function openDevice(device: UsbDevice): Promise<void> {
  await device.open()
  try { await device.selectConfiguration(1) } catch { /* already at config 1 */ }

  logDeviceStructure(device)

  // Try every interface across every configuration — log results so we can
  // diagnose which interfaces Windows allows vs. blocks.
  const claimed: number[] = []
  for (const cfg of device.configurations) {
    for (const iface of cfg.interfaces) {
      try {
        await device.claimInterface(iface.interfaceNumber)
        claimed.push(iface.interfaceNumber)
        console.log(`[thermal-printer] Claimed interface ${iface.interfaceNumber}`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`[thermal-printer] Could not claim interface ${iface.interfaceNumber}: ${msg}`)
        // Surface Windows driver conflict clearly
        if (msg.toLowerCase().includes('unable to claim interface')) {
          throw new Error(
            'Windows กำลังใช้ printer นี้อยู่ — กรุณาลอง: Device Manager → USB Printer Port → Disable device แล้วลอง เชื่อมต่อใหม่'
          )
        }
      }
    }
  }

  const ep = findEndpoint(device)
  if (!ep) throw new Error('No OUT endpoint found on this device. Is it a printer?')

  // Release interfaces we do not need
  for (const n of claimed) {
    if (n !== ep.interfaceNumber) {
      await device.releaseInterface(n).catch(() => {/* ignore */})
    }
  }

  // Ensure the needed interface is claimed
  if (!claimed.includes(ep.interfaceNumber)) {
    await device.claimInterface(ep.interfaceNumber)
  }
}

async function sendBytes(data: Uint8Array): Promise<void> {
  if (!_device) throw new Error('Printer not connected')
  const ep = findEndpoint(_device)
  if (!ep) throw new Error('Endpoint lost')
  // transferOut max chunk is typically 64KB; split if needed
  const CHUNK = 16384
  for (let i = 0; i < data.length; i += CHUNK) {
    await _device.transferOut(ep.endpointNumber, data.slice(i, i + CHUNK))
  }
}

// ── WiFi / Print-Server helpers ───────────────────────────────────────────────

const PRINTER_IP_KEY     = 'pos_printer_ip'
const PRINTER_NAME_KEY   = 'pos_printer_name'
const PRINT_SERVER_URL   = 'http://127.0.0.1:12345/print'
const WIFI_TIMEOUT_MS    = 4000
const SERVER_TIMEOUT_MS  = 5000

export function getPrinterIp(): string {
  try { return localStorage.getItem(PRINTER_IP_KEY) ?? '' } catch { return '' }
}
export function setPrinterIp(ip: string): void {
  try {
    if (ip.trim()) localStorage.setItem(PRINTER_IP_KEY, ip.trim())
    else           localStorage.removeItem(PRINTER_IP_KEY)
  } catch { /* ignore */ }
}

export function getPrinterName(): string {
  try { return localStorage.getItem(PRINTER_NAME_KEY) ?? '' } catch { return '' }
}
export function setPrinterName(name: string): void {
  try {
    if (name.trim()) localStorage.setItem(PRINTER_NAME_KEY, name.trim())
    else             localStorage.removeItem(PRINTER_NAME_KEY)
  } catch { /* ignore */ }
}

async function sendViaWifi(data: Uint8Array, ip: string): Promise<void> {
  const res = await fetch(`http://${ip}:9100`, {
    method:  'POST',
    body:    new Blob([data.buffer as ArrayBuffer], { type: 'application/octet-stream' }),
    headers: { 'Content-Type': 'application/octet-stream' },
    signal:  AbortSignal.timeout(WIFI_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`WiFi printer responded ${res.status}`)
}

async function sendViaPrintServer(data: Uint8Array, ip?: string): Promise<void> {
  const printerName = getPrinterName()
  const paperWidth  = String(getPaperWidth())
  const headers: Record<string, string> = {
    'Content-Type':  'application/octet-stream',
    'X-Paper-Width': paperWidth,
  }
  if (ip)          headers['X-Printer-IP']   = ip
  if (printerName) headers['X-Printer-Name'] = printerName

  console.log(`[thermal-printer] → POST ${PRINT_SERVER_URL}`, {
    'X-Printer-Name': printerName || '(none — will try USB auto-detect)',
    'X-Paper-Width':  paperWidth,
    bytes:            data.length,
  })

  const res = await fetch(PRINT_SERVER_URL, {
    method:  'POST',
    body:    new Blob([data.buffer as ArrayBuffer], { type: 'application/octet-stream' }),
    headers,
    signal:  AbortSignal.timeout(SERVER_TIMEOUT_MS),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    const msg  = body.error ?? `Print server responded ${res.status}`
    console.error('[thermal-printer] Print server error:', msg)
    throw new Error(msg)
  }
  console.log('[thermal-printer] Print server: OK')
}

// ── Public API ────────────────────────────────────────────────────────────────

export function isSupported(): boolean {
  return usb() !== null
}

/** Check if a printer is currently connected (or can be auto-reconnected). */
export async function getStatus(): Promise<PrinterStatus> {
  if (!isSupported()) return { connected: false, deviceName: null }
  if (_device)        return { connected: true,  deviceName: _device.productName || 'USB Printer' }

  const saved = loadSaved()
  if (!saved) return { connected: false, deviceName: null }

  try {
    const devices = await usb()!.getDevices()
    const match   = devices.find(d => d.vendorId === saved.vendorId && d.productId === saved.productId)
    if (!match) return { connected: false, deviceName: saved.name }
    await openDevice(match)
    _device = match
    return { connected: true, deviceName: match.productName || saved.name }
  } catch {
    return { connected: false, deviceName: saved.name }
  }
}

/** Open browser USB device picker (shows ALL USB devices). Resolves with device name on success. */
export async function connectPrinter(): Promise<string> {
  const api = usb()
  if (!api) throw new Error('WebUSB not supported. Use Chrome or Edge.')

  // Filter to Xprinter XP-58 (vendorId 0x0483, productId 0x5743)
  const device = await api.requestDevice({ filters: [{ vendorId: 0x0483, productId: 0x5743 }] })

  // Log IDs so user can confirm which device was selected
  console.log(
    `[thermal-printer] Selected device — vendorId: 0x${device.vendorId.toString(16).toUpperCase()}`,
    `productId: 0x${device.productId.toString(16).toUpperCase()}`,
    `name: "${device.productName || device.manufacturerName || '(none)'}"`,
  )

  await openDevice(device)
  _device = device
  persistDevice(device)

  const name = device.productName || device.manufacturerName
    || `USB ${device.vendorId.toString(16).toUpperCase()}:${device.productId.toString(16).toUpperCase()}`
  console.log(`[thermal-printer] Connected: ${name}`)
  return name
}

/** Return info about all USB devices previously granted permission by the user. */
export async function debugDevices(): Promise<string> {
  const api = usb()
  if (!api) return 'WebUSB not supported in this browser.'
  try {
    const devices = await api.getDevices()
    if (devices.length === 0) return 'No paired USB devices found.\nClick "เชื่อมต่อเครื่องพิมพ์" first to grant permission.'
    return devices.map((d, i) =>
      `[${i + 1}] ${d.productName || d.manufacturerName || '(unnamed)'}\n` +
      `    vendorId:  0x${d.vendorId.toString(16).toUpperCase().padStart(4, '0')}\n` +
      `    productId: 0x${d.productId.toString(16).toUpperCase().padStart(4, '0')}`
    ).join('\n\n')
  } catch (e) {
    return `Error: ${e instanceof Error ? e.message : String(e)}`
  }
}

/** Disconnect and forget the printer. */
export async function disconnectPrinter(): Promise<void> {
  if (_device) { try { await _device.close() } catch { /* ignore */ } }
  _device = null
  clearPersisted()
}

/** Print a test page. */
export async function testPrint(shopName = 'ALAN COFFEE & TRAVEL'): Promise<void> {
  await printReceipt({
    shopName,
    queue: 0, receipt: 'TEST', table: '', customer: '',
    cartSnapshot: [
      { qty: 1, recipe: { product_name: 'Test Print', price_lak: 0 }, customization: 'printer check OK' },
    ],
    subtotal: 0, discountAmt: 0, discountReason: '', finalTotal: 0,
    method: 'cash', received: 0, change: 0, vatPct: 0,
    footerText: 'ขอบคุณที่ใช้บริการ',
  })
}

// Center a string within w bytes; truncate if too long
function centerStr(s: string, w: number): string {
  const bl = byteLen(s)
  if (bl >= w) return s.substring(0, w)
  return ' '.repeat(Math.floor((w - bl) / 2)) + s
}

/** Build ESC/POS receipt and send to printer.
 *  Tries in order: WiFi (port 9100) → local print server → WebUSB → window.print() */
export async function printReceipt(data: PrintReceiptData): Promise<void> {
  const design   = getReceiptDesign()
  const mm       = getPaperWidth()
  const W        = charWidth(mm)
  const PRICE_W  = 10
  const NAME_W   = W - PRICE_W - 1  // 37 for 80mm, 21 for 58mm
  const now      = new Date()
  const dateStr  = now.toLocaleDateString('en-GB')
  const timeStr  = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const sep1     = '='.repeat(W)
  const sep2     = '-'.repeat(W)
  const payLabel = data.method === 'cash' ? 'เงินสด'
                 : data.method === 'qr'   ? 'QR Code' : 'โอนเงิน'

  const parts: Uint8Array[] = []
  const p = (...s: (number[] | Uint8Array)[]) => parts.push(concat(...s))

  p(CMD.init, CMD.codePage874)

  // Shop name
  if (design.showLogo) {
    p(CMD.alignCenter, CMD.sizeLarge, CMD.boldOn)
    p(line(centerStr(data.shopName.substring(0, Math.floor(W / 2)), Math.floor(W / 2))))
    p(CMD.boldOff, CMD.sizeNormal, CMD.alignLeft)
  }

  p(line(`${dateStr} ${timeStr}`))
  if (design.showReceiptNum) {
    p(line(data.table ? `Order #${data.receipt}  Table: ${data.table}` : `Order #${data.receipt}`))
  }
  if (data.customer)   p(line(data.customer.substring(0, W)))
  if (design.showStaff && (design.staffName || data.staffName)) {
    p(line(`พนักงาน: ${(design.staffName || data.staffName || '').substring(0, W - 10)}`))
  }

  // ── Queue number — prominent box ──────────────────────────────────────────
  if (design.showQueueLarge) {
    const queueStr   = `#${String(data.queue).padStart(3, '0')}`
    const queueLabel = '** คิว / QUEUE **'
    p(line(sep1))
    p(CMD.boldOn)
    p(line(centerStr(queueLabel, W)))
    p(CMD.boldOff)
    p(CMD.alignCenter, CMD.sizeLarge, CMD.boldOn)
    p(line(centerStr(queueStr, W)))
    p(CMD.boldOff, CMD.sizeNormal, CMD.alignLeft)
    p(line(sep1))
  }

  // ── Items ─────────────────────────────────────────────────────────────────
  p(line(sep2))
  for (const item of data.cartSnapshot) {
    const nameQty = sanitizeSpecial(item.recipe.product_name + (item.qty > 1 ? ` x${item.qty}` : ''))
    if (design.showItemPrice) {
      p(line(padR(nameQty, NAME_W) + ' ' + fmtLak((item.recipe.price_lak || 0) * item.qty).padStart(PRICE_W)))
    } else {
      p(line(nameQty.substring(0, W)))
    }
    if (item.customization) p(line(('  ' + sanitizeSpecial(thaiToReceipt(item.customization))).substring(0, W)))
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  p(line(sep2))
  p(line(twoCol('ยอดรวม', fmtLak(data.subtotal), W)))
  if (data.discountAmt > 0) {
    const lbl = data.discountReason ? `ส่วนลด (${data.discountReason})` : 'ส่วนลด'
    p(line(twoCol(lbl, `-${fmtLak(data.discountAmt)}`, W)))
  }
  p(CMD.boldOn)
  p(line(twoCol('ยอดสุทธิ', fmtLak(data.finalTotal), W)))
  p(CMD.boldOff)

  // ── Payment ───────────────────────────────────────────────────────────────
  p(line(sep1))
  p(line(twoCol('ชำระด้วย:', payLabel, W)))
  if (data.method === 'cash' && data.received > 0) {
    p(line(twoCol('รับมา:', fmtLak(data.received), W)))
    p(line(twoCol('เงินทอน:', fmtLak(data.change), W)))
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  p(line(sep1))
  p(CMD.alignCenter)
  p(line(centerStr(data.footerText || 'ขอบคุณที่ใช้บริการ', W)))
  p(line(centerStr('Thank you & come back', W)))
  if (data.address) p(line(centerStr(data.address.substring(0, W), W)))
  if (data.phone)   p(line(centerStr(data.phone.substring(0, W), W)))
  if (design.extraLine1) p(line(centerStr(design.extraLine1.substring(0, W), W)))
  if (design.extraLine2) p(line(centerStr(design.extraLine2.substring(0, W), W)))
  p(CMD.alignLeft)
  p(line(sep1))

  // Blank feed lines + partial cut
  for (let i = 0; i < design.blankLines; i++) p([LF])
  p(CMD.cutPartial)

  const bytes       = concat(...parts)
  const ip          = getPrinterIp()
  const printerName = getPrinterName()
  const errors: string[] = []

  // ── Fast path: Windows printer name configured → print server only ─────────
  // When pos_printer_name is set the user has an explicit Windows driver printer.
  // Don't fall through to WebUSB or window.print() — just succeed or throw.
  if (printerName) {
    console.log(`[thermal-printer] pos_printer_name="${printerName}" → using print server only`)
    await sendViaPrintServer(bytes, ip || undefined)  // throws on failure
    console.log('[thermal-printer] Printed via print server (named printer)')
    return
  }

  // ── Full fallback chain (no printer name configured) ──────────────────────

  // ── Method 1: WiFi direct (browser → printer:9100) ────────────────────────
  if (ip) {
    try {
      await sendViaWifi(bytes, ip)
      console.log(`[thermal-printer] Printed via WiFi ${ip}:9100`)
      return
    } catch (e) {
      errors.push(`WiFi: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // ── Method 2: Local print server (no named printer — USB auto-detect) ──────
  try {
    await sendViaPrintServer(bytes, ip || undefined)
    console.log('[thermal-printer] Printed via local print server')
    return
  } catch (e) {
    errors.push(`PrintServer: ${e instanceof Error ? e.message : String(e)}`)
  }

  // ── Method 3: WebUSB ───────────────────────────────────────────────────────
  try {
    if (!_device) {
      const s = await getStatus()
      if (!s.connected) throw new Error('not connected')
    }
    await sendBytes(bytes)
    console.log('[thermal-printer] Printed via WebUSB')
    return
  } catch (e) {
    errors.push(`WebUSB: ${e instanceof Error ? e.message : String(e)}`)
  }

  // ── Method 4: window.print() fallback ─────────────────────────────────────
  console.warn('[thermal-printer] All hardware methods failed — falling back to window.print()', errors)
  if (typeof window !== 'undefined') {
    window.print()
    return
  }

  throw new Error(`ไม่สามารถพิมพ์ได้ — ${errors.join(' | ')}`)
}
