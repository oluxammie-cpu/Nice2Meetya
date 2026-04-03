import { useState, useEffect } from 'react'
import Nav from './components/Nav.jsx'
import PublicView from './components/PublicView.jsx'
import GateView from './components/GateView.jsx'
import GuestView from './components/GuestView.jsx'
import HostView from './components/HostView.jsx'

export default function App() {
  const [view, setView]         = useState(() => sessionStorage.getItem('n2my_view') || 'public')
  const [gateMode, setGateMode] = useState('guest')

  // Persist view to sessionStorage whenever it changes
  useEffect(() => {
    sessionStorage.setItem('n2my_view', view)
  }, [view])

  function goGate(mode) {
    setGateMode(mode)
    setView('gate')
  }

  function goPublic() {
    sessionStorage.removeItem('n2my_view')
    setView('public')
  }

  return (
    <>
      <Nav view={view} goGate={goGate} goPublic={goPublic} />

      {view === 'public' && <PublicView goGate={goGate} />}
      {view === 'gate'   && (
        <GateView
          mode={gateMode}
          setMode={setGateMode}
          onSuccess={setView}
        />
      )}
      {view === 'guest'  && <GuestView goGate={goGate} />}
      {view === 'host'   && <HostView  goPublic={goPublic} />}
    </>
  )
}
