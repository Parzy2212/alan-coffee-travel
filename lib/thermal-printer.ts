// lib/thermal-printer.ts
// WebUSB ESC/POS thermal printer — Chrome/Edge only.
// Falls back gracefully; call isSupported() before use.
// Receipt language: thermal print always uses PC437 (Latin ASCII).
//   Lao  — no ESC/POS code page exists; always falls back to English.
//   Thai — requires code page 20 (TIS-620/PC874) which we don't send; falls back to English.
//   English — always supported.

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
  pointsEarned?:  number
  pointsBalance?: number
  isBirthday?:    boolean
}

// ── Print language support ────────────────────────────────────────────────────
// PC437 only covers Latin. Lao has no ESC/POS code page; Thai needs PC874.
// Call effectivePrintLang() to get the lang that will actually render on paper.

type PrintLang = 'en' | 'th' | 'lo'
const PRINT_FALLBACK_PREF_KEY = 'pos_print_lang_fallback_pref'

export function isPrintable(lang: PrintLang): boolean {
  return lang === 'en'
}

export function effectivePrintLang(lang: PrintLang): { lang: PrintLang; didFallback: boolean } {
  if (lang === 'en') return { lang: 'en', didFallback: false }
  return { lang: 'en', didFallback: true }
}

export function hasDismissedFallbackWarning(): boolean {
  try { return localStorage.getItem(PRINT_FALLBACK_PREF_KEY) === 'silent' } catch { return false }
}

export function dismissFallbackWarning(): void {
  try { localStorage.setItem(PRINT_FALLBACK_PREF_KEY, 'silent') } catch {}
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

// Receipt label translations — thermal print is always ASCII so we use English
// for the actual ESC/POS binary; `lang` only affects the screen preview labels.
const RECEIPT_LABELS = {
  en: { subtotal: 'SUBTOTAL', total: 'TOTAL', payment: 'PAYMENT:', received: 'RECEIVED:', change: 'CHANGE:', discount: 'DISCOUNT', queue: '** QUEUE **', birthday: '** HAPPY BIRTHDAY! **', thanks: 'Thank you & come back', staff: 'STAFF:', points: 'Points earned:', pointsBal: 'Points balance:' },
  th: { subtotal: 'ยอดรวม', total: 'ยอดสุทธิ', payment: 'ชำระเงิน:', received: 'รับมา:', change: 'เงินทอน:', discount: 'ส่วนลด', queue: '** คิว **', birthday: '** สุขสันต์วันเกิด! **', thanks: 'ขอบคุณ มาอีกนะคะ', staff: 'พนักงาน:', points: 'ได้รับแต้ม:', pointsBal: 'ยอดแต้ม:' },
  lo: { subtotal: 'ລວມ', total: 'ລວມທັງໝົດ', payment: 'ຊຳລະ:', received: 'ຮັບມາ:', change: 'ເງິນທອນ:', discount: 'ສ່ວນຫຼຸດ', queue: '** ຄິວ **', birthday: '** ສຸກສັນວັນເກີດ! **', thanks: 'ຂອບໃຈ ມາໃໝ່ດ້ວຍ', staff: 'ພະນັກງານ:', points: 'ໄດ້ຮັບແຕ້ມ:', pointsBal: 'ຍອດແຕ້ມ:' },
} as const
type ReceiptLang = keyof typeof RECEIPT_LABELS

/** Build plain-text receipt string — used for print preview.
 *  If lang is unsupported by thermal printers (lo/th), silently uses 'en' —
 *  callers should check effectivePrintLang() first to show a user warning. */
export function buildReceiptText(data: PrintReceiptData, design?: ReceiptDesign, lang: ReceiptLang = 'en'): string {
  const { lang: safeLang } = effectivePrintLang(lang as PrintLang)
  const d       = design ?? getReceiptDesign()
  const lbl     = RECEIPT_LABELS[safeLang]
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
  const pay = data.method === 'cash' ? 'CASH' : data.method === 'qr' ? 'QR CODE' : 'TRANSFER'

  const lines: string[] = []
  const L = (...ss: string[]) => lines.push(...ss)

  if (d.showLogo)       L(ctr(toAscii(data.shopName).substring(0, W)))
  L(`${dateStr} ${timeStr}`.substring(0, W))
  if (d.showReceiptNum) {
    const orderLine = data.table ? `Order #${data.receipt}  Table: ${data.table}` : `Order #${data.receipt}`
    L(orderLine.substring(0, W))
  }
  if (data.customer)    L(toAscii(data.customer).substring(0, W))
  if (d.showStaff && (d.staffName || data.staffName)) {
    L(`${lbl.staff} ${toAscii(d.staffName || data.staffName || '').substring(0, W - lbl.staff.length - 1)}`)
  }

  if (d.showQueueLarge) {
    L(sep1, ctr(lbl.queue), ctr(`#${String(data.queue).padStart(3, '0')}`), sep1)
  }

  L(sep2)
  for (const item of data.cartSnapshot) {
    const nameQty = toAscii(item.recipe.product_name + (item.qty > 1 ? ` x${item.qty}` : ''))
    if (d.showItemPrice) {
      L(padR(nameQty, NAME_W) + ' ' + fmtLak((item.recipe.price_lak || 0) * item.qty).padStart(PRICE_W))
    } else {
      L(nameQty.substring(0, W))
    }
    if (item.customization) L(('  ' + toAscii(item.customization)).substring(0, W))
  }

  L(sep2)
  L(tc(lbl.subtotal, fmtLak(data.subtotal)))
  if (data.discountAmt > 0) {
    const lblDisc = data.discountReason ? `${lbl.discount} (${toAscii(data.discountReason)})` : lbl.discount
    L(tc(lblDisc, `-${fmtLak(data.discountAmt)}`))
  }
  L(tc(lbl.total, fmtLak(data.finalTotal)))
  L(sep1)
  L(tc(lbl.payment, pay))
  if (data.method === 'cash' && data.received > 0) {
    L(tc(lbl.received, fmtLak(data.received)), tc(lbl.change, fmtLak(data.change)))
  }
  L(sep1)
  if (data.isBirthday) L(ctr(lbl.birthday))
  if (data.pointsEarned !== undefined && data.pointsEarned > 0) {
    L(tc(lbl.points, `+${data.pointsEarned}`))
    if (data.pointsBalance !== undefined) L(tc(lbl.pointsBal, String(data.pointsBalance)))
    L(sep2)
  }
  L(ctr(footerSafe(data.footerText || '')), ctr(lbl.thanks))
  if (data.address) L(ctr(toAscii(data.address).substring(0, W)))
  if (data.phone)   L(ctr(data.phone.substring(0, W)))
  if (d.extraLine1) L(ctr(toAscii(d.extraLine1).substring(0, W)))
  if (d.extraLine2) L(ctr(toAscii(d.extraLine2).substring(0, W)))
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
  codePage437: [ESC, 0x74, 0x00],  // PC437 — ASCII-safe, works on all printers
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

// ── Text → ASCII converter ────────────────────────────────────────────────────
// Translates known Thai phrases to English, then strips any remaining non-ASCII.
// Longer/more-specific phrases must come before shorter overlapping ones.

function toAscii(s: string): string {
  return s
    // Special Unicode punctuation
    .replace(/·/g, 'x').replace(/•/g, '*').replace(/×/g, 'x')
    .replace(/–/g, '-').replace(/—/g, '-')
    // Separators
    .replace(/ · /g, ' / ').replace(/ × /g, 'x')
    // Sweetness (specific before generic)
    .replace(/หวานน้อย/g, 'Less sugar')
    .replace(/หวานปกติ/g, 'Normal sugar')
    .replace(/หวานกลาง/g, 'Normal sugar')
    .replace(/หวานมาก/g, 'Extra sugar')
    .replace(/ไม่หวาน/g, 'No sugar')
    // Temperature
    .replace(/เย็น/g, 'Cold')
    .replace(/ร้อน/g, 'Hot')
    .replace(/อุ่น/g, 'Warm')
    // Size (specific before generic)
    .replace(/ใหญ่/g, 'Large')
    .replace(/เล็ก/g, 'Small')
    .replace(/กลาง/g, 'Medium')
    // Generic
    .replace(/ปกติ/g, 'Normal')
    // Strip any remaining non-ASCII
    .replace(/[^\x00-\x7F]/g, '?')
}

// Returns footer text as ASCII; falls back to default if no real letters remain.
function footerSafe(s: string): string {
  const cleaned = toAscii(s).trim()
  return /[A-Za-z0-9]/.test(cleaned) ? cleaned : 'Thank you & come back'
}

// ── ASCII encoding ────────────────────────────────────────────────────────────

function encodeLine(str: string): Uint8Array {
  const bytes: number[] = []
  for (const ch of str) {
    const cp = ch.codePointAt(0) ?? 0x3F
    bytes.push(cp < 0x80 ? cp : 0x3F)
  }
  return new Uint8Array(bytes)
}

// Byte length (= char length for ASCII-only strings)
function byteLen(str: string): number {
  return encodeLine(str).length
}

// Pad string to exactly `len` bytes; truncate with "..." if too long
function padR(str: string, len: number): string {
  const bl = byteLen(str)
  if (bl <= len) return str + ' '.repeat(len - bl)
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
        if (msg.toLowerCase().includes('unable to claim interface')) {
          throw new Error(
            'Windows is using this printer — try: Device Manager → USB Printer Port → Disable, then reconnect'
          )
        }
      }
    }
  }

  const ep = findEndpoint(device)
  if (!ep) throw new Error('No OUT endpoint found on this device. Is it a printer?')

  for (const n of claimed) {
    if (n !== ep.interfaceNumber) {
      await device.releaseInterface(n).catch(() => {/* ignore */})
    }
  }

  if (!claimed.includes(ep.interfaceNumber)) {
    await device.claimInterface(ep.interfaceNumber)
  }
}

async function sendBytes(data: Uint8Array): Promise<void> {
  if (!_device) throw new Error('Printer not connected')
  const ep = findEndpoint(_device)
  if (!ep) throw new Error('Endpoint lost')
  const CHUNK = 16384
  for (let i = 0; i < data.length; i += CHUNK) {
    await _device.transferOut(ep.endpointNumber, data.slice(i, i + CHUNK))
  }
}

// ── WiFi / Print-Server helpers ───────────────────────────────────────────────

const PRINTER_IP_KEY        = 'pos_printer_ip'
const PRINTER_NAME_KEY      = 'pos_printer_name'
const PRINT_SERVER_BASE     = 'http://127.0.0.1:12345'
const PRINT_SERVER_URL      = `${PRINT_SERVER_BASE}/print`
const PRINT_SERVER_STATUS   = `${PRINT_SERVER_BASE}/status`
const WIFI_TIMEOUT_MS   = 4000
// 5000ms for the /print POST: Windows spooling a physical print job takes 3-4s.
// A shorter value causes AbortError even though the job actually printed.
const SERVER_TIMEOUT_MS = 5000

// Module-level cache for /status — avoids hammering localhost when settings popup opens repeatedly
let _statusCache: { ok: boolean; ts: number } | null = null
const STATUS_CACHE_TTL = 30_000  // 30 seconds

/** Check if the local print server is reachable. Result is cached for 30 s.
 *  Uses a 4 s timeout — Windows IPC to the server process can be slow. */
export async function checkPrintServer(): Promise<boolean> {
  if (_statusCache && Date.now() - _statusCache.ts < STATUS_CACHE_TTL) return _statusCache.ok
  try {
    const res = await fetch(PRINT_SERVER_STATUS, { signal: AbortSignal.timeout(4000) })
    _statusCache = { ok: res.ok, ts: Date.now() }
    return res.ok
  } catch {
    _statusCache = { ok: false, ts: Date.now() }
    return false
  }
}

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

export async function connectPrinter(): Promise<string> {
  const api = usb()
  if (!api) throw new Error('WebUSB not supported. Use Chrome or Edge.')

  const device = await api.requestDevice({ filters: [{ vendorId: 0x0483, productId: 0x5743 }] })

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

export async function debugDevices(): Promise<string> {
  const api = usb()
  if (!api) return 'WebUSB not supported in this browser.'
  try {
    const devices = await api.getDevices()
    if (devices.length === 0) return 'No paired USB devices found.\nClick "Connect Printer" first to grant permission.'
    return devices.map((d, i) =>
      `[${i + 1}] ${d.productName || d.manufacturerName || '(unnamed)'}\n` +
      `    vendorId:  0x${d.vendorId.toString(16).toUpperCase().padStart(4, '0')}\n` +
      `    productId: 0x${d.productId.toString(16).toUpperCase().padStart(4, '0')}`
    ).join('\n\n')
  } catch (e) {
    return `Error: ${e instanceof Error ? e.message : String(e)}`
  }
}

export async function disconnectPrinter(): Promise<void> {
  if (_device) { try { await _device.close() } catch { /* ignore */ } }
  _device = null
  clearPersisted()
}

export async function testPrint(shopName = 'ALAN COFFEE & TRAVEL'): Promise<void> {
  await printReceipt({
    shopName,
    queue: 0, receipt: 'TEST', table: '', customer: '',
    cartSnapshot: [
      { qty: 1, recipe: { product_name: 'Test Print', price_lak: 0 }, customization: 'printer check OK' },
    ],
    subtotal: 0, discountAmt: 0, discountReason: '', finalTotal: 0,
    method: 'cash', received: 0, change: 0, vatPct: 0,
    footerText: 'Thank you & come back',
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
  const payLabel = data.method === 'cash' ? 'CASH'
                 : data.method === 'qr'   ? 'QR CODE' : 'TRANSFER'

  const parts: Uint8Array[] = []
  const p = (...s: (number[] | Uint8Array)[]) => parts.push(concat(...s))

  p(CMD.init, CMD.codePage437)

  // Shop name
  if (design.showLogo) {
    p(CMD.alignCenter, CMD.sizeLarge, CMD.boldOn)
    p(line(centerStr(toAscii(data.shopName).substring(0, Math.floor(W / 2)), Math.floor(W / 2))))
    p(CMD.boldOff, CMD.sizeNormal, CMD.alignLeft)
  }

  p(line(`${dateStr} ${timeStr}`))
  if (design.showReceiptNum) {
    p(line(data.table ? `Order #${data.receipt}  Table: ${data.table}` : `Order #${data.receipt}`))
  }
  if (data.customer)   p(line(toAscii(data.customer).substring(0, W)))
  if (design.showStaff && (design.staffName || data.staffName)) {
    p(line(`STAFF: ${toAscii(design.staffName || data.staffName || '').substring(0, W - 7)}`))
  }

  // ── Queue number — prominent box ──────────────────────────────────────────
  if (design.showQueueLarge) {
    const queueStr   = `#${String(data.queue).padStart(3, '0')}`
    const queueLabel = '** QUEUE **'
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
    const nameQty = toAscii(item.recipe.product_name + (item.qty > 1 ? ` x${item.qty}` : ''))
    if (design.showItemPrice) {
      p(line(padR(nameQty, NAME_W) + ' ' + fmtLak((item.recipe.price_lak || 0) * item.qty).padStart(PRICE_W)))
    } else {
      p(line(nameQty.substring(0, W)))
    }
    if (item.customization) p(line(('  ' + toAscii(item.customization)).substring(0, W)))
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  p(line(sep2))
  p(line(twoCol('SUBTOTAL', fmtLak(data.subtotal), W)))
  if (data.discountAmt > 0) {
    const lbl = data.discountReason ? `DISCOUNT (${toAscii(data.discountReason)})` : 'DISCOUNT'
    p(line(twoCol(lbl, `-${fmtLak(data.discountAmt)}`, W)))
  }
  p(CMD.boldOn)
  p(line(twoCol('TOTAL', fmtLak(data.finalTotal), W)))
  p(CMD.boldOff)

  // ── Payment ───────────────────────────────────────────────────────────────
  p(line(sep1))
  p(line(twoCol('PAYMENT:', payLabel, W)))
  if (data.method === 'cash' && data.received > 0) {
    p(line(twoCol('RECEIVED:', fmtLak(data.received), W)))
    p(line(twoCol('CHANGE:', fmtLak(data.change), W)))
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  p(line(sep1))
  p(CMD.alignCenter)
  p(line(centerStr(footerSafe(data.footerText || ''), W)))
  p(line(centerStr('Thank you & come back', W)))
  if (data.address) p(line(centerStr(toAscii(data.address).substring(0, W), W)))
  if (data.phone)   p(line(centerStr(data.phone.substring(0, W), W)))
  if (design.extraLine1) p(line(centerStr(toAscii(design.extraLine1).substring(0, W), W)))
  if (design.extraLine2) p(line(centerStr(toAscii(design.extraLine2).substring(0, W), W)))
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
  if (printerName) {
    console.log(`[thermal-printer] pos_printer_name="${printerName}" → using print server only`)
    await sendViaPrintServer(bytes, ip || undefined)
    console.log('[thermal-printer] Printed via print server (named printer)')
    return
  }

  // ── Full fallback chain (no printer name configured) ──────────────────────

  if (ip) {
    try {
      await sendViaWifi(bytes, ip)
      console.log(`[thermal-printer] Printed via WiFi ${ip}:9100`)
      return
    } catch (e) {
      errors.push(`WiFi: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  try {
    await sendViaPrintServer(bytes, ip || undefined)
    console.log('[thermal-printer] Printed via local print server')
    return
  } catch (e) {
    errors.push(`PrintServer: ${e instanceof Error ? e.message : String(e)}`)
  }

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

  console.warn('[thermal-printer] All hardware methods failed — falling back to window.print()', errors)
  if (typeof window !== 'undefined') {
    window.print()
    return
  }

  throw new Error(`Print failed — ${errors.join(' | ')}`)
}
