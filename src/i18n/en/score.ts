/** English copy for Settle Score (src/features/score). Names arrive as people typed them; amounts pre-formatted. */
import type { Messages } from '../types'

export const score = {
  'score.title': 'Settle Score',
  'score.subtitle': 'How good you are to share money with',
  'score.disclaimer': 'A game to help you pay back fast, not a credit score. It’s worked out on this phone from your own splits, and nothing leaves it.',

  // The card on You
  'score.card.aria': 'Settle Score {score}, {band}. See how it’s worked out',
  'score.card.hint': 'How fast you pay back, out of 900',
  'score.card.pending': 'Settle Score: not enough history yet. It appears after {needed} times you’ve owed someone {floor} or more ({owed} of {needed} so far).',

  // The dial
  'score.dial.aria': 'Settle Score {score} out of 900: {band}',
  'score.dial.range': '300 to 900',

  // Bands (the sentence is picked from what the factors show)
  'score.band.warming': 'Warming up',
  'score.band.getting': 'Getting there',
  'score.band.solid': 'Solid',
  'score.band.gold': 'Gold standard',
  'score.band.warming.body': 'A few old debts are holding it down. Paying one off moves it up straight away.',
  'score.band.warming.slow': 'Paying back has been slow. Paying within 3 days next time moves it up.',
  'score.band.getting.body': 'On the way. Paying back within a few days is the quickest way up.',
  'score.band.solid.body': 'Friends can count on you. Paying back within 3 days keeps it climbing.',
  'score.band.gold.body': 'Top of the scale. The friend everyone wants on the trip.',
  'score.band.gold.fast': 'You pay back fast. The friend everyone wants on the trip.',
  'score.band.gold.bills': 'You pick up the bill for others too. The friend everyone wants on the trip.',
  'score.band.gold.fastBills': 'You pay back fast and pick up the bill too. The friend everyone wants on the trip.',

  // Factors
  'score.factors.title': 'What goes into it',
  'score.factor.weight': '{weight}% of the score',
  'score.factor.bar': '{title}: {sub} out of 100',
  'score.factor.speed': 'How fast you pay back',
  'score.factor.speed.body': '{days, plural, =0 {You usually pay back the same day} one {You usually pay back in about # day} other {You usually pay back in about # days}}',
  'score.factor.speed.mixed': '{days, plural, =0 {Usually the same day, counting what you still owe} one {Usually about # day, counting what you still owe} other {Usually about # days, counting what you still owe}}',
  'score.factor.speed.unpaid': '{days, plural, =0 {Nothing paid back yet; your oldest is from today} one {Nothing paid back yet; your oldest is # day old} other {Nothing paid back yet; your oldest is # days old}}',
  'score.factor.speed.none': 'You haven’t owed anyone {floor} or more yet, so this sits in the middle',
  'score.factor.onTime': 'Paid within 3 days',
  'score.factor.onTime.body': '{counted, plural, one {{onTime} of the # time you owed someone was paid back within 3 days} other {{onTime} of the # times you owed someone were paid back within 3 days}}',
  'score.factor.onTime.none': 'No time you owed someone to count yet, so this sits in the middle',
  'score.factor.overdue': 'Owed for over a week',
  'score.factor.overdue.none': 'Nothing you owe is older than a week',
  'score.factor.overdue.body': '{amount} owed for over a week, the oldest for {days} days',
  'score.factor.overdue.count': '{count, plural, one {# debt} other {# debts}} older than a week, the oldest for {days} days',
  'score.factor.fronted': 'Bills you paid for others',
  'score.factor.fronted.body': '{count, plural, =0 {None yet: bills of {floor} or more you pay for others count here} one {You’ve paid # bill for other people} other {You’ve paid # bills for other people}}',
  'score.factor.history': 'How much history',
  'score.factor.history.body': '{count, plural, one {# split} other {# splits}} of {floor} or more, with {people, plural, one {# person} other {# people}}. The full range needs {full} splits with {fullPeople} different people.',
  'score.factor.history.full': '{count} splits of {floor} or more, with {people} people: enough for the full range',

  // Next step
  'score.next.title': 'Your best next step',
  'score.next.friend': 'Pay {name} {amount}',
  'score.next.group': 'Settle up in {group}: {amount}',
  'score.next.gain': 'About +{gain} to your score',
  'score.next.steady': 'Keeps your score on track',
  'score.next.friend.cta': 'Go to {name}',
  'score.next.group.cta': 'Settle up',
  'score.next.none': 'You owe nobody right now. Paying for the next round can help.',

  // How it's worked out
  'score.how.title': 'How it’s worked out',
  'score.how.counts': 'Every share you owed someone counts, from the day of the bill to the day you paid it back. In a group it counts from the day you started owing to the day you were square again, so one payment that clears a group counts once.',
  'score.how.small': 'Tiny bills hardly count: a bill under {floor} isn’t counted, nor is owing someone less than {floor}. At most {perDay} splits a day count.',
  'score.how.weights': 'How fast you pay back is {speed}% of it, paying within 3 days {onTime}%, nothing owed for over a week {overdue}%, bills you paid for others {fronted}% and how much history there is {history}%.',
  'score.how.history': 'With only a few splits the score stays near 600, and spreads out as your history grows. The full range, and Gold standard, need {full} splits with {fullPeople} different people.',
  'score.how.promise': 'Paying something off never lowers it. Loans don’t count, only splits and bills.',

  // Share
  'score.share': 'Share my score',
  'score.share.text': 'My Settle Score is {score} ({band}). It’s a game in {brand} for paying friends back on time, not a credit score. {url}',
  'score.share.copied': 'Copied. Paste it anywhere.',

  // Not enough yet
  'score.empty.title': 'Not enough history yet',
  'score.empty.body': 'Your score appears after {needed} times you’ve owed someone {floor} or more and paid them back. A debt left unpaid for over 3 days counts too. So far: {owed} of {needed}.',
} satisfies Messages
