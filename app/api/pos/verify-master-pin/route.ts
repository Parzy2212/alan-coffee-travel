import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { pin } = await req.json() as { pin?: string }
  const master = process.env.MASTER_PIN
  if (!master) {
    return NextResponse.json({ error: 'Master PIN not configured' }, { status: 503 })
  }
  if (!pin || pin !== master) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  return NextResponse.json({ ok: true })
}
