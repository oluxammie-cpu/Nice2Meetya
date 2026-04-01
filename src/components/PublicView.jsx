import { useEffect, useRef } from 'react'
import { PHASES } from '../lib/phases.js'
import styles from './PublicView.module.css'

function ChampagneFlutes() {
  return (
    <svg
      className={styles.flutes}
      viewBox="0 0 220 280"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <ellipse cx="110" cy="230" rx="60" ry="12" fill="rgba(201,168,76,0.07)" />

      {/* LEFT FLUTE */}
      <g opacity="0.92">
        <path
          d="M72 30 C68 60 62 90 58 115 C54 138 60 155 80 158 L80 218"
          stroke="rgba(201,168,76,0.5)" strokeWidth="1" fill="none"
        />
        <path
          d="M100 30 C104 60 110 90 114 115 C118 138 112 155 92 158 L92 218"
          stroke="rgba(201,168,76,0.5)" strokeWidth="1" fill="none"
        />
        <path
          d="M72 30 C68 60 62 90 58 115 C54 138 60 155 80 158 L92 158 C112 155 118 138 114 115 C110 90 104 60 100 30 Z"
          fill="rgba(201,168,76,0.06)" stroke="rgba(201,168,76,0.25)" strokeWidth="0.5"
        />
        <path
          d="M63 110 C61 125 62 140 80 144 L92 144 C110 140 111 125 109 110 Z"
          fill="rgba(240,208,128,0.12)"
        />
        <circle cx="80" cy="135" r="1.5" fill="rgba(240,208,128,0.6)">
          <animate attributeName="cy" values="135;95;135" dur="2.8s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.6;0;0.6" dur="2.8s" repeatCount="indefinite" />
        </circle>
        <circle cx="87" cy="125" r="1" fill="rgba(240,208,128,0.4)">
          <animate attributeName="cy" values="125;88;125" dur="3.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0;0.4" dur="3.5s" repeatCount="indefinite" />
        </circle>
        <circle cx="76" cy="142" r="1" fill="rgba(240,208,128,0.35)">
          <animate attributeName="cy" values="142;105;142" dur="2.2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.35;0;0.35" dur="2.2s" repeatCount="indefinite" />
        </circle>
        <line x1="86" y1="158" x2="86" y2="220" stroke="rgba(201,168,76,0.4)" strokeWidth="1.2" />
        <path d="M72 220 Q86 216 100 220" stroke="rgba(201,168,76,0.5)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M76 36 C74 58 70 86 68 108" stroke="rgba(255,255,255,0.12)" strokeWidth="1" fill="none" strokeLinecap="round" />
      </g>

      {/* RIGHT FLUTE — tilted for clink */}
      <g opacity="0.92" transform="rotate(7, 148, 28)">
        <path
          d="M122 30 C118 60 112 90 108 115 C104 138 110 155 130 158 L130 218"
          stroke="rgba(201,168,76,0.5)" strokeWidth="1" fill="none"
        />
        <path
          d="M150 30 C154 60 160 90 164 115 C168 138 162 155 142 158 L142 218"
          stroke="rgba(201,168,76,0.5)" strokeWidth="1" fill="none"
        />
        <path
          d="M122 30 C118 60 112 90 108 115 C104 138 110 155 130 158 L142 158 C162 155 168 138 164 115 C160 90 154 60 150 30 Z"
          fill="rgba(201,168,76,0.06)" stroke="rgba(201,168,76,0.25)" strokeWidth="0.5"
        />
        <path
          d="M113 110 C111 125 112 140 130 144 L142 144 C160 140 161 125 159 110 Z"
          fill="rgba(240,208,128,0.12)"
        />
        <circle cx="132" cy="130" r="1.5" fill="rgba(240,208,128,0.6)">
          <animate attributeName="cy" values="130;92;130" dur="3.1s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.6;0;0.6" dur="3.1s" repeatCount="indefinite" />
        </circle>
        <circle cx="138" cy="142" r="1" fill="rgba(240,208,128,0.4)">
          <animate attributeName="cy" values="142;104;142" dur="2.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0;0.4" dur="2.6s" repeatCount="indefinite" />
        </circle>
        <line x1="136" y1="158" x2="136" y2="220" stroke="rgba(201,168,76,0.4)" strokeWidth="1.2" />
        <path d="M122 220 Q136 216 150 220" stroke="rgba(201,168,76,0.5)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M126 36 C124 58 120 86 118 108" stroke="rgba(255,255,255,0.12)" strokeWidth="1" fill="none" strokeLinecap="round" />
      </g>

      {/* Clink sparkle */}
      <g>
        <circle cx="108" cy="24" r="2" fill="#F0D080">
          <animate attributeName="opacity" values="0;1;0" dur="1.9s" repeatCount="indefinite" />
          <animate attributeName="r" values="1;2.5;1" dur="1.9s" repeatCount="indefinite" />
        </circle>
        <line x1="108" y1="18" x2="108" y2="12" stroke="#F0D080" strokeWidth="0.8">
          <animate attributeName="opacity" values="0;0.7;0" dur="1.9s" repeatCount="indefinite" />
        </line>
        <line x1="102" y1="21" x2="97" y2="16" stroke="#F0D080" strokeWidth="0.8">
          <animate attributeName="opacity" values="0;0.5;0" dur="1.9s" begin="0.25s" repeatCount="indefinite" />
        </line>
        <line x1="114" y1="21" x2="119" y2="16" stroke="#F0D080" strokeWidth="0.8">
          <animate attributeName="opacity" values="0;0.5;0" dur="1.9s" begin="0.5s" repeatCount="indefinite" />
        </line>
        <line x1="100" y1="26" x2="94" y2="24" stroke="#F0D080" strokeWidth="0.6">
          <animate attributeName="opacity" values="0;0.4;0" dur="1.9s" begin="0.1s" repeatCount="indefinite" />
        </line>
        <line x1="116" y1="26" x2="122" y2="24" stroke="#F0D080" strokeWidth="0.6">
          <animate attributeName="opacity" values="0;0.4;0" dur="1.9s" begin="0.35s" repeatCount="indefinite" />
        </line>
      </g>
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

        <ChampagneFlutes />

        <p className={`${styles.presenter} fade-up`}>Maison de les nobles presents</p>
        <h1 className={`${styles.wordmark} fade-up delay-1`}>
          NICE2<span>MEETYA!</span>
        </h1>
        <p className={`${styles.tagline} fade-up delay-2`}>
          Where games open doors, and conversations do the rest.
        </p>
        <div className={`${styles.ctaRow} fade-up delay-3`}>
          <button className="btn btn-gold" onClick={() => goGate('guest')}>
            I'm Attending Tonight
          </button>
          <button className="btn btn-ghost" onClick={() => {
            document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })
          }}>
            What is this?
          </button>
        </div>
        <div className={`${styles.scrollLine} fade-up delay-4`} />
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
            <p>We design every detail: the pacing, the groupings, the pauses. So you don't have to work hard to connect — you just have to show up.</p>
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
