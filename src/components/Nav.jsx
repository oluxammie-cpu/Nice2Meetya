import styles from './Nav.module.css'

function HouseMark() {
  return (
    <svg
      width="28"
      height="26"
      viewBox="0 0 110 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {/* House — white outline */}
      <line x1="8"   y1="52" x2="8"   y2="95" stroke="white" strokeWidth="5" strokeLinecap="round"/>
      <line x1="102" y1="52" x2="102" y2="95" stroke="white" strokeWidth="5" strokeLinecap="round"/>
      <line x1="8"   y1="95" x2="102" y2="95" stroke="white" strokeWidth="5" strokeLinecap="round"/>
      <line x1="55"  y1="10" x2="8"   y2="52" stroke="white" strokeWidth="5" strokeLinecap="round"/>
      <line x1="55"  y1="10" x2="102" y2="52" stroke="white" strokeWidth="5" strokeLinecap="round"/>
      {/* Leaf — gold */}
      <path
        d="M38 82 C42 70 52 55 62 42 C68 34 74 28 72 24"
        stroke="#C9A84C" strokeWidth="2.5" strokeLinecap="round" fill="none"
      />
      <path
        d="M72 24 C78 30 76 40 70 50 C66 56 60 62 52 68 C46 72 40 76 38 82"
        stroke="#C9A84C" strokeWidth="3" strokeLinecap="round" fill="rgba(201,168,76,0.1)"
      />
      <path
        d="M72 24 C64 22 56 28 50 36 C44 44 40 56 38 82"
        stroke="#C9A84C" strokeWidth="3" strokeLinecap="round" fill="rgba(201,168,76,0.1)"
      />
      <path d="M62 42 C58 46 54 50 50 54" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7"/>
      <path d="M66 34 C61 39 57 44 53 48" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7"/>
      <path d="M56 52 C52 56 48 60 46 65" stroke="#C9A84C" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.6"/>
    </svg>
  )
}

export default function Nav({ view, goGate, goPublic }) {
  const isHost  = view === 'host'
  const isGuest = view === 'guest'

  return (
    <nav className={styles.nav}>
      <div className={styles.brand} onClick={goPublic}>
        <HouseMark />
        <span className={styles.brandText}>NICE2<span>MEETYA!</span></span>
      </div>
      <div className={styles.right}>
        {!isGuest && !isHost && (
          <button className="btn btn-ghost" style={{padding:'8px 16px'}} onClick={() => goGate('guest')}>
            Tonight's Event
          </button>
        )}
        {isHost ? (
          <button className="btn btn-ghost" style={{padding:'8px 16px'}} onClick={goPublic}>
            Back
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
