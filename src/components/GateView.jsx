import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import styles from './GateView.module.css'

export default function GateView({ mode, setMode, onSuccess }) {
  const [code, setCode]   = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const isGuest = mode === 'guest'

  async function submit() {
    if (!code.trim()) return
    setLoading(true)
    setError('')

    try {
      // Fetch the active event's codes from Supabase
      const { data, error: dbErr } = await supabase
        .from('events')
        .select('guest_code, host_code')
        .eq('active', true)
        .single()

      if (dbErr || !data) {
        setError('No active event found. Ask your host.')
        setLoading(false)
        return
      }

      const input = code.trim().toUpperCase()

      if (isGuest && input === data.guest_code.toUpperCase()) {
        onSuccess('guest')
      } else if (!isGuest && input === data.host_code.toUpperCase()) {
        onSuccess('host')
      } else {
        setError(isGuest ? 'Wrong code. Try again or ask your host.' : 'Incorrect host password.')
        setCode('')
      }
    } catch {
      setError('Connection error. Check your internet.')
    }
    setLoading(false)
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.box}>
        <div className={styles.wordmark}>
          NICE2<span>MEETYA!</span>
        </div>
        <p className={styles.sub}>
          {isGuest ? "Tonight's Access Code" : 'Host Login'}
        </p>

        <p className={styles.label}>
          {isGuest ? 'Enter the code from your host' : 'Enter host password'}
        </p>

        <input
          className={`${styles.codeInput} ${error ? styles.shake : ''}`}
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="••••"
          maxLength={8}
          autoComplete="off"
          autoFocus
        />

        <button
          className={`btn btn-gold ${styles.enterBtn}`}
          onClick={submit}
          disabled={loading}
        >
          {loading ? 'Checking…' : 'Enter'}
        </button>

        {error && <p className={styles.error}>{error}</p>}

        <button
          className={styles.switchLink}
          onClick={() => { setMode(isGuest ? 'host' : 'guest'); setCode(''); setError('') }}
        >
          {isGuest ? 'Host? Switch to host login' : '← Switch to guest access'}
        </button>
      </div>
    </div>
  )
}
