import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './styles/tokens.css'
import './styles/global.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { applyStoredAppearance } from './app/appearance'
import { profileStore } from './data/stores'
import { BRAND, type LanguageCode } from './domain/types'
import { contextFor, resolveLanguage, startLanguage } from './i18n/language'
import { setLanguage } from './i18n/runtime'
import { trackKeyboardInset } from './lib/keyboardInset'

const container = document.getElementById('root')
if (!container) throw new Error(`${BRAND.name}: #root element is missing from index.html.`)

// The saved theme and accent go on before the first paint: no flash of the wrong look.
applyStoredAppearance()

// iOS keeps sticky bottom actions under the on-screen keyboard; this lets them ride above it.
trackKeyboardInset()

/** The app's saved language (null = automatic); unreadable storage counts as automatic. */
function savedLanguage(): LanguageCode | null {
  try {
    return profileStore.get().language ?? null
  } catch {
    return null
  }
}

const context = contextFor(window.location.pathname)
let saved = savedLanguage()

// The person's language before the first paint: English costs nothing, any other language
// waits for its one chunk (at most 2.5 s; after that English shows and the language follows).
const languageReady = startLanguage(resolveLanguage({ context, saved, search: window.location.search }))

// Later changes to the saved choice (the picker, a restored backup) switch the app with it.
profileStore.subscribe(() => {
  const next = savedLanguage()
  if (next === saved) return
  saved = next
  void setLanguage(resolveLanguage({ context: contextFor(window.location.pathname), saved: next, search: '' }))
})

function mount(): void {
  createRoot(container as HTMLElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

if (languageReady) void languageReady.then(mount)
else mount()

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
