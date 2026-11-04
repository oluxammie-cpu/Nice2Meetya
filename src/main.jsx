import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import RegApp from './reg/RegApp.jsx'
import HostReg from './reg/HostReg.jsx'
import './index.css'

const path = window.location.pathname
const Root = path.startsWith('/ix') ? RegApp
           : path.startsWith('/host/ix') ? HostReg
           : App

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
