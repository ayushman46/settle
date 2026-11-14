/** English copy for Settle Score (src/features/score). Names arrive as people typed them; amounts pre-formatted. */
import type { Messages } from '../types'

export const score = {
  'score.title': 'Settle Score',
  'score.subtitle': 'How good you are to share money with',
  'score.disclaimer': 'A game to help you pay back fast, not a credit score. It’s worked out on this phone from your own splits, and nothing leaves it.',

  // The card on You
  'score.card.aria': 'Settle Score {score}, {band}. See how it’s worked out',
  'score.card.hint': 'How fast you pay back, out of 900',
  'score.card.pending': 'Your Settle Score appears after your first few splits',

  // The dial
  'score.dial.aria': 'Settle Score {score} out of 900: {band}',
  'score.dial.range': '300 to 900',

  // Bands
  'score.band.warming': 'Warming up',
  'score.band.getting': 'Getting there',
  'score.band.solid': 'Solid',
  'score.band.gold': 'Gold standard',
  'score.band.warming.body': 'A few old debts are holding it down. Paying one off moves it up straight away.',
  'score.band.getting.body': 'On the way. Paying back within a few days is the quickest way up.',
  'score.band.solid.body': 'Friends can count on you. Keep paying back within 3 days.',
  'score.band.gold.body': 'You pay back fast and pick up the bill too. The friend everyone wants on the trip.',

  // Factors
  'score.factors.title': 'What goes into it',
  'score.factor.weight': '{weight}% of the score',
  'score.factor.bar': '{title}: {sub} out of 100',
  'score.factor.speed': 'How fast you pay back',
  'score.factor.speed.body': '{days, plural, =0 {You usually pay back the same day} one {You usually pay back in about # day} other {You usually pay back in about # days}}',
  'score.factor.speed.none': 'You haven’t owed anyone yet, so this sits in the middle',
  'score.factor.onTime': 'Paid within 3 days',
  'score.factor.onTime.body': '{onTime} of {counted} paid back within 3 days',
  'score.factor.onTime.none': 'Nothing to count yet, so this sits in the middle',
  'score.factor.overdue': 'Owed for over a week',
  'score.factor.overdue.none': 'Nothing you owe is older than a week',
  'score.factor.overdue.body': '{amount} owed for over a week, the oldest for {days} days',
  'score.factor.overdue.count': '{count, plural, one {# debt} other {# debts}} older than a week, the oldest for {days} days',
  'score.factor.fronted': 'Bills you paid for others',
  'score.factor.fronted.body': '{count, plural, =0 {None yet: paying for the next round helps} one {You’ve paid # bill for other people} other {You’ve paid # bills for other people}}',
  'score.factor.history': 'How much history',
  'score.factor.history.body': '{count, plural, one {# split so far} other {# splits so far}}. The score uses its full range from {full}.',
  'score.factor.history.full': '{count} splits so far: enough for the full range',

  // Next step
  'score.next.title': 'Your best next step',
  'score.next.friend': 'Pay {name} {amount}',
  'score.next.group': 'Settle up in {group}: {amount}',
  'score.next.gain': 'About +{gain} to your score',
  'score.next.steady': 'Keeps your score on track',
  'score.next.friend.cta': 'Go to {name}',
  'score.next.group.cta': 'Settle up',
  'score.next.none': 'You owe nobody. Picking up the next bill for friends adds to your score.',

  // How it's worked out
  'score.how.title': 'How it’s worked out',
  'score.how.counts': 'Every share you owed someone counts, from the day of the bill to the day you paid it back. In a group it counts from the day you started owing to the day you were square again.',
  'score.how.weights': 'How fast you pay back is {speed}% of it, paying within 3 days {onTime}%, nothing owed for over a week {overdue}%, bills you paid for others {fronted}% and how much history there is {history}%.',
  'score.how.history': 'With only a few splits the score stays near 600, and spreads out as your history grows ({full} splits for the full range).',
  'score.how.promise': 'Paying something off never lowers it. Loans don’t count, only splits and bills.',

  // Share
  'score.share': 'Share my score',
  'score.share.text': 'My Settle Score is {score} ({band}). It’s worked out from how fast I pay my friends back.',
  'score.share.copied': 'Copied. Paste it anywhere.',

  // Not enough yet
  'score.empty.title': 'Your score appears after your first few splits',
  'score.empty.body': 'Split a few bills and pay back as you go. It’s worked out here, from your own splits.',
} satisfies Messages
