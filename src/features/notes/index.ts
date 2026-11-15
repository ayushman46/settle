/**
 * Cash, exact notes: which notes to give and the change to get back.
 * Tools hub copy: 'notes.tool.title', 'notes.tool.body'. No store (nothing is remembered).
 */
export { NotesButton, type NotesButtonProps } from './NotesButton'
export { NotesSheet, type NotesSheetProps } from './NotesSheet'
export {
  cashPlan,
  DENOMINATIONS,
  fewestPieces,
  pieceCount,
  pilesTotal,
  type CashPlan,
  type Denomination,
  type Handover,
  type Pile,
  type RoundOption,
} from './engine'
export { pilesText } from './notesText'
export { notesToday } from './today'
