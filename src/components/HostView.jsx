import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { PHASES, MENTI_LINK } from '../lib/phases.js'
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

const GROUP_NAMES = ['Onyx', 'Amber', 'Ivory']

const SPY_MISSIONS = [
  { title: 'The Untold Story' },
  { title: 'The Plot Twist' },
  { title: 'The Best Mistake' },
]

export default function HostView() {
  const [tab, setTab] = useState(() => sessionStorage.getItem('n2my_host_tab') || 'phases')
  const [event, setEvent]       = useState(null)
  const [guests, setGuests]     = useState([])
  const [prompt, setPrompt]     = useState('')
  const [newGuest, setNewGuest] = useState('')
  const [toast, setToast]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [screenMode, setScreenMode] = useState(false)
  const [timerMins, setTimerMins]   = useState(5)

  // Settings
  const [guestCode, setGuestCode]   = useState('')
  const [hostCode, setHostCode]     = useState('')
  const [tableCount, setTableCount] = useState(3)
  const [edition, setEdition]       = useState('Edition VI')

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2600)
  }

  const loadAll = useCallback(async () => {
    const { data: ev } = await supabase
      .from('events')
      .select('*')
      .eq('active', true)
      .single()
    if (ev) {
      setEvent(ev)
      setPrompt(ev.current_prompt || '')
      setGuestCode(ev.guest_code || '')
      setHostCode(ev.host_code || '')
      setTableCount(ev.table_count || 3)
      setEdition(ev.edition || 'Edition VI')

      const { data: gList } = await supabase
        .from('guests')
        .select('*')
        .eq('event_id', ev.id)
        .order('name')
      setGuests(gList || [])
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  useEffect(() => {
    const ch = supabase.channel('host-panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guests' }, loadAll)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [loadAll])

  async function setPhase(i) {
    setSaving(true)
    await supabase.from('events').update({ current_phase: i }).eq('id', event.id)
    setEvent(e => ({ ...e, current_phase: i }))
    setSaving(false)
    showToast(`Phase set: ${PHASES[i].name}`)
  }

  async function setRound(r) {
    await supabase.from('events').update({ current_round: r }).eq('id', event.id)
    setEvent(e => ({ ...e, current_round: r }))
    showToast(`Round ${r} now active — group cards updated`)
  }

  async function startTimer() {
    const end = new Date(Date.now() + timerMins * 60 * 1000).toISOString()
    await supabase.from('events').update({ timer_end: end }).eq('id', event.id)
    setEvent(e => ({ ...e, timer_end: end }))
    showToast(`Timer started — ${timerMins} minutes`)
  }

  async function stopTimer() {
    await supabase.from('events').update({ timer_end: null }).eq('id', event.id)
    setEvent(e => ({ ...e, timer_end: null }))
    showToast('Timer cleared')
  }

  async function pushPrompt() {
    await supabase.from('events').update({ current_prompt: prompt }).eq('id', event.id)
    showToast('Prompt pushed')
  }

  async function clearPrompt() {
    setPrompt('')
    await supabase.from('events').update({ current_prompt: '' }).eq('id', event.id)
    showToast('Prompt cleared')
  }

  async function updateAssignment(guestId, round, group) {
    const field = `round${round}_table`
    await supabase.from('guests').update({ [field]: parseInt(group) }).eq('id', guestId)
    setGuests(gs => gs.map(g => g.id === guestId ? { ...g, [field]: parseInt(group) } : g))
  }

  async function toggleSpy(guestId, isSpy, missionIdx) {
    await supabase.from('guests').update({
      is_spy: isSpy,
      spy_mission_index: isSpy ? missionIdx : null
    }).eq('id', guestId)
    setGuests(gs => gs.map(g => g.id === guestId
      ? { ...g, is_spy: isSpy, spy_mission_index: isSpy ? missionIdx : null }
      : g))
    showToast(isSpy ? `Spy assigned: ${SPY_MISSIONS[missionIdx].title}` : 'Spy role removed')
  }

  async function autoAssign(round) {
    const field = `round${round}_table`
    for (let i = 0; i < guests.length; i++) {
      await supabase.from('guests').update({ [field]: (i % 3) + 1 }).eq('id', guests[i].id)
    }
    await loadAll()
    showToast(`Round ${round} auto-assigned to groups`)
  }

  async function shuffleRound(round) {
    const shuffled = [...guests].sort(() => Math.random() - 0.5)
    const field = `round${round}_table`
    for (let i = 0; i < shuffled.length; i++) {
      await supabase.from('guests').update({ [field]: (i % 3) + 1 }).eq('id', shuffled[i].id)
    }
    await loadAll()
    showToast(`Round ${round} shuffled`)
  }

  async function addGuest() {
    const name = newGuest.trim()
    if (!name || !event) return
    const { data } = await supabase
      .from('guests')
      .insert({ event_id: event.id, name, round1_table: 1, round2_table: 2, round3_table: 3, is_spy: false })
      .select().single()
    if (data) {
      setGuests(gs => [...gs, data].sort((a, b) => a.name.localeCompare(b.name)))
      setNewGuest('')
      showToast(`${name} added`)
    }
  }

  async function removeGuest(id) {
    await supabase.from('guests').delete().eq('id', id)
    setGuests(gs => gs.filter(g => g.id !== id))
  }

  async function bulkImport() {
    const raw = window.prompt('Paste guest names, one per line:')
    if (!raw || !event) return
    const names = raw.split('\n').map(n => n.trim()).filter(Boolean)
    const rows = names.map((name, i) => ({
      event_id: event.id, name,
      round1_table: (i % 3) + 1,
      round2_table: ((i + 1) % 3) + 1,
      round3_table: ((i + 2) % 3) + 1,
      is_spy: false,
    }))
    await supabase.from('guests').insert(rows)
    await loadAll()
    showToast(`${names.length} guests imported`)
  }

  async function saveSettings() {
    await supabase.from('events').update({
      guest_code: guestCode.toUpperCase(),
      host_code: hostCode.toUpperCase(),
      table_count: 3,
      edition,
      group_names: GROUP_NAMES.join(','),
    }).eq('id', event.id)
    showToast('Settings saved')
  }

  function exportCSV() {
    const rows = [['Guest', 'Round 1', 'Round 2', 'Round 3', 'Spy', 'Mission']]
    guests.forEach(g => rows.push([
      g.name,
      GROUP_NAMES[(g.round1_table - 1)] || '',
      GROUP_NAMES[(g.round2_table - 1)] || '',
      GROUP_NAMES[(g.round3_table - 1)] || '',
      g.is_spy ? 'Yes' : 'No',
      g.is_spy && g.spy_mission_index !== null ? SPY_MISSIONS[g.spy_mission_index].title : '',
    ]))
    const csv = rows.map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'nice2meetya-groups.csv'
    a.click()
  }

  // Timer display
  const [hostTimeLeft, setHostTimeLeft] = useState(null)
  useEffect(() => {
    if (!event?.timer_end) { setHostTimeLeft(null); return }
    const tick = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((new Date(event.timer_end).getTime() - Date.now()) / 1000))
      setHostTimeLeft(remaining)
      if (remaining === 0) clearInterval(tick)
    }, 500)
    return () => clearInterval(tick)
  }, [event?.timer_end])

  function formatTime(s) {
    if (s === null) return null
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  if (!event) {
    return <div className={styles.loading}><p>Loading event…</p></div>
  }

  // ── SCREEN MODE — shown on venue TV/laptop ──
  if (screenMode) {
    const phase = PHASES[event.current_phase] || PHASES[0]
    const isMenti = event.current_phase === 1
    return (
      <div className={styles.screenMode}>
        <button className={styles.exitScreen} onClick={() => setScreenMode(false)}>
          Exit Screen Mode
        </button>
        <div className={styles.screenLogo}>NICE2<span>MEETYA!</span></div>
        <div className={styles.screenPhase}>{phase.name}</div>
        {event.current_prompt && (
          <div className={styles.screenPrompt}>{event.current_prompt}</div>
        )}
        {isMenti && (
          <div className={styles.screenMenti}>
            <div className={styles.screenMentiLabel}>Open Mentimeter to vote</div>
            <div className={styles.screenMentiUrl}>menti.com</div>
            <div className={styles.screenMentiCode}>ali66d4zwhf3</div>
          </div>
        )}
        {hostTimeLeft !== null && (
          <div className={`${styles.screenTimer} ${hostTimeLeft <= 30 ? styles.screenTimerUrgent : ''}`}>
            {formatTime(hostTimeLeft)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={styles.layout}>

      {/* SIDEBAR */}
      <div className={styles.sidebar}>
        <p className={styles.sidebarTitle}>Host Controls</p>
        {[
          { key: 'phases',   label: 'Phase Control' },
          { key: 'groups',   label: 'Group Assignments' },
          { key: 'spies',    label: 'Spy Missions' },
          { key: 'prompts',  label: 'Live Prompts' },
          { key: 'guests',   label: 'Guest List' },
          { key: 'settings', label: 'Settings' },
        ].map(item => (
          <div
            key={item.key}
            className={`${styles.navItem} ${tab === item.key ? styles.navActive : ''}`}
            onClick={() => { setTab(item.key); sessionStorage.setItem('n2my_host_tab', item.key) }}
          >
            <div className={styles.navDot} />
            {item.label}
          </div>
        ))}
        <div className={styles.navDivider} />
        <div className={styles.navItem} onClick={() => setScreenMode(true)}>
          <div className={styles.navDot} />
          Screen Mode ↗
        </div>
      </div>

      {/* MAIN */}
      <div className={styles.main}>

        {/* Status bar */}
        <div className={styles.statusBar}>
          <div className={styles.liveDot} />
          <span className={styles.statusText}>
            Live · {guests.length} guests · {PHASES[event.current_phase]?.name}
          </span>
          <span className={styles.liveCode}>{event.guest_code}</span>
        </div>

        {/* ── PHASES ── */}
        {tab === 'phases' && (
          <div>
            <h2 className={styles.tabTitle}>Phase Control</h2>
            <p className={styles.tabSub}>Tap to push live. All phones update instantly.</p>

            <div className={styles.phaseList}>
              {PHASES.map((p, i) => (
                <div
                  key={i}
                  className={`${styles.phaseItem} ${i === event.current_phase ? styles.phaseCurrent : ''}`}
                  onClick={() => setPhase(i)}
                >
                  <div className={styles.phaseNum}>{i + 1}</div>
                  <div className={styles.phaseInfo}>
                    <div className={styles.phaseName}>{p.name}</div>
                    <div className={styles.phaseDesc}>{p.desc}</div>
                  </div>
                  {i === event.current_phase && <div className={styles.liveBadge}>Live</div>}
                </div>
              ))}
            </div>

            {/* Round control */}
            <div className={styles.roundRow}>
              <p className={styles.tabSub} style={{ marginBottom: 0 }}>Active Round:</p>
              {[1, 2, 3].map(r => (
                <button
                  key={r}
                  className={`btn ${event.current_round === r ? 'btn-gold' : 'btn-outline'}`}
                  style={{ padding: '8px 20px' }}
                  onClick={() => setRound(r)}
                >
                  Round {r}
                </button>
              ))}
            </div>

            {/* Timer */}
            <div className={styles.timerBlock}>
              <p className={styles.timerBlockLabel}>Phase Timer</p>
              <div className={styles.timerControls}>
                <input
                  type="number"
                  className="input"
                  style={{ width: 80, textAlign: 'center' }}
                  min={1} max={60}
                  value={timerMins}
                  onChange={e => setTimerMins(parseInt(e.target.value) || 5)}
                />
                <span className={styles.timerUnit}>minutes</span>
                <button className="btn btn-gold" onClick={startTimer}>Start Timer</button>
                {event.timer_end && (
                  <>
                    <span className={styles.timerLive}>
                      {formatTime(hostTimeLeft)} left
                    </span>
                    <button className="btn btn-outline" onClick={stopTimer}>Stop</button>
                  </>
                )}
              </div>
              <p className={styles.tabSub} style={{ marginTop: 8, marginBottom: 0 }}>
                Timer shows on all guest screens and pulses red in the last 30 seconds.
              </p>
            </div>
          </div>
        )}

        {/* ── GROUPS ── */}
        {tab === 'groups' && (
          <div>
            <h2 className={styles.tabTitle}>Group Assignments</h2>
            <p className={styles.tabSub}>Three groups: Onyx, Amber, Ivory. Assign guests per round.</p>

            {/* Group headcount tiles */}
            <div className={styles.groupTiles}>
              {GROUP_NAMES.map((g, gi) => {
                const round = event.current_round || 1
                const field = `round${round}_table`
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
                  <span>Round {round}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => autoAssign(round)}>Auto</button>
                    <button className="btn btn-outline btn-sm" onClick={() => shuffleRound(round)}>Shuffle</button>
                  </div>
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
                          {g.is_spy && <span className={styles.spyBadge}>spy</span>}
                        </span>
                        <select
                          className={styles.tableSelect}
                          value={g[field] || 1}
                          onChange={e => updateAssignment(g.id, round, e.target.value)}
                        >
                          {GROUP_NAMES.map((gn, gi) => (
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

        {/* ── SPIES ── */}
        {tab === 'spies' && (
          <div>
            <h2 className={styles.tabTitle}>Spy Missions</h2>
            <p className={styles.tabSub}>Assign up to 3 spies. Their mission appears only on their screen when they look up their name.</p>

            <div className={styles.missionCards}>
              {SPY_MISSIONS.map((m, mi) => {
                const assignedSpy = guests.find(g => g.is_spy && g.spy_mission_index === mi)
                return (
                  <div key={mi} className={`${styles.missionCard} ${assignedSpy ? styles.missionAssigned : ''}`}>
                    <div className={styles.missionNum}>{mi + 1}</div>
                    <div className={styles.missionTitle}>{m.title}</div>
                    {assignedSpy && (
                      <div className={styles.missionAssignedTo}>Assigned to {assignedSpy.name.split(' ')[0]}</div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className={styles.assignTable} style={{ marginTop: 24 }}>
              <div className={styles.assignHeader} style={{ gridTemplateColumns: '1fr 140px 120px' }}>
                <span>Guest</span><span>Mission</span><span>Action</span>
              </div>
              {guests.map(g => (
                <div key={g.id} className={styles.assignRow} style={{ gridTemplateColumns: '1fr 140px 120px' }}>
                  <span className={styles.guestName}>{g.name}</span>
                  <select
                    className={styles.tableSelect}
                    value={g.is_spy ? g.spy_mission_index ?? 0 : ''}
                    onChange={e => {
                      if (e.target.value !== '') {
                        toggleSpy(g.id, true, parseInt(e.target.value))
                      }
                    }}
                    disabled={g.is_spy}
                  >
                    <option value="">— no mission —</option>
                    {SPY_MISSIONS.map((m, mi) => (
                      <option key={mi} value={mi}>{m.title}</option>
                    ))}
                  </select>
                  {g.is_spy ? (
                    <button className="btn btn-red btn-sm" onClick={() => toggleSpy(g.id, false, null)}>
                      Remove
                    </button>
                  ) : (
                    <span className={styles.noSpy}>—</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PROMPTS ── */}
        {tab === 'prompts' && (
          <div>
            <h2 className={styles.tabTitle}>Live Prompts</h2>
            <p className={styles.tabSub}>Push to all phones instantly. Also appears in Screen Mode.</p>
            <div className={styles.promptEditor}>
              <p className={styles.promptEditorLabel}>Current Prompt</p>
              <textarea
                className={styles.promptTextarea}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="What's a skill nobody would guess from looking at you?"
                rows={3}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button className="btn btn-gold" onClick={pushPrompt}>Push to everyone</button>
                <button className="btn btn-outline" onClick={clearPrompt}>Clear</button>
              </div>
            </div>
            <p className={styles.presetsLabel}>Quick Presets</p>
            <div className={styles.presets}>
              {PROMPT_PRESETS.map(p => (
                <div key={p} className={styles.preset} onClick={() => setPrompt(p)}>{p}</div>
              ))}
            </div>
          </div>
        )}

        {/* ── GUESTS ── */}
        {tab === 'guests' && (
          <div>
            <h2 className={styles.tabTitle}>Guest List</h2>
            <p className={styles.tabSub}>{guests.length} guests tonight.</p>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <input className="input" value={newGuest}
                onChange={e => setNewGuest(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addGuest()}
                placeholder="Guest name…" />
              <button className="btn btn-gold" style={{ whiteSpace: 'nowrap' }} onClick={addGuest}>Add</button>
              <button className="btn btn-outline" style={{ whiteSpace: 'nowrap' }} onClick={bulkImport}>Bulk Import</button>
            </div>
            <div className={styles.assignTable}>
              <div className={styles.assignHeader} style={{ gridTemplateColumns: '1fr 80px' }}>
                <span>Name</span><span>Remove</span>
              </div>
              {guests.map(g => (
                <div key={g.id} className={styles.assignRow} style={{ gridTemplateColumns: '1fr 80px' }}>
                  <span className={styles.guestName}>{g.name}</span>
                  <button className="btn btn-red btn-sm" onClick={() => removeGuest(g.id)}>Remove</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SETTINGS ── */}
        {tab === 'settings' && (
          <div>
            <h2 className={styles.tabTitle}>Settings</h2>
            <p className={styles.tabSub}>Configure tonight's event.</p>
            <div className={styles.settingsCard}>
              {[
                { label: 'Guest Access Code', sub: 'Share this with guests on arrival',
                  input: <input className="input" style={{ width: 120, textAlign: 'center', fontFamily: "'Bebas Neue'", fontSize: 22, letterSpacing: '0.15em' }}
                    value={guestCode} maxLength={8} onChange={e => setGuestCode(e.target.value.toUpperCase())} /> },
                { label: 'Host Password', sub: 'Keep this private',
                  input: <input className="input" style={{ width: 120, textAlign: 'center' }}
                    value={hostCode} maxLength={8} type="password" onChange={e => setHostCode(e.target.value)} /> },
                { label: 'Event Edition', sub: 'Shown in guest view',
                  input: <input className="input" style={{ width: 140 }} value={edition} onChange={e => setEdition(e.target.value)} /> },
              ].map(row => (
                <div key={row.label} className={styles.settingsRow}>
                  <div>
                    <div className={styles.settingsLabel}>{row.label}</div>
                    <div className={styles.settingsSub}>{row.sub}</div>
                  </div>
                  {row.input}
                </div>
              ))}
            </div>
            <button className="btn btn-gold" onClick={saveSettings} style={{ marginTop: 20 }}>Save Settings</button>
          </div>
        )}

      </div>

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  )
}
