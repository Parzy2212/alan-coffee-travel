import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json() as { email?: string; password?: string }
  if (!email || !password) {
    return NextResponse.json({ error: 'กรุณาใส่อีเมลและรหัสผ่าน' }, { status: 400 })
  }

  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const svc  = process.env.SUPABASE_SERVICE_ROLE_KEY!

  // Authenticate as the owner
  const authClient = createClient(url, anon)
  const { data: authData, error: authError } = await authClient.auth.signInWithPassword({ email, password })
  if (authError || !authData.user) {
    return NextResponse.json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 })
  }

  // Find their shop via service role (bypasses RLS)
  const admin = createClient(url, svc, { auth: { persistSession: false } })
  const { data: shopUser, error: shopErr } = await admin
    .from('shop_users')
    .select('shop_id, role')
    .eq('user_id', authData.user.id)
    .eq('active', true)
    .in('role', ['owner', 'manager'])
    .single()

  if (shopErr || !shopUser) {
    return NextResponse.json({ error: 'ไม่พบร้านค้า หรือไม่มีสิทธิ์รีเซ็ต PIN' }, { status: 403 })
  }

  // Reset all active employee PINs
  const { error: resetErr } = await admin.rpc('reset_employee_pins', {
    p_shop_id: shopUser.shop_id,
    p_new_pin: '1234',
  })

  if (resetErr) {
    return NextResponse.json({ error: 'รีเซ็ตไม่สำเร็จ: ' + resetErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, newPin: '1234' })
}
