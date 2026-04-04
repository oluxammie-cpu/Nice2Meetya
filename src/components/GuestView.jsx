import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import { PHASES } from '../lib/phases.js'
import styles from './GuestView.module.css'

function CountdownTimer({ endsAt, onComplete }) {
  const [remaining, setRemaining] = useState(null)
  const doneRef = useRef(false)

  useEffect(() => {
    if (!endsAt) { setRemaining(null); doneRef.current = false; return }
    doneRef.current = false
    const tick = () => {
      const diff = Math.max(0, Math.round((new Date(endsAt) - Date.now()) / 1000))
      setRemaining(diff)
      if (diff === 0 && !doneRef.current) { doneRef.current = true; onComplete && onComplete() }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [endsAt, onComplete])

  if (remaining === null) return null
  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const urgent = remaining <= 30 && remaining > 0
  const done = remaining === 0

  return (
    <div className={`${styles.timerBanner} ${urgent ? styles.timerUrgent : ''} ${done ? styles.timerDone : ''}`}>
      {done ? 'Time — moving on!' : `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')} remaining`}
    </div>
  )
}

export default function GuestView() {
  const [event, setEvent]           = useState(null)
  const [guestName, setGuestName]   = useState('')
  const [searched, setSearched]     = useState(false)
  const [myData, setMyData]         = useState(null)
  const [lookupErr, setLookupErr]   = useState('')

  const loadEvent = useCallback(async () => {
    const { data } = await supabase.from('events').select('*').eq('active', true).single()
    if (data) setEvent(data)
  }, [])

  useEffect(() => {
    loadEvent()
    const ch = supabase.channel('guest-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events' }, loadEvent)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [loadEvent])

  async function lookupGuest() {
    const name = guestName.trim()
    if (!name || !event) return
    setLookupErr('')
    const { data } = await supabase
      .from('guests')
      .select('name, round1_table, round2_table, round3_table, is_spy, spy_mission_index')
      .eq('event_id', event.id)
      .ilike('name', `%${name}%`)
      .limit(1)
      .single()
    if (!data) {
      setLookupErr("We don't have that name on the list. Try a shorter version, or ask your host.")
      return
    }
    setMyData(data)
    setSearched(true)
  }

  if (!event) return (
    <div className={styles.loading}>Connecting to tonight's event…</div>
  )

  const phase   = PHASES[event.current_phase] || PHASES[0]
  const round   = event.current_round || 1
const groupNames = ['Onyx', 'Amber', 'Ivory', 'Pearl']
const groupNames = ['Onyx', 'Amber', 'Ivory', 'Pearl']
const myGroupIndex = myData ? myData[`round${round}_table`] : null
const myGroup = myGroupIndex ? groupNames[myGroupIndex - 1] : null
const myFirstName = myData ? myData.name.split(' ')[0] : ''
const myGroup = myGroupIndex ? groupNames[myGroupIndex - 1] : null
const myFirstName = myData ? myData.name.split(' ')[0] : ''
  const isMenti = event.menti_active

  const GROUP_STYLE = {
    'Onyx':  { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.18)', color: '#FFFFFF' },
    'Amber': { bg: 'rgba(201,168,76,0.1)',   border: 'rgba(201,168,76,0.45)',  color: '#C9A84C' },
    'Ivory': { bg: 'rgba(240,235,215,0.07)', border: 'rgba(240,235,215,0.25)', color: '#F0EBDC' },
  }
  const gs = myGroup ? (GROUP_STYLE[myGroup] || GROUP_STYLE['Amber']) : null

  return (
    <div className={styles.page}>
      <div className={styles.phaseBanner}>{phase.name}</div>
      <CountdownTimer endsAt={event.timer_ends_at} />

      <div className={styles.main}>

        {/* NAME LOOKUP */}
        {!searched && (
          <div className={styles.card}>
            <p className={styles.groupNote}>Welcome, {myFirstName}. Find your group and settle in.</p>
            <h2 className={styles.lookupTitle}>What's your name?</h2>
            <div className={styles.lookupRow}>
              <input className={styles.input} value={guestName} placeholder="Your name…" autoFocus
                onChange={e => setGuestName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && lookupGuest()} />
              <button className={styles.btnGold} onClick={lookupGuest}>Find me</button>
            </div>
            {lookupErr && <p className={styles.lookupErr}>{lookupErr}</p>}
          </div>
        )}

        {/* GROUP CARD */}
        {searched && myData && (
          <>
            <div className={styles.groupCard} style={gs ? { background: gs.bg, borderColor: gs.border } : {}}>
              <div className={styles.groupCardBar} style={gs ? { background: gs.color } : {}} />
              <p className={styles.groupEyebrow}>Round {round} — Your Group</p>
              <div className={styles.groupName} style={gs ? { color: gs.color } : {}}>{myGroup || '—'}</div>
             <p className={styles.groupNote}>Welcome, {myFirstName}. Find your group and settle in.</p>
              <button className={styles.btnGhost}
                onClick={() => { setSearched(false); setMyData(null); setGuestName('') }}>
                Not you?
              </button>
            </div>

            {/* SPY MISSION */}
            {myData.is_spy && myData.spy_mission && (
              <div className={styles.spyCard}>
                <div className={styles.spyTop}>
                  <span className={styles.spyBadge}>Agent</span>
                  <span className={styles.spyTitle}>Your Secret Mission</span>
                </div>
                <p className={styles.spyText}>{myData.spy_mission}</p>
                <p className={styles.spyNote}>Keep this between us. Report back to nobody.</p>
              </div>
            )}
          </>
        )}

        {/* MENTIMETER */}
        {isMenti && (
          <div className={styles.mentiCard}>
            <p className={styles.mentiLabel}>This or That — join the vote</p>
            <p className={styles.mentiDesc}>Open Mentimeter on your phone and play along with everyone.</p>
            <a href={event.menti_link} target="_blank" rel="noreferrer" className={styles.mentiBtn}>
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
            <div key={i} className={`${styles.scheduleItem}
              ${i === event.current_phase ? styles.scheduleActive : ''}
              ${i < event.current_phase ? styles.scheduleDone : ''}`}>
              <div className={styles.scheduleDot} />
              <span className={styles.scheduleText}>{p.name}</span>
            </div>
          ))}
        </div>

        {/* WHATSAPP */}
        <div className={styles.waCard}>
          <p className={styles.waText}>Stay in the loop between editions</p>
          <a href={event.whatsapp_link} target="_blank" rel="noreferrer" className={styles.waBtn}>
            Join our WhatsApp Community ↗
          </a>
        </div>

      </div>
    </div>
  )
}
