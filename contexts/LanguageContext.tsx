'use client'
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export type Lang = 'en' | 'lo' | 'th'

interface LanguageContextType {
  lang: Lang
  setLang: (lang: Lang) => void
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'en',
  setLang: () => {},
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('alan_lang') as Lang | null
      if (saved && ['en', 'lo', 'th'].includes(saved)) {
        setLangState(saved)
        document.documentElement.setAttribute('data-lang', saved)
      } else {
        document.documentElement.setAttribute('data-lang', 'en')
      }
    } catch { /* iOS Safari private mode */ }
  }, [])

  function setLang(l: Lang) {
    setLangState(l)
    document.documentElement.setAttribute('data-lang', l)
    try { localStorage.setItem('alan_lang', l) } catch { /* iOS Safari private mode */ }
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLang() {
  return useContext(LanguageContext)
}
