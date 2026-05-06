'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'

interface AuthContextType {
  session: Session | null
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let sub: { unsubscribe: () => void } | null = null

    import('@/lib/supabase-auth').then(({ authClient }) => {
      authClient.auth.getSession().then(({ data }) => {
        setSession(data.session)
        setLoading(false)
      })

      const { data } = authClient.auth.onAuthStateChange((_event, session) => {
        setSession(session)
        setLoading(false)
      })
      sub = data.subscription
    })

    return () => { sub?.unsubscribe() }
  }, [])

  const signIn = async (email: string, password: string) => {
    const { authClient } = await import('@/lib/supabase-auth')
    const { data, error } = await authClient.auth.signInWithPassword({ email, password })
    if (!error && data.user) {
      try {
        await authClient.from('account_events').insert({
          user_id: data.user.id,
          event_type: 'login',
        })
      } catch { /* non-fatal */ }
    }
    return { error: error?.message ?? null }
  }

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { authClient } = await import('@/lib/supabase-auth')
    const { error } = await authClient.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    return { error: error?.message ?? null }
  }

  const signOut = async () => {
    const { authClient } = await import('@/lib/supabase-auth')
    const { data: { user: currentUser } } = await authClient.auth.getUser()
    if (currentUser) {
      try {
        await authClient.from('account_events').insert({
          user_id: currentUser.id,
          event_type: 'logout',
        })
      } catch { /* non-fatal */ }
    }
    await authClient.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
