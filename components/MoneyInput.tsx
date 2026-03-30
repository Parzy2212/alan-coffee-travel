'use client'

import { useState, useEffect } from 'react'

interface MoneyInputProps {
  value: string | number
  onChange: (rawDigits: string) => void
  style?: React.CSSProperties
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
}

export function MoneyInput({ value, onChange, style, placeholder, disabled, autoFocus }: MoneyInputProps) {
  const parseNum = (v: string | number) => {
    const n = typeof v === 'number' ? v : parseInt(String(v).replace(/[^0-9]/g, ''), 10)
    return isNaN(n) || n <= 0 ? 0 : n
  }

  const [isFocused, setIsFocused] = useState(false)
  // raw = pure digit string, no commas
  const [raw, setRaw] = useState(() => {
    const n = parseNum(value)
    return n > 0 ? String(n) : ''
  })

  // Sync from parent only when not focused (external value changes)
  useEffect(() => {
    if (!isFocused) {
      const n = parseNum(value)
      setRaw(n > 0 ? String(n) : '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // While focused show raw digits; on blur show formatted
  const display = isFocused
    ? raw
    : raw ? parseInt(raw, 10).toLocaleString('en-US') : ''

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    setIsFocused(true)
    // Select all so user can type immediately
    setTimeout(() => e.target.select(), 0)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Only allow digits — no formatting, no parent update → no re-render → no focus loss
    const digits = e.target.value.replace(/[^0-9]/g, '')
    setRaw(digits)
  }

  function handleBlur() {
    setIsFocused(false)
    const n = parseNum(raw)
    const digits = n > 0 ? String(n) : ''
    setRaw(digits)
    onChange(digits)  // parent only updates here, not during typing
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={style}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
    />
  )
}
