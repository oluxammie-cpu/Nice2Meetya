import styles from './Nav.module.css'

export default function Nav({ view, goGate, goPublic }) {
  const isHost  = view === 'host'
  const isGuest = view === 'guest'

  return (
    <nav className={styles.nav}>
      <div className={styles.brand} onClick={goPublic}>
        NICE2<span>MEETYA!</span>
      </div>
      <div className={styles.right}>
        {!isGuest && !isHost && (
          <button className="btn btn-ghost" style={{padding:'8px 16px'}} onClick={() => goGate('guest')}>
            Tonight's Event
          </button>
        )}
        {isHost ? (
          <button className="btn btn-ghost" style={{padding:'8px 16px'}} onClick={goPublic}>
            ← Back
          </button>
        ) : (
          <button className="btn btn-gold" style={{padding:'8px 16px'}} onClick={() => goGate('host')}>
            Host Panel
          </button>
        )}
      </div>
    </nav>
  )
}
