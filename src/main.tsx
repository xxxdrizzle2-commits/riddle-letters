import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './Shell'
import './styles.css'
import './v1.css'

// An older open tab can request a chunk removed by a newer Pages deployment.
// Reload once to obtain the current HTML and chunk names; a second failure is
// surfaced by the router error page instead of entering a refresh loop.
const chunkReloadKey = 'riddle-chunk-reload-at'
window.addEventListener('vite:preloadError', event => {
  const previous = Number(sessionStorage.getItem(chunkReloadKey) || 0)
  if (Date.now() - previous < 60_000) return
  event.preventDefault()
  sessionStorage.setItem(chunkReloadKey, String(Date.now()))
  window.location.reload()
})

const root = createRoot(document.getElementById('root')!)
root.render(<React.StrictMode><App/></React.StrictMode>)
