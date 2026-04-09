import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { PHASES } from '../lib/phases.js'
import { optimiseRotations, roundsToAssignments, calculateCoverage } from '../lib/rotation.js'
import styles from './HostView.module.css'

const PROMPT_PRESETS = [
  "What would your 10-year-old self think of you now?",
  "What's a skill nobody would guess from looking at you?",
  "Name one thing you changed your mind about this year.",
  "What's the best advice you've ignored?",
  "If you could be remarkable at one thing, what would it be?",
  "What's something you do that most people don't?",
  "What's a conversation you keep meaning to have?",
  "What does your ideal Saturday look like?",
]

// Spy missions are loaded from the database (editable via Settings)


// Completely isolated spy mission editor — manages own state, never affected by parent re-renders
function SpyMissionEditor({ initialMissions, onSave }) {
  const [missions, setMissions] = useState(initialMissions || [])
  const loaded = useState(false)

  // Only sync from parent once on first meaningful load
  useEffect(() => {
    if (!loaded[0] && initialMissions && initialMissions.length > 0) {
      setMissions(initialMissions)
      loaded[1](true)
    }
  }, [initialMissions]) // eslint-disable-line

  function update(mi, field, value) {
    const next = missions.map((m, i) => i === mi ? { ...m, [field]: value } : m)
    setMissions(next)
    onSave(next)
  }

  function remove(mi) {
    const next = missions.filter((_, i) => i !== mi)
    setMissions(next)
    onSave(next)
  }

  function add() {
    const next = [...missions, { title: 'New Mission', brief: 'Describe the mission here…' }]
    setMissions(next)
    onSave(next)
  }

  return (
    <div style={{ padding: '8px 24px 20px' }}>
      {missions.map((m, mi) => (
        <div key={mi} style={{ marginBottom: 16, background: '#0f0f0f', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#C9A84C', fontFamily: 'DM Sans, sans-serif' }}>
              Mission {mi + 1}
            </span>
            <button
              onClick={() => remove(mi)}
              style={{ background: 'none', border: '0.5px solid rgba(232,41,26,0.4)', color: '#E8291A', borderRadius: 4, fontSize: 10, padding: '3px 10px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              Remove
            </button>
          </div>
          <input
            type="text"
            value={m.title}
            placeholder="Mission title"
            onChange={e => update(mi, 'title', e.target.value)}
            style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginBottom: 8, background: '#1a1a1a', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 4, color: '#fff', fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 500, padding: '9px 14px', outline: 'none' }}
          />
          <textarea
            value={m.brief}
            placeholder="What the spy sees on their screen…"
            rows={3}
            onChange={e => update(mi, 'brief', e.target.value)}
            style={{ display: 'block', width: '100%', boxSizing: 'border-box', background: '#1a1a1a', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 4, color: 'rgba(255,255,255,0.75)', fontFamily: 'DM Sans, sans-serif', fontSize: 12, padding: '9px 14px', outline: 'none', resize: 'vertical', lineHeight: 1.65, fontStyle: 'italic' }}
          />
        </div>
      ))}
      <button
        onClick={add}
        style={{ background: 'rgba(201,168,76,0.1)', border: '0.5px solid rgba(201,168,76,0.35)', color: '#C9A84C', borderRadius: 4, fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', padding: '9px 18px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
        + Add Mission
      </button>
    </div>
  )
}

export default function HostView() {
  const [tab, setTab]               = useState(() => sessionStorage.getItem('n2my_host_tab') || 'tonight')
  const [event, setEvent]           = useState(null)
  const [guests, setGuests]         = useState([])
  const [prompt, setPrompt]         = useState('')
  const [newGuest, setNewGuest]     = useState('')
  const [toast, setToast]           = useState('')
  const [screenMode, setScreenMode] = useState(false)
  const [screenEvent, setScreenEvent] = useState(null)
  const [timerMins, setTimerMins]   = useState(10)
  const [hostTimeLeft, setHostTimeLeft] = useState(null)
  const [optimising, setOptimising] = useState(false)
  const [coverage, setCoverage]     = useState(null)
  const [archives, setArchives]     = useState([])
  const [archiving, setArchiving]   = useState(false)
  const [spyMissions, setSpyMissions] = useState([
    { title: 'The Untold Story', brief: "Discover something about one person tonight that they have never posted on social media and probably never will. Don't ask directly — let it come up naturally." },
    { title: 'The Plot Twist', brief: "Find one person whose current life looks nothing like what they planned 10 years ago. Find out what changed. The best discoveries come through listening, not asking." },
    { title: 'The Best Mistake', brief: "Discover one person's best mistake — the thing that went wrong and turned out to be exactly right. People love talking about this. Give them the space." },
  ])

  const [guestCode, setGuestCode]         = useState('')
  const [hostCode, setHostCode]           = useState('')
  const [edition, setEdition]             = useState('')
  const [groupNamesRaw, setGroupNamesRaw] = useState('')
  const [mentiLink, setMentiLink]                 = useState('')
  const [mentiPresenterLink, setMentiPresenterLink] = useState('')
  const [waLink, setWaLink]                       = useState('')

  const showToast = (msg, duration = 2800) => {
    setToast(msg)
    setTimeout(() => setToast(''), duration)
  }

  const loadAll = useCallback(async () => {
    const { data: ev } = await supabase
      .from('events').select('*').eq('active', true).single()
    if (!ev) return
    setEvent(ev)
    setPrompt(ev.current_prompt || '')
    setGuestCode(ev.guest_code || '')
    setHostCode(ev.host_code || '')
    setEdition(ev.edition || '')
    setGroupNamesRaw(ev.group_names || 'Onyx,Amber,Ivory,Pearl')
    setMentiLink(ev.menti_link || '')
    setMentiPresenterLink(ev.menti_presenter_link || '')
    setWaLink(ev.whatsapp_link || '')
    const { data: gList } = await supabase
      .from('guests').select('*').eq('event_id', ev.id).order('name')
    setGuests(gList || [])

    // Load archives
    const { data: archList } = await supabase
      .from('event_archives')
      .select('*')
      .order('created_at', { ascending: false })
    setArchives(archList || [])
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // Load spy missions once on mount only — not on realtime updates
  // so in-progress edits are never overwritten
  useEffect(() => {
    supabase.from('events').select('spy_missions').eq('active', true).single()
      .then(({ data }) => {
        if (data?.spy_missions) {
          try {
            const parsed = JSON.parse(data.spy_missions)
            if (Array.isArray(parsed) && parsed.length > 0) setSpyMissions(parsed)
          } catch {}
        }
      })
  }, []) // empty deps = runs once only

  // Screen mode gets its own independent realtime subscription
  useEffect(() => {
    if (!screenMode) { setScreenEvent(null); return }
    // Load fresh event data for screen
    supabase.from('events').select('*').eq('active', true).single()
      .then(({ data }) => { if (data) setScreenEvent(data) })
    const ch = supabase.channel('screen-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events' }, payload => {
        setScreenEvent(prev => ({ ...prev, ...payload.new }))
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [screenMode])

  useEffect(() => {
    if (!event) return
    const ch = supabase.channel('host-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guests' }, loadAll)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events' }, payload => {
        setEvent(prev => ({ ...prev, ...payload.new }))
        if (payload.new.current_prompt !== undefined) setPrompt(payload.new.current_prompt || '')
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [loadAll, event?.id])

  useEffect(() => {
    if (!event?.timer_ends_at) { setHostTimeLeft(null); return }
    const tick = () => {
      const r = Math.max(0, Math.ceil((new Date(event.timer_ends_at) - Date.now()) / 1000))
      setHostTimeLeft(r)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [event?.timer_ends_at])

  function formatTime(s) {
    if (s === null || s === undefined) return null
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  function switchTab(key) {
    setTab(key)
    sessionStorage.setItem('n2my_host_tab', key)
  }

  const groupNames = groupNamesRaw
    ? groupNamesRaw.split(',').map(g => g.trim()).filter(Boolean)
    : ['Onyx', 'Amber', 'Ivory', 'Pearl']

  async function setPhase(i) {
    await supabase.from('events').update({ current_phase: i }).eq('id', event.id)
    setEvent(e => ({ ...e, current_phase: i }))
    showToast(`Phase: ${PHASES[i].name}`)
  }

  async function setRound(r) {
    await supabase.from('events').update({ current_round: r }).eq('id', event.id)
    setEvent(e => ({ ...e, current_round: r }))
    showToast(`Round ${r} active — all phones updated`)
  }

  async function toggleMenti(on) {
    await supabase.from('events').update({ menti_active: on }).eq('id', event.id)
    setEvent(e => ({ ...e, menti_active: on }))
    showToast(on ? 'Mentimeter live on all phones' : 'Mentimeter hidden')
  }

  async function startTimer() {
    const end = new Date(Date.now() + timerMins * 60 * 1000).toISOString()
    await supabase.from('events').update({ timer_ends_at: end }).eq('id', event.id)
    setEvent(e => ({ ...e, timer_ends_at: end }))
    showToast(`${timerMins} min timer started`)
  }

  async function stopTimer() {
    await supabase.from('events').update({ timer_ends_at: null }).eq('id', event.id)
    setEvent(e => ({ ...e, timer_ends_at: null }))
    setHostTimeLeft(null)
    showToast('Timer stopped')
  }

  async function pushPrompt() {
    if (!prompt.trim()) return
    await supabase.from('events').update({ current_prompt: prompt }).eq('id', event.id)
    showToast('Prompt live on all phones')
  }

  async function clearPrompt() {
    setPrompt('')
    await supabase.from('events').update({ current_prompt: '' }).eq('id', event.id)
    showToast('Prompt cleared')
  }

  async function optimiseAllRounds() {
    if (guests.length === 0) { showToast('Add guests first'); return }
    setOptimising(true)
    showToast('Calculating optimal rotations…', 6000)
    await new Promise(r => setTimeout(r, 60))
    const guestIds = guests.map(g => g.id)
    const rounds = optimiseRotations(guestIds, groupNames.length, 3, 40)
    const assignments = roundsToAssignments(rounds)
    const stats = calculateCoverage(guestIds, rounds)
    for (const guest of guests) {
      const a = assignments[guest.id]
      if (!a) continue
      await supabase.from('guests').update({
        round1_table: a.round1_table || 1,
        round2_table: a.round2_table || 1,
        round3_table: a.round3_table || 1,
      }).eq('id', guest.id)
    }
    await loadAll()
    setCoverage(stats)
    setOptimising(false)
    showToast(`Done — ${stats.coveragePercent}% of possible pairs will meet`)
  }

  async function shuffleRound(round) {
    const shuffled = [...guests].sort(() => Math.random() - 0.5)
    const field = `round${round}_table`
    const n = groupNames.length
    for (let i = 0; i < shuffled.length; i++) {
      await supabase.from('guests').update({ [field]: (i % n) + 1 }).eq('id', shuffled[i].id)
    }
    await loadAll()
    showToast(`Round ${round} shuffled`)
  }

  async function updateAssignment(guestId, round, tableNum) {
    const field = `round${round}_table`
    await supabase.from('guests').update({ [field]: parseInt(tableNum) }).eq('id', guestId)
    setGuests(gs => gs.map(g => g.id === guestId ? { ...g, [field]: parseInt(tableNum) } : g))
  }

  async function toggleSpy(guestId, isSpy, missionIdx) {
    await supabase.from('guests').update({
      is_spy: isSpy,
      spy_mission_index: isSpy ? missionIdx : null
    }).eq('id', guestId)
    setGuests(gs => gs.map(g => g.id === guestId
      ? { ...g, is_spy: isSpy, spy_mission_index: isSpy ? missionIdx : null } : g))
    showToast(isSpy ? `Mission: ${spyMissions[missionIdx]?.title || ''}` : 'Spy role removed')
  }

  async function addGuest() {
    const name = newGuest.trim()
    if (!name || !event) return
    const n = groupNames.length
    const idx = guests.length
    const { data, error } = await supabase
      .from('guests')
      .insert({
        event_id: event.id, name,
        round1_table: (idx % n) + 1,
        round2_table: ((idx + 1) % n) + 1,
        round3_table: ((idx + 2) % n) + 1,
        round4_table: 1, round5_table: 1, round6_table: 1,
        is_spy: false
      })
      .select().single()
    if (error) { showToast('Error: ' + error.message); return }
    if (data) {
      setGuests(gs => [...gs, data].sort((a, b) => a.name.localeCompare(b.name)))
      setNewGuest('')
      showToast(`${name} added`)
    }
  }

  async function removeGuest(id) {
    await supabase.from('guests').delete().eq('id', id)
    setGuests(gs => gs.filter(g => g.id !== id))
    showToast('Removed')
  }

  async function bulkImport() {
    const raw = window.prompt('Paste guest names, one per line:')
    if (!raw || !event) return
    const names = raw.split('\n').map(n => n.trim()).filter(Boolean)
    const n = groupNames.length
    const startIdx = guests.length
    const rows = names.map((name, i) => ({
      event_id: event.id, name,
      round1_table: ((startIdx + i) % n) + 1,
      round2_table: ((startIdx + i + 1) % n) + 1,
      round3_table: ((startIdx + i + 2) % n) + 1,
      round4_table: 1, round5_table: 1, round6_table: 1,
      is_spy: false,
    }))
    const { error } = await supabase.from('guests').insert(rows)
    if (error) { showToast('Import error: ' + error.message); return }
    await loadAll()
    showToast(`${names.length} guests added`)
  }

  async function saveSettings() {
    const { error } = await supabase.from('events').update({
      guest_code: guestCode.toUpperCase().trim(),
      host_code: hostCode.toUpperCase().trim(),
      edition: edition.trim(),
      group_names: groupNamesRaw.trim(),
      menti_link: mentiLink.trim(),
      menti_presenter_link: mentiPresenterLink.trim(),
      whatsapp_link: waLink.trim(),
      spy_missions: JSON.stringify(spyMissions),
    }).eq('id', event.id)
    if (error) { showToast('Save failed: ' + error.message); return }
    await loadAll()
    showToast('Settings saved')
  }

  async function archiveAndReset(hardReset = false) {
    if (!event) return
    const confirmed = window.confirm(
      hardReset
        ? `Archive ${event.edition || 'this event'} and wipe the guest list for a fresh start?`
        : `Archive ${event.edition || 'this event'} and reset tonight's state? Guest list will be kept.`
    )
    if (!confirmed) return
    setArchiving(true)

    // Build guest snapshot
    const guestsSnapshot = guests.map(g => ({
      name: g.name,
      round1: groupNames[g.round1_table - 1] || '',
      round2: groupNames[g.round2_table - 1] || '',
      round3: groupNames[g.round3_table - 1] || '',
      is_spy: g.is_spy,
    }))

    // Save archive
    const { error: archErr } = await supabase.from('event_archives').insert({
      edition: event.edition || 'Untitled',
      event_date: new Date().toISOString().split('T')[0],
      guest_count: guests.length,
      group_names: event.group_names || '',
      guest_code: event.guest_code || '',
      guests_json: guestsSnapshot,
    })

    if (archErr) { showToast('Archive failed: ' + archErr.message); setArchiving(false); return }

    // Reset event state
    const defaultMissions = [
      { title: 'The Untold Story', brief: "Discover something about one person tonight that they have never posted on social media and probably never will. Don't ask directly — let it come up naturally." },
      { title: 'The Plot Twist', brief: "Find one person whose current life looks nothing like what they planned 10 years ago. Find out what changed. The best discoveries come through listening, not asking." },
      { title: 'The Best Mistake', brief: "Discover one person's best mistake — the thing that went wrong and turned out to be exactly right. People love talking about this. Give them the space." },
    ]
    await supabase.from('events').update({
      current_phase: 0,
      current_round: 1,
      current_prompt: '',
      timer_ends_at: null,
      menti_active: false,
      ...(hardReset ? { spy_missions: JSON.stringify(defaultMissions) } : {}),
    }).eq('id', event.id)

    // Hard reset — wipe guests
    if (hardReset) {
      await supabase.from('guests').delete().eq('event_id', event.id)
    }

    await loadAll()
    setArchiving(false)
    showToast(`${event.edition || 'Event'} archived${hardReset ? ' and guest list cleared' : ''}`)
  }

  function downloadArchiveCSV(archive) {
    const guests = archive.guests_json || []
    const headers = ['Guest', 'Round 1', 'Round 2', 'Round 3', 'Spy']
    const rows = guests.map(g => [g.name, g.round1, g.round2, g.round3, g.is_spy ? 'Yes' : 'No'])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `nice2meetya-${archive.edition}-${archive.event_date}.csv`
    a.click()
  }

  function exportCSV() {
    const headers = ['Guest', 'Round 1', 'Round 2', 'Round 3', 'Spy', 'Mission']
    const rows = guests.map(g => [
      g.name,
      groupNames[g.round1_table - 1] || '',
      groupNames[g.round2_table - 1] || '',
      groupNames[g.round3_table - 1] || '',
      g.is_spy ? 'Yes' : 'No',
      g.is_spy && g.spy_mission_index !== null ? (spyMissions[g.spy_mission_index]?.title || '') : '',
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `nice2meetya-${edition || 'event'}.csv`
    a.click()
  }

  if (!event) return <div className={styles.loading}><p>Loading…</p></div>

  const timerRunning = event.timer_ends_at && hostTimeLeft !== null && hostTimeLeft > 0

  if (screenMode) {
    const se = screenEvent || event
    const phase = PHASES[se?.current_phase] || PHASES[0]
    const screenTimeLeft = se?.timer_ends_at
      ? Math.max(0, Math.ceil((new Date(se.timer_ends_at) - Date.now()) / 1000))
      : null
    const mentiCode = (se?.menti_link || '')
      .replace('https://www.menti.com/', '').replace('https://menti.com/', '')
    return (
      <div className={styles.screenMode}>
        <button className={styles.exitScreen} onClick={() => setScreenMode(false)}>Exit</button>
        <div className={styles.screenBrand}>NICE2<span>MEETYA!</span></div>
        <div className={styles.screenPhase}>{phase.name}</div>
        {se?.current_prompt && (
          <div className={styles.screenPrompt}>{se.current_prompt}</div>
        )}
        {se?.menti_active && (
          <div className={styles.screenMenti}>
            <div className={styles.screenMentiSub}>Open Mentimeter to vote</div>
            <div className={styles.screenMentiUrl}>menti.com</div>
            {mentiCode ? <div className={styles.screenMentiCode}>{mentiCode}</div> : null}
          </div>
        )}
        {screenTimeLeft !== null && screenTimeLeft > 0 && (
          <div className={`${styles.screenTimer} ${screenTimeLeft <= 30 ? styles.screenTimerUrgent : ''}`}>
            {formatTime(screenTimeLeft)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={styles.layout}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarBrand}>NICE2<span>MEETYA!</span></div>

        <div className={styles.sidebarSection}>Tonight</div>
        <div className={`${styles.navItem} ${tab === 'tonight' ? styles.navActive : ''}`}
          onClick={() => switchTab('tonight')}>
          <span className={styles.navIcon}>◎</span> Control Panel
        </div>

        <div className={styles.sidebarSection}>Setup</div>
        {[
          { key: 'groups',   icon: '◈', label: 'Groups' },
          { key: 'spies',    icon: '◉', label: 'Spy Missions' },
          { key: 'guests',   icon: '◇', label: 'Guest List' },
          { key: 'settings', icon: '◆', label: 'Settings' },
          { key: 'archives', icon: '◫', label: 'Archives' },
        ].map(item => (
          <div key={item.key}
            className={`${styles.navItem} ${tab === item.key ? styles.navActive : ''}`}
            onClick={() => switchTab(item.key)}>
            <span className={styles.navIcon}>{item.icon}</span> {item.label}
          </div>
        ))}

        <div className={styles.sidebarDivider} />
        <div className={styles.navItem} onClick={() => setScreenMode(true)}>
          <span className={styles.navIcon}>⊡</span> Screen Mode
        </div>

        <div className={styles.sidebarStatus}>
          <div className={styles.liveDot} />
          <div>
            <div className={styles.statusGuests}>{guests.length} guests · {groupNames.length} groups</div>
            <div className={styles.statusCode}>{event.guest_code}</div>
          </div>
        </div>
      </div>

      <div className={styles.main}>

        {tab === 'tonight' && (
          <div>
            <div className={styles.pageHeader}>
              <h2 className={styles.tabTitle}>Control Panel</h2>
              <p className={styles.tabSub}>Run the entire evening from this screen.</p>
            </div>

            <div className={styles.commandBar}>
              <div className={styles.commandUnit}>
                <div className={styles.commandLabel}>Round</div>
                <div className={styles.roundBtns}>
                  {[1, 2, 3].map(r => (
                    <button key={r}
                      className={`${styles.roundBtn} ${event.current_round === r ? styles.roundBtnActive : ''}`}
                      onClick={() => setRound(r)}>{r}</button>
                  ))}
                </div>
              </div>

              <div className={styles.commandUnit}>
                <div className={styles.commandLabel}>Timer</div>
                <div className={styles.timerRow}>
                  {timerRunning ? (
                    <>
                      <div className={`${styles.timerDisplay} ${hostTimeLeft <= 30 ? styles.timerUrgent : ''}`}>
                        {formatTime(hostTimeLeft)}
                      </div>
                      <button className={styles.timerStopBtn} onClick={stopTimer}>Stop</button>
                    </>
                  ) : (
                    <>
                      <input type="number" className={styles.timerInput}
                        min={1} max={90} value={timerMins}
                        onChange={e => setTimerMins(parseInt(e.target.value) || 10)} />
                      <span className={styles.timerUnit}>min</span>
                      <button className={styles.timerStartBtn} onClick={startTimer}>Start</button>
                    </>
                  )}
                </div>
              </div>

              <div className={styles.commandUnit}>
                <div className={styles.commandLabel}>Mentimeter</div>
                <div className={styles.mentiControls}>
                  <button
                    className={`${styles.mentiToggle} ${event.menti_active ? styles.mentiToggleOn : ''}`}
                    onClick={() => toggleMenti(!event.menti_active)}>
                    {event.menti_active ? 'Live ●' : 'Off ○'}
                  </button>
                  {event.menti_presenter_link && (
                    <a
                      href={event.menti_presenter_link}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.presenterBtn}
                    >
                      Open Presenter View ↗
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.sectionLabel}>Phase</div>
            <div className={styles.phaseList}>
              {PHASES.map((p, i) => (
                <div key={i}
                  className={`${styles.phaseItem} ${i === event.current_phase ? styles.phaseCurrent : ''} ${i < event.current_phase ? styles.phaseDone : ''}`}
                  onClick={() => setPhase(i)}>
                  <div className={styles.phaseNum}>{i + 1}</div>
                  <div className={styles.phaseInfo}>
                    <div className={styles.phaseName}>{p.name}</div>
                    <div className={styles.phaseDesc}>{p.desc}</div>
                  </div>
                  {i === event.current_phase && <div className={styles.livePill}>Live</div>}
                  {i < event.current_phase && <div className={styles.donePill}>✓</div>}
                </div>
              ))}
            </div>

            <div className={styles.sectionLabel} style={{ marginTop: 28 }}>Live Prompt</div>
            <div className={styles.promptBlock}>
              <textarea
                className={styles.promptTextarea}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Type a prompt and push it to all phones…"
                rows={2}
              />
              <div className={styles.promptActions}>
                <button className={styles.pushBtn} onClick={pushPrompt}>Push to all phones</button>
                {event.current_prompt && (
                  <button className={styles.clearBtn} onClick={clearPrompt}>Clear</button>
                )}
              </div>
              <div className={styles.presets}>
                {PROMPT_PRESETS.map(p => (
                  <div key={p} className={styles.preset} onClick={() => setPrompt(p)}>{p}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'groups' && (
          <div>
            <div className={styles.pageHeader}>
              <h2 className={styles.tabTitle}>Group Assignments</h2>
              <p className={styles.tabSub}>
                {groupNames.length} groups · {guests.length} guests.
              </p>
            </div>

            <div className={styles.optimiseBlock}>
              <div>
                <div className={styles.optimiseTitle}>Optimise All Rounds</div>
                <div className={styles.optimiseSub}>
                  Generates Rounds 1, 2 and 3 at once to maximise unique pairings. Everyone meets as many new people as possible. Scales to any group size.
                </div>
                {coverage && (
                  <div className={styles.coverageStat}>
                    Last run: <strong>{coverage.coveragePercent}%</strong> of possible pairs will meet ·{' '}
                    {coverage.uniquePairsMet} unique connections · {coverage.repeatPairs} repeats
                  </div>
                )}
              </div>
              <button className={styles.optimiseBtn} onClick={optimiseAllRounds} disabled={optimising}>
                {optimising ? 'Calculating…' : 'Optimise'}
              </button>
            </div>

            <div className={styles.groupTiles}>
              {groupNames.map((g, gi) => {
                const field = `round${event.current_round || 1}_table`
                const count = guests.filter(gu => gu[field] === gi + 1).length
                return (
                  <div key={g} className={styles.groupTile}>
                    <div className={styles.groupTileName}>{g}</div>
                    <div className={styles.groupTileCount}>{count} guests</div>
                  </div>
                )
              })}
            </div>

            {[1, 2, 3].map(round => (
              <div key={round} className={styles.roundBlock}>
                <div className={styles.roundHeader}>
                  <span className={styles.roundHeaderTitle}>Round {round}</span>
                  <button className="btn btn-outline btn-sm" onClick={() => shuffleRound(round)}>Shuffle</button>
                </div>
                <div className={styles.assignTable}>
                  <div className={styles.assignHeader}>
                    <span>Guest</span><span>Group</span>
                  </div>
                  {guests.map(g => {
                    const field = `round${round}_table`
                    return (
                      <div key={g.id} className={styles.assignRow}>
                        <span className={styles.guestName}>
                          {g.name}
                          {g.is_spy && <span className={styles.spyTag}>spy</span>}
                        </span>
                        <select className={styles.tableSelect}
                          value={g[field] || 1}
                          onChange={e => updateAssignment(g.id, round, e.target.value)}>
                          {groupNames.map((gn, gi) => (
                            <option key={gi} value={gi + 1}>{gn}</option>
                          ))}
                        </select>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={exportCSV}>
              Export CSV
            </button>
          </div>
        )}

        {tab === 'spies' && (
          <div>
            <div className={styles.pageHeader}>
              <h2 className={styles.tabTitle}>Spy Missions</h2>
              <p className={styles.tabSub}>
                Assign a secret mission to up to 3 guests. Their mission appears only on their screen. Nobody else sees it.
              </p>
            </div>

            <div className={styles.missionCards}>
              {(spyMissions || []).map((m, mi) => {
                const spy = guests.find(g => g.is_spy && g.spy_mission_index === mi)
                return (
                  <div key={mi} className={`${styles.missionCard} ${spy ? styles.missionAssigned : ''}`}>
                    <div className={styles.missionNum}>{mi + 1}</div>
                    <div className={styles.missionTitle}>{m.title}</div>
                    <div className={styles.missionBrief}>{m.brief}</div>
                    {spy && <div className={styles.missionAssignedTo}>{spy.name.split(' ')[0]}</div>}
                  </div>
                )
              })}
            </div>

            <div className={styles.assignTable} style={{ marginTop: 20 }}>
              <div className={styles.assignHeader} style={{ gridTemplateColumns: '1fr 160px 100px' }}>
                <span>Guest</span><span>Mission</span><span></span>
              </div>
              {guests.map(g => (
                <div key={g.id} className={styles.assignRow} style={{ gridTemplateColumns: '1fr 160px 100px' }}>
                  <span className={styles.guestName}>{g.name}</span>
                  <select className={styles.tableSelect}
                    value={g.is_spy ? (g.spy_mission_index ?? '') : ''}
                    disabled={g.is_spy}
                    onChange={e => e.target.value !== '' && toggleSpy(g.id, true, parseInt(e.target.value))}>
                    <option value="">— none —</option>
                    {(spyMissions || []).map((m, mi) => (
                      <option key={mi} value={mi}>{m.title}</option>
                    ))}
                  </select>
                  {g.is_spy
                    ? <button className="btn btn-red btn-sm" onClick={() => toggleSpy(g.id, false, null)}>Remove</button>
                    : <span className={styles.noSpy} />}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'guests' && (
          <div>
            <div className={styles.pageHeader}>
              <h2 className={styles.tabTitle}>Guest List</h2>
              <p className={styles.tabSub}>{guests.length} guests on the list tonight.</p>
            </div>
            <div className={styles.addGuestRow}>
              <input className="input" value={newGuest}
                onChange={e => setNewGuest(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addGuest()}
                placeholder="Guest name…" />
              <button className="btn btn-gold" onClick={addGuest}>Add</button>
              <button className="btn btn-outline" onClick={bulkImport}>Bulk Import</button>
            </div>
            <div className={styles.assignTable}>
              <div className={styles.assignHeader} style={{ gridTemplateColumns: '1fr 80px' }}>
                <span>Name</span><span></span>
              </div>
              {guests.map(g => (
                <div key={g.id} className={styles.assignRow} style={{ gridTemplateColumns: '1fr 80px' }}>
                  <span className={styles.guestName}>
                    {g.name}
                    {g.is_spy && <span className={styles.spyTag}>spy</span>}
                  </span>
                  <button className="btn btn-red btn-sm" onClick={() => removeGuest(g.id)}>Remove</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <div>
            <div className={styles.pageHeader}>
              <h2 className={styles.tabTitle}>Settings</h2>
              <p className={styles.tabSub}>All changes go live after saving.</p>
            </div>
            <div className={styles.settingsCard}>

              <div className={styles.settingsGroup}>
                <div className={styles.settingsGroupTitle}>Access</div>
                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabel}>Guest Code <span className={styles.settingsSub}>Share on arrival</span></div>
                  <input className="input" style={{ width: 120, textAlign: 'center', fontFamily: "'Bebas Neue'", fontSize: 22, letterSpacing: '0.15em' }}
                    value={guestCode} maxLength={8} onChange={e => setGuestCode(e.target.value.toUpperCase())} />
                </div>
                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabel}>Host Password <span className={styles.settingsSub}>Keep private</span></div>
                  <input className="input" style={{ width: 120, textAlign: 'center' }}
                    value={hostCode} maxLength={8} type="password" onChange={e => setHostCode(e.target.value)} />
                </div>
              </div>

              <div className={styles.settingsGroup}>
                <div className={styles.settingsGroupTitle}>Event</div>
                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabel}>Edition <span className={styles.settingsSub}>e.g. Edition VII</span></div>
                  <input className="input" style={{ width: 160 }} value={edition} onChange={e => setEdition(e.target.value)} />
                </div>
                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabel}>
                    Group Names
                    <span className={styles.settingsSub}>Comma-separated · add as many as you need</span>
                  </div>
                  <input className="input" style={{ width: 280 }} value={groupNamesRaw}
                    onChange={e => setGroupNamesRaw(e.target.value)} placeholder="Onyx,Amber,Ivory,Pearl" />
                </div>
              </div>

              <div className={styles.settingsGroup}>
                <div className={styles.settingsGroupTitle}>Spy Missions</div>
                <SpyMissionEditor
                  initialMissions={spyMissions}
                  onSave={setSpyMissions}
                />
              </div>

              <div className={styles.settingsGroup}>
                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabel}>Mentimeter Voting Link <span className={styles.settingsSub}>Guests use this to vote</span></div>
                  <input className="input" style={{ width: 280 }} value={mentiLink} onChange={e => setMentiLink(e.target.value)} />
                </div>
                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabel}>Mentimeter Presenter Link <span className={styles.settingsSub}>Open this on the venue screen to show live results</span></div>
                  <input className="input" style={{ width: 280 }} value={mentiPresenterLink} onChange={e => setMentiPresenterLink(e.target.value)} />
                </div>
                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabel}>WhatsApp Link <span className={styles.settingsSub}>Community invite</span></div>
                  <input className="input" style={{ width: 280 }} value={waLink} onChange={e => setWaLink(e.target.value)} />
                </div>
              </div>

            </div>
            <button className="btn btn-gold" onClick={saveSettings} style={{ marginTop: 20 }}>
              Save All Settings
            </button>

            <div className={styles.resetBlock}>
              <div className={styles.resetTitle}>Archive & Reset</div>
              <div className={styles.resetSub}>
                Both options archive the current edition before resetting. The archive is always saved first.
              </div>
              <div className={styles.resetBtns}>
                <button
                  className={styles.resetSoftBtn}
                  onClick={() => archiveAndReset(false)}
                  disabled={archiving}
                >
                  {archiving ? 'Archiving…' : 'Archive & Soft Reset'}
                  <span className={styles.resetBtnSub}>Keeps guest list · resets phase, round, prompt, timer</span>
                </button>
                <button
                  className={styles.resetHardBtn}
                  onClick={() => archiveAndReset(true)}
                  disabled={archiving}
                >
                  {archiving ? 'Archiving…' : 'Archive & Full Reset'}
                  <span className={styles.resetBtnSub}>Wipes guest list · fresh start for new edition</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'archives' && (
          <div>
            <div className={styles.pageHeader}>
              <h2 className={styles.tabTitle}>Archives</h2>
              <p className={styles.tabSub}>{archives.length} past edition{archives.length !== 1 ? 's' : ''} on record.</p>
            </div>

            {archives.length === 0 ? (
              <div className={styles.emptyArchives}>
                <p>No archives yet. After your first event, use Archive & Reset in Settings to save it here.</p>
              </div>
            ) : (
              <div className={styles.archiveList}>
                {archives.map(a => (
                  <div key={a.id} className={styles.archiveCard}>
                    <div className={styles.archiveLeft}>
                      <div className={styles.archiveEdition}>{a.edition}</div>
                      <div className={styles.archiveMeta}>
                        {new Date(a.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                        {' · '}
                        {a.guest_count} guests
                        {a.group_names ? ` · ${a.group_names.split(',').length} groups` : ''}
                      </div>
                    </div>
                    <button
                      className={styles.archiveDownload}
                      onClick={() => downloadArchiveCSV(a)}
                    >
                      Download CSV
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  )
}
