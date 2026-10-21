/**
 * Share kit — everything that leaves the app: pay links, share-card images, nudges, chat-app
 * links, files and plain-text summaries.
 */
export {
  decodePayLink,
  encodePayLink,
  PAY_LINK_LIMITS,
  PAY_PATH,
  payLinkDebtors,
  payLinkFromExpense,
  payLinkItemLines,
  payLinkProgress,
  type PayLinkDebtor,
  type PayLinkItem,
  type PayLinkItemLine,
  type PayLinkPayload,
  type PayLinkPerson,
} from './payLink'
export {
  defaultSiteLabel,
  renderShareCard,
  ShareCardError,
  shareCardFilename,
  shareCardInputFromExpense,
} from './card/render'
export { CARD_SIZE, type ShareCardInput, type ShareCardPerson } from './card/layout'
export { NUDGE_MAX_LENGTH, NUDGE_TONES, nudgeText, nudgeVariantCount, type NudgeInput, type NudgeTone } from './nudge'
export { normalizePhone, smsUrl, whatsappUrl } from './links'
export { safeFilename, shareFile, type ShareFileOptions, type ShareFileOutcome } from './shareFile'
export { summaryText } from './summary'
export { categoryLabel } from './categories'
export { outsideName } from './names'
// Text sharing and the clipboard live in lib/share (v2); re-exported so screens need one import.
export { copyText, shareResult, type ShareOutcome } from '../lib/share'
