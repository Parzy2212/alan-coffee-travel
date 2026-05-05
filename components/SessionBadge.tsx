'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useShop } from '@/contexts/ShopContext'

// Floating session indicator — position:fixed, doesn't disrupt any layout
export function SessionBadge() {
  const { user, signOut } = useAuth()
  const { shop } = useShop()
  const router = useRouter()

  if (!user) return null

  const handleLogout = async () => {
    await signOut()
    router.replace('/login')
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 16,
      right: 16,
      zIndex: 9999,
      backgroundColor: 'rgba(17,17,17,0.96)',
      border: '1px solid rgba(201,168,76,0.2)',
      borderRadius: 10,
      padding: '8px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      backdropFilter: 'blur(10px)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
    }}>
      <div>
        {shop && (
          <div style={{ color: '#c9a84c', fontSize: 11, fontWeight: 700, letterSpacing: '0.5px' }}>
            {shop.name}
          </div>
        )}
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>
          {user.email}
        </div>
      </div>
      <button
        onClick={handleLogout}
        style={{
          background: 'none',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 6,
          padding: '4px 12px',
          color: 'rgba(255,255,255,0.45)',
          fontSize: 11,
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'all 0.15s',
          whiteSpace: 'nowrap',
        }}
      >
        ออกจากระบบ
      </button>
    </div>
  )
}
