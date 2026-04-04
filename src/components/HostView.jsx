import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { PHASES } from '../lib/phases.js'
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

const SPY_MISSIONS = [
  { title: 'The Untold Story' },
  { title: 'The Plot Twist' },
  { title: 'The Best Mistake' },
]

export default function HostView() {
  const [tab, setTab]               = useState(() => sessionStorage.getItem('n2my_host_tab') || 'phases')
  const [event, setEvent]           = useState(null)
  const [guests, setGuests]         = useState([])
  const [prompt, setPrompt]         = useState('')
  const [newGuest, setNewGuest]     = useState('')
  const [toast, setToast]           = useState('')
  const [screenMode, setScreenMode] = useState(false)
  const [timerMins, setTimerMins]   = useState(5)
  const [hostTimeLeft, setHostTimeLeft] = useState(null)

  // Settings state
  const [guestCode, setGuestCode]   = useState('')
  const [hostCode, setHostCode]     = useState('')
  const [edition, setEdition]       = useState('Edition VI')
  const [groupNamesRaw, setGroupNamesRaw] = useState('Onyx,Amber,Ivory,Pearl')
  const [mentiLink, setMentiLink]   = useState('https://www.menti.com/ali66d4zwhf3')
  const [waLink, setWaLink]         = useState('https://chat.whatsapp.com/BmXCynJNcCwGR3RtUuX3DL')

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2800) }

  const loadAll = useCallback(async () => {
    const { data: ev } = await supabase
      .from('events').select('*').eq('active', true).single()
    if (ev) {
      setEvent(ev)
      setPrompt(ev.current_prompt || '')
      setGuestCode(ev.guest_code || '')
      setHostCode(ev.host_code || '')
      setEdition(ev.edition || 'Edition VI')
      setGroupNamesRaw(ev.group_names || 'Onyx,Amber,Ivory,Pearl')
      setMentiLink(ev.menti_link || 'https://www.menti.com/ali66d4zwhf3')
      setWaLink(ev.whatsapp_link || 'https://chat.whatsapp.com/BmXCynJNcCwGR3RtUuX3DL')

      const { data: gList } = await supabase
        .from('guests').select('*').eq('event_id', ev.id).order('name')
      setGuests(gList || [])
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  useEffect(() => {
    const ch = supabase.channel('host-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guests' }, loadAll)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events' }, loadAll)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [loadAll])

  // Host-side timer display
  useEffect(() => {
    if (!event?.timer_ends_at) { setHostTimeLeft(null); return }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((new Date(event.timer_ends_at).getTime() - Date.now()) / 1000))
      setHostTimeLeft(remaining)
      if (remaining === 0) clearInterval(id)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [event?.timer_ends_at])

  function formatTime(s) {
    if (s === null || s === undefined) return '—'
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  // Derived groups from DB
  const groupNames = groupNamesRaw
    ? groupNamesRaw.split(',').map(g => g.trim()).filter(Boolean)
    : ['Onyx', 'Amber', 'Ivory', 'Pearl']

  // ── ACTIONS ──

  function switchTab(key) {
    setTab(key)
    sessionStorage.setItem('n2my_host_tab', key)
  }

  async function setPhase(i) {
    await supabase.from('events').update({ current_phase: i }).eq('id', event.id)
    setEvent(e => ({ ...e, current_phase: i }))
    showToast(`Phase: ${PHASES[i].name}`)
  }

  async function setRound(r) {
    await supabase.from('events').update({ current_round: r }).eq('id', event.id)
    setEvent(e => ({ ...e, current_round: r }))
    showToast(`Round ${r} active — group cards updated on all phones`)
  }

  async function startTimer() {
    const end = new Date(Date.now() + timerMins * 60 * 1000).toISOString()
    await supabase.from('events').update({ timer_ends_at: end }).eq('id', event.id)
    setEvent(e => ({ ...e, timer_ends_at: end }))
    showToast(`Timer started — ${timerMins} min`)
  }

  async function stopTimer() {
    await supabase.from('events').update({ timer_ends_at: null }).eq('id', event.id)
    setEvent(e => ({ ...e, timer_ends_at: null }))
    setHostTimeLeft(null)
    showToast('Timer cleared')
  }

  async function toggleMenti(on) {
    await supabase.from('events').update({ menti_active: on }).eq('id', event.id)
    setEvent(e => ({ ...e, menti_active: on }))
    showToast(on ? 'Mentimeter live on all phones' : 'Mentimeter hidden')
  }

  async function pushPrompt() {
    await supabase.from('events').update({ current_prompt: prompt }).eq('id', event.id)
    showToast('Prompt pushed to all phones')
  }

  async function clearPrompt() {
    setPrompt('')
    await supabase.from('events').update({ current_prompt: '' }).eq('id', event.id)
    showToast('Prompt cleared')
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
    showToast(isSpy ? `Spy: ${SPY_MISSIONS[missionIdx].title}` : 'Spy role removed')
  }

  async function autoAssign(round) {
    const field = `round${round}_table`
    const n = groupNames.length
    for (let i = 0; i < guests.length; i++) {
      await supabase.from('guests').update({ [field]: (i % n) + 1 }).eq('id', guests[i].id)
    }
    await loadAll()
    showToast(`Round ${round} auto-assigned across ${n} groups`)
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

  async function addGuest() {
    const name = newGuest.trim()
    if (!name || !event) return
    const { data, error } = await supabase
      .from('guests')
      .insert({
        event_id: event.id, name,
        round1_table: 1, round2_table: 2,
        round3_table: Math.min(3, groupNames.length),
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
    showToast('Guest removed')
  }

  async function bulkImport() {
    const raw = window.prompt('Paste guest names, one per line:')
    if (!raw || !event) return
    const names = raw.split('\n').map(n => n.trim()).filter(Boolean)
    const n = groupNames.length
    const rows = names.map((name, i) => ({
      event_id: event.id, name,
      round1_table: (i % n) + 1,
      round2_table: ((i + 1) % n) + 1,
      round3_table: ((i + 2) % n) + 1,
      round4_table: 1, round5_table: 1, round6_table: 1,
      is_spy: false,
    }))
    const { error } = await supabase.from('guests').insert(rows)
    if (error) { showToast('Import error: ' + error.message); return }
    await loadAll()
    showToast(`${names.length} guests imported`)
  }

  async function saveSettings() {
    await supabase.from('events').update({
      guest_code: guestCode.toUpperCase().trim(),
      host_code: hostCode.toUpperCase().trim(),
      edition: edition.trim(),
      group_names: groupNamesRaw.trim(),
      menti_link: mentiLink.trim(),
      whatsapp_link: waLink.trim(),
    }).eq('id', event.id)
    setGroupNamesRaw(groupNamesRaw.trim())
    showToast('Settings saved')
  }

  function exportCSV() {
    const rows = [['Guest', ...groupNames.map((_, i) => `Round ${i + 1}`), 'Spy', 'Mission']]
    guests.forEach(g => rows.push([
      g.name,
      ...groupNames.map((_, i) => groupNames[g[`round${i + 1}_table`] - 1] || ''),
      g.is_spy ? 'Yes' : 'No',
      g.is_spy && g.spy_mission_index !== null ? SPY_MISSIONS[g.spy_mission_index].title : '',
    ]))
    const csv = rows.map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'nice2meetya-groups.csv'
    a.click()
  }

  if (!event) return (
    <div className={styles.loading}><p>Loading event…</p></div>
  )

  // ── SCREEN MODE ──
  if (screenMode) {
    const phase = PHASES[event.current_phase] || PHASES[0]
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
        {event.menti_active && (
          <div className={styles.screenMenti}>
            <div className={styles.screenMentiLabel}>Open Mentimeter to vote</div>
            <div className={styles.screenMentiUrl}>menti.com</div>
            <div className={styles.screenMentiCode}>
              {(event.menti_link || '').replace('https://www.menti.com/', '')}
            </div>
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

  // ── MAIN PANEL ──
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
            onClick={() => switchTab(item.key)}
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
            Live · {guests.length} guests · {groupNames.length} groups · {PHASES[event.current_phase]?.name}
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
              <p className={styles.roundLabel}>Active Round:</p>
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

            {/* Menti toggle */}
            <div className={styles.mentiToggleBlock}>
              <div>
                <div className={styles.toggleLabel}>Mentimeter</div>
                <div className={styles.toggleSub}>Show Menti button on all guest phones</div>
              </div>
              <button
                className={`btn ${event.menti_active ? 'btn-gold' : 'btn-outline'}`}
                style={{ padding: '8px 20px', minWidth: 80 }}
                onClick={() => toggleMenti(!event.menti_active)}
              >
                {event.menti_active ? 'On' : 'Off'}
              </button>
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
                <span className={styles.timerUnit}>min</span>
                <button className="btn btn-gold" onClick={startTimer}>Start</button>
                {event.timer_ends_at && hostTimeLeft !== null && hostTimeLeft > 0 && (
                  <>
                    <span className={styles.timerLive}>{formatTime(hostTimeLeft)}</span>
                    <button className="btn btn-outline" onClick={stopTimer}>Stop</button>
                  </>
                )}
              </div>
              <p className={styles.timerNote}>
                Countdown shows on all guest phones. Pulses red at 30 seconds.
              </p>
            </div>
          </div>
        )}

        {/* ── GROUPS ── */}
        {tab === 'groups' && (
          <div>
            <h2 className={styles.tabTitle}>Group Assignments</h2>
            <p className={styles.tabSub}>
              {groupNames.length} groups: {groupNames.join(', ')}. Change group names in Settings.
            </p>

            {/* Group headcount tiles */}
            <div className={styles.groupTiles}>
              {groupNames.map((g, gi) => {
                const round = event.current_round || 1
                const field = `round${round}_table`
                const count = guests.filter(gu => gu[field] === gi + 1).length
                return (
                  <div key={g} className={styles.groupTile}>
                    <div className={styles.groupTileName}>{g}</div>
                    <div className={styles.groupTileCount}>{count}</div>
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
                          {g.is_spy && <span className={styles.spyTag}>spy</span>}
                        </span>
                        <select
                          className={styles.tableSelect}
                          value={g[field] || 1}
                          onChange={e => updateAssignment(g.id, round, e.target.value)}
                        >
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

        {/* ── SPIES ── */}
        {tab === 'spies' && (
          <div>
            <h2 className={styles.tabTitle}>Spy Missions</h2>
            <p className={styles.tabSub}>
              Assign up to 3 spies. Their mission appears only on their screen when they look up their name.
            </p>

            <div className={styles.missionCards}>
              {SPY_MISSIONS.map((m, mi) => {
                const spy = guests.find(g => g.is_spy && g.spy_mission_index === mi)
                return (
                  <div key={mi} className={`${styles.missionCard} ${spy ? styles.missionAssigned : ''}`}>
                    <div className={styles.missionNum}>{mi + 1}</div>
                    <div className={styles.missionTitle}>{m.title}</div>
                    {spy && <div className={styles.missionAssignedTo}>{spy.name.split(' ')[0]}</div>}
                  </div>
                )
              })}
            </div>

            <div className={styles.assignTable} style={{ marginTop: 20 }}>
              <div className={styles.assignHeader} style={{ gridTemplateColumns: '1fr 160px 100px' }}>
                <span>Guest</span><span>Mission</span><span>Action</span>
              </div>
              {guests.map(g => (
                <div key={g.id} className={styles.assignRow} style={{ gridTemplateColumns: '1fr 160px 100px' }}>
                  <span className={styles.guestName}>{g.name}</span>
                  <select
                    className={styles.tableSelect}
                    value={g.is_spy ? (g.spy_mission_index ?? '') : ''}
                    disabled={g.is_spy}
                    onChange={e => e.target.value !== '' && toggleSpy(g.id, true, parseInt(e.target.value))}
                  >
                    <option value="">— none —</option>
                    {SPY_MISSIONS.map((m, mi) => (
                      <option key={mi} value={mi}>{m.title}</option>
                    ))}
                  </select>
                  {g.is_spy
                    ? <button className="btn btn-red btn-sm" onClick={() => toggleSpy(g.id, false, null)}>Remove</button>
                    : <span className={styles.noSpy}>—</span>
                  }
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PROMPTS ── */}
        {tab === 'prompts' && (
          <div>
            <h2 className={styles.tabTitle}>Live Prompts</h2>
            <p className={styles.tabSub}>Push to all phones instantly. Also shows in Screen Mode.</p>
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
              <input
                className="input"
                value={newGuest}
                onChange={e => setNewGuest(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addGuest()}
                placeholder="Guest name…"
              />
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
            <p className={styles.tabSub}>All changes save to the database and update live.</p>
            <div className={styles.settingsCard}>

              <div className={styles.settingsRow}>
                <div>
                  <div className={styles.settingsLabel}>Group Names</div>
                  <div className={styles.settingsSub}>Comma-separated. Add as many as you need.</div>
                </div>
                <input
                  className="input"
                  style={{ width: 260 }}
                  value={groupNamesRaw}
                  onChange={e => setGroupNamesRaw(e.target.value)}
                  placeholder="Onyx,Amber,Ivory,Pearl"
                />
              </div>

              <div className={styles.settingsRow}>
                <div>
                  <div className={styles.settingsLabel}>Guest Access Code</div>
                  <div className={styles.settingsSub}>Share with guests on arrival</div>
                </div>
                <input
                  className="input"
                  style={{ width: 120, textAlign: 'center', fontFamily: "'Bebas Neue'", fontSize: 22, letterSpacing: '0.15em' }}
                  value={guestCode}
                  maxLength={8}
                  onChange={e => setGuestCode(e.target.value.toUpperCase())}
                />
              </div>

              <div className={styles.settingsRow}>
                <div>
                  <div className={styles.settingsLabel}>Host Password</div>
                  <div className={styles.settingsSub}>Keep private</div>
                </div>
                <input
                  className="input"
                  style={{ width: 120, textAlign: 'center' }}
                  value={hostCode}
                  maxLength={8}
                  type="password"
                  onChange={e => setHostCode(e.target.value)}
                />
              </div>

              <div className={styles.settingsRow}>
                <div>
                  <div className={styles.settingsLabel}>Edition</div>
                  <div className={styles.settingsSub}>Shown on the guest view</div>
                </div>
                <input
                  className="input"
                  style={{ width: 160 }}
                  value={edition}
                  onChange={e => setEdition(e.target.value)}
                />
              </div>

              <div className={styles.settingsRow}>
                <div>
                  <div className={styles.settingsLabel}>Mentimeter Link</div>
                  <div className={styles.settingsSub}>Changes each event</div>
                </div>
                <input
                  className="input"
                  style={{ width: 260 }}
                  value={mentiLink}
                  onChange={e => setMentiLink(e.target.value)}
                />
              </div>

              <div className={styles.settingsRow}>
                <div>
                  <div className={styles.settingsLabel}>WhatsApp Link</div>
                  <div className={styles.settingsSub}>Community invite link</div>
                </div>
                <input
                  className="input"
                  style={{ width: 260 }}
                  value={waLink}
                  onChange={e => setWaLink(e.target.value)}
                />
              </div>

            </div>
            <button className="btn btn-gold" onClick={saveSettings} style={{ marginTop: 20 }}>
              Save All Settings
            </button>
          </div>
        )}

      </div>

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  )
        }
