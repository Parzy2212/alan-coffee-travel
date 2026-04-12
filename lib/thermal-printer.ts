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

const WIDTH = 32 // 58mm = 32 chars at standard font

// ── TIS-620 encoding ──────────────────────────────────────────────────────────
// Thai Unicode U+0E01–U+0E5B → TIS-620 byte = codepoint − 0x0D60
// ASCII < 0x80 pass through. Anything else → 0x3F '?'

function encodeLine(str: string): Uint8Array {
  const bytes: number[] = []
  for (const ch of str) {
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

// Pad string so its TIS-620 byteLen equals `len`
function padR(str: string, len: number): string {
  const bl = byteLen(str)
  return bl >= len ? str : str + ' '.repeat(len - bl)
}

// Two-column row: label left, value right, total = WIDTH bytes
function twoCol(left: string, right: string): string {
  const lLen  = byteLen(left)
  const rLen  = right.length // right is always ASCII numbers
  const spaces = WIDTH - lLen - rLen
  return left + (spaces > 0 ? ' '.repeat(spaces) : ' ') + right
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
  const headers: Record<string, string> = { 'Content-Type': 'application/octet-stream' }
  if (ip) headers['X-Printer-IP'] = ip
  const res = await fetch(PRINT_SERVER_URL, {
    method:  'POST',
    body:    new Blob([data.buffer as ArrayBuffer], { type: 'application/octet-stream' }),
    headers,
    signal:  AbortSignal.timeout(SERVER_TIMEOUT_MS),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `Print server responded ${res.status}`)
  }
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

/** Build ESC/POS receipt and send to printer.
 *  Tries in order: WiFi (port 9100) → local print server → WebUSB → window.print() */
export async function printReceipt(data: PrintReceiptData): Promise<void> {
  const now     = new Date()
  const dateStr = now.toLocaleDateString('en-GB')
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const sep1    = '='.repeat(WIDTH)
  const sep2    = '-'.repeat(WIDTH)
  const payLabel = data.method === 'cash' ? 'เงินสด'
                 : data.method === 'qr'   ? 'QR Code'
                 : 'โอนเงิน'

  const parts: Uint8Array[] = []
  const p = (...s: (number[] | Uint8Array)[]) => parts.push(concat(...s))

  // Init + code page for Thai
  p(CMD.init, CMD.codePage874)

  // Shop name — center, large, bold
  p(CMD.alignCenter, CMD.sizeLarge, CMD.boldOn)
  p(line(data.shopName.substring(0, 16))) // large text = 2× width, 16 chars fills 32
  p(CMD.boldOff, CMD.sizeNormal)

  // Date / time / order number
  p(line(`${dateStr} ${timeStr}`))
  p(line(data.table ? `Order #${data.receipt}  Table: ${data.table}` : `Order #${data.receipt}`))
  if (data.customer) p(line(data.customer.substring(0, WIDTH)))

  // Items
  p(CMD.alignLeft)
  p(line(sep2))

  for (const item of data.cartSnapshot) {
    const name  = item.recipe.product_name
    const price = fmtLak((item.recipe.price_lak || 0) * item.qty)
    const qty   = `x${item.qty}`
    // Row 1: name + qty
    p(line(padR(name, WIDTH - qty.length - 1) + ' ' + qty))
    // Row 2: customization + price
    const cust = item.customization ? `  ${item.customization}` : ''
    p(line(padR(cust, WIDTH - price.length - 1) + ' ' + price))
  }

  // Totals
  p(line(sep2))
  p(line(twoCol('ยอดรวม', fmtLak(data.subtotal))))
  if (data.discountAmt > 0) {
    const lbl = data.discountReason ? `ส่วนลด (${data.discountReason})` : 'ส่วนลด'
    p(line(twoCol(lbl, fmtLak(data.discountAmt))))
  } else {
    p(line(twoCol('ส่วนลด', '0')))
  }
  p(CMD.boldOn)
  p(line(twoCol('ยอดสุทธิ', fmtLak(data.finalTotal))))
  p(CMD.boldOff)

  // Payment
  p(line(sep1))
  p(line(twoCol('ชำระด้วย:', payLabel)))
  if (data.method === 'cash' && data.received > 0) {
    p(line(twoCol('รับมา:', fmtLak(data.received))))
    p(line(twoCol('เงินทอน:', fmtLak(data.change))))
  }

  // Footer
  p(line(sep1))
  p(CMD.alignCenter)
  p(line((data.footerText || 'ขอบคุณที่ใช้บริการ').substring(0, WIDTH)))
  p(line('Thank you & come back'))
  if (data.address) p(line(data.address.substring(0, WIDTH)))
  if (data.phone)   p(line(data.phone.substring(0, WIDTH)))
  p(line(sep1))

  // Feed + partial cut
  p(CMD.feed3, CMD.cutPartial)

  const bytes  = concat(...parts)
  const ip     = getPrinterIp()
  const errors: string[] = []

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

  // ── Method 2: Local print server (localhost:12345) ─────────────────────────
  try {
    // Pass IP to server so it can forward via TCP if needed
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
