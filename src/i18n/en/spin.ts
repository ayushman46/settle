/** English copy for Who pays? (src/features/spin): the wheel that picks who gets this bill. Names arrive as people typed them; amounts pre-formatted. */
import type { Messages } from '../types'

export const spin = {
  'spin.sheet.title': 'Who pays?',
  'spin.sheet.description': 'Spin the wheel to pick who gets this bill.',

  'spin.mode.aria': 'How the wheel is cut',
  'spin.mode.fair': 'Fair',
  'spin.mode.luck': 'Pure luck',
  'spin.explain.fair': 'Half the wheel is shared equally, and the other half goes to whoever has paid less than their share in {group}, more the further behind they are.',
  'spin.explain.fair.even': 'Nobody here is behind in {group}, so everyone has the same chance.',
  'spin.explain.luck': 'Everyone has the same chance.',

  'spin.wheel.aria': 'The wheel: {chances}',
  'spin.wheel.chance': '{name} {percent}%',
  'spin.people.title': 'Tap someone to leave them out of this spin (the birthday person?)',
  'spin.people.aria': 'Who’s in this spin',
  'spin.person.chance': '{percent}%',
  'spin.person.out': 'Left out',
  'spin.person.behind': '{amount} behind',
  'spin.person.aria': '{name}, {percent}% chance. Tap to leave out.',
  'spin.person.aria.out': '{name}, left out of this spin. Tap to bring back.',
  'spin.few': 'Leave at least two people in to spin.',

  'spin.cta': 'Spin',
  'spin.again': 'Spin again',
  'spin.spinning': 'Spinning…',
  'spin.result': '{name}’s got this one',
  'spin.result.you': 'You’ve got this one',
  'spin.add': 'Add the bill with {name} paying',
  'spin.add.you': 'Add the bill with you paying',
  'spin.banner.title': 'The wheel picked {name}',
  'spin.banner.title.you': 'The wheel picked you',
  'spin.banner.body': 'Enter the amount and save: everyone in the group shares it equally, unless you change it.',
} satisfies Messages
