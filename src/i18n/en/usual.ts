/** English copy for A group’s usual split (src/features/usual). Names arrive as people typed them; amounts pre-formatted. */
import type { Messages } from '../types'

export const usual = {
  'usual.chip.title': 'Usual split: {label}',
  'usual.chip.change': 'Change',
  'usual.chip.change.aria': 'Change: split this one equally instead',
  'usual.stop': 'Stop using it',
  'usual.stopped.toast': '{group}’s usual split is gone. New expenses start equal.',
  'usual.undo': 'Undo',

  'usual.part.percent': '{name} {value}%',
  'usual.part.shares': '{name} {value, plural, one {# share} other {# shares}}',

  'usual.offer.label': 'Use this for every new expense in {group}',
  'usual.offer.body': 'New expenses here will start split this way. You can change any one of them.',
  'usual.offer.replace': 'Instead of the usual split now, {label}.',

  'usual.use': 'Use the usual split: {label}',

  'usual.stale.title': 'The usual split was for different people',
  'usual.stale.body': 'The group has changed since {label} was set. Set it again for everyone in it now.',
  'usual.stale.again': 'Set it again',
} satisfies Messages
