/** English copy for Fair rent (src/features/fairrent): rent by room and what it has. Names arrive as people typed them; amounts pre-formatted. */
import type { Messages } from '../types'

export const fairrent = {
  'fairrent.tool.title': 'Fair rent',
  'fairrent.tool.body': 'Rent by room: size, attached bathroom, balcony, AC. Whole rupees that add up.',

  'fairrent.title': 'Fair rent',
  'fairrent.subtitle': 'The better room pays more, common space is shared equally, and every rupee of the rent is counted.',
  'fairrent.subtitle.group': 'For {group}. The better room pays more, common space is shared equally, and every rupee of the rent is counted.',

  // The rent.
  'fairrent.rent.label': 'Monthly rent',
  'fairrent.rent.fromSetup': 'From {name} in Rent and HRA receipts. Change it if it is different now.',

  // Who lives in the flat.
  'fairrent.people.heading': 'Who lives here',
  'fairrent.people.change': 'Change',
  'fairrent.people.done': 'Done',
  'fairrent.people.search': 'Search or add flatmates',
  'fairrent.people.none': 'Nobody yet. Add the flatmates.',

  // Rooms.
  'fairrent.rooms.heading': 'Rooms',
  'fairrent.rooms.fine': 'Small counts as 90 sq ft, medium as 120, large as 160. Type the real size if you know it.',
  'fairrent.room.name': 'Room {n}',
  'fairrent.room.size.aria': 'Size of room {n}',
  'fairrent.size.small': 'Small',
  'fairrent.size.medium': 'Medium',
  'fairrent.size.large': 'Large',
  'fairrent.room.sqft': 'Sq ft, if you know it',
  'fairrent.room.sqft.aria': 'Room {n}: size in sq ft',
  'fairrent.room.sqft.placeholder': '140',
  'fairrent.room.has': 'What it has',
  'fairrent.extra.bath': 'Attached bathroom',
  'fairrent.extra.balcony': 'Balcony',
  'fairrent.extra.ac': 'AC',
  'fairrent.extra.aria': 'Room {n}: {extra}',
  'fairrent.room.tweak': 'More light, quieter',
  'fairrent.room.tweak.aria': 'Room {n}: more light, quieter',
  'fairrent.tweak.same': 'Same',
  'fairrent.tweak.up': '+{n}%',
  'fairrent.tweak.down': '−{n}%',
  'fairrent.room.who': 'Who lives in it',
  'fairrent.room.who.aria': '{name} lives in room {n}',
  'fairrent.room.empty': 'Nobody in it, so it is left out of the split.',
  'fairrent.room.remove.aria': 'Remove room {n}',
  'fairrent.room.add': 'Add a room',
  'fairrent.toast.roomRemoved': 'Room {n} removed',

  // The method, shown.
  'fairrent.method.heading': 'How it is split',
  'fairrent.method.common': 'Common space',
  'fairrent.method.common.aria': 'Part of the rent that pays for common space',
  'fairrent.method.pct': '{n}%',
  'fairrent.method.body':
    '{common} of the rent pays for the hall, kitchen and the rest of the common space, shared equally by {count, plural, one {the one person here} other {all # people}}. The other {rooms} goes by room: its size, plus {bath}% for an attached bathroom, {balcony}% for a balcony and {ac}% for AC. People sharing a room split its part.',
  'fairrent.method.change': 'Change what the extras add',
  'fairrent.method.hide': 'Hide',
  'fairrent.factor.bath': 'Attached bathroom adds',
  'fairrent.factor.balcony': 'Balcony adds',
  'fairrent.factor.ac': 'AC adds',

  // The answer.
  'fairrent.result.heading': 'Each person’s rent',
  'fairrent.result.needRent': 'Type the monthly rent to see each person’s part.',
  'fairrent.result.needPeople': 'Put someone in a room to see the split.',
  'fairrent.result.unplaced': '{names} {count, plural, one {is} other {are}} not in a room yet, so the rent is split among the others.',
  'fairrent.result.equal.more': 'Equal split: {equal}. This is {diff} more.',
  'fairrent.result.equal.less': 'Equal split: {equal}. This is {diff} less.',
  'fairrent.result.equal.same': 'The same as an equal split.',
  'fairrent.result.total': 'Adds up to {amount}, the whole rent.',

  // One line of reason each.
  'fairrent.why.size.small': 'the small room',
  'fairrent.why.size.medium': 'the medium room',
  'fairrent.why.size.large': 'the large room',
  'fairrent.why.sqft': 'the {n} sq ft room',
  'fairrent.why.bath': 'the bathroom',
  'fairrent.why.balcony': 'a balcony',
  'fairrent.why.ac': 'AC',
  'fairrent.why.up': '{n}% added for light and quiet',
  'fairrent.why.down': '{n}% taken off for light and quiet',
  'fairrent.why.with': '{room} with {extras}',
  'fairrent.why.shared': '{room}, shared with {names}',
  'fairrent.list.and': '{head} and {last}',

  // Into the app's rent set-up.
  'fairrent.use.cta': 'Use this for {name}',
  'fairrent.use.fine': 'Puts these amounts into {name} in Rent and HRA receipts, so its pay link and receipts use them.',
  'fairrent.use.done': '{name} now uses these shares',
  'fairrent.use.already': '{name} in Rent and HRA receipts already uses these shares.',
  'fairrent.use.failed': 'Could not put these into {name}. Nothing was changed.',
  'fairrent.use.none': 'Once this flat is set up in Rent and HRA receipts with the same people, one tap here fills in each share.',
  'fairrent.use.setup': 'Open Rent and HRA receipts',

  // As a message.
  'fairrent.share.cta': 'Send to the flat',
  'fairrent.share.title': 'Fair rent',
  'fairrent.share.copied': 'Copied. Paste it in the flat’s chat.',
  'fairrent.share.failed': 'Could not share it. Try again.',
  'fairrent.message.head': 'Rent of {amount}, split by room:',
  'fairrent.message.line': '{name}: {amount} ({why})',
  'fairrent.message.method': 'How: {pct}% of the rent is for common space, shared equally. The rest goes by room size and what the room has.',
  'fairrent.message.equal': 'An equal split would be {amount} each.',

  'fairrent.reset.cta': 'Start again',
  'fairrent.reset.done': 'Cleared. A medium room each again.',
} satisfies Messages
