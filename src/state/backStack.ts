/**
 * The bill flow's side of the app's browser history.
 *
 * History is one trail shared by pages, bottom sheets and the bill flow's steps — see
 * `src/app/nav/historyDriver.ts`. Inside the flow (URL `/app/bill`) each step has its own entry,
 * one above the other from the flow's first entry, and sheets sit above the step they were opened
 * on:
 *
 *   … → /app → scan → review → paid → people → assign → result → sheet → nested sheet
 *
 * So the system/Android Back button closes the top-most sheet first, then walks back through the
 * flow one step at a time, then returns to the screen the flow was opened from. A reload keeps the
 * trail (browsers restore `history.state`); a fresh tab that resumes mid-flow gets the trail
 * rebuilt beneath it.
 *
 * The flow's provider calls `flowHistory().init(step)` when it mounts, `syncTo(step)` on every step
 * change and `setPopHandler()` to follow Back/Forward between steps.
 */
export {
  HistoryDriver,
  TRAVERSAL_TIMEOUT_MS,
  historyDriver as flowHistory,
  resetHistoryDriver as resetFlowHistory,
  type PopHandler,
  type SheetHandle,
} from '../app/nav/historyDriver'
export { readEntry, stepDepth, type FlowEntry } from '../app/nav/entry'
export { useBackClose } from '../app/nav/useBackClose'
