import { useEffect, useMemo, useState } from 'react'
import { reg, naira, guestLink, waLink } from './api.js'
import s from './Reg.module.css'

/* ─────────── Shared pieces ─────────── */

function Masthead({ edition }) {
  return (
    <header className={s.mast}>
      <p className={s.presenter}>Maison de les nobles</p>
      <h1 className={s.wordmark}>NICE2<span>MEETYA!</span></h1>
      {edition && <>
        <p className={s.edition}>{edition.title} · {edition.theme}</p>
        {edition.line && <p className={s.line}>{edition.line}</p>}
      </>}
    </header>
  )
}

function Shell({ edition, children }) {
  return <main className={s.page}><div className={s.col}><Masthead edition={edition} />{children}</div></main>
}

function Menu({ menu, qty, setQty }) {
  const cats = useMemo(() => {
    const m = new Map()
    menu.forEach(d => { if (!m.has(d.category)) m.set(d.category, []); m.get(d.category).push(d) })
    return [...m]
  }, [menu])
  const set = (id, n) => setQty(q => ({ ...q, [id]: Math.max(0, Math.min(5, n)) }))

  return cats.map(([cat, dishes]) => (
    <div key={cat}>
      <p className={s.cat}>{cat}</p>
      {dishes.map(d => {
        const n = qty[d.id] || 0
        return (
          <div key={d.id} className={`${s.dish} ${n ? s.dishOn : ''}`}>
            <div className={s.dishText}>
              <div className={s.dishName}>{d.name}</div>
              {d.description && <div className={s.dishDesc}>{d.description}</div>}
              <div className={s.dishPrice}>{naira(d.price_kobo)}</div>
            </div>
            <div className={s.stepper}>
              {n > 0 && <>
                <button className={s.stepBtn} onClick={() => set(d.id, n - 1)} aria-label={`Remove ${d.name}`}>−</button>
                <span className={s.qty}>{n}</span>
              </>}
              <button className={`${s.stepBtn} ${n ? '' : s.stepAdd}`} onClick={() => set(d.id, n + 1)} aria-label={`Add ${d.name}`}>+</button>
            </div>
          </div>
        )
      })}
    </div>
  ))
}

function Field({ label, ...props }) {
  return (
    <label className={s.field} style={{ display: 'block' }}>
      <span className={s.label}>{label}</span>
      <input className={s.input} {...props} />
    </label>
  )
}

function GiveSeats({ token, taken, total, edition }) {
  const [copied, setCopied] = useState(false)
  const link = guestLink(token)
  const text = `I'm saving you a seat at Nice2Meetya! — ${edition.title}: ${edition.theme}. ${edition.date_label}. It's by invitation only, and this is yours: ${link}`
  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch {}
  }
  const left = Math.max(0, total - taken)
  return (
    <section className={s.give}>
      <p className={s.giveTitle}>{left === 0 ? 'Both seats are taken' : `${left === total ? 'Two seats' : 'One seat'} to give`}</p>
      <p className={s.body}>
        {left === 0
          ? 'Your guests are confirmed. Thank you for bringing good people.'
          : 'Bring someone worth knowing. They pay a ₦10,000 entry and order their own food.'}
      </p>
      <div className={s.seats}>
        {Array.from({ length: total }, (_, i) => <div key={i} className={`${s.seat} ${i < taken ? s.seatTaken : ''}`} />)}
      </div>
      {left > 0 && (
        <div className={s.actions}>
          <a className="btn btn-gold" href={waLink(text)} target="_blank" rel="noreferrer">Send on WhatsApp</a>
          <button className="btn btn-ghost" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
        </div>
      )}
    </section>
  )
}

/* ─────────── Invite (alumnus or guest) ─────────── */

function Invite({ kind, token }) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [qty, setQty] = useState({})
  const [form, setForm] = useState({ name: '', phone: '', email: '', about: '' })
  const [busy, setBusy] = useState(false)
  const [payErr, setPayErr] = useState('')

  useEffect(() => {
    reg('lookup', { kind, token }).then(setData).catch(e => setErr(e.message))
  }, [kind, token])

  if (err) return <Shell><p className={s.muted}>{err}</p></Shell>
  if (!data) return <Shell><p className={s.loading}>One moment</p></Shell>

  const { edition, menu } = data
  const isGuest = kind === 'guest'
  const entry = isGuest ? edition.guest_fee_kobo : 0
  const food = menu.reduce((t, d) => t + (qty[d.id] || 0) * d.price_kobo, 0)
  const itemCount = Object.values(qty).reduce((a, b) => a + b, 0)
  const up = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const ready = itemCount > 0 && form.phone.trim() && form.email.trim() && (!isGuest || form.name.trim())

  // Already confirmed alumnus coming back to their link
  if (data.confirmed) {
    return (
      <Shell edition={edition}>
        <div className={s.center}>
          <div className={s.seal}>✦</div>
          <h2 className={s.hello}>You're in, <em>{data.firstName}</em>.</h2>
          <p className={s.body}>{edition.date_label}</p>
          <p className={s.body}>{data.venue_label}</p>
        </div>
        <GiveSeats token={data.guestToken} taken={data.guestSeatsTaken} total={edition.guests_per_alumnus} edition={edition} />
      </Shell>
    )
  }
  if (!edition.open) return <Shell edition={edition}><p className={s.muted}>Registration for this edition has closed.</p></Shell>
  if (isGuest && data.seatsLeft === 0) {
    return <Shell edition={edition}><p className={s.muted}>Both seats on {data.hostFirstName}'s link have been taken.</p></Shell>
  }

  async function pay() {
    setBusy(true); setPayErr('')
    try {
      const items = Object.entries(qty).filter(([, n]) => n > 0).map(([id, n]) => ({ id, qty: n }))
      const res = await reg('start', { kind, token, ...form, items })
      window.location.assign(res.authorization_url)
    } catch (e) { setPayErr(e.message); setBusy(false) }
  }

  return (
    <Shell edition={edition}>
      {isGuest ? <>
        <h2 className={s.hello}><em>{data.hostFirstName}</em> saved you a seat.</h2>
        <p className={s.body}>We're winding the year up with the people who've been in the room, and the people they'd vouch for. You come recommended.</p>
      </> : <>
        <h2 className={s.hello}>Welcome back, <em>{data.firstName}</em>.</h2>
        <p className={s.body}>We're winding the year up with the people who've been in the room. This one is by invitation, and your seat is on the house.</p>
      </>}
      <div className={s.date}><span>{edition.date_label}</span><span>Lagos</span></div>

      <section className={s.section}>
        <p className={s.sectionTitle}>{isGuest ? 'About you' : 'Confirm it’s you'}</p>
        <p className={s.sectionNote}>{isGuest ? 'So we can seat you well.' : 'Use the number you came with before.'}</p>
        {isGuest && <Field label="Full name" value={form.name} onChange={up('name')} autoComplete="name" />}
        <Field label="Phone number" type="tel" inputMode="tel" placeholder="080…" value={form.phone} onChange={up('phone')} autoComplete="tel" />
        <Field label="Email · for your receipt" type="email" value={form.email} onChange={up('email')} autoComplete="email" />
        {isGuest && <Field label="What you do, in a line · optional" maxLength={140} value={form.about} onChange={up('about')} />}
      </section>

      <section className={s.section}>
        <p className={s.sectionTitle}>Your plate</p>
        <p className={s.sectionNote}>Ordered ahead, so everyone is served together.</p>
        <Menu menu={menu} qty={qty} setQty={setQty} />
      </section>

      <section className={s.bill}>
        <div className={s.billRow}><span>Entry</span>{isGuest ? <span>{naira(entry)}</span> : <span className={s.free}>On the house</span>}</div>
        <div className={s.billRow}><span>Food & drinks</span><span>{naira(food)}</span></div>
        <div className={s.billTotal}><span>Total</span><span>{naira(entry + food)}</span></div>
        <button className={`btn btn-gold ${s.pay}`} disabled={!ready || busy} onClick={pay}>
          {busy ? 'Opening payment…' : itemCount ? `Confirm & pay ${naira(entry + food)}` : 'Choose from the menu'}
        </button>
        {payErr && <p className={s.error}>{payErr}</p>}
        <p className={s.fine}>Secure payment by Paystack. Food is prepared ahead, so orders are final.</p>
      </section>
    </Shell>
  )
}

/* ─────────── After payment ─────────── */

function Done() {
  const reference = new URLSearchParams(window.location.search).get('reference')
    || new URLSearchParams(window.location.search).get('trxref')
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!reference) { setErr('Missing payment reference.'); return }
    let tries = 0, stop = false
    async function poll() {
      try {
        const d = await reg('status', { reference })
        if (stop) return
        setData(d)
        if (d.status === 'pending' && ++tries < 10) setTimeout(poll, 3000)
      } catch (e) { setErr(e.message) }
    }
    poll()
    return () => { stop = true }
  }, [reference])

  if (err) return <Shell><p className={s.muted}>{err}</p></Shell>
  if (!data) return <Shell><p className={s.loading}>Confirming your payment</p></Shell>
  const { edition } = data

  if (data.status === 'pending') {
    return <Shell edition={edition}><p className={s.muted}>We haven't received confirmation from Paystack yet. If you were charged, you're safe — refresh in a minute. Reference: {reference}</p></Shell>
  }
  if (data.status !== 'paid') {
    return <Shell edition={edition}><p className={s.muted}>Something's off with this payment. Message your host with this reference and it'll be sorted: {reference}</p></Shell>
  }

  return (
    <Shell edition={edition}>
      <div className={s.center}>
        <div className={s.seal}>✦</div>
        <h2 className={s.hello}>You're in, <em>{data.firstName}</em>.</h2>
        <p className={s.body}>{edition.date_label}</p>
        <p className={s.body}>{data.venue_label}</p>
      </div>

      <section className={s.bill}>
        {data.items.map((i, k) => (
          <div key={k} className={s.billRow}><span>{i.qty} × {i.name}</span><span>{naira(i.qty * i.unit_kobo)}</span></div>
        ))}
        {data.entry_kobo > 0 && <div className={s.billRow}><span>Entry</span><span>{naira(data.entry_kobo)}</span></div>}
        <div className={s.billTotal}><span>Paid</span><span>{naira(data.total_kobo)}</span></div>
      </section>

      {data.kind === 'alumni' && data.guestToken &&
        <GiveSeats token={data.guestToken} taken={0} total={edition.guests_per_alumnus} edition={edition} />}
    </Shell>
  )
}

/* ─────────── Router ─────────── */

export default function RegApp() {
  const parts = window.location.pathname.split('/').filter(Boolean) // ['ix', ...]
  if (parts[1] === 'done') return <Done />
  if (parts[1] === 'g' && parts[2]) return <Invite kind="guest" token={parts[2]} />
  if (parts[1]) return <Invite kind="alumni" token={parts[1]} />
  return <Shell><p className={s.muted}>This edition is by invitation. Your host will send you a personal link.</p></Shell>
}
