'use client'

import { useLang, type Lang } from '@/contexts/LanguageContext'

const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'th', label: 'ไทย' },
  { code: 'lo', label: 'ລາວ' },
]

const GOLD = '#c9a84c'

export function LanguageSwitcher() {
  const { lang, setLang } = useLang()

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 2, border: '1px solid rgba(255,255,255,0.08)' }}>
      {LANGS.map(l => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          style={{
            padding: '0 10px', height: 30, borderRadius: 6, border: 'none',
            backgroundColor: lang === l.code ? `${GOLD}22` : 'transparent',
            color: lang === l.code ? GOLD : 'rgba(255,255,255,0.35)',
            fontSize: 11, fontWeight: lang === l.code ? 800 : 500,
            cursor: 'pointer', transition: 'all 0.15s',
            outline: 'none',
          }}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}
