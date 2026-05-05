'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

const GOLD = '#c9a84c'

export function AuthGuard({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/login')
    }
  }, [session, loading, router])

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0a0a0a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 16,
      }}>
        <div style={{ color: GOLD, fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px' }}>
          ALAN <span style={{ color: 'rgba(201,168,76,0.4)', fontSize: 14, letterSpacing: '2px', fontWeight: 600 }}>CafeOS</span>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>กำลังโหลด...</div>
      </div>
    )
  }

  if (!session) return null

  return <>{children}</>
}
