'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  getActiveEmployee,
  setActiveEmployee,
  clearActiveEmployee,
  type ActiveEmployee,
} from './active-employee'

export function useActiveEmployee() {
  const [employee, setEmployee] = useState<ActiveEmployee | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setEmployee(getActiveEmployee())
    setReady(true)
  }, [])

  const clockIn = useCallback((emp: ActiveEmployee) => {
    setActiveEmployee(emp)
    setEmployee(emp)
  }, [])

  const clockOut = useCallback(() => {
    clearActiveEmployee()
    setEmployee(null)
  }, [])

  return { employee, ready, clockIn, clockOut }
}
