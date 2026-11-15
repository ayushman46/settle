/** Paid in kind in words: the chips' labels and the note shown beside a payment later. */
import { t, type MessageKey } from '../../i18n'
import type { KindDirection, KindEntry, KindWhat } from './engine'

const CHIP_KEYS: Record<KindDirection, Record<KindWhat, MessageKey>> = {
  in: {
    ticket: 'kind.what.in.ticket',
    elsewhere: 'kind.what.in.elsewhere',
    cash: 'kind.what.in.cash',
    favour: 'kind.what.in.favour',
    other: 'kind.what.in.other',
  },
  out: {
    ticket: 'kind.what.out.ticket',
    elsewhere: 'kind.what.out.elsewhere',
    cash: 'kind.what.out.cash',
    favour: 'kind.what.out.favour',
    other: 'kind.what.out.other',
  },
}

const NOTE_KEYS: Record<KindDirection, Record<KindWhat, MessageKey>> = {
  in: {
    ticket: 'kind.note.in.ticket',
    elsewhere: 'kind.note.in.elsewhere',
    cash: 'kind.note.in.cash',
    favour: 'kind.note.in.favour',
    other: 'kind.note.in.other',
  },
  out: {
    ticket: 'kind.note.out.ticket',
    elsewhere: 'kind.note.out.elsewhere',
    cash: 'kind.note.out.cash',
    favour: 'kind.note.out.favour',
    other: 'kind.note.out.other',
  },
}

/** The chip's label, worded from your side: "Bought my ticket" when they settle, "Bought their ticket" when you do. */
export function kindChipLabel(what: KindWhat, direction: KindDirection): string {
  return t(CHIP_KEYS[direction][what])
}

/**
 * What it was, for showing later: "Riya bought your ticket"; for "something else", the person's
 * own words in quotes.
 */
export function kindWhatText(entry: Pick<KindEntry, 'what' | 'direction' | 'text'>, name: string): string {
  const text = entry.text?.trim() ?? ''
  if (entry.what === 'other' && text !== '') return t('kind.note.text', { text })
  return t(NOTE_KEYS[entry.direction][entry.what], { name })
}

/** The whole line beside a payment: "Settled without money: Riya bought your ticket". */
export function kindNoteText(entry: Pick<KindEntry, 'what' | 'direction' | 'text'>, name: string): string {
  return t('kind.note.line', { what: kindWhatText(entry, name) })
}
