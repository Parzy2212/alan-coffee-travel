import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fmsdfcsqdpdlppucuptn.supabase.co'
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtc2RmY3NxZHBkbHBwdWN1cHRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMTgxNDksImV4cCI6MjA4NzU5NDE0OX0.LQ8kzdNml5HK4m12Mj4fPm2FL8MXc17vDAfrKl6sRS4'

// Auth-enabled client — only used in browser contexts for login/signup/session.
// Kept separate from the public anon client (lib/supabase.ts) which disables
// auth to avoid SSR localStorage issues on public travel pages.
export const authClient = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'alan_pos_session',
  },
})

// a lost connection: no code, only the browser's own text (Chrome "Failed to fetch" / "network error"
// while reading the answer, Firefox "NetworkError ...", Safari "Load failed")
export function isNetworkError(error: { code?: string; message: string }): boolean {
  return !error.code && /Failed to fetch|NetworkError|network error|Load failed/i.test(error.message)
}

// 42501 = the database refused the caller (not signed in as the shop owner / manager).
// Neutral on purpose: callers that write say themselves whether a retry could save twice.
export function dbErrorText(error: { code?: string; message: string }): string {
  if (error.code === '42501') return 'บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้ (ต้องเข้าสู่ระบบด้วยบัญชีเจ้าของร้านหรือผู้จัดการ)'
  if (isNetworkError(error)) return 'เชื่อมต่อไม่ได้ อินเทอร์เน็ตอาจหลุด'
  return error.message
}
