const LS_KEY = 'alan_active_employee'

export type ActiveEmployee = {
  id: string
  name: string
  role: string
  shiftId: string
  clockedInAt: string
  shopId: string
}

export function getActiveEmployee(): ActiveEmployee | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as ActiveEmployee) : null
  } catch { return null }
}

export function setActiveEmployee(emp: ActiveEmployee): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(emp)) } catch { /* ignore */ }
}

export function clearActiveEmployee(): void {
  try { localStorage.removeItem(LS_KEY) } catch { /* ignore */ }
}
