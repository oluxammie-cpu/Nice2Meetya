import { useState, useEffect } from 'react'
import Nav from './components/Nav.jsx'
import PublicView from './components/PublicView.jsx'
import GateView from './components/GateView.jsx'
import GuestView from './components/GuestView.jsx'
import HostView from './components/HostView.jsx'

function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem('n2my_session') || '{}')
  } catch {
    return {}
  }
}

function saveSession(data) {
  sessionStorage.setItem('n2my_session', JSON.stringify(data))
}

function clearSession() {
  sessionStorage.removeItem('n2my_session')
}

export default function App() {
  const session = getSession()
  const [view, setView]         = useState(session.view || 'public')
  const [gateMode, setGateMode] = useState('guest')

  useEffect(() => {
    if (view === 'guest' || view === 'host') {
      saveSession({ view })
    } else if (view === 'public') {
      clearSession()
    }
  }, [view])

  function goGate(mode) {
    setGateMode(mode)
    setView('gate')
  }

  function goPublic() {
    clearSession()
    setView('public')
  }

  function onSuccess(newView) {
    saveSession({ view: newView })
    setView(newView)
  }

  return (
    <>
      <Nav view={view} goGate={goGate} goPublic={goPublic} />

      {view === 'public' && <PublicView goGate={goGate} />}
      {view === 'gate'   && (
        <GateView
          mode={gateMode}
          setMode={setGateMode}
          onSuccess={onSuccess}
        />
      )}
      {view === 'guest'  && <GuestView goGate={goGate} />}
      {view === 'host'   && <HostView  goPublic={goPublic} />}
    </>
  )
}
