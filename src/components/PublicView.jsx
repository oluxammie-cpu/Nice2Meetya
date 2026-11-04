import { useEffect, useRef } from 'react'

const EVENING = [
  { name: 'Arrive',        desc: 'The room is already chosen. You only have to walk in.' },
  { name: 'Rounds',        desc: 'Structured conversations with people you would not have met otherwise. We move you; you bring yourself.' },
  { name: 'Dinner',        desc: 'Ordered ahead and served together, so nothing interrupts the talk.' },
  { name: 'The Afterroom', desc: "The conversation starts at the event. It doesn't end there." },
]
import styles from './PublicView.module.css'

export default function PublicView({ goGate }) {
  const bokehRef = useRef(null)

  useEffect(() => {
    const c = bokehRef.current
    if (!c) return
    const colors = ['rgba(201,168,76,0.3)','rgba(240,208,128,0.2)','rgba(201,168,76,0.18)']
    for (let i = 0; i < 16; i++) {
      const b = document.createElement('div')
      const size = Math.random() * 60 + 12
      b.style.cssText = `
        position:absolute;border-radius:50%;pointer-events:none;
        width:${size}px;height:${size}px;
        left:${Math.random()*100}%;top:${Math.random()*100}%;
        background:${colors[Math.floor(Math.random()*colors.length)]};
        filter:blur(${size*0.4}px);
        animation:bokeh ${6+Math.random()*8}s ${-Math.random()*10}s linear infinite;
      `
      c.appendChild(b)
    }
  }, [])

  return (
    <div className={styles.page}>
      <style>{`
        @keyframes bokeh {
          0%   { transform:translateY(0) scale(1); opacity:0; }
          10%  { opacity:1; }
          90%  { opacity:0.5; }
          100% { transform:translateY(-120px) scale(1.3); opacity:0; }
        }
      `}</style>

      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div ref={bokehRef} className={styles.bokehLayer} />

        <p className={`${styles.presenter} fade-up`}>Maison des Nobles presents</p>
        <h1 className={`${styles.wordmark} fade-up delay-1`}>
          NICE2<span>MEETYA!</span>
        </h1>
        <p className={`${styles.tagline} fade-up delay-2`}>
          A curated encounter for people who have built something.
        </p>
        <div className={`${styles.ctaRow} fade-up delay-3`}>
          <button className="btn btn-gold" onClick={() => goGate('guest')}>
            I'm Attending Tonight
          </button>
          <button className="btn btn-ghost" onClick={() => {
            document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })
          }}>
            The Experience
          </button>
        </div>
        <div className={styles.scrollLine} />
      </section>

      {/* ABOUT */}
      <section className={styles.section} id="about">
        <div className={styles.aboutGrid}>
          <div>
            <p className="eyebrow">The Experience</p>
            <h2 className={styles.aboutHeadline}>
              Not networking.<br />
              Not a party.<br />
              <em>Something better.</em>
            </h2>
          </div>
          <div className={styles.aboutBody}>
            <p>Nice2Meetya! is for people who have built something with their lives and are ready to be surprised by who else is in the room.</p>
            <p>Every detail is designed: who sits where, when you move, what you are asked. You do not have to work the room. You only have to show up.</p>
            <p>You leave having met people you will call again.</p>
          </div>
        </div>
      </section>

      <div className={styles.sectionInner}>
        <div className="ornament"><hr /><span className="ornament-sym">✦</span><hr /></div>
      </div>

      {/* FLOW */}
      <section className={styles.section}>
        <h2 className={styles.flowHeading}>How the evening unfolds</h2>
        <div className={styles.flowGrid}>
          {EVENING.map((p, i) => (
            <div key={i} className={styles.flowStep}>
              <div className={styles.flowNum}>0{i + 1}</div>
              <div className={styles.flowTitle}>{p.name}</div>
              <p className={styles.flowDesc}>{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* COMMUNITY */}
      <div className={styles.communityBand}>
        <h2 className={styles.communityHeadline}>
          EDITION IX<br />
          <span>MOMENTUM</span>
        </h2>
        <p className={styles.communitySub}>Moving is not the same as going somewhere.</p>
        <div className={styles.badgeRow}>
          {['Lagos', 'December', 'By invitation'].map(b => (
            <span key={b} className={styles.badge}>{b}</span>
          ))}
        </div>
        <p className={styles.communitySub} style={{ marginTop: '24px', marginBottom: 0 }}>
          Seats are by invitation, extended by the people already in the room.
        </p>
      </div>

      <footer className={styles.footer}>
        <span className={styles.footerBrand}>Maison des Nobles</span>
        <span className={styles.footerCopy}>Nice2Meetya! © {new Date().getFullYear()}</span>
      </footer>
    </div>
  )
}
