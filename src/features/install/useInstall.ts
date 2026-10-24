import { useCallback, useEffect, useState } from 'react'
import { isStandalone, platformFor, type InstallPlatform } from './installState'

/** The browser's install prompt, kept until someone asks to install (it can only be shown once). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export interface InstallState {
  platform: InstallPlatform
  standalone: boolean
  canPrompt: boolean
  /** Shows the browser's install dialog. Resolves to what the person chose. */
  install: () => Promise<'accepted' | 'dismissed' | 'unavailable'>
}

function standaloneNow(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return isStandalone(window.matchMedia('(display-mode: standalone)').matches, (navigator as { standalone?: boolean }).standalone)
  } catch {
    return false
  }
}

/** Live install state: catches `beforeinstallprompt` (Chrome, Edge, Samsung) and `appinstalled`. */
export function useInstall(): InstallState {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [standalone, setStandalone] = useState(standaloneNow)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvent(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setEvent(null)
      setStandalone(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!event) return 'unavailable'
    try {
      await event.prompt()
      const { outcome } = await event.userChoice
      setEvent(null)
      return outcome
    } catch {
      setEvent(null)
      return 'unavailable'
    }
  }, [event])

  const platform = typeof navigator === 'undefined' ? 'other' : platformFor(navigator.userAgent, navigator.maxTouchPoints)
  return { platform, standalone, canPrompt: event !== null, install }
}
