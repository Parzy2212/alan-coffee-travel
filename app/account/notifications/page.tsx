'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AccountLayout } from '@/components/AccountLayout'
import { EmailNotificationsCard } from '@/components/account/EmailNotificationsCard'
import { TelegramNotificationsCard } from '@/components/account/TelegramNotificationsCard'
import { NotificationScheduleCard } from '@/components/account/NotificationScheduleCard'
import { useAuth } from '@/contexts/AuthContext'
import { loadNotificationPrefs, saveNotificationPrefs, type NotificationPrefs } from '@/lib/notification-preferences'

export default function NotificationsPage() {
  const { user } = useAuth()
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null)
  const [loading, setLoading] = useState(true)
  const [shopId, setShopId] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!user) return
    async function init() {
      const { authClient } = await import('@/lib/supabase-auth')
      const { data: su } = await authClient
        .from('shop_users')
        .select('shop_id')
        .eq('user_id', user!.id)
        .maybeSingle()
      const sid = su?.shop_id ?? null
      setShopId(sid)
      const p = await loadNotificationPrefs(user!.id, sid)
      setPrefs(p)
      setLoading(false)
    }
    init()
  }, [user])

  const persist = useCallback((updated: NotificationPrefs) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      await saveNotificationPrefs(updated)
      setSavedAt(Date.now())
      // If no id yet, reload to get the inserted row's id
      if (!updated.id) {
        const fresh = await loadNotificationPrefs(updated.user_id!, updated.shop_id ?? null)
        setPrefs(fresh)
      }
    }, 500)
  }, [])

  const handleChange = useCallback((patch: Partial<NotificationPrefs>) => {
    setPrefs(prev => {
      if (!prev) return prev
      const updated = { ...prev, ...patch }
      persist(updated)
      return updated
    })
  }, [persist])

  if (loading || !prefs) {
    return (
      <AccountLayout>
        <div style={{ marginBottom: 28 }}>
          <div style={{ height: 28, width: 160, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 6, marginBottom: 8 }} />
          <div style={{ height: 16, width: 300, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 4 }} />
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: 180, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.04)', marginBottom: 24 }} />
        ))}
      </AccountLayout>
    )
  }

  return (
    <AccountLayout>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: 'white', fontWeight: 800, fontSize: 22, fontFamily: 'var(--font-heading)', marginBottom: 4 }}>
          การแจ้งเตือน
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>
          ปรับแต่งวิธีที่คุณรับการแจ้งเตือนจาก Alan Cafe OS
        </p>
      </div>

      {!shopId && (
        <div style={{
          backgroundColor: 'rgba(255,185,0,0.08)', border: '1px solid rgba(255,185,0,0.2)',
          borderRadius: 10, padding: '12px 16px', marginBottom: 24,
          color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.6,
        }}>
          การตั้งค่าบางอย่างจะใช้งานได้เมื่อคุณเป็นสมาชิกของร้านค้า
        </div>
      )}

      <EmailNotificationsCard prefs={prefs} onChange={handleChange} savedAt={savedAt} />
      <TelegramNotificationsCard prefs={prefs} onChange={handleChange} />
      <NotificationScheduleCard prefs={prefs} onChange={handleChange} />

      <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, lineHeight: 1.7, marginBottom: 24 }}>
        การส่งอีเมลจริงจะเริ่มต้นในเร็วๆ นี้ การตั้งค่าที่บันทึกไว้จะถูกใช้อัตโนมัติเมื่อระบบพร้อม
      </div>
    </AccountLayout>
  )
}
