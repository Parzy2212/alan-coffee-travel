import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdminAuthConfigured, readAdminCookies, verifyAdminSession } from '@/lib/admin-session'

export const runtime = 'edge'

// ─── Allowed tables and actions (whitelist — never trust client input) ─────────

const ALLOWED_TABLES = [
  'destinations',
  'guides',
  'guide_destinations',
  'site_settings',
] as const
type AllowedTable = (typeof ALLOWED_TABLES)[number]

const ALLOWED_ACTIONS = [
  'insert',
  'update',
  'delete',
  'delete_match',
  'insert_many',
  'upsert',
] as const
type AllowedAction = (typeof ALLOWED_ACTIONS)[number]

// delete_match only allowed on specific columns (prevent arbitrary column injection)
const ALLOWED_MATCH_COLUMNS = ['guide_id', 'id', 'key'] as const

// ─── Service-role Supabase client (server-side only, bypasses RLS) ───────────

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured on the server.')
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    // 1. Verify admin session cookie (middleware does not cover /api)
    if (!isAdminAuthConfigured()) {
      return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 })
    }
    const cookieHeader = request.headers.get('cookie')
    if (readAdminCookies(cookieHeader).length === 0) {
      return NextResponse.json({ error: 'Unauthorized — no session.' }, { status: 401 })
    }
    if (!(await verifyAdminSession(cookieHeader))) {
      return NextResponse.json({ error: 'Unauthorized — invalid session.' }, { status: 401 })
    }

    // 2. Parse and validate request body
    let body: {
      table?: unknown
      action?: unknown
      data?: unknown
      id?: unknown
      column?: unknown
      value?: unknown
      rows?: unknown
    }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
    }

    const { table, action, data, id, column, value, rows } = body

    if (typeof table !== 'string' || !(ALLOWED_TABLES as readonly string[]).includes(table)) {
      return NextResponse.json({ error: `Table '${table}' is not allowed.` }, { status: 400 })
    }
    if (typeof action !== 'string' || !(ALLOWED_ACTIONS as readonly string[]).includes(action)) {
      return NextResponse.json({ error: `Action '${action}' is not allowed.` }, { status: 400 })
    }

    const safeTable = table as AllowedTable
    const safeAction = action as AllowedAction

    // The shared admin password must not reach the shop's payment details or any other shop
    // setting: those are owner-only through update_payment_setting / update_site_setting (051/052).
    if (safeTable === 'site_settings') {
      const d = data as Record<string, unknown> | null
      const heroOnly = safeAction === 'upsert' && !!d && typeof d === 'object' && !Array.isArray(d)
        && Object.keys(d).every(k => k === 'key' || k === 'value')
        && d.key === 'hero_image_url' && typeof d.value === 'string'
      if (!heroOnly) {
        return NextResponse.json({ error: 'Only hero_image_url can be changed here.' }, { status: 403 })
      }
    }

    // 3. Execute with service-role client (bypasses RLS)
    const supabase = getServiceClient()
    let result: unknown = { ok: true }

    switch (safeAction) {
      case 'insert': {
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          return NextResponse.json({ error: 'data (object) required for insert.' }, { status: 400 })
        }
        const { data: inserted, error } = await supabase
          .from(safeTable)
          .insert([data])
          .select()
          .single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        result = inserted
        break
      }

      case 'update': {
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          return NextResponse.json({ error: 'data (object) required for update.' }, { status: 400 })
        }
        if (typeof id !== 'string' || !id) {
          return NextResponse.json({ error: 'id (string) required for update.' }, { status: 400 })
        }
        const { error } = await supabase.from(safeTable).update(data).eq('id', id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        break
      }

      case 'delete': {
        if (typeof id !== 'string' || !id) {
          return NextResponse.json({ error: 'id (string) required for delete.' }, { status: 400 })
        }
        const { error } = await supabase.from(safeTable).delete().eq('id', id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        break
      }

      case 'delete_match': {
        if (
          typeof column !== 'string' ||
          !(ALLOWED_MATCH_COLUMNS as readonly string[]).includes(column)
        ) {
          return NextResponse.json({ error: `Column '${column}' is not allowed for delete_match.` }, { status: 400 })
        }
        if (typeof value !== 'string' || !value) {
          return NextResponse.json({ error: 'value (string) required for delete_match.' }, { status: 400 })
        }
        const { error } = await supabase.from(safeTable).delete().eq(column, value)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        break
      }

      case 'insert_many': {
        if (!Array.isArray(rows)) {
          return NextResponse.json({ error: 'rows (array) required for insert_many.' }, { status: 400 })
        }
        if (rows.length === 0) break // nothing to insert, return ok
        const { error } = await supabase.from(safeTable).insert(rows)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        break
      }

      case 'upsert': {
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          return NextResponse.json({ error: 'data (object) required for upsert.' }, { status: 400 })
        }
        const { error } = await supabase.from(safeTable).upsert(data)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        break
      }
    }

    const { error: auditErr } = await supabase.from('audit_logs').insert({
      action:     safeAction,
      table_name: safeTable,
      row_id:     typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id) ? id : null,
      after_data: (data ?? rows ?? (column ? { column, value } : {})) as Record<string, unknown>,
      staff_name: 'admin (shared password)',
      ip_address: request.headers.get('cf-connecting-ip'),
    })
    // The change itself is already saved, so the response stays ok; a missing log line goes to the server log
    if (auditErr) console.error('admin audit log not written:', auditErr.message)

    return NextResponse.json({ ok: true, data: result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
