'use client'

import { useState } from 'react'

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
  // raw is only used while the field is focused; otherwise display derives from value prop directly
  const [raw, setRaw] = useState('')

  // When not focused: always reflect the current value prop (handles async-loaded parent state)
  // When focused: show raw digits the user is typing
  const numVal = parseNum(value)
  const display = isFocused
    ? raw
    : numVal > 0 ? numVal.toLocaleString('en-US') : ''

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    // Seed raw from the current prop value so editing starts from the right number
    setRaw(numVal > 0 ? String(numVal) : '')
    setIsFocused(true)
    setTimeout(() => e.target.select(), 0)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Only allow digits — no parent update during typing, so no re-render/focus-loss
    const digits = e.target.value.replace(/[^0-9]/g, '')
    setRaw(digits)
  }

  function handleBlur() {
    setIsFocused(false)
    const n = parseNum(raw)
    const digits = n > 0 ? String(n) : ''
    setRaw(digits)
    onChange(digits)
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
