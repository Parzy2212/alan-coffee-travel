export function formatMoney(value: number | string): string {
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, '')) || 0
  return n > 0 ? Math.round(n).toLocaleString('en-US') : ''
}

export function parseMoney(str: string): number {
  return parseFloat(String(str).replace(/,/g, '')) || 0
}
