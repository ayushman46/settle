/** The shagun book as the screens need it: families, functions by id, totals (worked out once per change). */
import { useMemo } from 'react'
import { bookTotals, familySummaries, type BookTotals, type FamilySummary } from './engine'
import { useShagunBook, type ShagunState } from './store'
import type { ShagunFunction } from './types'

export interface ShagunView {
  book: ShagunState
  families: FamilySummary[]
  functionsById: Readonly<Record<string, ShagunFunction>>
  totals: BookTotals
  /** Every family name in the book, as written (for picking instead of typing). */
  names: string[]
}

export function useShagun(): ShagunView {
  const book = useShagunBook()
  return useMemo(() => {
    const families = familySummaries(book.entries)
    return {
      book,
      families,
      functionsById: Object.fromEntries(book.functions.map((fn) => [fn.id, fn])),
      totals: bookTotals(book.entries),
      names: families.map((f) => f.name),
    }
  }, [book])
}
