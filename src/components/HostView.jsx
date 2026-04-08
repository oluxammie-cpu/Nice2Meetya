import { useState, useEffect, useRef } from 'react'
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

const DEFAULT_MISSIONS = [
  { title: 'The Untold Story', brief: "Discover something about one person tonight that they have never posted on social media and probably never will. Don't ask directly — let it come up naturally." },
  { title: 'The Plot Twist', brief: "Find one person whose current life looks nothing like what they planned 10 years ago. Find out what changed. The best discoveries come through listening, not asking." },
  { title: 'The Best Mistake', brief: "Discover one person's best mistake — the thing that went wrong and turned out to be exactly right. People love talking about this. Give them the space." },
]

// ── SCREEN MODE ──────────────────────────────────────────────
// Completely self-contained component with its own Supabase subscription
function ScreenMode({ onExit }) {
  const [ev, setEv] = useState(null)
  const [timeLeft, setTimeLeft] = useState(null)

  useEffect(() => {
    // Initial load
    supabase.from('events').select('*').eq('active', true).single()
      .then(({ data }) => { if (data) setEv(data) })

    // Own realtime subscription
    const ch = supabase.channel('screen-own')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events' },
        payload => setEv(prev => ({ ...prev, ...payload.new })))
      .subscribe()

    return () => supabase.removeChannel(ch)
  }, [])

  // Timer countdown
  useEffect(() => {
    if (!ev?.timer_ends_at) { setTimeLeft(null); return }
    const tick = () => setTimeLeft(Math.max(0, Math.ceil((new Date(ev.timer_ends_at) - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [ev?.timer_ends_at])

  if (!ev) return <div className={styles.screenMode}><button className={styles.exitScreen} onClick={onExit}>Exit</button><p style={{color:'rgba(255,255,255,0.3)',fontFamily:'serif',fontStyle:'italic'}}>Connecting…</p></div>

  const phase = PHASES[ev.current_phase] || PHASES[0]
  const mentiCode = (ev.menti_link || '').replace('https://www.menti.com/', '').replace('https://menti.com/', '')
  const fmt = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`

  return (
    <div className={styles.screenMode}>
      <button className={styles.exitScreen} onClick={onExit}>Exit</button>
      <div className={styles.screenBrand}>NICE2<span>MEETYA!</span></div>
      <div className={styles.screenPhase}>{phase.name}</div>
      {ev.current_prompt ? <div className={styles.screenPrompt}>{ev.current_prompt}</div> : null}
      {ev.menti_active && (
        <div className={styles.screenMenti}>
          <div className={styles.screenMentiSub}>Open Mentimeter to vote</div>
          <div className={styles.screenMentiUrl}>menti.com</div>
          {mentiCode && <div className={styles.screenMentiCode}>{mentiCode}</div>}
        </div>
      )}
      {timeLeft !== null && timeLeft > 0 && (
        <div className={`${styles.screenTimer} ${timeLeft <= 30 ? styles.screenTimerUrgent : ''}`}>
          {fmt(timeLeft)}
        </div>
      )}
      {timeLeft === 0 && <div className={styles.screenTimerDone}>Time</div>}
    </div>
  )
}

// ── MAIN HOST VIEW ───────────────────────────────────────────
export default function HostView() {
  const [tab, setTab]           = useState(() => sessionStorage.getItem('n2my_tab') || 'tonight')
  const [event, setEvent]       = useState(null)
  const [guests, setGuests]     = useState([])
  const [prompt, setPrompt]     = useState('')
  const [newGuest, setNewGuest] = useState('')
  const [toast, setToast]       = useState('')
  const [screenMode, setScreenMode] = useState(false)
  const [timerMins, setTimerMins]   = useState(10)
  const [hostTimeLeft, setHostTimeLeft] = useState(null)
  const [optimising, setOptimising]   = useState(false)
  const [coverage, setCoverage]       = useState(null)
  const [archives, setArchives]       = useState([])
  const [archiving, setArchiving]     = useState(false)

  // Settings fields — controlled independently from event to avoid overwrite
  const [guestCode, setGuestCode]   = useState('')
  const [hostCode, setHostCode]     = useState('')
  const [edition, setEdition]       = useState('')
  const [groupNamesRaw, setGroupNamesRaw] = useState('Onyx,Amber,Ivory,Pearl')
  const [mentiLink, setMentiLink]   = useState('')
  const [mentiPresLink, setMentiPresLink] = useState('')
  const [waLink, setWaLink]         = useState('')

  // Spy missions — completely isolated state, never overwritten by realtime
  const [missions, setMissions] = useState(DEFAULT_MISSIONS)
  const missionsLoaded = useRef(false)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2800) }

  function switchTab(key) { setTab(key); sessionStorage.setItem('n2my_tab', key) }

  // ── LOAD EVENT + GUESTS ──
  async function loadEvent() {
    const { data: ev } = await supabase.from('events').select('*').eq('active', true).single()
    if (!ev) return
    setEvent(ev)
    setPrompt(ev.current_prompt || '')
    setGuestCode(ev.guest_code || '')
    setHostCode(ev.host_code || '')
    setEdition(ev.edition || '')
    setGroupNamesRaw(ev.group_names || 'Onyx,Amber,Ivory,Pearl')
    setMentiLink(ev.menti_link || '')
    setMentiPresLink(ev.menti_presenter_link || '')
    setWaLink(ev.whatsapp_link || '')

    // Load missions only once — never again, so edits aren't overwritten
    if (!missionsLoaded.current && ev.spy_missions) {
      try {
        const parsed = JSON.parse(ev.spy_missions)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMissions(parsed)
          missionsLoaded.current = true
        }
      } catch {}
    }

    return ev.id
  }

  async function loadGuests(eventId) {
    const { data } = await supabase.from('guests').select('*').eq('event_id', eventId).order('name')
    setGuests(data || [])
  }

  async function loadArchives() {
    const { data } = await supabase.from('event_archives').select('*').order('created_at', { ascending: false })
    setArchives(data || [])
  }

  // Initial load
  useEffect(() => {
    loadEvent().then(id => { if (id) { loadGuests(id); loadArchives() } })
  }, [])

  // Realtime — event updates only touch event state, never missions or settings fields
  useEffect(() => {
    const ch = supabase.channel('host-events')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events' }, payload => {
        setEvent(prev => ({ ...prev, ...payload.new }))
        // Sync prompt display with live value
        if (payload.new.current_prompt !== undefined) setPrompt(payload.new.current_prompt || '')
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  // Realtime — guest changes reload guest list only
  useEffect(() => {
    if (!event?.id) return
    const ch = supabase.channel('host-guests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guests' },
        () => loadGuests(event.id))
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [event?.id])

  // Host-side timer countdown
  useEffect(() => {
    if (!event?.timer_ends_at) { setHostTimeLeft(null); return }
    const tick = () => setHostTimeLeft(Math.max(0, Math.ceil((new Date(event.timer_ends_at) - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [event?.timer_ends_at])

  const fmt = s => s === null ? null : `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`

  const groupNames = groupNamesRaw.split(',').map(g => g.trim()).filter(Boolean)

  // ── ACTIONS ──

  async function setPhase(i) {
    await supabase.from('events').update({ current_phase: i }).eq('id', event.id)
    setEvent(e => ({ ...e, current_phase: i }))
    showToast(`Phase: ${PHASES[i].name}`)
  }

  async function setRound(r) {
    await supabase.from('events').update({ current_round: r }).eq('id', event.id)
    setEvent(e => ({ ...e, current_round: r }))
    showToast(`Round ${r} active`)
  }

  async function toggleMenti(on) {
    await supabase.from('events').update({ menti_active: on }).eq('id', event.id)
    setEvent(e => ({ ...e, menti_active: on }))
    showToast(on ? 'Mentimeter live on all phones' : 'Mentimeter off')
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
    showToast('Prompt pushed to all phones')
  }

  async function clearPrompt() {
    setPrompt('')
    await supabase.from('events').update({ current_prompt: '' }).eq('id', event.id)
    showToast('Prompt cleared')
  }

  async function optimiseAllRounds() {
    if (!guests.length) { showToast('Add guests first'); return }
    setOptimising(true)
    showToast('Calculating…', 6000)
    await new Promise(r => setTimeout(r, 60))
    const ids = guests.map(g => g.id)
    const rounds = optimiseRotations(ids, groupNames.length, 3, 40)
    const asgn = roundsToAssignments(rounds)
    const stats = calculateCoverage(ids, rounds)
    for (const g of guests) {
      const a = asgn[g.id]
      if (!a) continue
      await supabase.from('guests').update({
        round1_table: a.round1_table || 1,
        round2_table: a.round2_table || 1,
        round3_table: a.round3_table || 1,
      }).eq('id', g.id)
    }
    await loadGuests(event.id)
    setCoverage(stats)
    setOptimising(false)
    showToast(`Done — ${stats.coveragePercent}% of pairs will meet`)
  }

  async function shuffleRound(round) {
    const shuffled = [...guests].sort(() => Math.random() - 0.5)
    const n = groupNames.length
    for (let i = 0; i < shuffled.length; i++) {
      await supabase.from('guests').update({ [`round${round}_table`]: (i % n) + 1 }).eq('id', shuffled[i].id)
    }
    await loadGuests(event.id)
    showToast(`Round ${round} shuffled`)
  }

  async function updateAssignment(guestId, round, val) {
    const field = `round${round}_table`
    await supabase.from('guests').update({ [field]: parseInt(val) }).eq('id', guestId)
    setGuests(gs => gs.map(g => g.id === guestId ? { ...g, [field]: parseInt(val) } : g))
  }

  async function toggleSpy(guestId, isSpy, missionIdx) {
    await supabase.from('guests').update({ is_spy: isSpy, spy_mission_index: isSpy ? missionIdx : null }).eq('id', guestId)
    setGuests(gs => gs.map(g => g.id === guestId ? { ...g, is_spy: isSpy, spy_mission_index: isSpy ? missionIdx : null } : g))
    showToast(isSpy ? `Mission assigned: ${missions[missionIdx]?.title || ''}` : 'Spy role removed')
  }

  async function addGuest() {
    const name = newGuest.trim()
    if (!name || !event) return
    const n = groupNames.length
    const idx = guests.length
    const { data, error } = await supabase.from('guests').insert({
      event_id: event.id, name,
      round1_table: (idx % n) + 1,
      round2_table: ((idx + 1) % n) + 1,
      round3_table: ((idx + 2) % n) + 1,
      round4_table: 1, round5_table: 1, round6_table: 1,
      is_spy: false,
    }).select().single()
    if (error) { showToast('Error: ' + error.message); return }
    if (data) { setGuests(gs => [...gs, data].sort((a, b) => a.name.localeCompare(b.name))); setNewGuest(''); showToast(`${name} added`) }
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
    const si = guests.length
    const rows = names.map((name, i) => ({
      event_id: event.id, name,
      round1_table: ((si + i) % n) + 1,
      round2_table: ((si + i + 1) % n) + 1,
      round3_table: ((si + i + 2) % n) + 1,
      round4_table: 1, round5_table: 1, round6_table: 1,
      is_spy: false,
    }))
    const { error } = await supabase.from('guests').insert(rows)
    if (error) { showToast('Error: ' + error.message); return }
    await loadGuests(event.id)
    showToast(`${names.length} guests added`)
  }

  async function saveSettings() {
    const { error } = await supabase.from('events').update({
      guest_code: guestCode.toUpperCase().trim(),
      host_code: hostCode.toUpperCase().trim(),
      edition: edition.trim(),
      group_names: groupNamesRaw.trim(),
      menti_link: mentiLink.trim(),
      menti_presenter_link: mentiPresLink.trim(),
      whatsapp_link: waLink.trim(),
      spy_missions: JSON.stringify(missions),
    }).eq('id', event.id)
    if (error) { showToast('Save failed: ' + error.message); return }
    showToast('Settings saved')
  }

  async function archiveAndReset(hard) {
    if (!event) return
    if (!window.confirm(hard ? `Archive and wipe guest list?` : `Archive and soft reset?`)) return
    setArchiving(true)
    const snap = guests.map(g => ({
      name: g.name,
      round1: groupNames[g.round1_table - 1] || '',
      round2: groupNames[g.round2_table - 1] || '',
      round3: groupNames[g.round3_table - 1] || '',
      is_spy: g.is_spy,
    }))
    const { error } = await supabase.from('event_archives').insert({
      edition: event.edition || 'Untitled',
      event_date: new Date().toISOString().split('T')[0],
      guest_count: guests.length,
      group_names: event.group_names || '',
      guest_code: event.guest_code || '',
      guests_json: snap,
    })
    if (error) { showToast('Archive failed: ' + error.message); setArchiving(false); return }
    const resetData = { current_phase: 0, current_round: 1, current_prompt: '', timer_ends_at: null, menti_active: false }
    if (hard) resetData.spy_missions = JSON.stringify(DEFAULT_MISSIONS)
    await supabase.from('events').update(resetData).eq('id', event.id)
    if (hard) await supabase.from('guests').delete().eq('event_id', event.id)
    if (hard) { setGuests([]); setMissions(DEFAULT_MISSIONS); missionsLoaded.current = false }
    await loadEvent()
    setArchiving(false)
    showToast(`Archived${hard ? ' and reset' : ''}`)
  }

  function downloadArchive(a) {
    const rows = (a.guests_json || []).map(g => [g.name, g.round1, g.round2, g.round3, g.is_spy ? 'Yes' : 'No'])
    const csv = [['Guest','Round 1','Round 2','Round 3','Spy'], ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const el = document.createElement('a')
    el.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    el.download = `nice2meetya-${a.edition}-${a.event_date}.csv`
    el.click()
  }

  function exportCSV() {
    const rows = guests.map(g => [
      g.name,
      groupNames[g.round1_table - 1] || '',
      groupNames[g.round2_table - 1] || '',
      groupNames[g.round3_table - 1] || '',
      g.is_spy ? 'Yes' : 'No',
      g.is_spy && g.spy_mission_index != null ? (missions[g.spy_mission_index]?.title || '') : '',
    ])
    const csv = [['Guest','Round 1','Round 2','Round 3','Spy','Mission'], ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const el = document.createElement('a')
    el.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    el.download = `nice2meetya-${edition || 'event'}.csv`
    el.click()
  }

  // ── INPUT STYLES (used inline to avoid CSS conflicts) ──
  const iStyle = { display:'block', width:'100%', boxSizing:'border-box', background:'#181818', border:'0.5px solid rgba(255,255,255,0.12)', borderRadius:4, color:'#fff', fontFamily:'DM Sans,sans-serif', fontSize:13, padding:'9px 14px', outline:'none', marginBottom:0 }
  const taStyle = { ...iStyle, minHeight:80, resize:'vertical', fontStyle:'italic', lineHeight:1.6 }

  if (!event) return <div className={styles.loading}><p>Loading…</p></div>
  if (screenMode) return <ScreenMode onExit={() => setScreenMode(false)} />

  const timerRunning = event.timer_ends_at && hostTimeLeft !== null && hostTimeLeft > 0

  return (
    <div className={styles.layout}>
      {/* SIDEBAR */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarBrand}>NICE2<span>MEETYA!</span></div>
        <div className={styles.sidebarSection}>Tonight</div>
        <div className={`${styles.navItem} ${tab==='tonight'?styles.navActive:''}`} onClick={() => switchTab('tonight')}>
          <span className={styles.navIcon}>◎</span> Control Panel
        </div>
        <div className={styles.sidebarSection}>Setup</div>
        {[
          { key:'groups', icon:'◈', label:'Groups' },
          { key:'spies',  icon:'◉', label:'Spy Missions' },
          { key:'guests', icon:'◇', label:'Guest List' },
          { key:'settings', icon:'◆', label:'Settings' },
          { key:'archives', icon:'◫', label:'Archives' },
        ].map(item => (
          <div key={item.key} className={`${styles.navItem} ${tab===item.key?styles.navActive:''}`} onClick={() => switchTab(item.key)}>
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

      {/* MAIN */}
      <div className={styles.main}>

        {/* ── TONIGHT ── */}
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
                  {[1,2,3].map(r => (
                    <button key={r} className={`${styles.roundBtn} ${event.current_round===r?styles.roundBtnActive:''}`} onClick={() => setRound(r)}>{r}</button>
                  ))}
                </div>
              </div>
              <div className={styles.commandUnit}>
                <div className={styles.commandLabel}>Timer</div>
                <div className={styles.timerRow}>
                  {timerRunning ? (
                    <>
                      <div className={`${styles.timerDisplay} ${hostTimeLeft<=30?styles.timerUrgent:''}`}>{fmt(hostTimeLeft)}</div>
                      <button className={styles.timerStopBtn} onClick={stopTimer}>Stop</button>
                    </>
                  ) : (
                    <>
                      <input type="number" className={styles.timerInput} min={1} max={90} value={timerMins} onChange={e => setTimerMins(parseInt(e.target.value)||10)} />
                      <span className={styles.timerUnit}>min</span>
                      <button className={styles.timerStartBtn} onClick={startTimer}>Start</button>
                    </>
                  )}
                </div>
              </div>
              <div className={styles.commandUnit}>
                <div className={styles.commandLabel}>Mentimeter</div>
                <div className={styles.mentiControls}>
                  <button className={`${styles.mentiToggle} ${event.menti_active?styles.mentiToggleOn:''}`} onClick={() => toggleMenti(!event.menti_active)}>
                    {event.menti_active ? 'Live ●' : 'Off ○'}
                  </button>
                  {event.menti_presenter_link && (
                    <a href={event.menti_presenter_link} target="_blank" rel="noreferrer" className={styles.presenterBtn}>
                      Presenter View ↗
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.sectionLabel}>Phase</div>
            <div className={styles.phaseList}>
              {PHASES.map((p, i) => (
                <div key={i} className={`${styles.phaseItem} ${i===event.current_phase?styles.phaseCurrent:''} ${i<event.current_phase?styles.phaseDone:''}`} onClick={() => setPhase(i)}>
                  <div className={styles.phaseNum}>{i+1}</div>
                  <div className={styles.phaseInfo}>
                    <div className={styles.phaseName}>{p.name}</div>
                    <div className={styles.phaseDesc}>{p.desc}</div>
                  </div>
                  {i===event.current_phase && <div className={styles.livePill}>Live</div>}
                  {i<event.current_phase && <div className={styles.donePill}>✓</div>}
                </div>
              ))}
            </div>

            <div className={styles.sectionLabel} style={{marginTop:28}}>Live Prompt</div>
            <div className={styles.promptBlock}>
              <textarea className={styles.promptTextarea} value={prompt} rows={2} placeholder="Type a prompt and push to all phones…" onChange={e => setPrompt(e.target.value)} />
              <div className={styles.promptActions}>
                <button className={styles.pushBtn} onClick={pushPrompt}>Push to all phones</button>
                {event.current_prompt && <button className={styles.clearBtn} onClick={clearPrompt}>Clear</button>}
              </div>
              <div className={styles.presets}>
                {PROMPT_PRESETS.map(p => <div key={p} className={styles.preset} onClick={() => setPrompt(p)}>{p}</div>)}
              </div>
            </div>
          </div>
        )}

        {/* ── GROUPS ── */}
        {tab === 'groups' && (
          <div>
            <div className={styles.pageHeader}>
              <h2 className={styles.tabTitle}>Group Assignments</h2>
              <p className={styles.tabSub}>{groupNames.length} groups · {guests.length} guests</p>
            </div>
            <div className={styles.optimiseBlock}>
              <div>
                <div className={styles.optimiseTitle}>Optimise All Rounds</div>
                <div className={styles.optimiseSub}>Generates Rounds 1–3 to maximise unique pairings. Scales to any size.</div>
                {coverage && <div className={styles.coverageStat}>Last run: <strong>{coverage.coveragePercent}%</strong> of pairs will meet · {coverage.uniquePairsMet} connections · {coverage.repeatPairs} repeats</div>}
              </div>
              <button className={styles.optimiseBtn} onClick={optimiseAllRounds} disabled={optimising}>{optimising?'Calculating…':'Optimise'}</button>
            </div>
            <div className={styles.groupTiles}>
              {groupNames.map((g, gi) => {
                const count = guests.filter(gu => gu[`round${event.current_round||1}_table`]===gi+1).length
                return <div key={g} className={styles.groupTile}><div className={styles.groupTileName}>{g}</div><div className={styles.groupTileCount}>{count} guests</div></div>
              })}
            </div>
            {[1,2,3].map(round => (
              <div key={round} className={styles.roundBlock}>
                <div className={styles.roundHeader}>
                  <span className={styles.roundHeaderTitle}>Round {round}</span>
                  <button className="btn btn-outline btn-sm" onClick={() => shuffleRound(round)}>Shuffle</button>
                </div>
                <div className={styles.assignTable}>
                  <div className={styles.assignHeader}><span>Guest</span><span>Group</span></div>
                  {guests.map(g => (
                    <div key={g.id} className={styles.assignRow}>
                      <span className={styles.guestName}>{g.name}{g.is_spy&&<span className={styles.spyTag}>spy</span>}</span>
                      <select className={styles.tableSelect} value={g[`round${round}_table`]||1} onChange={e => updateAssignment(g.id,round,e.target.value)}>
                        {groupNames.map((gn,gi) => <option key={gi} value={gi+1}>{gn}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <button className="btn btn-outline btn-sm" style={{marginTop:12}} onClick={exportCSV}>Export CSV</button>
          </div>
        )}

        {/* ── SPIES ── */}
        {tab === 'spies' && (
          <div>
            <div className={styles.pageHeader}>
              <h2 className={styles.tabTitle}>Spy Missions</h2>
              <p className={styles.tabSub}>Assign a secret mission to guests. Only they see it when they look up their name.</p>
            </div>
            <div className={styles.missionCards}>
              {missions.map((m, mi) => {
                const spy = guests.find(g => g.is_spy && g.spy_mission_index===mi)
                return (
                  <div key={mi} className={`${styles.missionCard} ${spy?styles.missionAssigned:''}`}>
                    <div className={styles.missionNum}>{mi+1}</div>
                    <div className={styles.missionTitle}>{m.title}</div>
                    <div className={styles.missionBrief}>{m.brief}</div>
                    {spy && <div className={styles.missionAssignedTo}>{spy.name.split(' ')[0]}</div>}
                  </div>
                )
              })}
            </div>
            <div className={styles.assignTable} style={{marginTop:20}}>
              <div className={styles.assignHeader} style={{gridTemplateColumns:'1fr 160px 100px'}}>
                <span>Guest</span><span>Mission</span><span></span>
              </div>
              {guests.map(g => (
                <div key={g.id} className={styles.assignRow} style={{gridTemplateColumns:'1fr 160px 100px'}}>
                  <span className={styles.guestName}>{g.name}</span>
                  <select className={styles.tableSelect} value={g.is_spy?(g.spy_mission_index??''):''} disabled={g.is_spy} onChange={e => e.target.value!==''&&toggleSpy(g.id,true,parseInt(e.target.value))}>
                    <option value="">— none —</option>
                    {missions.map((m,mi) => <option key={mi} value={mi}>{m.title}</option>)}
                  </select>
                  {g.is_spy
                    ? <button className="btn btn-red btn-sm" onClick={() => toggleSpy(g.id,false,null)}>Remove</button>
                    : <span />
                  }
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── GUESTS ── */}
        {tab === 'guests' && (
          <div>
            <div className={styles.pageHeader}>
              <h2 className={styles.tabTitle}>Guest List</h2>
              <p className={styles.tabSub}>{guests.length} guests tonight.</p>
            </div>
            <div className={styles.addGuestRow}>
              <input className="input" value={newGuest} placeholder="Guest name…" onChange={e => setNewGuest(e.target.value)} onKeyDown={e => e.key==='Enter'&&addGuest()} />
              <button className="btn btn-gold" onClick={addGuest}>Add</button>
              <button className="btn btn-outline" onClick={bulkImport}>Bulk Import</button>
            </div>
            <div className={styles.assignTable}>
              <div className={styles.assignHeader} style={{gridTemplateColumns:'1fr 80px'}}><span>Name</span><span></span></div>
              {guests.map(g => (
                <div key={g.id} className={styles.assignRow} style={{gridTemplateColumns:'1fr 80px'}}>
                  <span className={styles.guestName}>{g.name}{g.is_spy&&<span className={styles.spyTag}>spy</span>}</span>
                  <button className="btn btn-red btn-sm" onClick={() => removeGuest(g.id)}>Remove</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SETTINGS ── */}
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
                  <div className={styles.settingsLabel}>Guest Code<span className={styles.settingsSub}>Share on arrival</span></div>
                  <input className="input" style={{width:120,textAlign:'center',fontFamily:"'Bebas Neue'",fontSize:22,letterSpacing:'0.15em'}} value={guestCode} maxLength={8} onChange={e => setGuestCode(e.target.value.toUpperCase())} />
                </div>
                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabel}>Host Password<span className={styles.settingsSub}>Keep private</span></div>
                  <input className="input" style={{width:120,textAlign:'center'}} type="password" value={hostCode} maxLength={8} onChange={e => setHostCode(e.target.value)} />
                </div>
              </div>

              <div className={styles.settingsGroup}>
                <div className={styles.settingsGroupTitle}>Event</div>
                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabel}>Edition<span className={styles.settingsSub}>e.g. Edition VII</span></div>
                  <input className="input" style={{width:160}} value={edition} onChange={e => setEdition(e.target.value)} />
                </div>
                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabel}>Group Names<span className={styles.settingsSub}>Comma-separated · add as many as needed</span></div>
                  <input className="input" style={{width:280}} value={groupNamesRaw} placeholder="Onyx,Amber,Ivory,Pearl" onChange={e => setGroupNamesRaw(e.target.value)} />
                </div>
              </div>

              <div className={styles.settingsGroup}>
                <div className={styles.settingsGroupTitle}>Spy Missions</div>
                <div style={{padding:'12px 24px 16px'}}>
                  {missions.map((m, mi) => (
                    <div key={mi} style={{marginBottom:16,padding:16,background:'#0d0d0d',borderRadius:8,border:'0.5px solid rgba(255,255,255,0.08)'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                        <span style={{fontSize:10,letterSpacing:'0.14em',textTransform:'uppercase',color:'#C9A84C'}}>Mission {mi+1}</span>
                        <button onClick={() => setMissions(prev => prev.filter((_,i) => i!==mi))} style={{background:'none',border:'0.5px solid rgba(232,41,26,0.4)',color:'#E8291A',borderRadius:4,fontSize:10,padding:'3px 10px',cursor:'pointer',fontFamily:'DM Sans,sans-serif'}}>Remove</button>
                      </div>
                      <input
                        type="text"
                        value={m.title}
                        placeholder="Mission title"
                        onChange={e => { const v=e.target.value; setMissions(prev => prev.map((x,i) => i===mi?{...x,title:v}:x)) }}
                        style={{...iStyle,marginBottom:8}}
                      />
                      <textarea
                        value={m.brief}
                        placeholder="What the spy sees on their phone…"
                        onChange={e => { const v=e.target.value; setMissions(prev => prev.map((x,i) => i===mi?{...x,brief:v}:x)) }}
                        style={taStyle}
                      />
                    </div>
                  ))}
                  <button onClick={() => setMissions(prev => [...prev,{title:'New Mission',brief:'Describe the mission…'}])} style={{background:'rgba(201,168,76,0.1)',border:'0.5px solid rgba(201,168,76,0.3)',color:'#C9A84C',borderRadius:4,fontSize:11,fontWeight:500,letterSpacing:'0.08em',padding:'8px 18px',cursor:'pointer',fontFamily:'DM Sans,sans-serif'}}>
                    + Add Mission
                  </button>
                </div>
              </div>

              <div className={styles.settingsGroup}>
                <div className={styles.settingsGroupTitle}>Links</div>
                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabel}>Mentimeter Voting Link<span className={styles.settingsSub}>Guests use this to vote</span></div>
                  <input className="input" style={{width:280}} value={mentiLink} onChange={e => setMentiLink(e.target.value)} />
                </div>
                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabel}>Mentimeter Presenter Link<span className={styles.settingsSub}>Open on venue screen to show live results</span></div>
                  <input className="input" style={{width:280}} value={mentiPresLink} onChange={e => setMentiPresLink(e.target.value)} />
                </div>
                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabel}>WhatsApp Community Link<span className={styles.settingsSub}>Invite link for guests</span></div>
                  <input className="input" style={{width:280}} value={waLink} onChange={e => setWaLink(e.target.value)} />
                </div>
              </div>

            </div>
            <button className="btn btn-gold" onClick={saveSettings} style={{marginTop:20}}>Save All Settings</button>

            <div className={styles.resetBlock}>
              <div className={styles.resetTitle}>Archive & Reset</div>
              <div className={styles.resetSub}>Both options archive the current edition first. The archive is always saved before anything is reset.</div>
              <div className={styles.resetBtns}>
                <button className={styles.resetSoftBtn} onClick={() => archiveAndReset(false)} disabled={archiving}>
                  {archiving?'Archiving…':'Archive & Soft Reset'}
                  <span className={styles.resetBtnSub}>Keeps guest list · resets phase, round, prompt, timer</span>
                </button>
                <button className={styles.resetHardBtn} onClick={() => archiveAndReset(true)} disabled={archiving}>
                  {archiving?'Archiving…':'Archive & Full Reset'}
                  <span className={styles.resetBtnSub}>Wipes guest list · resets missions · fresh start</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── ARCHIVES ── */}
        {tab === 'archives' && (
          <div>
            <div className={styles.pageHeader}>
              <h2 className={styles.tabTitle}>Archives</h2>
              <p className={styles.tabSub}>{archives.length} past edition{archives.length!==1?'s':''} on record.</p>
            </div>
            {archives.length===0 ? (
              <div className={styles.emptyArchives}><p>No archives yet. Use Archive & Reset in Settings after each edition.</p></div>
            ) : (
              <div className={styles.archiveList}>
                {archives.map(a => (
                  <div key={a.id} className={styles.archiveCard}>
                    <div className={styles.archiveLeft}>
                      <div className={styles.archiveEdition}>{a.edition}</div>
                      <div className={styles.archiveMeta}>
                        {new Date(a.event_date).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})} · {a.guest_count} guests{a.group_names?` · ${a.group_names.split(',').length} groups`:''}
                      </div>
                    </div>
                    <button className={styles.archiveDownload} onClick={() => downloadArchive(a)}>Download CSV</button>
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
