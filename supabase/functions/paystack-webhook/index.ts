// Paystack calls this after a payment. Deployed with JWT verification OFF;
// authenticity is proven by the HMAC signature instead.
import { settle } from '../_shared/common.ts'

async function hmacSha512Hex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return Array.from(new Uint8Array(sig), b => b.toString(16).padStart(2, '0')).join('')
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('ok')
  const raw = await req.text()
  const expected = await hmacSha512Hex(Deno.env.get('PAYSTACK_SECRET_KEY')!, raw)
  const given = req.headers.get('x-paystack-signature') || ''
  if (!safeEqual(expected, given)) return new Response('bad signature', { status: 401 })

  const event = JSON.parse(raw)
  if (event.event === 'charge.success' && event.data?.reference) {
    // settle() re-verifies with Paystack and checks the amount before marking paid
    await settle(event.data.reference).catch(e => console.error('settle', e))
  }
  return new Response('ok')
})
