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
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, '')) || 0
  const isFocused = useRef(false)
  const [display, setDisplay] = useState(num > 0 ? Math.round(num).toLocaleString('en-US') : '')

  useEffect(() => {
    if (!isFocused.current) {
      setDisplay(num > 0 ? Math.round(num).toLocaleString('en-US') : '')
    }
  }, [num])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    const n = parseInt(raw, 10) || 0
    setDisplay(raw === '' ? '' : n.toLocaleString('en-US'))
    onChange(raw)
  }

  function handleFocus() {
    isFocused.current = true
    setDisplay(num > 0 ? String(Math.round(num)) : '')
  }

  function handleBlur() {
    isFocused.current = false
    setDisplay(num > 0 ? Math.round(num).toLocaleString('en-US') : '')
  }

  return (
    <input
      value={display}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={style}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      inputMode="numeric"
    />
  )
}
