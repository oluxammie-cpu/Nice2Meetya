import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { host, MOCK, naira, alumniLink, waLink } from './api.js'
import s from './Host.module.css'

// DRAFT copy — edit freely
const inviteText = (first, ed, link) =>
  `Hi ${first}, it's Olarinde. We're winding 2026 up with a Nice2Meetya! reunion — ${ed.title}: ${ed.theme}. ${ed.date_label}.\n\n` +
  `It's by invitation, and you're on the list. Your seat is on the house; you only pre-order your food. ` +
  `You can also bring two people worth knowing.\n\nYour seat: ${link}`

const first = n => String(n || '').trim().split(/\s+/)[0]
const prettyPhone = p => p?.startsWith('234') ? '0' + p.slice(3) : p

/* ─────────── Login ─────────── */
function Login({ onIn }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  async function go(e) {
    e.preventDefault(); setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    error ? setErr('Those details did not work.') : onIn()
  }
  return (
    <form className={s.login} onSubmit={go}>
      <p className={s.brand}>NICE2<span>MEETYA!</span></p>
      <p className={s.sub}>Host</p>
      <input className="input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <input className="input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
      <button className="btn btn-gold">Sign in</button>
      {err && <p className={s.err}>{err}</p>}
    </form>
  )
}

/* ─────────── Invites ─────────── */
function Invites({ data, act }) {
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [paste, setPaste] = useState('')
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState('')

  const rows = useMemo(() => data.alumni
    .filter(a => !q || (a.name + a.phone).toLowerCase().includes(q.toLowerCase()))
    .map(a => {
      const inv = data.invites.find(i => i.alumni_id === a.id && !i.revoked)
      const paid = inv && data.registrations.some(r => r.invite_id === inv.id && r.kind === 'alumni' && r.status === 'paid')
      return { a, inv, paid }
    })
    .sort((x, y) => (!!y.inv - !!x.inv) || x.a.name.localeCompare(y.a.name)), [data, q])

  const invitedCount = data.invites.filter(i => !i.revoked).length

  async function importPaste() {
    const list = paste.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const m = l.match(/^(.*?)[,\t;]\s*([+\d][\d\s-]{8,})$/)
      return m ? { name: m[1].trim(), phone: m[2] } : { name: l, phone: '' }
    })
    const r = await host('import_alumni', { rows: list })
    setNote(`${r.imported} added${r.skipped ? ` · ${r.skipped} skipped (no valid number)` : ''}`)
    setPaste(''); setAdding(false); act('overview')
  }
  async function copy(text, id) {
    try { await navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(''), 1500) } catch {}
  }

  return <>
    <div className={s.toolbar}>
      <input className="input" placeholder={`Search ${data.alumni.length} alumni`} value={q} onChange={e => setQ(e.target.value)} />
      <button className="btn btn-ghost btn-sm" onClick={() => setAdding(a => !a)}>{adding ? 'Close' : 'Add people'}</button>
    </div>
    {adding && (
      <div className={s.paste}>
        <textarea className="input" rows={6} placeholder={'One per line:\nTolu Adeyemi, 08012345678'} value={paste} onChange={e => setPaste(e.target.value)} />
        <button className="btn btn-gold btn-sm" onClick={importPaste} disabled={!paste.trim()}>Add to list</button>
      </div>
    )}
    {note && <p className={s.note}>{note}</p>}
    <p className={s.count}>{invitedCount} invited</p>

    <ul className={s.list}>
      {rows.map(({ a, inv, paid }) => (
        <li key={a.id} className={`${s.row} ${inv ? '' : s.dim}`}>
          <div className={s.who}>
            <span className={s.name}>{a.name}</span>
            <span className={s.meta}>{prettyPhone(a.phone)}{paid && <b className={s.ok}> · confirmed</b>}</span>
          </div>
          {!inv
            ? <button className="btn btn-ghost btn-sm" onClick={() => act('invite', { alumni_ids: [a.id] })}>Invite</button>
            : <div className={s.rowActions}>
                <a className="btn btn-gold btn-sm" target="_blank" rel="noreferrer"
                   href={waLink(inviteText(first(a.name), data.edition, alumniLink(inv.token)), a.phone)}>WhatsApp</a>
                <button className="btn btn-ghost btn-sm" onClick={() => copy(alumniLink(inv.token), inv.id)}>{copied === inv.id ? 'Copied' : 'Link'}</button>
                {!paid && <button className={s.x} title="Withdraw invite" onClick={() => act('revoke', { invite_id: inv.id })}>×</button>}
              </div>}
        </li>
      ))}
    </ul>
  </>
}

/* ─────────── Room ─────────── */
function Room({ data }) {
  const paid = data.registrations.filter(r => r.status === 'paid')
  const pending = data.registrations.filter(r => r.status === 'pending')
  const entry = paid.reduce((t, r) => t + r.entry_kobo, 0)
  const food = paid.reduce((t, r) => t + r.food_kobo, 0)
  const groups = data.invites.filter(i => !i.revoked).map(inv => ({
    alumnus: data.alumni.find(a => a.id === inv.alumni_id),
    regs: data.registrations.filter(r => r.invite_id === inv.id),
  })).filter(g => g.regs.length)

  return <>
    <div className={s.stats}>
      <div><b>{paid.length}</b><span>confirmed</span></div>
      <div><b>{paid.filter(r => r.kind === 'guest').length}</b><span>new faces</span></div>
      <div><b>{naira(entry)}</b><span>entry</span></div>
      <div><b>{naira(food)}</b><span>food</span></div>
    </div>
    {pending.length > 0 && <p className={s.note}>{pending.length} started but haven't paid</p>}
    <ul className={s.list}>
      {groups.map(g => (
        <li key={g.alumnus?.id} className={s.group}>
          {g.regs.sort((a, b) => (a.kind === 'alumni' ? -1 : 1)).map(r => (
            <div key={r.id} className={`${s.person} ${r.kind === 'guest' ? s.guest : ''} ${r.status !== 'paid' ? s.dim : ''}`}>
              <span className={s.name}>{r.name}</span>
              <span className={s.meta}>
                {r.kind === 'guest' ? `via ${first(g.alumnus?.name)}` : 'alumnus'}
                {r.status !== 'paid' && ' · awaiting payment'}
                {r.about && ` · ${r.about}`}
              </span>
            </div>
          ))}
        </li>
      ))}
    </ul>
    {!groups.length && <p className={s.empty}>No one yet.</p>}
  </>
}

/* ─────────── Kitchen ─────────── */
function Kitchen({ data }) {
  const [copied, setCopied] = useState(false)
  const paid = data.registrations.filter(r => r.status === 'paid')
  const tally = {}
  paid.forEach(r => r.items.forEach(i => { tally[i.name] = (tally[i.name] || 0) + i.qty }))
  const dishes = Object.entries(tally).sort((a, b) => b[1] - a[1])
  const food = paid.reduce((t, r) => t + r.food_kobo, 0)

  const text = [
    `Nice2Meetya! ${data.edition.title} — ${data.edition.date_label}`,
    `${paid.length} guests\n`,
    'TOTALS', ...dishes.map(([n, q]) => `${q} × ${n}`),
    '\nBY GUEST', ...paid.map(r => `${r.name}: ${r.items.map(i => `${i.qty}× ${i.name}`).join(', ')}`),
  ].join('\n')

  return <>
    <ul className={s.list}>
      {dishes.map(([n, q]) => (
        <li key={n} className={s.dishRow}><b>{q}</b><span>{n}</span></li>
      ))}
    </ul>
    {!dishes.length ? <p className={s.empty}>No paid orders yet.</p> : <>
      <p className={s.foodTotal}>{naira(food)} owed to venue</p>
      <button className="btn btn-gold" style={{ width: '100%' }}
        onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {} }}>
        {copied ? 'Copied' : 'Copy order for the venue'}
      </button>
    </>}
  </>
}

/* ─────────── Setup ─────────── */
function Setup({ data, act }) {
  const ed = data.edition
  const [f, setF] = useState({
    date_label: ed.date_label, venue_label: ed.venue_label,
    fee: ed.guest_fee_kobo / 100, seats: ed.guests_per_alumnus, is_open: ed.is_open,
    close: ed.orders_close_at ? ed.orders_close_at.slice(0, 16) : '',
  })
  const [dish, setDish] = useState(null)
  const up = k => e => setF(x => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const save = () => act('save_edition', { patch: {
    date_label: f.date_label, venue_label: f.venue_label,
    guest_fee_kobo: Math.round(Number(f.fee) * 100), guests_per_alumnus: Number(f.seats),
    is_open: f.is_open, orders_close_at: f.close ? new Date(f.close).toISOString() : null,
  } })

  return <>
    <p className={s.h}>Edition</p>
    <label className={s.f}><span>Date & time</span><input className="input" value={f.date_label} onChange={up('date_label')} /></label>
    <label className={s.f}><span>Venue · shown after payment</span><input className="input" value={f.venue_label} onChange={up('venue_label')} /></label>
    <div className={s.two}>
      <label className={s.f}><span>Guest entry ₦</span><input className="input" type="number" value={f.fee} onChange={up('fee')} /></label>
      <label className={s.f}><span>Seats per alumnus</span><input className="input" type="number" min="0" max="5" value={f.seats} onChange={up('seats')} /></label>
    </div>
    <label className={s.f}><span>Food orders close</span><input className="input" type="datetime-local" value={f.close} onChange={up('close')} /></label>
    <label className={s.check}><input type="checkbox" checked={f.is_open} onChange={up('is_open')} /> Registration open</label>
    <button className="btn btn-gold btn-sm" onClick={save}>Save</button>

    <p className={s.h} style={{ marginTop: 40 }}>Menu</p>
    <ul className={s.list}>
      {data.menu.filter(m => m.active).map(m => (
        <li key={m.id} className={s.row}>
          <div className={s.who}>
            <span className={s.name}>{m.name}</span>
            <span className={s.meta}>{m.category} · {naira(m.price_kobo)}</span>
          </div>
          <div className={s.rowActions}>
            <button className="btn btn-ghost btn-sm" onClick={() => setDish({ ...m, price: m.price_kobo / 100 })}>Edit</button>
            <button className={s.x} onClick={() => act('remove_menu_item', { id: m.id })}>×</button>
          </div>
        </li>
      ))}
    </ul>
    {dish ? (
      <div className={s.paste}>
        <input className="input" placeholder="Dish" value={dish.name} onChange={e => setDish({ ...dish, name: e.target.value })} />
        <input className="input" placeholder="Short description" value={dish.description} onChange={e => setDish({ ...dish, description: e.target.value })} />
        <div className={s.two}>
          <input className="input" placeholder="Category" value={dish.category} onChange={e => setDish({ ...dish, category: e.target.value })} />
          <input className="input" type="number" placeholder="Price ₦" value={dish.price} onChange={e => setDish({ ...dish, price: e.target.value })} />
        </div>
        <div className={s.rowActions}>
          <button className="btn btn-gold btn-sm" onClick={async () => {
            await act('save_menu_item', { item: { ...dish, price_kobo: Math.round(Number(dish.price) * 100) } }); setDish(null)
          }}>Save dish</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setDish(null)}>Cancel</button>
        </div>
      </div>
    ) : (
      <button className="btn btn-ghost btn-sm" onClick={() => setDish({ name: '', description: '', category: 'Mains', price: '', sort: data.menu.length + 1 })}>Add dish</button>
    )}
  </>
}

/* ─────────── Shell ─────────── */
const TABS = ['Invites', 'Room', 'Kitchen', 'Setup']

export default function HostReg() {
  const [authed, setAuthed] = useState(MOCK)
  const [checking, setChecking] = useState(!MOCK)
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('Invites')
  const [err, setErr] = useState('')

  useEffect(() => {
    if (MOCK) return
    supabase.auth.getSession().then(({ data }) => { setAuthed(!!data.session); setChecking(false) })
  }, [])

  async function act(action, body) {
    setErr('')
    try { setData(await host(action, body)) }
    catch (e) {
      setErr(e.message)
      if (/authori/i.test(e.message)) { await supabase.auth.signOut(); setAuthed(false) }
    }
  }
  useEffect(() => { if (authed) act('overview') }, [authed])

  if (checking) return null
  if (!authed) return <div className={s.page}><Login onIn={() => setAuthed(true)} /></div>

  return (
    <div className={s.page}>
      <div className={s.col}>
        <header className={s.head}>
          <p className={s.brand}>NICE2<span>MEETYA!</span></p>
          <p className={s.sub}>{data ? `${data.edition.title} · ${data.edition.theme}` : ''}</p>
        </header>
        <nav className={s.tabs}>
          {TABS.map(t => <button key={t} className={t === tab ? s.on : ''} onClick={() => setTab(t)}>{t}</button>)}
        </nav>
        {err && <p className={s.err}>{err}</p>}
        {!data ? <p className={s.empty}>Loading…</p> : <>
          {tab === 'Invites' && <Invites data={data} act={act} />}
          {tab === 'Room' && <Room data={data} />}
          {tab === 'Kitchen' && <Kitchen data={data} />}
          {tab === 'Setup' && <Setup data={data} act={act} />}
        </>}
      </div>
    </div>
  )
}
