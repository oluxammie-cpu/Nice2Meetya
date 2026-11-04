import { createClient } from 'npm:@supabase/supabase-js@2'

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

export const fail = (message: string, status = 400) => json({ error: message }, status)

// Service-role client: bypasses RLS. Never exposed to the browser.
export const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
)

/** Normalise Nigerian numbers to 234XXXXXXXXXX. Returns null if invalid. */
export function normPhone(input: string): string | null {
  let d = String(input || '').replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('0') && d.length === 11) d = '234' + d.slice(1)
  if (d.length === 10 && /^[789]/.test(d)) d = '234' + d
  if (/^234[789]\d{9}$/.test(d)) return d
  // allow international numbers for diaspora guests
  if (d.length >= 10 && d.length <= 15 && !d.startsWith('0')) return d
  return null
}

export function token(len = 10) {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789' // no look-alikes
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('')
}

export const firstName = (n: string) => String(n || '').trim().split(/\s+/)[0]

export const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '').trim())

const PAYSTACK = 'https://api.paystack.co'
export async function paystack(path: string, init: RequestInit = {}) {
  const res = await fetch(PAYSTACK + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || body.status === false) throw new Error(body.message || `Paystack ${res.status}`)
  return body.data
}

/** Mark a registration paid if Paystack confirms the exact amount. Idempotent. */
export async function settle(reference: string) {
  const { data: reg } = await db.from('reg_registrations')
    .select('id, status, total_kobo').eq('reference', reference).maybeSingle()
  if (!reg) return { status: 'unknown' as const }
  if (reg.status === 'paid') return { status: 'paid' as const, id: reg.id }

  const tx = await paystack(`/transaction/verify/${encodeURIComponent(reference)}`)
  if (tx.status !== 'success') return { status: 'pending' as const, id: reg.id }
  if (Number(tx.amount) !== reg.total_kobo || tx.currency !== 'NGN') {
    console.error('Amount mismatch', reference, tx.amount, reg.total_kobo)
    return { status: 'mismatch' as const, id: reg.id }
  }
  const { error } = await db.from('reg_registrations')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', reg.id).eq('status', 'pending')
  if (error) {
    // Most likely: this phone already holds a paid seat (unique index).
    console.error('Settle failed', reference, error.message)
    return { status: 'duplicate' as const, id: reg.id }
  }
  return { status: 'paid' as const, id: reg.id }
}
