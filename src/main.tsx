import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './styles/tokens.css'
import './styles/global.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { trackKeyboardInset } from './lib/keyboardInset'

const container = document.getElementById('root')
if (!container) throw new Error('BillSplit: #root element is missing from index.html.')

// iOS keeps sticky bottom actions under the on-screen keyboard; this lets them ride above it.
trackKeyboardInset()

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Offline support (production only — in dev a worker would cache Vite's modules and confuse HMR).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const register = (): void => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // No offline cache this time (e.g. private mode); the app works the same online.
    })
  }
  // After load, so installing the worker never competes with the first paint.
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}
