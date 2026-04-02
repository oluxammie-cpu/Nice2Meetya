import { useEffect, useRef } from 'react'
import { PHASES } from '../lib/phases.js'
import styles from './PublicView.module.css'

function HouseMark() {
  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* House outline */}
      <path
        d="M60 18 L98 50 L98 100 L22 100 L22 50 Z"
        stroke="rgba(201,168,76,0.85)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
      {/* Roof peak */}
      <path
        d="M52 18 L60 10 L68 18"
        stroke="rgba(201,168,76,0.85)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
      {/* Feather stem */}
      <path
        d="M60 82 C60 82 60 48 60 44"
        stroke="rgba(201,168,76,0.7)"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Leaf right upper */}
      <path
        d="M60 44 C68 46 74 52 72 60 C70 66 64 68 60 66"
        stroke="rgba(201,168,76,0.75)"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="rgba(201,168,76,0.08)"
      />
      {/* Leaf left upper */}
      <path
        d="M60 44 C52 46 46 52 48 60 C50 66 56 68 60 66"
        stroke="rgba(201,168,76,0.75)"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="rgba(201,168,76,0.08)"
      />
      {/* Leaf right lower */}
      <path
        d="M60 66 C66 68 70 74 68 80 C66 84 62 84 60 82"
        stroke="rgba(201,168,76,0.6)"
        strokeWidth="1"
        strokeLinecap="round"
        fill="rgba(201,168,76,0.05)"
      />
      {/* Leaf left lower */}
      <path
        d="M60 66 C54 68 50 74 52 80 C54 84 58 84 60 82"
        stroke="rgba(201,168,76,0.6)"
        strokeWidth="1"
        strokeLinecap="round"
        fill="rgba(201,168,76,0.05)"
      />
    </svg>
  )
}

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

        <div className={`${styles.logoMark} fade-up`}>
          <HouseMark />
        </div>
        <p className={`${styles.presenter} fade-up delay-1`}>Maison de les nobles presents</p>
        <h1 className={`${styles.wordmark} fade-up delay-2`}>
          NICE2<span>MEETYA!</span>
        </h1>
        <p className={`${styles.tagline} fade-up delay-3`}>
          Where games open doors, and conversations do the rest.
        </p>
        <div className={`${styles.ctaRow} fade-up delay-4`}>
          <button className="btn btn-gold" onClick={() => goGate('guest')}>
            I'm Attending Tonight
          </button>
          <button className="btn btn-ghost" onClick={() => {
            document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })
          }}>
            What is this?
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
            <p>Nice2Meetya! is a premium social evening designed to make meeting strangers feel effortless. Games are not the point — they are the permission structure. They lower the stakes, spark the first laugh, and create the conditions for real conversation.</p>
            <p>We design every detail: the pacing, the groupings, the pauses. So you do not have to work hard to connect — you just have to show up.</p>
            <p>Guests leave feeling relaxed, seen, and socially fulfilled. Not drained.</p>
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
          {PHASES.map((p, i) => (
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
          EDITION VII<br />
          <span>COMING SOON</span>
        </h2>
        <p className={styles.communitySub}>Every quarter. Same intention. New faces.</p>
        <div className={styles.badgeRow}>
          {['Lagos', 'Quarterly', 'Limited Seats'].map(b => (
            <span key={b} className={styles.badge}>{b}</span>
          ))}
        </div>
        <button className="btn btn-gold" style={{ marginTop: '24px' }} onClick={() => goGate('guest')}>
          Join the Guest List
        </button>
      </div>

      <footer className={styles.footer}>
        <span className={styles.footerBrand}>Maison de les nobles</span>
        <span className={styles.footerCopy}>Nice2Meetya! © 2025</span>
      </footer>
    </div>
  )
}
