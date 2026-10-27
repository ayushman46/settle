import { useAutoSettle } from './useAutoSettle'

/** Mounted by the app shell in the Android app only: ticks people off as payments arrive. */
export function AutoSettleWatcher() {
  useAutoSettle()
  return null
}
