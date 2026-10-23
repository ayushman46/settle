/** English copy for S4 · next round's on you. Keys: `rotation.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const rotation = {
  // "Everyone" in a round: the current members, you included.
  'rotation.everyone': '{count, plural, =2 {both of you} other {all # of you}}',
  'rotation.everyone.you': '{count, plural, =2 {both of you} other {all #}}',
  // The card on a group, between where you stand and the tabs.
  'rotation.card.title': "Next round's on {name}",
  'rotation.card.title.you': "Next round's on you",
  'rotation.card.body': "{name}'s {behind} behind. If {name} pays the next {squares} for {everyone}, {name}'s square.",
  'rotation.card.body.you': "You're {behind} behind. Pay the next {squares} for {everyone} and you're square.",
  'rotation.card.usual': 'A usual round here is {usual} — that settles {settles} of the {out} the group is out.',
  // When the usual round is bigger than helps.
  'rotation.card.fallback': "{name}'s {behind} behind. Paying up to {squares} for {everyone} squares {name} up — a bigger round puts {name} ahead.",
  'rotation.card.fallback.you': "You're {behind} behind. Paying up to {squares} for {everyone} squares you up — a bigger round puts you ahead.",
  // When only people who left the group are behind.
  'rotation.card.left.title': 'Settle up instead',
  'rotation.card.left': '{name} left the group with {amount} to settle — settle up instead.',
  'rotation.card.left.many': '{count} people who left the group have {amount} to settle — settle up instead.',
  'rotation.card.log.cta': 'Log the next round',
  'rotation.card.plan.cta': 'See the rotation',
  'rotation.card.settle.cta': 'Settle up',
  // The banner on the new split the card opens.
  'rotation.banner.title': "{name}'s round",
  'rotation.banner.title.you': 'Your round',
  'rotation.banner.body': 'Up to {amount} squares {name} up. More than that and {name} is ahead.',
  'rotation.banner.body.you': "Up to {amount} squares you up. More than that and you're ahead.",
  // The rotation sheet.
  'rotation.sheet.title': 'Pay it forward',
  'rotation.sheet.description': 'Take turns paying for everyone instead of paying each other back. Each round is split equally between {everyone}.',
  'rotation.sheet.amount.label': 'Each round, about',
  'rotation.sheet.amount.error': 'Enter an amount',
  'rotation.sheet.reset.cta': 'Reset',
  'rotation.sheet.reset.aria': 'Reset to the usual round',
  'rotation.sheet.rounds.label': 'Rounds',
  'rotation.sheet.round.title': '{n} · {name} pays',
  'rotation.sheet.round.title.you': '{n} · You pay',
  'rotation.sheet.round.subtitle': 'Group out {before} → {after}',
  'rotation.sheet.round.settles': 'settles {amount}',
  'rotation.sheet.round.aria': 'Round {n}, {name} pays, group out {before} to {after}, settles {amount}',
  'rotation.sheet.round.aria.you': 'Round {n}, you pay, group out {before} to {after}, settles {amount}',
  'rotation.sheet.square': "Everyone's square after round {n} 🎉",
  'rotation.sheet.leftover': 'Then settle the last {amount}:',
  'rotation.sheet.empty.title': "A {amount} round is bigger than anyone's behind",
  'rotation.sheet.empty.body': 'Try a smaller round — or settle up.',
  'rotation.sheet.settle.cta': 'Settle up',
  'rotation.sheet.log.cta': 'Log round 1 with {name} paying',
  'rotation.sheet.log.cta.you': 'Log round 1 with you paying',
  'rotation.sheet.live': 'Plan updated: {count, plural, one {# round} other {# rounds}}',
  'rotation.sheet.live.none': 'Plan updated: no round helps',
} as const satisfies Messages
