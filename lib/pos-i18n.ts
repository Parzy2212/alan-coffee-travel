import type { Lang } from '@/contexts/LanguageContext'

type Strings = {
  hold:         string
  queue:        string
  orders:       string
  closeShift:   string
  search:       string
  subtotal:     string
  total:        string
  discount:     string
  charge:       string
  payment:      string
  received:     string
  change:       string
  cash:         string
  qr:           string
  transfer:     string
  split:        string
  customer:     string
  table:        string
  note:         string
  confirm:      string
  cancel:       string
  receiptLang:  string
  noItems:      string
  testMode:     string
  points:       string
  pointsEarned: string
  pointsBal:    string
  staff:        string
}

const T: Record<Lang, Strings> = {
  en: {
    hold:         'Hold',
    queue:        'Queue & Orders',
    orders:       'Orders',
    closeShift:   'Close Shift',
    search:       'Search menu... (press /)',
    subtotal:     'Subtotal',
    total:        'Total',
    discount:     'Discount',
    charge:       'Charge',
    payment:      'Payment',
    received:     'Received',
    change:       'Change',
    cash:         'Cash',
    qr:           'QR',
    transfer:     'Transfer',
    split:        'Split',
    customer:     'Customer',
    table:        'Table / Room',
    note:         'Staff note',
    confirm:      'Confirm',
    cancel:       'Cancel',
    receiptLang:  'Receipt language',
    noItems:      'No items in this category',
    testMode:     'TEST MODE — orders marked TEST, not counted in real sales',
    points:       'Points',
    pointsEarned: 'Points earned',
    pointsBal:    'Points balance',
    staff:        'Staff',
  },
  th: {
    hold:         'พัก',
    queue:        'คิว & ออเดอร์',
    orders:       'ออเดอร์',
    closeShift:   'ปิดกะ',
    search:       'ค้นหาเมนู... (กด /)',
    subtotal:     'ยอดรวม',
    total:        'ยอดสุทธิ',
    discount:     'ส่วนลด',
    charge:       'เรียกเก็บเงิน',
    payment:      'ชำระเงิน',
    received:     'รับมา',
    change:       'เงินทอน',
    cash:         'เงินสด',
    qr:           'QR โค้ด',
    transfer:     'โอนเงิน',
    split:        'แยกจ่าย',
    customer:     'ลูกค้า',
    table:        'โต๊ะ / ห้อง',
    note:         'หมายเหตุ',
    confirm:      'ยืนยัน',
    cancel:       'ยกเลิก',
    receiptLang:  'ภาษาใบเสร็จ',
    noItems:      'ไม่มีรายการในหมวดนี้',
    testMode:     'โหมดทดสอบ — ออเดอร์จะถูกทำเครื่องหมาย TEST ไม่นับยอดขายจริง',
    points:       'แต้ม',
    pointsEarned: 'ได้รับแต้ม',
    pointsBal:    'แต้มสะสม',
    staff:        'พนักงาน',
  },
  lo: {
    hold:         'ພັກ',
    queue:        'ຄິວ & ອໍເດີ',
    orders:       'ອໍເດີ',
    closeShift:   'ປິດກະ',
    search:       'ຄົ້ນຫາເມນູ... (ກົດ /)',
    subtotal:     'ລວມ',
    total:        'ລວມທັງໝົດ',
    discount:     'ສ່ວນຫຼຸດ',
    charge:       'ຮຽກເກັບ',
    payment:      'ຊຳລະເງິນ',
    received:     'ຮັບມາ',
    change:       'ເງິນທອນ',
    cash:         'ເງິນສົດ',
    qr:           'QR',
    transfer:     'ໂອນເງິນ',
    split:        'ແຍກຈ່າຍ',
    customer:     'ລູກຄ້າ',
    table:        'ໂຕະ / ຫ້ອງ',
    note:         'ໝາຍເຫດ',
    confirm:      'ຢືນຢັນ',
    cancel:       'ຍົກເລີກ',
    receiptLang:  'ພາສາໃບເສັດ',
    noItems:      'ບໍ່ມີລາຍການໃນໝວດນີ້',
    testMode:     'ໂໝດທົດສອບ — ອໍເດີຈະຖືກໝາຍ TEST ບໍ່ນັບຍອດຂາຍຈິງ',
    points:       'ແຕ້ມ',
    pointsEarned: 'ໄດ້ຮັບແຕ້ມ',
    pointsBal:    'ຍອດແຕ້ມ',
    staff:        'ພະນັກງານ',
  },
}

export function t(key: keyof Strings, lang: Lang): string {
  return T[lang][key]
}
