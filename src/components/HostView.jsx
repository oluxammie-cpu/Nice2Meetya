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

export default function HostView() {
  const [tab, setTab]         = useState('phases')
  const [event, setEvent]     = useState(null)
  const [guests, setGuests]   = useState([])
  const [prompt, setPrompt]   = useState('')
  const [newGuest, setNewGuest] = useState('')
  const [toast, setToast]     = useState('')
  const [saving, setSaving]   = useState(false)

  // Settings state
  const [guestCode, setGuestCode] = useState('')
  const [hostCode, setHostCode]   = useState('')
  const [tableCount, setTableCount] = useState(6)
  const [edition, setEdition]     = useState('Edition VI')

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
      setTableCount(ev.table_count || 6)
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

  // Realtime sync
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
    showToast(`Round ${r} is now active`)
  }

  async function pushPrompt() {
    await supabase.from('events').update({ current_prompt: prompt }).eq('id', event.id)
    showToast('Prompt pushed to all guests')
  }

  async function clearPrompt() {
    setPrompt('')
    await supabase.from('events').update({ current_prompt: '' }).eq('id', event.id)
    showToast('Prompt cleared')
  }

  async function updateAssignment(guestId, round, table) {
    const field = `round${round}_table`
    await supabase.from('guests').update({ [field]: parseInt(table) }).eq('id', guestId)
    setGuests(gs => gs.map(g => g.id === guestId ? { ...g, [field]: parseInt(table) } : g))
  }

  async function addGuest() {
    const name = newGuest.trim()
    if (!name || !event) return
    const { data } = await supabase
      .from('guests')
      .insert({ event_id: event.id, name, round1_table: 1, round2_table: 1, round3_table: 1 })
      .select().single()
    if (data) {
      setGuests(gs => [...gs, data].sort((a,b) => a.name.localeCompare(b.name)))
      setNewGuest('')
      showToast(`${name} added`)
    }
  }

  async function removeGuest(id) {
    await supabase.from('guests').delete().eq('id', id)
    setGuests(gs => gs.filter(g => g.id !== id))
  }

  async function autoAssign(round) {
    const tc = tableCount
    const updates = guests.map((g, i) => ({
      id: g.id,
      [`round${round}_table`]: (i % tc) + 1
    }))
    for (const u of updates) {
      const field = `round${round}_table`
      await supabase.from('guests').update({ [field]: u[field] }).eq('id', u.id)
    }
    await loadAll()
    showToast(`Round ${round} auto-assigned`)
  }

  async function shuffleRound(round) {
    const shuffled = [...guests].sort(() => Math.random() - 0.5)
    const field = `round${round}_table`
    for (let i = 0; i < shuffled.length; i++) {
      await supabase.from('guests')
        .update({ [field]: (i % tableCount) + 1 })
        .eq('id', shuffled[i].id)
    }
    await loadAll()
    showToast(`Round ${round} shuffled`)
  }

  async function saveSettings() {
    await supabase.from('events').update({
      guest_code: guestCode.toUpperCase(),
      host_code: hostCode.toUpperCase(),
      table_count: parseInt(tableCount),
      edition,
    }).eq('id', event.id)
    setEvent(e => ({ ...e, guest_code: guestCode.toUpperCase(), table_count: parseInt(tableCount) }))
    showToast('Settings saved')
  }

  function exportCSV() {
    const rows = [['Guest', 'Round 1', 'Round 2', 'Round 3']]
    guests.forEach(g => rows.push([g.name, g.round1_table, g.round2_table, g.round3_table]))
    const csv = rows.map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'nice2meetya-assignments.csv'
    a.click()
  }

  async function bulkImport() {
    const raw = window.prompt('Paste guest names, one per line:')
    if (!raw || !event) return
    const names = raw.split('\n').map(n => n.trim()).filter(Boolean)
    const rows = names.map((name, i) => ({
      event_id: event.id, name,
      round1_table: (i % tableCount) + 1,
      round2_table: (i % tableCount) + 1,
      round3_table: (i % tableCount) + 1,
    }))
    await supabase.from('guests').insert(rows)
    await loadAll()
    showToast(`${names.length} guests imported`)
  }

  if (!event) {
    return (
      <div className={styles.loading}>
        <p>Loading event…</p>
      </div>
    )
  }

  const tableNums = Array.from({ length: tableCount }, (_, i) => i + 1)

  return (
    <div className={styles.layout}>

      {/* SIDEBAR */}
      <div className={styles.sidebar}>
        <p className={styles.sidebarTitle}>Host Controls</p>
        {[
          { key: 'phases',   label: 'Phase Control' },
          { key: 'tables',   label: 'Table Assignments' },
          { key: 'prompts',  label: 'Live Prompts' },
          { key: 'guests',   label: 'Guest List' },
          { key: 'settings', label: 'Settings' },
        ].map(item => (
          <div
            key={item.key}
            className={`${styles.navItem} ${tab === item.key ? styles.navActive : ''}`}
            onClick={() => setTab(item.key)}
          >
            <div className={styles.navDot} />
            {item.label}
          </div>
        ))}
      </div>

      {/* MAIN */}
      <div className={styles.main}>

        {/* Status bar */}
        <div className={styles.statusBar}>
          <div className={styles.liveDot} />
          <span className={styles.statusText}>
            Event live · {guests.length} guests · Round {event.current_round || 1}
          </span>
          <span className={styles.liveCode}>{event.guest_code}</span>
        </div>

        {/* ── PHASES ── */}
        {tab === 'phases' && (
          <div>
            <h2 className={styles.tabTitle}>Phase Control</h2>
            <p className={styles.tabSub}>Tap to push a phase live. All guests see it instantly.</p>

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
                  {i === event.current_phase && (
                    <div className={styles.liveBadge}>Live</div>
                  )}
                </div>
              ))}
            </div>

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
          </div>
        )}

        {/* ── TABLES ── */}
        {tab === 'tables' && (
          <div>
            <h2 className={styles.tabTitle}>Table Assignments</h2>
            <p className={styles.tabSub}>Assign guests per round. Changes sync to guests immediately.</p>

            {/* Table overview tiles */}
            {[1, 2, 3].map(round => (
              <div key={round} className={styles.roundBlock}>
                <div className={styles.roundHeader}>
                  <span>Round {round}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => autoAssign(round)}>
                      Auto-assign
                    </button>
                    <button className="btn btn-outline btn-sm" onClick={() => shuffleRound(round)}>
                      Shuffle
                    </button>
                  </div>
                </div>

                {/* Table headcount tiles */}
                <div className={styles.tableTiles}>
                  {tableNums.map(t => {
                    const field = `round${round}_table`
                    const count = guests.filter(g => g[field] === t).length
                    return (
                      <div key={t} className={styles.tableTile}>
                        <div className={styles.tileNum}>{t}</div>
                        <div className={styles.tileCount}>{count} guest{count !== 1 ? 's' : ''}</div>
                      </div>
                    )
                  })}
                </div>

                {/* Guest assignment rows */}
                <div className={styles.assignTable}>
                  <div className={styles.assignHeader}>
                    <span>Guest</span>
                    <span>Table</span>
                  </div>
                  {guests.map(g => {
                    const field = `round${round}_table`
                    return (
                      <div key={g.id} className={styles.assignRow}>
                        <span className={styles.guestName}>{g.name}</span>
                        <select
                          className={styles.tableSelect}
                          value={g[field] || 1}
                          onChange={e => updateAssignment(g.id, round, e.target.value)}
                        >
                          {tableNums.map(t => (
                            <option key={t} value={t}>Table {t}</option>
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

        {/* ── PROMPTS ── */}
        {tab === 'prompts' && (
          <div>
            <h2 className={styles.tabTitle}>Live Prompts</h2>
            <p className={styles.tabSub}>Push a prompt and every guest sees it on their phone instantly.</p>

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
                <button className="btn btn-gold" onClick={pushPrompt}>Push to guests</button>
                <button className="btn btn-outline" onClick={clearPrompt}>Clear</button>
              </div>
            </div>

            <p className={styles.presetsLabel}>Quick Presets</p>
            <div className={styles.presets}>
              {PROMPT_PRESETS.map(p => (
                <div key={p} className={styles.preset} onClick={() => setPrompt(p)}>
                  {p}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── GUESTS ── */}
        {tab === 'guests' && (
          <div>
            <h2 className={styles.tabTitle}>Guest List</h2>
            <p className={styles.tabSub}>{guests.length} guests on the list tonight.</p>

            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <input
                className="input"
                value={newGuest}
                onChange={e => setNewGuest(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addGuest()}
                placeholder="Guest name…"
              />
              <button className="btn btn-gold" style={{ whiteSpace: 'nowrap' }} onClick={addGuest}>
                Add
              </button>
              <button className="btn btn-outline" style={{ whiteSpace: 'nowrap' }} onClick={bulkImport}>
                Bulk Import
              </button>
            </div>

            <div className={styles.assignTable}>
              <div className={styles.assignHeader} style={{ gridTemplateColumns: '1fr 80px' }}>
                <span>Name</span><span>Remove</span>
              </div>
              {guests.map(g => (
                <div key={g.id} className={styles.assignRow} style={{ gridTemplateColumns: '1fr 80px' }}>
                  <span className={styles.guestName}>{g.name}</span>
                  <button className="btn btn-red btn-sm" onClick={() => removeGuest(g.id)}>
                    Remove
                  </button>
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
                {
                  label: 'Guest Access Code',
                  sub: 'Guests enter this to access the event view',
                  input: <input className="input" style={{ width: 120, textAlign: 'center', fontFamily: "'Bebas Neue'", fontSize: 22, letterSpacing: '0.15em' }}
                    value={guestCode} maxLength={8}
                    onChange={e => setGuestCode(e.target.value.toUpperCase())} />
                },
                {
                  label: 'Host Password',
                  sub: 'Keep this private',
                  input: <input className="input" style={{ width: 120, textAlign: 'center' }}
                    value={hostCode} maxLength={8} type="password"
                    onChange={e => setHostCode(e.target.value)} />
                },
                {
                  label: 'Number of Tables',
                  sub: 'How many tables at tonight's event',
                  input: <input className="input" style={{ width: 80, textAlign: 'center' }}
                    type="number" min={2} max={20}
                    value={tableCount}
                    onChange={e => setTableCount(e.target.value)} />
                },
                {
                  label: 'Event Edition',
                  sub: 'Shown in the guest view header',
                  input: <input className="input" style={{ width: 140 }}
                    value={edition}
                    onChange={e => setEdition(e.target.value)} />
                },
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

            <button className="btn btn-gold" onClick={saveSettings} style={{ marginTop: 20 }}>
              Save Settings
            </button>
          </div>
        )}

      </div>

      {/* TOAST */}
      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  )
}
