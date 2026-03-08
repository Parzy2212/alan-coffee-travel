import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('[Supabase] MISSING env vars — NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl, '| NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? '(set)' : '(MISSING)')
}

export const supabase = createClient(supabaseUrl, supabaseKey)