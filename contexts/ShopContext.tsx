'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './AuthContext'

export interface Shop {
  id: string
  slug: string
  name: string
  currency: string
  timezone: string
  language: string
  plan: 'free' | 'pro' | 'enterprise'
  logo_url: string | null
  city: string | null
  country: string
}

interface ShopContextType {
  shop: Shop | null
  loading: boolean
}

// Single-tenant fallback — always alan-cafe until multi-tenant is live
const ALAN_CAFE: Shop = {
  id: 'pending',  // replaced from DB after migration runs
  slug: 'alan-cafe',
  name: 'Alan Coffee & Travel',
  currency: 'LAK',
  timezone: 'Asia/Vientiane',
  language: 'th',
  plan: 'free',
  logo_url: null,
  city: 'Attapeu',
  country: 'LA',
}

const ShopContext = createContext<ShopContextType>({ shop: null, loading: true })

export function ShopProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [shop, setShop] = useState<Shop | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      setShop(null)
      setLoading(false)
      return
    }

    // Try to load shop from DB; fall back to alan-cafe if table doesn't exist yet
    loadShop(user.id, user.email ?? '')
  }, [user, authLoading])

  const loadShop = async (userId: string, email: string) => {
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data, error } = await supabase
        .from('shop_users')
        .select('shop_id, role, shops(id, slug, name, currency, timezone, language, plan, logo_url, city, country)')
        .or(`user_id.eq.${userId},email.eq.${email}`)
        .eq('active', true)
        .maybeSingle()

      if (!error && data?.shops) {
        const s = Array.isArray(data.shops) ? data.shops[0] : data.shops
        setShop(s as Shop)
      } else {
        setShop(ALAN_CAFE)
      }
    } catch {
      setShop(ALAN_CAFE)
    }
    setLoading(false)
  }

  return (
    <ShopContext.Provider value={{ shop, loading }}>
      {children}
    </ShopContext.Provider>
  )
}

export const useShop = () => useContext(ShopContext)
