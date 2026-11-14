/** English copy for Fair fare (src/features/fare): a shared cab split by where each person got off. Names arrive as people typed them; amounts pre-formatted. */
import type { Messages } from '../types'

export const fare = {
  'fare.open': 'Shared ride? Split by where each got off',
  'fare.title': 'Split by where people got off',
  'fare.eyebrow': 'Shared cab or auto',
  'fare.description': 'Tap people in the order they got off. Whoever you don’t tap rode to the end.',

  'fare.order.aria': 'Riders, in the order they got off',
  'fare.tap.first': 'Got off first',
  'fare.tap.next': 'Got off next',
  'fare.tap.same': 'Same stop',
  'fare.tap.aria': '{name}: {action}',
  'fare.stop': 'Stop {n}',
  'fare.stop.aria': '{name} got off at stop {n}. Tap to put them back.',
  'fare.end': 'Rode to the end',
  'fare.same.label': 'Got off at the same stop',
  'fare.same.description': 'The next people you tap join the last stop.',
  'fare.reset': 'Start over',

  'fare.km.show': 'Add distances (km)',
  'fare.km.hide': 'Hide distances',
  'fare.km.hint': 'Optional. Without them, every leg counts the same.',
  'fare.km.partial': 'Fill in every leg to split by distance.',
  'fare.km.leg': 'Leg {n}, till {names} got off (km)',
  'fare.km.last': 'Leg {n}, to the end (km)',

  'fare.result.aria': 'What each person pays',
  'fare.reason.all': '{count, plural, one {Rode the whole way} other {Rode all # legs}}',
  'fare.reason.legs': 'Rode {ridden} of {count} legs',
  'fare.reason.km': 'Rode {km} of {total} km',
  'fare.equal': 'Everyone got off at the same place: that’s just an equal split.',
  'fare.apply': 'Use this split',
} satisfies Messages
