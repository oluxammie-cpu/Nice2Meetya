import { useState } from 'react'
import Nav from './components/Nav.jsx'
import PublicView from './components/PublicView.jsx'
import GateView from './components/GateView.jsx'
import GuestView from './components/GuestView.jsx'
import HostView from './components/HostView.jsx'

// View names: 'public' | 'gate' | 'guest' | 'host'
export default function App() {
  const [view, setView]       = useState('public')
  const [gateMode, setGateMode] = useState('guest') // 'guest' | 'host'

  function goGate(mode) {
    setGateMode(mode)
    setView('gate')
  }

  return (
    <>
      <Nav view={view} goGate={goGate} goPublic={() => setView('public')} />

      {view === 'public' && <PublicView goGate={goGate} />}
      {view === 'gate'   && (
        <GateView
          mode={gateMode}
          setMode={setGateMode}
          onSuccess={setView}
        />
      )}
      {view === 'guest'  && <GuestView goGate={goGate} />}
      {view === 'host'   && <HostView  goPublic={() => setView('public')} />}
    </>
  )
}
