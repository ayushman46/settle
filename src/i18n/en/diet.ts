/** English copy for Veg and no-drinks memory (src/features/diet). Names arrive as people typed them; amounts pre-formatted. */
import type { Messages } from '../types'

export const diet = {
  // The strip at the top of "Who had what?"
  'diet.strip.title.both': 'Anyone not drinking, or vegetarian?',
  'diet.strip.title.alcohol': 'Anyone not drinking?',
  'diet.strip.title.nonveg': 'Anyone vegetarian?',
  'diet.strip.body': 'They come off those items by themselves, and it’s remembered for next time.',
  'diet.strip.summary': '{count, plural, =0 {Tap to choose} one {# person remembered} other {# people remembered}}',
  'diet.strip.people.aria': 'Who doesn’t drink, and who is vegetarian',
  'diet.strip.alcohol': 'No alcohol',
  'diet.strip.nonveg': 'Veg',
  'diet.strip.alcohol.aria': 'No alcohol for {name}',
  'diet.strip.nonveg.aria': 'Veg only for {name}',

  // What it did
  'diet.banner.alcohol': '{name} doesn’t drink: taken off {count, plural, one {# drink} other {# drinks}} ({amount}).',
  'diet.banner.alcohol.me': 'You don’t drink: taken off {count, plural, one {# drink} other {# drinks}} ({amount}).',
  'diet.banner.nonveg': '{name} is vegetarian: taken off {count, plural, one {# dish} other {# dishes}} ({amount}).',
  'diet.banner.nonveg.me': 'You’re vegetarian: taken off {count, plural, one {# dish} other {# dishes}} ({amount}).',
  'diet.banner.kept': 'Nobody else is on {item}, so it stays with {names}.',
  'diet.banner.keptMore': '{count, plural, one {# more item stays} other {# more items stay}} as it is, for the same reason.',
  'diet.banner.undo': 'Undo',
  'diet.banner.undone': 'Put back on the items',

  // While picking who had an item
  'diet.toast.alcohol': 'Taken off {item}: {names} (no alcohol)',
  'diet.toast.nonveg': 'Taken off {item}: {names} (veg)',

  // On a person's page
  'diet.toggles.aria': 'Food and drink',
  'diet.toggles.alcohol': 'Doesn’t drink',
  'diet.toggles.alcohol.body': 'Taken off beer, wine and cocktails on a bill by themselves.',
  'diet.toggles.nonveg': 'Vegetarian',
  'diet.toggles.nonveg.body': 'Taken off chicken, mutton, fish and egg dishes on a bill by themselves.',
} satisfies Messages
