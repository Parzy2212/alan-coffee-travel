// Kip has no coins: when a bill has any discount, the amount to pay is rounded
// DOWN to the shop's step (ตั้งค่าร้าน, 500 or 1,000) and the discount recorded
// on the bill is what the customer really got off.
// 105,000 with 5% off -> 99,750 -> pays 99,000, discount 6,000.

export const DISCOUNT_ROUND_STEPS = [500, 1000] as const
export const DEFAULT_DISCOUNT_ROUND_STEP = 1000

export function parseDiscountRoundStep(raw: unknown): number {
  const n = Number(raw)
  return (DISCOUNT_ROUND_STEPS as readonly number[]).includes(n) ? n : DEFAULT_DISCOUNT_ROUND_STEP
}

export function roundedDiscount(subtotal: number, rawDiscount: number, step: number): number {
  if (!(subtotal > 0) || !(rawDiscount > 0)) return 0
  const raw = Math.min(rawDiscount, subtotal)
  const net = Math.floor((subtotal - raw) / step) * step
  return subtotal - Math.max(net, 0)
}
