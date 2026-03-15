import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (_client) return _client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fmsdfcsqdpdlppucuptn.supabase.co'
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtc2RmY3NxZHBkbHBwdWN1cHRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMTgxNDksImV4cCI6MjA4NzU5NDE0OX0.LQ8kzdNml5HK4m12Mj4fPm2FL8MXc17vDAfrKl6sRS4'
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  return _client
}

// Legacy named export for compatibility with existing imports
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
