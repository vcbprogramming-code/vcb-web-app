import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { SettingsProvider } from './settings'
import './app.css'
import './extra.css'

// Mirror the live app's mobile detection (.is-mobile on <html> before paint).
function detectMobile(): void {
  const ua = navigator.userAgent || ''
  const uaMobile = /iPhone|iPod|Android.+Mobile|BlackBerry|IEMobile|Opera Mini/i.test(ua)
  const sw = (window.screen && window.screen.width) || 0
  const iw = window.innerWidth || 0
  document.documentElement.classList.toggle('is-mobile', uaMobile || sw < 768 || iw < 768)
}
detectMobile()
window.addEventListener('resize', detectMobile, { passive: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <App />
    </SettingsProvider>
  </StrictMode>,
)
