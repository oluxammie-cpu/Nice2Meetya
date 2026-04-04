import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { PHASES, SPY_MISSIONS } from '../lib/phases.js'
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

function ScreenMode({ event, onExit }) {
  const phase = PHASES[event.current_phase] || PHASES[0]
  return (
    <div className={styles.screenMode}>
      <div className={styles.screenInner}>
        <div className={styles.screenMark}>✦</div>
        <div className={styles.screenEdition}>{event.edition}</div>
        <div className={styles.screenPhase}>{phase.name}</div>
        {event.current_prompt && (
          <div className={styles.screenPrompt}>{event.current_prompt}</div>
        )}
        <div className={styles.screenWordmark}>NICE2<span>MEETYA!</span></div>
      </div>
      <button className={styles.screenExit} onClick={onExit}>Exit Screen Mode</button>
    </div>
  )
}

export default function HostView() {
  const [tab, setTab]           = useState('phases')
  const [event, setEvent]       = useState(null)
  const [guests, setGuests]     = useState([])
  const [prompt, setPrompt]     = useState('')
  const [newGuest, setNewGuest] = useState('')
  const [toast, setToast]       = useState('')
  const [timerMins, setTimerMins] = useState(5)
  const [screenMode, setScreenMode] = useState(false)

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 2600) }

  const loadAll = useCallback(async () => {
    const { data: ev } = await supabase.from('events').select('*').eq('active', true).single()
    if (ev) {
      setEvent(ev)
      setPrompt(ev.current_prompt || '')
      const { data: gs } = await supabase.from('guests').select('*').eq('event_id', ev.id).order('name')
      setGuests(gs || [])
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

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

  async function pushPrompt() {
    await supabase.from('events').update({ current_prompt: prompt }).eq('id', event.id)
    showToast('Prompt pushed')
  }

  async function clearPrompt() {
    setPrompt('')
    await supabase.from('events').update({ current_prompt: '' }).eq('id', event.id)
    showToast('Prompt cleared')
  }

  async function startTimer() {
    const endsAt = new Date(Date.now() + timerMins * 60 * 1000).toISOString()
    await supabase.from('events').update({ timer_ends_at: endsAt }).eq('id', event.id)
    setEvent(e => ({ ...e, timer_ends_at: endsAt }))
    showToast(`Timer started — ${timerMins} min`)
  }

  async function stopTimer() {
    await supabase.from('events').update({ timer_ends_at: null }).eq('id', event.id)
    setEvent(e => ({ ...e, timer_ends_at: null }))
    showToast('Timer cleared')
  }

  async function toggleMenti(val) {
    await supabase.from('events').update({ menti_active: val }).eq('id', event.id)
    setEvent(e => ({ ...e, menti_active: val }))
    showToast(val ? 'Mentimeter visible to guests' : 'Mentimeter hidden')
  }

  async function updateGroup(guestId, round, group) {
    const field = `round${round}_group`
    await supabase.from('guests').update({ [field]: group }).eq('id', guestId)
    setGuests(gs => gs.map(g => g.id === guestId ? { ...g, [field]: group } : g))
  }

  async function toggleSpy(guestId, currentVal) {
    const isSpy = !currentVal
    const guest = guests.find(g => g.id === guestId)
    const usedMissions = guests.filter(g => g.is_spy && g.id !== guestId).map(g => g.spy_mission)
    const available = SPY_MISSIONS.find(m => !usedMissions.includes(m.mission))
    const mission = isSpy && available ? available.mission : ''
    await supabase.from('guests').update({ is_spy: isSpy, spy_mission: mission }).eq('id', guestId)
    setGuests(gs => gs.map(g => g.id === guestId ? { ...g, is_spy: isSpy, spy_mission: mission } : g))
    showToast(isSpy ? `${guest?.name} is now a spy` : `${guest?.name} is no longer a spy`)
  }

  async function autoAssign(round) {
    const groups = event.group_names || ['Onyx', 'Amber', 'Ivory']
    const field = `round${round}_group`
    for (let i = 0; i < guests.length; i++) {
      await supabase.from('guests').update({ [field]: groups[i % groups.length] }).eq('id', guests[i].id)
    }
    await loadAll()
    showToast(`Round ${round} auto-assigned`)
  }

  async function shuffleRound(round) {
    const groups = event.group_names || ['Onyx', 'Amber', 'Ivory']
    const shuffled = [...guests].sort(() => Math.random() - 0.5)
    const field = `round${round}_group`
    for (let i = 0; i < shuffled.length; i++) {
      await supabase.from('guests').update({ [field]: groups[i % groups.length] }).eq('id', shuffled[i].id)
    }
    await loadAll()
    showToast(`Round ${round} shuffled`)
  }

 async function addGuest() {
    const name = newGuest.trim()
    if (!name || !event) return
    const { data, error } = await supabase
      .from('guests')
      .insert({ event_id: event.id, name, round1_table: 1, round2_table: 2, round3_table: 3, is_spy: false })
      .select().single()
    if (error) {
      alert('Error adding guest: ' + error.message + ' | Code: ' + error.code)
      return
    }
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
    const groups = event.group_names || ['Onyx', 'Amber', 'Ivory']
    const names = raw.split('\n').map(n => n.trim()).filter(Boolean)
    const startIdx = guests.length
    const rows = names.map((name, i) => ({
      event_id: event.id, name,
      round1_group: groups[(startIdx + i) % groups.length],
      round2_group: groups[(startIdx + i) % groups.length],
      round3_group: groups[(startIdx + i) % groups.length],
    }))
    await supabase.from('guests').insert(rows)
    await loadAll()
    showToast(`${names.length} guests imported`)
  }

  function exportCSV() {
    const rows = [['Guest', 'Round 1', 'Round 2', 'Round 3', 'Spy']]
    guests.forEach(g => rows.push([g.name, g.round1_group, g.round2_group, g.round3_group, g.is_spy ? 'Yes' : '']))
    const csv = rows.map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'nice2meetya-groups.csv'
    a.click()
  }

  if (!event) return <div className={styles.loading}>Loading event…</div>
  if (screenMode) return <ScreenMode event={event} onExit={() => setScreenMode(false)} />

  const groups = event.group_names || ['Onyx', 'Amber', 'Ivory']
  const spyCount = guests.filter(g => g.is_spy).length

  return (
    <div className={styles.layout}>

      {/* SIDEBAR */}
      <div className={styles.sidebar}>
        <p className={styles.sidebarTitle}>Host Controls</p>
        {[
          { key: 'phases',   label: 'Phase Control' },
          { key: 'timer',    label: 'Timer' },
          { key: 'groups',   label: 'Group Assignments' },
          { key: 'prompts',  label: 'Live Prompts' },
          { key: 'spies',    label: `Spies ${spyCount > 0 ? `(${spyCount})` : ''}` },
          { key: 'guests',   label: 'Guest List' },
          { key: 'menti',    label: 'Mentimeter' },
          { key: 'settings', label: 'Settings' },
        ].map(item => (
          <div key={item.key}
            className={`${styles.navItem} ${tab === item.key ? styles.navActive : ''}`}
            onClick={() => setTab(item.key)}>
            <div className={styles.navDot} />{item.label}
          </div>
        ))}
        <div className={styles.navSep} />
        <div className={styles.navItem} onClick={() => setScreenMode(true)}>
          <div className={styles.navDot} />Screen Mode
        </div>
      </div>

      {/* MAIN */}
      <div className={styles.main}>

        <div className={styles.statusBar}>
          <div className={styles.liveDot} />
          <span className={styles.statusText}>Live · {guests.length} guests · Round {event.current_round || 1}</span>
          <span className={styles.liveCode}>{event.guest_code}</span>
        </div>

        {/* ── PHASES ── */}
        {tab === 'phases' && (
          <div>
            <h2 className={styles.tabTitle}>Phase Control</h2>
            <p className={styles.tabSub}>Tap to push a phase live. Every guest sees it instantly.</p>
            <div className={styles.phaseList}>
              {PHASES.map((p, i) => (
                <div key={i}
                  className={`${styles.phaseItem} ${i === event.current_phase ? styles.phaseCurrent : ''}`}
                  onClick={() => setPhase(i)}>
                  <div className={styles.phaseNum}>{i + 1}</div>
                  <div className={styles.phaseInfo}>
                    <div className={styles.phaseName}>{p.name}</div>
                    <div className={styles.phaseDesc}>{p.desc}</div>
                  </div>
                  {i === event.current_phase && <div className={styles.liveBadge}>Live</div>}
                </div>
              ))}
            </div>
            <div className={styles.roundRow}>
              <p className={styles.tabSub} style={{ marginBottom: 0 }}>Active Round:</p>
              {[1, 2, 3].map(r => (
                <button key={r}
                  className={`${styles.btn} ${event.current_round === r ? styles.btnGold : styles.btnOutline}`}
                  onClick={() => setRound(r)}>Round {r}</button>
              ))}
            </div>
          </div>
        )}

        {/* ── TIMER ── */}
        {tab === 'timer' && (
          <div>
            <h2 className={styles.tabTitle}>Timer</h2>
            <p className={styles.tabSub}>Set a countdown for the current phase. Guests see it live on their screens.</p>
            <div className={styles.timerBox}>
              <div className={styles.timerRow}>
                <input type="number" className={styles.input} style={{ width: 90, fontSize: 28, textAlign: 'center', fontFamily: "'Bebas Neue'" }}
                  min={1} max={60} value={timerMins}
                  onChange={e => setTimerMins(parseInt(e.target.value) || 5)} />
                <span className={styles.timerUnit}>minutes</span>
                <button className={`${styles.btn} ${styles.btnGold}`} onClick={startTimer}>Start</button>
                <button className={`${styles.btn} ${styles.btnOutline}`} onClick={stopTimer}>Clear</button>
              </div>
              {event.timer_ends_at && (
                <div className={styles.timerStatus}>
                  Timer running — ends at {new Date(event.timer_ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
            <div className={styles.timerPresets}>
              <p className={styles.presetsLabel}>Quick set</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[3, 5, 7, 10, 15, 20].map(m => (
                  <button key={m} className={`${styles.btn} ${styles.btnOutline} ${styles.btnSm}`}
                    onClick={() => setTimerMins(m)}>{m} min</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── GROUPS ── */}
        {tab === 'groups' && (
          <div>
            <h2 className={styles.tabTitle}>Group Assignments</h2>
            <p className={styles.tabSub}>Assign guests to Onyx, Amber, or Ivory per round.</p>
            {[1, 2, 3].map(round => (
              <div key={round} className={styles.roundBlock}>
                <div className={styles.roundHeader}>
                  <span>Round {round}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className={`${styles.btn} ${styles.btnOutline} ${styles.btnSm}`} onClick={() => autoAssign(round)}>Auto</button>
                    <button className={`${styles.btn} ${styles.btnOutline} ${styles.btnSm}`} onClick={() => shuffleRound(round)}>Shuffle</button>
                  </div>
                </div>
                {/* Group headcounts */}
                <div className={styles.groupTiles}>
                  {groups.map(g => {
                    const field = `round${round}_group`
                    const count = guests.filter(gs => gs[field] === g).length
                    return (
                      <div key={g} className={styles.groupTile}>
                        <div className={styles.groupTileName}>{g}</div>
                        <div className={styles.groupTileCount}>{count} guests</div>
                      </div>
                    )
                  })}
                </div>
                {/* Guest rows */}
                <div className={styles.assignTable}>
                  <div className={styles.assignHeader} style={{ gridTemplateColumns: '1fr 140px' }}>
                    <span>Guest</span><span>Group</span>
                  </div>
                  {guests.map(g => {
                    const field = `round${round}_group`
                    return (
                      <div key={g.id} className={styles.assignRow} style={{ gridTemplateColumns: '1fr 140px' }}>
                        <span className={styles.guestName}>{g.name}{g.is_spy ? ' 🕵' : ''}</span>
                        <select className={styles.tableSelect} value={g[field] || groups[0]}
                          onChange={e => updateGroup(g.id, round, e.target.value)}>
                          {groups.map(gr => <option key={gr} value={gr}>{gr}</option>)}
                        </select>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
            <button className={`${styles.btn} ${styles.btnOutline} ${styles.btnSm}`} style={{ marginTop: 12 }} onClick={exportCSV}>
              Export CSV
            </button>
          </div>
        )}

        {/* ── PROMPTS ── */}
        {tab === 'prompts' && (
          <div>
            <h2 className={styles.tabTitle}>Live Prompts</h2>
            <p className={styles.tabSub}>Push a prompt — every guest sees it instantly on their screen.</p>
            <div className={styles.promptEditor}>
              <p className={styles.promptEditorLabel}>Current Prompt</p>
              <textarea className={styles.promptTextarea} value={prompt} rows={3}
                placeholder="What's a skill nobody would guess from looking at you?"
                onChange={e => setPrompt(e.target.value)} />
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button className={`${styles.btn} ${styles.btnGold}`} onClick={pushPrompt}>Push to guests</button>
                <button className={`${styles.btn} ${styles.btnOutline}`} onClick={clearPrompt}>Clear</button>
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

        {/* ── SPIES ── */}
        {tab === 'spies' && (
          <div>
            <h2 className={styles.tabTitle}>Spy Assignments</h2>
            <p className={styles.tabSub}>Designate up to 3 spies. Each gets a secret mission card only they can see.</p>
            <div className={styles.spyMissions}>
              {SPY_MISSIONS.map((m, i) => (
                <div key={m.id} className={styles.spyMissionCard}>
                  <div className={styles.spyMissionTitle}>{m.title}</div>
                  <p className={styles.spyMissionText}>{m.mission}</p>
                </div>
              ))}
            </div>
            <div className={styles.assignTable} style={{ marginTop: 20 }}>
              <div className={styles.assignHeader} style={{ gridTemplateColumns: '1fr 100px' }}>
                <span>Guest</span><span>Spy?</span>
              </div>
              {guests.map(g => (
                <div key={g.id} className={styles.assignRow} style={{ gridTemplateColumns: '1fr 100px' }}>
                  <div>
                    <div className={styles.guestName}>{g.name}</div>
                    {g.is_spy && g.spy_mission && (
                      <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 2, fontStyle: 'italic' }}>
                        {SPY_MISSIONS.find(m => m.mission === g.spy_mission)?.title || 'Mission assigned'}
                      </div>
                    )}
                  </div>
                  <button
                    className={`${styles.btn} ${g.is_spy ? styles.btnRed : styles.btnOutline} ${styles.btnSm}`}
                    onClick={() => toggleSpy(g.id, g.is_spy)}
                    disabled={!g.is_spy && spyCount >= 3}>
                    {g.is_spy ? 'Remove' : 'Make Spy'}
                  </button>
                </div>
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
              <input className={styles.input} value={newGuest} placeholder="Guest name…"
                onChange={e => setNewGuest(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addGuest()} />
              <button className={`${styles.btn} ${styles.btnGold}`} onClick={addGuest}>Add</button>
              <button className={`${styles.btn} ${styles.btnOutline}`} onClick={bulkImport}>Bulk</button>
            </div>
            <div className={styles.assignTable}>
              <div className={styles.assignHeader} style={{ gridTemplateColumns: '1fr 80px' }}>
                <span>Name</span><span>Remove</span>
              </div>
              {guests.map(g => (
                <div key={g.id} className={styles.assignRow} style={{ gridTemplateColumns: '1fr 80px' }}>
                  <span className={styles.guestName}>{g.name}{g.is_spy ? ' 🕵' : ''}</span>
                  <button className={`${styles.btn} ${styles.btnRed} ${styles.btnSm}`} onClick={() => removeGuest(g.id)}>Remove</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── MENTIMETER ── */}
        {tab === 'menti' && (
          <div>
            <h2 className={styles.tabTitle}>Mentimeter</h2>
            <p className={styles.tabSub}>Control when guests see the Mentimeter link on their screens.</p>
            <div className={styles.mentiControl}>
              <div>
                <div className={styles.settingsLabel}>Show Menti link to guests</div>
                <div className={styles.settingsSub}>Guests will see a button to join your Mentimeter</div>
              </div>
              <button
                className={`${styles.btn} ${event.menti_active ? styles.btnRed : styles.btnGold}`}
                onClick={() => toggleMenti(!event.menti_active)}>
                {event.menti_active ? 'Hide' : 'Show'}
              </button>
            </div>
            <div className={styles.mentiLinkBox}>
              <p className={styles.settingsLabel}>Mentimeter Link</p>
              <a href={event.menti_link} target="_blank" rel="noreferrer" className={styles.mentiLink}>
                {event.menti_link} ↗
              </a>
            </div>
            <div className={styles.mentiLinkBox} style={{ marginTop: 12 }}>
              <p className={styles.settingsSub}>For the venue screen, click Screen Mode in the sidebar to go fullscreen — then open Mentimeter results in a separate browser tab on the same device.</p>
            </div>
          </div>
        )}

        {/* ── SETTINGS ── */}
        {tab === 'settings' && (
          <div>
            <h2 className={styles.tabTitle}>Settings</h2>
            <div className={styles.settingsCard}>
              {[
                { label: 'Guest Access Code', sub: 'Share this with guests', field: 'guest_code' },
                { label: 'Host Password', sub: 'Keep this private', field: 'host_code' },
                { label: 'Event Edition', sub: 'Shown in guest view', field: 'edition' },
                { label: 'WhatsApp Link', sub: 'Community invite link', field: 'whatsapp_link' },
                { label: 'Mentimeter Link', sub: 'Guest voting link', field: 'menti_link' },
              ].map(row => (
                <div key={row.field} className={styles.settingsRow}>
                  <div>
                    <div className={styles.settingsLabel}>{row.label}</div>
                    <div className={styles.settingsSub}>{row.sub}</div>
                  </div>
                  <input className={styles.input} style={{ width: 200 }}
                    defaultValue={event[row.field] || ''}
                    onBlur={async e => {
                      await supabase.from('events').update({ [row.field]: e.target.value }).eq('id', event.id)
                      showToast('Saved')
                    }} />
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  )
}
