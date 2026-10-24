/**
 * Remembers, on this phone only, how often Settle was opened and whether the install card was
 * dismissed. Per-viewer convenience: if storage is blocked, the card simply behaves as if new.
 */
import { EMPTY_MEMORY, parseMemory, type InstallMemory } from './installState'

export const INSTALL_MEMORY_KEY = 'settle.install.v1'
const SESSION_KEY = 'settle.install.session'

export function readMemory(): InstallMemory {
  try {
    return parseMemory(window.localStorage.getItem(INSTALL_MEMORY_KEY))
  } catch {
    return EMPTY_MEMORY
  }
}

export function writeMemory(memory: InstallMemory): void {
  try {
    window.localStorage.setItem(INSTALL_MEMORY_KEY, JSON.stringify(memory))
  } catch {
    // Storage full or blocked: the card will simply ask again next time.
  }
}

/** Counts this browser session as one visit (once per tab session) and returns the memory after it. */
export function noteSessionVisit(): InstallMemory {
  let counted = false
  try {
    counted = window.sessionStorage.getItem(SESSION_KEY) === '1'
    if (!counted) window.sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    // No session storage: count it anyway.
  }
  const memory = readMemory()
  if (counted) return memory
  const next = { ...memory, visits: memory.visits + 1 }
  writeMemory(next)
  return next
}
