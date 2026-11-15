/** English copy for Cash, exact notes (src/features/notes): which notes, what change. Names arrive as people typed them; amounts pre-formatted. */
import type { Messages } from '../types'

export const notes = {
  // Tools hub
  'notes.tool.title': 'Cash, exact notes',
  'notes.tool.body': 'Paying in cash? See which notes to give and the change to get back.',

  // The button, wherever cash is recorded
  'notes.button': 'Which notes?',
  'notes.button.aria': 'Which notes to give for {amount} in cash',

  // The sheet
  'notes.sheet.title': 'Which notes to give',
  'notes.sheet.eyebrow':
    '{who, select, payer {You pay {receiver} {amount} in cash} receiver {{payer} pays you {amount} in cash} plain {Paying {amount} in cash} other {{payer} pays {receiver} {amount} in cash}}',
  'notes.sheet.body': 'The fewest notes to count out, and the change to hand back.',
  'notes.amount.label': 'Amount in cash',
  'notes.amount.empty': 'Type an amount, for example ₹1,370, to see the notes.',

  'notes.give':
    '{who, select, payer {You give {receiver} {amount}} receiver {{payer} gives you {amount}} plain {Give {amount}} other {{payer} gives {receiver} {amount}}}',
  'notes.back':
    '{who, select, payer {{receiver} gives you back {amount}} receiver {You give {payer} back {amount}} plain {Get {amount} back} other {{receiver} gives {payer} back {amount}}}',
  'notes.noChange': 'No change needed.',
  'notes.exact': 'Have the exact notes? {piles} make {amount}, with no change.',
  'notes.round': 'Or round to {to} and call {diff} even, if you both agree. Then: {give}, {back}.',
  'notes.round.exact': 'Or round to {to} and call {diff} even, if you both agree. Then: {give}, and no change.',
  'notes.round.give': '{amount} given ({piles})',
  'notes.round.back': '{amount} back ({piles})',
  'notes.paise': 'Cash can’t be paid to the paisa, so this is worked out for {amount}.',
  'notes.fine': 'Any notes that add up will do. These are the fewest to count.',

  // Notes and coins in words
  'notes.pile.note':
    '{count, plural, =1 {one {value} note} =2 {two {value} notes} =3 {three {value} notes} =4 {four {value} notes} =5 {five {value} notes} other {# {value} notes}}',
  'notes.pile.coin':
    '{count, plural, =1 {one {value} coin} =2 {two {value} coins} =3 {three {value} coins} =4 {four {value} coins} =5 {five {value} coins} other {# {value} coins}}',
  'notes.pile.many': '{count} × {value}',
  'notes.pile.count': '×{count}',
} satisfies Messages
