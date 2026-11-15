/**
 * Payday-aware: your payday and each friend's; the best day to ask (the day after theirs); "clear
 * everything" on yours; and, in the Android app, a payday worked out from salary alerts that is
 * offered, never set. The Tools hub shows 'payday.tool.title' and 'payday.tool.body'.
 */
export { PaydayScreen } from './PaydayScreen'
export { PaydaySheet, type PaydaySheetProps } from './PaydaySheet'
export { PaydayPickSheet, type PaydayPickSheetProps } from './PaydayPickSheet'
export { FriendPaydayRow, type FriendPaydayRowProps } from './FriendPaydayRow'
export { PaydayHint, type PaydayHintProps } from './PaydayHint'
export { PaydayCard } from './PaydayCard'
export { usePaydayDue } from './usePaydayDue'
export { PaydayGuessCard } from './PaydayGuessCard'
export { PAYDAY_PATH } from './paths'
export { paydayToday } from './today'
export { noteSalaryAlerts, type SalaryAlert } from './alerts'
export { guessPayday, isSalaryAlert, type PaydayGuess } from './salary'
export {
  bestAskDay,
  declineGuess,
  dismissPaydayCard,
  noteSalary,
  paydayStore,
  setFriendPayday,
  setMyPayday,
  useFriendPayday,
  useFriendPaydays,
  useMyPayday,
  usePaydayGuess,
  type PaydayState,
} from './store'
export {
  ASK_WINDOW_DAYS,
  askAfter,
  askList,
  bestAsk,
  lastPayday,
  nextPayday,
  paydayDue,
  paydayIn,
  paydayWindow,
  type AskDay,
  type AskRow,
  type Payday,
  type PaydayDue,
} from './engine'
export { askHint, paydayLabel } from './labels'

/** The copy keys the Tools hub shows for this feature. */
export const PAYDAY_TOOL = { title: 'payday.tool.title', body: 'payday.tool.body' } as const
