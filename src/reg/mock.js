// Preview-only data so pages can be seen without the database. All dummies.
const edition = {
  id: 'e1', slug: 'ix', title: 'Edition IX', theme: 'Momentum',
  line: 'Moving is not the same as going somewhere.',
  date_label: 'Sunday, 27 December · 5pm', venue_label: 'Venue details to follow',
  guest_fee_kobo: 1000000, guests_per_alumnus: 2, is_open: true, orders_close_at: null,
}
let menu = [
  { id: 'm1', category: 'Mains',  name: 'Grilled chicken & smoky jollof', description: 'Quarter chicken, plantain',    price_kobo: 1200000, active: true, sort: 1 },
  { id: 'm2', category: 'Mains',  name: 'Seafood pasta',                  description: 'Prawns, calamari, light cream', price_kobo: 1500000, active: true, sort: 2 },
  { id: 'm3', category: 'Mains',  name: 'Beef suya platter',              description: 'Yaji, onions, fries',           price_kobo: 1100000, active: true, sort: 3 },
  { id: 'm4', category: 'Mains',  name: 'Vegetable stir-fry rice',        description: 'Seasonal greens, sesame',       price_kobo:  900000, active: true, sort: 4 },
  { id: 'm5', category: 'Drinks', name: 'Mocktail',                       description: 'House blend',                   price_kobo:  450000, active: true, sort: 10 },
  { id: 'm6', category: 'Drinks', name: 'Chapman',                        description: '',                              price_kobo:  400000, active: true, sort: 11 },
  { id: 'm7', category: 'Drinks', name: 'Bottled water',                  description: '',                              price_kobo:  150000, active: true, sort: 12 },
]
const pub = () => ({ title: edition.title, theme: edition.theme, line: edition.line, date_label: edition.date_label, guest_fee_kobo: edition.guest_fee_kobo, guests_per_alumnus: edition.guests_per_alumnus, open: edition.is_open })
const wait = (v, ms = 350) => new Promise(r => setTimeout(() => r(structuredClone(v)), ms))

let alumni = [
  { id: 'a1', name: 'Tolu Adeyemi', phone: '2348010000001', note: '' },
  { id: 'a2', name: 'Kemi Balogun', phone: '2348010000002', note: '' },
  { id: 'a3', name: 'Chidi Okafor', phone: '2348010000003', note: '' },
  { id: 'a4', name: 'Ifeoma Nwosu', phone: '2348010000004', note: '' },
  { id: 'a5', name: 'Seun Lawal',   phone: '2348010000005', note: '' },
  { id: 'a6', name: 'Amaka Eze',    phone: '2348010000006', note: '' },
]
let invites = [
  { id: 'i1', alumni_id: 'a1', token: 'demo', guest_token: 'demo', revoked: false },
  { id: 'i2', alumni_id: 'a2', token: 'k3m9', guest_token: 'k3m9g', revoked: false },
  { id: 'i3', alumni_id: 'a3', token: 'c7p2', guest_token: 'c7p2g', revoked: false },
]
const it = (name, qty, unit_kobo) => ({ name, qty, unit_kobo })
let registrations = [
  { id: 'r1', invite_id: 'i1', kind: 'alumni', name: 'Tolu Adeyemi', phone: '2348010000001', about: '', status: 'paid', entry_kobo: 0, food_kobo: 1650000, total_kobo: 1650000, items: [it('Grilled chicken & smoky jollof', 1, 1200000), it('Mocktail', 1, 450000)] },
  { id: 'r2', invite_id: 'i1', kind: 'guest',  name: 'Bayo Martins', phone: '2348020000001', about: 'Architect, runs a small studio in Yaba', status: 'paid', entry_kobo: 1000000, food_kobo: 1500000, total_kobo: 2500000, items: [it('Seafood pasta', 1, 1500000)] },
  { id: 'r3', invite_id: 'i2', kind: 'alumni', name: 'Kemi Balogun', phone: '2348010000002', about: '', status: 'paid', entry_kobo: 0, food_kobo: 1500000, total_kobo: 1500000, items: [it('Beef suya platter', 1, 1100000), it('Chapman', 1, 400000)] },
  { id: 'r4', invite_id: 'i2', kind: 'guest',  name: 'Dami Ojo', phone: '2348020000002', about: 'Product lead, fintech', status: 'pending', entry_kobo: 1000000, food_kobo: 900000, total_kobo: 1900000, items: [it('Vegetable stir-fry rice', 1, 900000)] },
]

export async function reg(action, body) {
  if (action === 'lookup') {
    const live = menu.filter(m => m.active)
    if (body.kind === 'guest') return wait({ kind: 'guest', edition: pub(), menu: live, hostFirstName: 'Tolu', seatsLeft: 1 })
    if (body.token === 'done') return wait({ kind: 'alumni', edition: pub(), menu: live, firstName: 'Tolu', confirmed: true, guestToken: 'demo', guestSeatsTaken: 1, venue_label: edition.venue_label })
    return wait({ kind: 'alumni', edition: pub(), menu: live, firstName: 'Tolu', confirmed: false })
  }
  if (action === 'start') {
    if (body.kind === 'alumni' && !String(body.phone).replace(/\D/g, '').endsWith('0000001'))
      throw new Error("That number doesn't match the one we have for you.")
    return wait({ authorization_url: `/ix/done?reference=MOCK-${body.kind}` }, 700)
  }
  if (action === 'status') {
    const kind = String(body.reference).includes('guest') ? 'guest' : 'alumni'
    return wait({
      status: 'paid', kind, firstName: kind === 'guest' ? 'Bayo' : 'Tolu', edition: pub(),
      venue_label: edition.venue_label, guestToken: kind === 'alumni' ? 'demo' : undefined,
      items: [it('Grilled chicken & smoky jollof', 1, 1200000), it('Mocktail', 1, 450000)],
      entry_kobo: kind === 'guest' ? 1000000 : 0, food_kobo: 1650000,
      total_kobo: kind === 'guest' ? 2650000 : 1650000,
    }, 900)
  }
}

const overview = () => wait({ edition, alumni, invites, registrations, menu }, 250)
let n = 100
export async function host(action, body) {
  if (action === 'import_alumni') {
    let imported = 0
    for (const r of body.rows) {
      const phone = String(r.phone).replace(/\D/g, '').replace(/^0/, '234')
      if (!r.name || phone.length < 10) continue
      if (!alumni.find(a => a.phone === phone)) alumni.push({ id: 'a' + n++, name: r.name, phone, note: '' })
      imported++
    }
    return wait({ imported, skipped: body.rows.length - imported })
  }
  if (action === 'invite') {
    for (const id of body.alumni_ids) {
      const ex = invites.find(i => i.alumni_id === id)
      if (ex) ex.revoked = false
      else invites.push({ id: 'i' + n++, alumni_id: id, token: 'x' + n, guest_token: 'g' + n, revoked: false })
    }
  }
  if (action === 'revoke') invites.find(i => i.id === body.invite_id).revoked = true
  if (action === 'save_edition') Object.assign(edition, body.patch)
  if (action === 'save_menu_item') {
    if (body.item.id) Object.assign(menu.find(m => m.id === body.item.id), body.item)
    else menu.push({ ...body.item, id: 'm' + n++, active: true })
  }
  if (action === 'remove_menu_item') menu = menu.filter(m => m.id !== body.id)
  return overview()
}
