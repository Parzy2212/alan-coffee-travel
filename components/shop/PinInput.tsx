'use client'

import { useRef } from 'react'

const GOLD = '#c9a84c'

interface PinInputProps {
  value: string
  onChange: (pin: string) => void
  visible?: boolean
  disabled?: boolean
  error?: boolean
}

export function PinInput({ value, onChange, visible = false, disabled, error }: PinInputProps) {
  const r0 = useRef<HTMLInputElement>(null)
  const r1 = useRef<HTMLInputElement>(null)
  const r2 = useRef<HTMLInputElement>(null)
  const r3 = useRef<HTMLInputElement>(null)
  const refs = [r0, r1, r2, r3]

  const digits = [value[0] ?? '', value[1] ?? '', value[2] ?? '', value[3] ?? '']

  const handleChange = (idx: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[idx] = digit
    onChange(next.join(''))
    if (digit && idx < 3) refs[idx + 1].current?.focus()
  }

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (digits[idx]) {
        const next = [...digits]; next[idx] = ''
        onChange(next.join(''))
      } else if (idx > 0) {
        const next = [...digits]; next[idx - 1] = ''
        onChange(next.join(''))
        refs[idx - 1].current?.focus()
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      refs[idx - 1].current?.focus()
    } else if (e.key === 'ArrowRight' && idx < 3) {
      refs[idx + 1].current?.focus()
    }
  }

  const borderColor = error ? '#ff6b6b' : GOLD
  const bgFilled    = error ? 'rgba(255,77,77,0.15)' : 'rgba(201,168,76,0.12)'

  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {digits.map((d, idx) => (
        <input
          key={idx}
          ref={refs[idx]}
          type={visible ? 'text' : 'password'}
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={e => handleChange(idx, e.target.value)}
          onKeyDown={e => handleKeyDown(idx, e)}
          onFocus={e => e.target.select()}
          disabled={disabled}
          style={{
            width: 56, height: 62, textAlign: 'center', fontSize: 22, fontWeight: 700,
            backgroundColor: d ? bgFilled : 'rgba(255,255,255,0.04)',
            border: `2px solid ${d ? borderColor : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 10, color: 'white', outline: 'none',
            fontFamily: 'inherit', transition: 'all 0.15s', boxSizing: 'border-box',
            cursor: disabled ? 'not-allowed' : 'text',
          }}
        />
      ))}
    </div>
  )
}
