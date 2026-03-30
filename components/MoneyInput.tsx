'use client'

import { useState, useEffect, useRef } from 'react'

interface MoneyInputProps {
  value: string | number
  onChange: (rawDigits: string) => void
  style?: React.CSSProperties
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
}

export function MoneyInput({ value, onChange, style, placeholder, disabled, autoFocus }: MoneyInputProps) {
  const toNum = (v: string | number) => {
    const n = typeof v === 'number' ? v : parseInt(String(v).replace(/[^0-9]/g, ''), 10)
    return isNaN(n) ? 0 : n
  }
  const fmt = (n: number) => n > 0 ? n.toLocaleString('en-US') : ''

  const focused = useRef(false)
  const [display, setDisplay] = useState(() => fmt(toNum(value)))

  // Sync formatted display when value changes externally (not while user is typing)
  useEffect(() => {
    if (!focused.current) {
      setDisplay(fmt(toNum(value)))
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    focused.current = true
    const raw = String(toNum(value) || '')
    setDisplay(raw === '0' ? '' : raw)
    // Select all so user can type immediately without backspacing
    setTimeout(() => e.target.select(), 0)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Strip everything except digits — no formatting while typing
    const raw = e.target.value.replace(/[^0-9]/g, '')
    setDisplay(raw)
    onChange(raw)
  }

  function handleBlur() {
    focused.current = false
    const n = parseInt(display.replace(/[^0-9]/g, ''), 10) || 0
    setDisplay(fmt(n))
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
