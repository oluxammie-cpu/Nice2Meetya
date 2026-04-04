import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import { PHASES } from '../lib/phases.js'
import styles from './GuestView.module.css'

const DEFAULT_GROUPS = ['Onyx', 'Amber', 'Ivory', 'Pearl', 'Sage', 'Ruby']

const GROUP_STYLE = {
  'Onyx':  { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.2)',  color: '#FFFFFF' },
  'Amber': { bg: 'rgba(201,168,76,0.1)',   border: 'rgba(201,168,76,0.5)',   color: '#C9A84C' },
  'Ivory': { bg: 'rgba(240,235,215,0.07)', border: 'rgba(240,235,215,0.3)',  color: '#F0EBDC' },
  'Pearl': { bg: 'rgba(180,200,220,0.08)', border: 'rgba(180,200,220,0.35)', color: '#B4C8DC' },
  'Sage':  { bg: 'rgba(140,180,140,0.08)', border: 'rgba(140,180,140,0.35)', color: '#8CB48C' },
  'Ruby':  { bg: 'rgba(232,41,26,0.08)',   border: 'rgba(232,41,26,0.35)',   color: '#E8291A' },
}

const SPY_MISSIONS = [
  "Discover something about one person tonight that they have never posted on social media and probably never will. Don't ask directly — let it come up naturally.",
  "Find one person whose current life looks nothing like what they planned 10 years ago. Find out what changed. The best discoveries come through listening, not asking.",
  "Discover one person's best mistake — the thing that went wrong and turned out to be exactly right. People love talking about this. Give them the space.",
]

function CountdownTimer({ endsAt }) {
  const [remaining, setRemaining] = useState(null)

  useEffect(() => {
    if (!endsAt) { setRemaining(null); return }
    const tick = () => {
      const diff = Math.max(0, Math.round((new Date(endsAt) - Date.now()) / 1000))
      setRemaining(diff)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [endsAt])

  if (remaining === null) return null
  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const urgent = remaining <= 30 && remaining > 0
  const done = remaining === 0

  return (
    <div className={`${styles.timerBar} ${urgent ? styles.timerUrgent : ''} ${done ? styles.timerDone : ''}`}>
      {done
        ? 'Time is up — moving on!'
        : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} remaining`}
    </div>
  )
}

export default function GuestView() {
  const [event, setEvent]         = useState(null)
  const [guestName, setGuestName] = useState('')
  const [searched, setSearched]   = useState(false)
  const [myData, setMyData]       = useState(null)
  const [lookupErr, setLookupErr] = useState('')

  // Persist guest data across refresh
  useEffect(() => {
    const saved = sessionStorage.getItem('n2my_guest_data')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setMyData(parsed)
        setSearched(true)
      } catch {}
    }
  }, [])

  const loadEvent = useCallback(async () => {
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('active', true)
      .single()
    if (data) setEvent(data)
  }, [])

  useEffect(() => {
    loadEvent()
    const ch = supabase
      .channel('guest-realtime')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'events'
      }, loadEvent)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [loadEvent])

  async function lookupGuest() {
    const name = guestName.trim()
    if (!name || !event) return
    setLookupErr('')

    const { data, error } = await supabase
      .from('guests')
      .select('id, name, round1_table, round2_table, round3_table, round4_table, round5_table, round6_table, is_spy, spy_mission_index')
      .eq('event_id', event.id)
      .ilike('name', `%${name}%`)
      .limit(1)
      .single()

    if (error || !data) {
      setLookupErr("We don't have that name on the list. Try a shorter version, or ask your host.")
      return
    }

    setMyData(data)
    setSearched(true)
    sessionStorage.setItem('n2my_guest_data', JSON.stringify(data))
  }

  function clearGuest() {
    setSearched(false)
    setMyData(null)
    setGuestName('')
    sessionStorage.removeItem('n2my_guest_data')
  }

  if (!event) return (
    <div className={styles.loading}>Connecting to tonight's event…</div>
  )

  const phase      = PHASES[event.current_phase] || PHASES[0]
  const round      = event.current_round || 1
  const groupNames = event.group_names
    ? event.group_names.split(',').map(g => g.trim())
    : DEFAULT_GROUPS
  const myGroupIndex = myData ? myData[`round${round}_table`] : null
  const myGroup      = myGroupIndex ? (groupNames[myGroupIndex - 1] || `Group ${myGroupIndex}`) : null
  const myFirstName  = myData ? myData.name.split(' ')[0] : ''
  const gs           = myGroup ? (GROUP_STYLE[myGroup] || { bg: 'rgba(201,168,76,0.1)', border: 'rgba(201,168,76,0.5)', color: '#C9A84C' }) : null

  return (
    <div className={styles.page}>

      {/* PHASE BANNER — always visible */}
      <div className={styles.phaseBanner}>{phase.name}</div>

      {/* PERSISTENT GROUP BADGE — shows once searched, stays visible always */}
      {searched && myData && myGroup && (
        <div className={styles.groupBadgeBar} style={{ borderBottomColor: gs?.color || '#C9A84C' }}>
          <span className={styles.groupBadgeLabel}>Round {round}</span>
          <span className={styles.groupBadgeName} style={{ color: gs?.color || '#C9A84C' }}>
            {myGroup}
          </span>
          <span className={styles.groupBadgeHello}>· {myFirstName}</span>
        </div>
      )}

      {/* TIMER */}
      <CountdownTimer endsAt={event.timer_ends_at} />

      <div className={styles.main}>

        {/* NAME LOOKUP — shown if not yet searched */}
        {!searched && (
          <div className={styles.card}>
            <p className={styles.eyebrow}>Find your spot</p>
            <h2 className={styles.lookupTitle}>What's your name?</h2>
            <div className={styles.lookupRow}>
              <input
                className={styles.input}
                value={guestName}
                placeholder="Your name…"
                autoFocus
                onChange={e => setGuestName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && lookupGuest()}
              />
              <button className={styles.btnGold} onClick={lookupGuest}>Find me</button>
            </div>
            {lookupErr && <p className={styles.lookupErr}>{lookupErr}</p>}
          </div>
        )}

        {/* GROUP CARD — shown after lookup */}
        {searched && myData && (
          <>
            <div
              className={styles.groupCard}
              style={gs ? { background: gs.bg, borderColor: gs.border } : {}}
            >
              <div className={styles.groupCardBar} style={gs ? { background: gs.color } : {}} />
              <p className={styles.groupEyebrow}>Round {round} — Your Group</p>
              <div className={styles.groupName} style={gs ? { color: gs.color } : {}}>
                {myGroup || '—'}
              </div>
              <p className={styles.groupNote}>
                Welcome, {myFirstName}. Find your group and settle in.
              </p>
              <button className={styles.btnGhost} onClick={clearGuest}>
                Not you?
              </button>
            </div>

            {/* SPY MISSION */}
            {myData.is_spy && myData.spy_mission_index !== null && (
              <div className={styles.spyCard}>
                <div className={styles.spyTop}>
                  <span className={styles.spyBadge}>Agent</span>
                  <span className={styles.spyTitle}>Your Secret Mission</span>
                </div>
                <p className={styles.spyText}>{SPY_MISSIONS[myData.spy_mission_index]}</p>
                <p className={styles.spyNote}>Keep this between us. Report back to nobody.</p>
              </div>
            )}
          </>
        )}

        {/* MENTIMETER — host toggles on/off */}
        {event.menti_active && (
          <div className={styles.mentiCard}>
            <p className={styles.mentiLabel}>This or That — join the vote</p>
            <p className={styles.mentiDesc}>
              Open Mentimeter and cast your vote. Look up at the screen to see results live.
            </p>
            <a
              href={event.menti_link || 'https://www.menti.com/ali66d4zwhf3'}
              target="_blank"
              rel="noreferrer"
              className={styles.mentiBtn}
            >
              Open Mentimeter ↗
            </a>
          </div>
        )}

        {/* LIVE PROMPT */}
        {event.current_prompt ? (
          <div className={styles.promptCard}>
            <p className={styles.promptLabel}>Tonight's Prompt</p>
            <p className={styles.promptText}>{event.current_prompt}</p>
          </div>
        ) : null}

        {/* PHASE INFO */}
        <div className={styles.card}>
          <p className={styles.eyebrow}>What's happening now</p>
          <h3 className={styles.phaseTitle}>{phase.name}</h3>
          <p className={styles.phaseDesc}>{phase.desc}</p>
        </div>

        {/* SCHEDULE */}
        <div className={styles.scheduleCard}>
          <div className={styles.scheduleHeader}>Tonight's flow</div>
          {PHASES.map((p, i) => (
            <div
              key={i}
              className={`${styles.scheduleItem}
                ${i === event.current_phase ? styles.scheduleActive : ''}
                ${i < event.current_phase ? styles.scheduleDone : ''}`}
            >
              <div className={styles.scheduleDot} />
              <span className={styles.scheduleText}>{p.name}</span>
            </div>
          ))}
        </div>

        {/* WHATSAPP */}
        <div className={styles.waCard}>
          <p className={styles.waText}>Stay in the loop between editions</p>
          <a
            href={event.whatsapp_link || 'https://chat.whatsapp.com/BmXCynJNcCwGR3RtUuX3DL'}
            target="_blank"
            rel="noreferrer"
            className={styles.waBtn}
          >
            Join our WhatsApp Community ↗
          </a>
        </div>

      </div>
    </div>
  )
}
