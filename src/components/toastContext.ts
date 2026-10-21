import { createContext, useContext } from 'react'

export type ToastTone = 'neutral' | 'success' | 'error' | 'info' | 'warning'

export interface ToastAction {
  /** Short verb, e.g. "Undo". */
  label: string
  /** Runs when tapped; the toast then closes. */
  onAction: () => void
}

export interface ToastOptions {
  /** Adds a small status glyph. Default `neutral` (text only). */
  tone?: ToastTone
  /** One inline action (e.g. Undo). */
  action?: ToastAction
  /**
   * Milliseconds before it hides. Default 2200, or 8000 when there is an action (which Ctrl/Cmd+Z
   * also runs while it shows). Paused while hovered, touched or focused.
   */
  duration?: number
}

/** Shows a toast (replacing any current one). Returns a function that dismisses it early. */
export type ShowToast = (message: string, options?: ToastOptions) => () => void

export const ToastContext = createContext<ShowToast | null>(null)

/** Closes whatever toast is showing. */
export const DismissToastContext = createContext<(() => void) | null>(null)

/** `const toast = useToast(); toast('Copied to clipboard', { tone: 'success' })`. Requires `<ToastProvider>`. */
export function useToast(): ShowToast {
  const show = useContext(ToastContext)
  if (!show) throw new Error('useToast() must be used inside <ToastProvider>.')
  return show
}

/**
 * Returns a function that closes the current toast, if any — e.g. when the screen changes, so an
 * "Undo" for something on the previous screen doesn't follow the person around.
 */
export function useDismissToast(): () => void {
  const dismiss = useContext(DismissToastContext)
  if (!dismiss) throw new Error('useDismissToast() must be used inside <ToastProvider>.')
  return dismiss
}
