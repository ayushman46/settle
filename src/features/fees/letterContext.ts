/** Opening Bank charges' one letter sheet (FeeLetterSheet's LetterSheetHost provides it) from anywhere on the screen. */
import { createContext, useContext } from 'react'

export type LetterMode = 'bank' | 'ombudsman' | 'replied' | 'back' | 'basic'

export interface OpenedLetter {
  claimId: string | null
  mode: LetterMode
  bank?: string | null
  account?: string | null
}

export const LetterContext = createContext<(opened: OpenedLetter) => void>(() => undefined)

/** Opens the screen's letter sheet. */
export function useOpenLetter(): (opened: OpenedLetter) => void {
  return useContext(LetterContext)
}
