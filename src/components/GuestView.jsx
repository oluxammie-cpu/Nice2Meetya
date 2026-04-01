import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { PHASES } from '../lib/phases.js'
import styles from './GuestView.module.css'

export default function GuestView({ goGate }) {
  const [event, setEvent]         = useState(null)
  const [guestName, setGuestName] = useState('')
  const [searched, setSearched]   = useState(false)
  const [myAssignment, setMyAssignment] = useState(null)
  const [lookupErr, setLookupErr] = useState('')

  // Load active event and subscribe to realtime changes
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

    // Realtime subscription — re-fetch whenever event row changes
    const channel = supabase
      .channel('event-guest')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'events',
      }, () => loadEvent())
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [loadEvent])

  async function lookupGuest() {
    const name = guestName.trim().toLowerCase()
    if (!name || !event) return
    setLookupErr('')

    const { data } = await supabase
      .from('guests')
      .select('name, round1_table, round2_table, round3_table')
      .eq('event_id', event.id)
      .ilike('name', `%${name}%`)
      .limit(1)
      .single()

    if (!data) {
      setLookupErr("Name not found. Try a shorter version or ask your host.")
      return
    }
    setMyAssignment(data)
    setSearched(true)
  }

  if (!event) {
    return (
      <div className={styles.loading}>
        <p className={styles.loadingText}>Connecting to tonight's event…</p>
      </div>
    )
  }

  const phase     = PHASES[event.current_phase] || PHASES[0]
  const round     = event.current_round || 1
  const myTable   = myAssignment ? myAssignment[`round${round}_table`] : null

  return (
    <div className={styles.page}>
      <div className={styles.phaseBanner}>
        {phase.name}
      </div>

      <div className={styles.main}>

        {/* NAME LOOKUP */}
        {!searched && (
          <div className="card" style={{ marginBottom: 20, textAlign: 'center' }}>
            <p className="eyebrow" style={{ textAlign: 'left' }}>Find your seat</p>
            <h2 className={styles.lookupTitle}>What's your name?</h2>
            <div className={styles.lookupRow}>
              <input
                className="input"
                value={guestName}
                onChange={e => setGuestName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && lookupGuest()}
                placeholder="Your name…"
                autoFocus
              />
              <button className="btn btn-gold" onClick={lookupGuest}>
                Find me
              </button>
            </div>
            {lookupErr && <p className={styles.lookupErr}>{lookupErr}</p>}
          </div>
        )}

        {/* TABLE ASSIGNMENT */}
        {searched && myAssignment && (
          <div className={styles.tableCard}>
            <div className="ornament" style={{ margin: 0 }}>
              <p className={styles.tableEyebrow}>Round {round} · Your Table</p>
            </div>
            <div className={styles.tableNumber}>{myTable ?? '—'}</div>
            <p className={styles.tableName}>
              {myAssignment.name.split(' ')[0]}'s seat
            </p>
            <p className={styles.tableRoundNote}>
              You're at Table {myTable} for Round {round}
            </p>
            <button
              className={`btn btn-ghost ${styles.changeBtn}`}
              onClick={() => { setSearched(false); setMyAssignment(null); setGuestName('') }}
            >
              Not you?
            </button>
          </div>
        )}

        {/* LIVE PROMPT */}
        <div className={`${styles.promptCard}`}>
          <p className={styles.promptLabel}>Tonight's Prompt</p>
          {event.current_prompt ? (
            <p className={styles.promptText}>{event.current_prompt}</p>
          ) : (
            <p className={styles.promptEmpty}>Waiting for tonight's prompt…</p>
          )}
        </div>

        {/* CURRENT PHASE */}
        <div className="card" style={{ marginBottom: 16 }}>
          <p className="eyebrow">What's happening now</p>
          <h3 className={styles.phaseTitle}>{phase.name}</h3>
          <p className={styles.phaseDesc}>{phase.desc}</p>
        </div>

        {/* SCHEDULE */}
        <div className={styles.scheduleCard}>
          <div className={styles.scheduleHeader}>Tonight's Schedule</div>
          {PHASES.map((p, i) => (
            <div
              key={i}
              className={`${styles.scheduleItem}
                ${i === event.current_phase ? styles.active : ''}
                ${i < event.current_phase ? styles.done : ''}`}
            >
              <div className={styles.scheduleDot} />
              <span className={styles.scheduleText}>{p.name}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
