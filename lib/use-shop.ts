'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export interface Shop {
  id: string
  slug: string
  name: string
  description: string | null
  phone: string | null
  email: string | null
  city: string | null
  country: string | null
  currency: string
  language: string
  timezone: string | null
  operating_hours: Record<string, { open: string; close: string; closed: boolean }> | null
  payment_methods: { cash: boolean; qr: boolean; card: boolean; transfer: boolean } | null
}

export function useShop() {
  const { user } = useAuth()
  const [shop, setShop] = useState<Shop | null>(null)
  const [shopId, setShopId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function load() {
      const { authClient } = await import('@/lib/supabase-auth')

      const { data: su } = await authClient
        .from('shop_users')
        .select('shop_id')
        .eq('user_id', user!.id)
        .eq('role', 'owner')
        .maybeSingle()

      if (cancelled) return
      if (!su?.shop_id) { setLoading(false); return }

      setShopId(su.shop_id)

      const { data: s } = await authClient
        .from('shops')
        .select('id, slug, name, description, phone, email, city, country, currency, language, timezone, operating_hours, payment_methods')
        .eq('id', su.shop_id)
        .maybeSingle()

      if (!cancelled) {
        setShop((s as Shop) ?? null)
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [user])

  return { shop, shopId, loading, setShop }
}
