import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

// ─── Cookie parser (edge-compatible — no next/headers required) ───────────────

function getSessionCookie(request: Request): string | undefined {
  const header = request.headers.get('cookie') ?? ''
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === 'admin_session') return v.join('=')
  }
  return undefined
}

// ─── SHA-256 token derivation (same as middleware + login route) ──────────────

async function computeExpectedToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`${password}:alan-admin`)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

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
    // 1. Verify admin session cookie (same logic as middleware.ts)
    const adminPassword = process.env.ADMIN_PASSWORD
    if (!adminPassword) {
      return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 })
    }
    const sessionCookie = getSessionCookie(request)
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized — no session.' }, { status: 401 })
    }
    const expectedToken = await computeExpectedToken(adminPassword)
    if (sessionCookie !== expectedToken) {
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

    // Non-blocking audit log (best-effort — ignored if table doesn't exist)
    void supabase.from('audit_logs').insert({
      action:     safeAction,
      table_name: safeTable,
      record_id:  typeof id === 'string' ? id : null,
      payload:    (data ?? rows ?? (column ? { column, value } : {})) as Record<string, unknown>,
      created_at: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true, data: result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
