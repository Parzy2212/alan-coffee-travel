// Receipt layout and exchange rates are shop settings (site_settings, set in ตั้งค่าร้าน).
// Each device keeps the last copy in localStorage so printing and the cart still work
// offline; lib/thermal-printer.ts and lib/currency.ts read that copy.

export const RECEIPT_LAYOUT_DEFAULTS = {
  receipt_show_logo:        'true',
  receipt_show_receipt_num: 'true',
  receipt_show_staff:       'false',
  receipt_show_queue_large: 'true',
  receipt_show_item_price:  'true',
  receipt_extra_line_1:     '',
  receipt_extra_line_2:     '',
  receipt_blank_lines:      '4',
} as const

// site_settings key -> localStorage key on the device
export const SHOP_DEVICE_KEYS: Record<string, string> = {
  ...Object.fromEntries(Object.keys(RECEIPT_LAYOUT_DEFAULTS).map(k => [k, k])),
  exchange_rates:     'pos_exchange_rates',
  display_currencies: 'pos_display_currencies',
}

/** Copies the shop-wide values onto this device. Keys the shop has never saved are left alone. */
export function applyShopSettingsToDevice(settings: Record<string, unknown>): void {
  try {
    for (const [key, deviceKey] of Object.entries(SHOP_DEVICE_KEYS)) {
      const v = settings[key]
      if (typeof v === 'string') localStorage.setItem(deviceKey, v)
    }
  } catch { /* storage blocked: the built-in defaults are used */ }
}

/** What this device has for a shop key (used once, to pre-fill ตั้งค่าร้าน before the shop has a value). */
export function readDeviceShopSetting(key: string): string | null {
  try { return localStorage.getItem(SHOP_DEVICE_KEYS[key]) } catch { return null }
}
