// Receipt printed as HTML through the OS printer driver (window.print).
// Unlike raw ESC/POS, the browser renders Lao and Thai text. With the
// POS shortcut's --kiosk-printing flag, window.print() goes straight to
// the default printer with no dialog (see docs/pos-printer-setup-th.md).

import { getMenuName } from '@/lib/menu-i18n'
import type { PrintReceiptData, ReceiptDesign } from '@/lib/thermal-printer'
import { getReceiptDesign, getPaperWidth, RECEIPT_LABELS } from '@/lib/thermal-printer'

export type ReceiptLang = 'en' | 'th' | 'lo'

const EXTRA = {
  en: { order: 'Order', table: 'Table', cash: 'CASH', qr: 'QR CODE', transfer: 'TRANSFER' },
  th: { order: 'บิล', table: 'โต๊ะ', cash: 'เงินสด', qr: 'QR', transfer: 'โอน' },
  lo: { order: 'ບິນ', table: 'ໂຕະ', cash: 'ເງິນສົດ', qr: 'QR', transfer: 'ໂອນ' },
} as const

// Drink options are saved in Thai (CustomPopup in app/pos/POSClient.tsx; the
// dashboard SQL matches the Thai words). Known options are translated here;
// free-typed notes print as typed.
const OPTION_TEXT: Record<string, { en: string; lo: string; th?: string }> = {
  'หวานปกติ':      { en: 'Normal sugar',     lo: 'ຫວານປົກກະຕິ' },
  'หวานน้อย':      { en: 'Less sugar',       lo: 'ຫວານໜ້ອຍ' },
  'ไม่หวาน':       { en: 'No sugar',         lo: 'ບໍ່ຫວານ' },
  'ร้อน':          { en: 'Hot',              lo: 'ຮ້ອນ' },
  'เย็น':          { en: 'Iced',             lo: 'ເຢັນ' },
  'อุ่น':          { en: 'Hot',              lo: 'ຮ້ອນ', th: 'ร้อน' }, // removed option, still in old held carts
  'ไม่ใส่น้ำแข็ง': { en: 'No ice',           lo: 'ບໍ່ໃສ່ນ້ຳກ້ອນ' },
  'extra shot':    { en: 'Extra shot',       lo: 'ເພີ່ມຊັອດ', th: 'เพิ่มช็อต' },
  'ห่อแยก':        { en: 'Packed separately', lo: 'ຫໍ່ແຍກ' },
}

export function translateCustomization(s: string, lang: ReceiptLang): string {
  return s.split(' · ').map(part => part.split(', ').map(t => OPTION_TEXT[t.trim()]?.[lang] ?? t).join(', ')).join(' · ')
}

const esc = (s: string) => s
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const lak = (n: number) => `${Math.round(n || 0).toLocaleString('en-US')} ₭`

export function buildReceiptHtml(data: PrintReceiptData, lang: ReceiptLang, design: ReceiptDesign = getReceiptDesign()): string {
  const lbl = RECEIPT_LABELS[lang]
  const ex  = EXTRA[lang]
  const now = data.soldAt ? new Date(data.soldAt) : new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const when = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`
  const pay  = data.method === 'cash' ? ex.cash : data.method === 'qr' ? ex.qr : ex.transfer
  const row  = (l: string, r: string, cls = '') => `<div class="r ${cls}"><span>${esc(l)}</span><span>${esc(r)}</span></div>`
  const c    = (s: string, cls = '') => `<div class="c ${cls}">${esc(s)}</div>`
  const out: string[] = []

  if (data.isTest)        out.push(c('*** TEST ORDER ***', 'b big'))
  if (design.showLogo)    out.push(c(data.shopName, 'b big'))
  out.push(c(when))
  if (design.showReceiptNum) out.push(c(`${ex.order} #${data.receipt}${data.table ? `  ${ex.table}: ${data.table}` : ''}`))
  if (data.customer)      out.push(c(data.customer))
  const staff = design.staffName || data.staffName
  if (design.showStaff && staff) out.push(c(`${lbl.staff} ${staff}`))

  if (design.showQueueLarge) {
    out.push('<hr class="d">', c(lbl.queue.replace(/\*/g, '').trim(), 'b'), c(`#${String(data.queue).padStart(3, '0')}`, 'b q'), '<hr class="d">')
  } else {
    out.push('<hr>')
  }

  for (const item of data.cartSnapshot) {
    const name = getMenuName(item.recipe, lang) + (item.qty > 1 ? ` x${item.qty}` : '')
    out.push(design.showItemPrice ? row(name, lak((item.recipe.price_lak || 0) * item.qty), 'item') : `<div class="item">${esc(name)}</div>`)
    if (item.customization) out.push(`<div class="sub">${esc(translateCustomization(item.customization, lang))}</div>`)
  }

  out.push('<hr>', row(lbl.subtotal, lak(data.subtotal)))
  if (data.discountAmt > 0) {
    out.push(row(data.discountReason ? `${lbl.discount} (${data.discountReason})` : lbl.discount, `-${lak(data.discountAmt)}`))
  }
  out.push(row(lbl.total, lak(data.finalTotal), 'b big'), '<hr class="d">', row(lbl.payment, pay))
  if (data.method === 'cash' && data.received > 0) {
    out.push(row(lbl.received, lak(data.received)), row(lbl.change, lak(data.change)))
  }
  out.push('<hr class="d">')
  if (data.isBirthday) out.push(c(lbl.birthday.replace(/\*/g, '').trim(), 'b'))
  if (data.pointsEarned) {
    out.push(row(lbl.points, `+${data.pointsEarned}`))
    if (data.pointsBalance !== undefined) out.push(row(lbl.pointsBal, String(data.pointsBalance)))
  }
  if (data.footerText) out.push(c(data.footerText))
  out.push(c(lbl.thanks))
  if (data.address)       out.push(c(data.address, 's'))
  if (data.phone)         out.push(c(data.phone, 's'))
  if (design.extraLine1)  out.push(c(design.extraLine1, 's'))
  if (design.extraLine2)  out.push(c(design.extraLine2, 's'))
  if (data.isTest)        out.push(c('*** TEST - NOT A REAL ORDER ***', 'b'))
  out.push(`<div style="height:${design.blankLines * 4}mm"></div>`)

  return `<div class="rcpt w${getPaperWidth()}" lang="${lang}">${out.join('')}</div>`
}

async function waitForFonts(): Promise<void> {
  try {
    const body = getComputedStyle(document.body)
    const lao  = body.getPropertyValue('--font-lao').trim()
    const thai = body.getPropertyValue('--font-thai').trim()
    const loads: Promise<unknown>[] = []
    if (lao)  loads.push(document.fonts.load(`12px ${lao}`, 'ກຂ'))
    if (thai) loads.push(document.fonts.load(`12px ${thai}`, 'กข'))
    await Promise.race([Promise.all(loads), new Promise(r => setTimeout(r, 3000))])
    await document.fonts.ready
  } catch { /* print with whatever fonts are ready */ }
}

let printing = false

/** Prints via the browser. Resolves once the job is handed to the OS (kiosk
 *  printing) or the print dialog is closed. */
export async function printReceiptViaBrowser(data: PrintReceiptData, lang: ReceiptLang): Promise<void> {
  if (printing) throw new Error('กำลังพิมพ์ใบเสร็จอีกใบอยู่ — รอสักครู่แล้วกดใหม่')
  printing = true
  const host = document.createElement('div')
  host.id = 'print-receipt'
  host.innerHTML = buildReceiptHtml(data, lang)
  const page = document.createElement('style')
  document.body.appendChild(host)
  document.head.appendChild(page)
  document.documentElement.classList.add('printing-receipt')
  try {
    await waitForFonts()
    // Page = paper width x receipt height, so the printer feeds no blank paper.
    // Unnamed @page: with a named page Chrome keeps the default sheet (A4/Letter
    // with margins, so it adds its date/URL header) and centres the receipt on it.
    const rcpt = host.firstElementChild as HTMLElement
    const mm = Math.ceil(rcpt.getBoundingClientRect().height * 25.4 / 96) + 4
    page.textContent = `@page { size: ${getPaperWidth()}mm ${mm}mm; margin: 0; }`
    window.print()
  } finally {
    document.documentElement.classList.remove('printing-receipt')
    page.remove()
    host.remove()
    printing = false
  }
}
