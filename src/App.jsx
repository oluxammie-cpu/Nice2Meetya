import { useState, useEffect } from 'react'
import Nav from './components/Nav.jsx'
import PublicView from './components/PublicView.jsx'
import GateView from './components/GateView.jsx'
import GuestView from './components/GuestView.jsx'
import HostView from './components/HostView.jsx'

const SESSION_KEY = 'n2my_session'

function getSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}') }
  catch { return {} }
}

export default function App() {
  const session                 = getSession()
  const [view, setView]         = useState(session.view || 'public')
  const [gateMode, setGateMode] = useState('guest')

  function persist(v) {
    if (v === 'guest' || v === 'host') {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ view: v }))
    } else {
      sessionStorage.removeItem(SESSION_KEY)
    }
  }

  function goGate(mode) {
    setGateMode(mode)
    setView('gate')
    sessionStorage.removeItem(SESSION_KEY)
  }

  function goPublic() {
    sessionStorage.removeItem(SESSION_KEY)
    setView('public')
  }

  function onSuccess(v) {
    persist(v)
    setView(v)
  }

  return (
    <>
      <Nav view={view} goGate={goGate} goPublic={goPublic} />
      {view === 'public' && <PublicView goGate={goGate} />}
      {view === 'gate'   && <GateView mode={gateMode} setMode={setGateMode} onSuccess={onSuccess} />}
      {view === 'guest'  && <GuestView goGate={goGate} />}
      {view === 'host'   && <HostView goPublic={goPublic} />}
    </>
  )
}
