// Public registration API. Actions: lookup · start · status
import { cors, json, fail, db, normPhone, token, firstName, validEmail, paystack, settle } from '../_shared/common.ts'

const HOLD_MINUTES = 30 // an unpaid guest checkout holds a seat this long

async function findInvite(tok: string, kind: string) {
  const col = kind === 'guest' ? 'guest_token' : 'token'
  const { data } = await db.from('reg_invites')
    .select('id, token, guest_token, revoked, alumni:alumni_id(id, name, phone), edition:edition_id(*)')
    .eq(col, String(tok || '').trim().toLowerCase()).maybeSingle()
  if (!data || data.revoked) return null
  return data as any
}

async function menuFor(editionId: string) {
  const { data } = await db.from('reg_menu_items')
    .select('id, category, name, description, price_kobo')
    .eq('edition_id', editionId).eq('active', true).order('sort').order('name')
  return data || []
}

async function guestSeatsTaken(inviteId: string) {
  const since = new Date(Date.now() - HOLD_MINUTES * 60_000).toISOString()
  const { data } = await db.from('reg_registrations')
    .select('status, created_at').eq('invite_id', inviteId).eq('kind', 'guest')
    .in('status', ['paid', 'pending'])
  return (data || []).filter(r => r.status === 'paid' || r.created_at > since).length
}

async function alumnusPaid(inviteId: string) {
  const { data } = await db.from('reg_registrations')
    .select('id').eq('invite_id', inviteId).eq('kind', 'alumni').eq('status', 'paid').maybeSingle()
  return !!data
}

const ordersOpen = (ed: any) => ed.is_open && (!ed.orders_close_at || new Date(ed.orders_close_at) > new Date())

function publicEdition(ed: any) {
  return {
    title: ed.title, theme: ed.theme, line: ed.line, date_label: ed.date_label,
    guest_fee_kobo: ed.guest_fee_kobo, guests_per_alumnus: ed.guests_per_alumnus,
    open: ordersOpen(ed),
  }
}

async function lookup(body: any) {
  const kind = body.kind === 'guest' ? 'guest' : 'alumni'
  const inv = await findInvite(body.token, kind)
  if (!inv) return fail('This link is not valid.', 404)
  const ed = inv.edition
  const out: any = { kind, edition: publicEdition(ed), menu: await menuFor(ed.id) }

  if (kind === 'alumni') {
    out.firstName = firstName(inv.alumni.name)
    out.confirmed = await alumnusPaid(inv.id)
    if (out.confirmed) {
      out.guestToken = inv.guest_token
      out.guestSeatsTaken = await guestSeatsTaken(inv.id)
      out.venue_label = ed.venue_label
    }
  } else {
    out.hostFirstName = firstName(inv.alumni.name)
    out.seatsLeft = Math.max(0, ed.guests_per_alumnus - await guestSeatsTaken(inv.id))
  }
  return json(out)
}

async function start(body: any) {
  const kind = body.kind === 'guest' ? 'guest' : 'alumni'
  const inv = await findInvite(body.token, kind)
  if (!inv) return fail('This link is not valid.', 404)
  const ed = inv.edition
  if (!ordersOpen(ed)) return fail('Registration for this edition has closed.')

  const phone = normPhone(body.phone)
  if (!phone) return fail('Enter a valid phone number.')
  const email = String(body.email || '').trim().toLowerCase()
  if (!validEmail(email)) return fail('Enter a valid email for your receipt.')

  let name: string
  let entry = 0
  if (kind === 'alumni') {
    if (phone !== inv.alumni.phone) return fail("That number doesn't match the one we have for you.")
    if (await alumnusPaid(inv.id)) return fail("You're already confirmed.")
    name = inv.alumni.name
  } else {
    name = String(body.name || '').trim().replace(/\s+/g, ' ')
    if (name.length < 3) return fail('Enter your full name.')
    if (phone === inv.alumni.phone) return fail('This seat is for a guest.')
    if (await guestSeatsTaken(inv.id) >= ed.guests_per_alumnus) return fail('Both seats on this link are taken.')
    entry = ed.guest_fee_kobo
  }

  const { data: already } = await db.from('reg_registrations')
    .select('id').eq('edition_id', ed.id).eq('phone', phone).eq('status', 'paid').maybeSingle()
  if (already) return fail('This number is already confirmed for this edition.')

  // Food: priced server-side, never trust the browser's totals
  const wanted = (Array.isArray(body.items) ? body.items : [])
    .map((i: any) => ({ id: String(i.id), qty: Math.floor(Number(i.qty)) }))
    .filter((i: any) => i.qty > 0)
  if (!wanted.length) return fail('Choose at least one item from the menu.')
  if (wanted.some((i: any) => i.qty > 5)) return fail('Maximum of 5 of any item.')
  const menu = await menuFor(ed.id)
  const lines = wanted.map((w: any) => {
    const m = menu.find(x => x.id === w.id)
    return m && { menu_item_id: m.id, name: m.name, qty: w.qty, unit_kobo: m.price_kobo }
  })
  if (lines.some((l: any) => !l)) return fail('Part of your order is no longer on the menu. Refresh and try again.')
  const food = lines.reduce((s: number, l: any) => s + l.qty * l.unit_kobo, 0)
  const total = entry + food

  const reference = `N2MY-${ed.slug.toUpperCase()}-${token(10).toUpperCase()}`
  const { data: reg, error } = await db.from('reg_registrations').insert({
    edition_id: ed.id, invite_id: inv.id, kind, name, phone, email,
    about: String(body.about || '').slice(0, 280),
    entry_kobo: entry, food_kobo: food, total_kobo: total, reference,
  }).select('id').single()
  if (error) return fail('Could not start registration. Try again.', 500)
  await db.from('reg_order_items').insert(lines.map((l: any) => ({ ...l, registration_id: reg.id })))

  const site = Deno.env.get('SITE_URL') || 'https://maisondeslesnobles.com'
  try {
    const tx = await paystack('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email, amount: total, currency: 'NGN', reference,
        callback_url: `${site}/ix/done`,
        metadata: { kind, name, edition: ed.slug, cancel_action: `${site}/ix/${kind === 'guest' ? 'g/' + inv.guest_token : inv.token}` },
      }),
    })
    return json({ authorization_url: tx.authorization_url, reference })
  } catch (e) {
    await db.from('reg_registrations').update({ status: 'cancelled' }).eq('id', reg.id)
    console.error('Paystack init failed', (e as Error).message)
    return fail('Payment could not be started. Try again shortly.', 502)
  }
}

async function status(body: any) {
  const reference = String(body.reference || '')
  const result = await settle(reference).catch(() => ({ status: 'pending' as const }))
  if (result.status === 'unknown') return fail('Registration not found.', 404)

  const { data: reg } = await db.from('reg_registrations')
    .select('kind, name, total_kobo, entry_kobo, food_kobo, invite:invite_id(token, guest_token), edition:edition_id(*), items:reg_order_items(name, qty, unit_kobo)')
    .eq('reference', reference).single()
  const r = reg as any
  const out: any = {
    status: result.status, kind: r.kind, firstName: firstName(r.name),
    edition: publicEdition(r.edition), items: r.items,
    entry_kobo: r.entry_kobo, food_kobo: r.food_kobo, total_kobo: r.total_kobo,
  }
  if (result.status === 'paid') {
    out.venue_label = r.edition.venue_label
    if (r.kind === 'alumni') out.guestToken = r.invite.guest_token
    out.backToken = r.kind === 'alumni' ? r.invite.token : null
  }
  return json(out)
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return fail('Method not allowed', 405)
  try {
    const body = await req.json()
    if (body.action === 'lookup') return await lookup(body)
    if (body.action === 'start') return await start(body)
    if (body.action === 'status') return await status(body)
    return fail('Unknown action')
  } catch (e) {
    console.error(e)
    return fail('Something went wrong.', 500)
  }
})
