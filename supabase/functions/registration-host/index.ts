// Host-only API. Requires a signed-in Supabase user whose email is in HOST_EMAILS.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { cors, json, fail, db, normPhone, token } from '../_shared/common.ts'

async function hostFrom(req: Request) {
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!jwt) return null
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
  const { data } = await client.auth.getUser(jwt)
  const email = data.user?.email?.toLowerCase()
  const allowed = (Deno.env.get('HOST_EMAILS') || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean)
  return email && allowed.includes(email) ? email : null
}

async function edition(slug = 'ix') {
  const { data } = await db.from('reg_editions').select('*').eq('slug', slug).maybeSingle()
  return data
}

async function overview(ed: any) {
  const [alumni, invites, regs, menu] = await Promise.all([
    db.from('alumni').select('id, name, phone, note').order('name'),
    db.from('reg_invites').select('id, alumni_id, token, guest_token, revoked').eq('edition_id', ed.id),
    db.from('reg_registrations')
      .select('id, invite_id, kind, name, phone, email, about, entry_kobo, food_kobo, total_kobo, status, reference, paid_at, created_at, items:reg_order_items(name, qty, unit_kobo)')
      .eq('edition_id', ed.id).neq('status', 'cancelled').order('created_at'),
    db.from('reg_menu_items').select('*').eq('edition_id', ed.id).order('sort').order('name'),
  ])
  return json({
    edition: ed,
    alumni: alumni.data || [],
    invites: invites.data || [],
    registrations: regs.data || [],
    menu: menu.data || [],
  })
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    if (!await hostFrom(req)) return fail('Not authorised.', 401)
    const body = await req.json()
    const ed = await edition(body.slug)
    if (!ed) return fail('Edition not found.', 404)

    switch (body.action) {
      case 'overview':
        return await overview(ed)

      case 'import_alumni': {
        const rows = (body.rows || []).map((r: any) => ({ name: String(r.name || '').trim(), phone: normPhone(r.phone) }))
        const good = rows.filter((r: any) => r.name && r.phone)
        const bad = rows.length - good.length
        // de-duplicate within the paste
        const unique = Object.values(Object.fromEntries(good.map((r: any) => [r.phone, r])))
        if (unique.length) {
          const { error } = await db.from('alumni').upsert(unique, { onConflict: 'phone' })
          if (error) return fail(error.message, 500)
        }
        return json({ imported: unique.length, skipped: bad })
      }

      case 'invite': {
        for (const alumni_id of body.alumni_ids || []) {
          const { data: existing } = await db.from('reg_invites').select('id')
            .eq('edition_id', ed.id).eq('alumni_id', alumni_id).maybeSingle()
          if (existing) await db.from('reg_invites').update({ revoked: false }).eq('id', existing.id)
          else await db.from('reg_invites').insert({ edition_id: ed.id, alumni_id, token: token(10), guest_token: token(10) })
        }
        return await overview(ed)
      }

      case 'revoke':
        await db.from('reg_invites').update({ revoked: true }).eq('id', body.invite_id).eq('edition_id', ed.id)
        return await overview(ed)

      case 'save_edition': {
        const allowed = ['title', 'theme', 'line', 'date_label', 'venue_label', 'guest_fee_kobo', 'guests_per_alumnus', 'is_open', 'orders_close_at']
        const patch = Object.fromEntries(Object.entries(body.patch || {}).filter(([k]) => allowed.includes(k)))
        await db.from('reg_editions').update(patch).eq('id', ed.id)
        return await overview(await edition(ed.slug))
      }

      case 'save_menu_item': {
        const it = body.item || {}
        const row = {
          edition_id: ed.id, category: String(it.category || 'Mains'), name: String(it.name || '').trim(),
          description: String(it.description || ''), price_kobo: Math.max(0, Math.round(Number(it.price_kobo) || 0)),
          active: it.active !== false, sort: Number(it.sort) || 0,
        }
        if (!row.name) return fail('Name the dish.')
        if (it.id) await db.from('reg_menu_items').update(row).eq('id', it.id).eq('edition_id', ed.id)
        else await db.from('reg_menu_items').insert(row)
        return await overview(ed)
      }

      case 'remove_menu_item': {
        // keep history if anyone has ordered it — just hide it
        const { count } = await db.from('reg_order_items').select('id', { count: 'exact', head: true }).eq('menu_item_id', body.id)
        if (count) await db.from('reg_menu_items').update({ active: false }).eq('id', body.id)
        else await db.from('reg_menu_items').delete().eq('id', body.id)
        return await overview(ed)
      }

      default:
        return fail('Unknown action')
    }
  } catch (e) {
    console.error(e)
    return fail('Something went wrong.', 500)
  }
})
