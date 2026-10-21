import { useEffect, useLayoutEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import { historyDriver, type SheetHandle } from './historyDriver'

/**
 * Makes the system/Android Back button close a sheet instead of leaving the screen — on any page,
 * including inside the bill flow. While `open`, a history entry is held for the sheet; Back pops
 * it and calls `onClose`. Closing from the UI (`open` → false) removes that entry again, and so
 * does navigating away. Nested sheets close top-most first.
 *
 * If `open` is still true once `onClose` has run, the entry is held again — beneath any sheet
 * `onClose` opened. That makes an unsaved-changes guard two lines:
 *
 *   useBackClose(dirty, () => setConfirming(true))         // Back asks first…
 *   useBackClose(confirming, () => setConfirming(false))   // …and Back again keeps editing
 *   // Discard: setDirty(false) and goBack(fallback) in the same handler.
 */
export function useBackClose(open: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose)
  const openRef = useRef(open)
  useLayoutEffect(() => {
    onCloseRef.current = onClose
    openRef.current = open
  })

  useEffect(() => {
    if (!open) return
    const history = historyDriver()
    let disposed = false
    let handle: SheetHandle | null = null
    const onBack = (): void => {
      handle = null
      if (disposed) return
      // Commit the close now so we can tell whether the owner really closed the sheet.
      flushSync(() => onCloseRef.current())
      // Still open (e.g. it can't be dismissed right now): hold an entry for it again.
      if (!disposed && openRef.current) handle = history.openSheet(onBack)
    }
    handle = history.openSheet(onBack)
    return () => {
      disposed = true
      handle?.release()
    }
  }, [open])
}
