/**
 * Kannada copy for "Bank charges" (src/features/fees): your bank's charges checked against the RBI's
 * rules, what can be claimed back, the letters, and the claims as they go. The feature is
 * "ಬ್ಯಾಂಕ್ ಶುಲ್ಕಗಳು" everywhere ("ಬ್ಯಾಂಕ್ ಶುಲ್ಕಗಳು ವಿಭಾಗದಲ್ಲಿ" in a sentence, like Stuck money's
 * "ಸಿಲುಕಿದ ಹಣ ವಿಭಾಗದಲ್ಲಿ"). A claim is "ಕ್ಲೇಮ್"; to claim back is "ವಾಪಸ್ ಕೇಳಿ"; a charge put back is
 * "ವಾಪಸ್ ಹಾಕಲಾಗಿದೆ". A returned cheque or mandate is "ಬೌನ್ಸ್", never "ವಾಪಸ್" (that reads as money back).
 * The letters themselves stay in English (src/features/fees/letters.ts).
 */
import type { Messages } from '../types'

export const fees = {
  'fees.title': 'ಬ್ಯಾಂಕ್ ಶುಲ್ಕಗಳು',
  'fees.tile': 'ಬ್ಯಾಂಕ್ ಶುಲ್ಕಗಳು',
  'fees.tagline': 'RBI ನಿಯಮಗಳು ಅನುಮತಿಸದ ಶುಲ್ಕಗಳನ್ನು ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ಕಡಿತ ಮಾಡಿದ್ದರೆ, ಅವನ್ನು ಹುಡುಕಿ ವಾಪಸ್ ಪಡೆಯಿರಿ.',

  // Before anything is checked.
  'fees.empty.title': 'ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ವಿಧಿಸಬಾರದ ಶುಲ್ಕ ವಿಧಿಸುತ್ತಿದೆಯೇ?',
  'fees.empty.text':
    'ಬ್ಯಾಂಕ್ ಸ್ಟೇಟ್‌ಮೆಂಟ್ ಸೇರಿಸಿ. Settle ಪ್ರತಿ ಶುಲ್ಕವನ್ನು RBI ನಿಯಮಗಳ ಪ್ರಕಾರ ಪರಿಶೀಲಿಸುತ್ತದೆ (ಕನಿಷ್ಠ ಬ್ಯಾಲೆನ್ಸ್, ATM, NEFT, UPI, SMS ಇತ್ಯಾದಿ), ಮತ್ತು ತಪ್ಪಾದವುಗಳನ್ನು ವಾಪಸ್ ಪಡೆಯಲು ಪತ್ರ ಬರೆದುಕೊಡುತ್ತದೆ.',
  'fees.check.cta': 'ಸ್ಟೇಟ್‌ಮೆಂಟ್ ಪರಿಶೀಲಿಸಿ',
  'fees.check.again': 'ಇನ್ನೊಂದು ಸ್ಟೇಟ್‌ಮೆಂಟ್',
  'fees.check.formats': 'Excel (.xlsx), ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ಇಮೇಲ್ ಮಾಡುವ .xls, ಅಥವಾ CSV. PDF ಸ್ಟೇಟ್‌ಮೆಂಟ್‌ಗಳನ್ನು ಇನ್ನೂ ಓದಲಾಗುವುದಿಲ್ಲ.',
  'fees.paste.cta': 'ಬ್ಯಾಂಕ್ SMS ಅಂಟಿಸಿ',
  'fees.how.title': 'ಸ್ಟೇಟ್‌ಮೆಂಟ್ ಪಡೆಯುವುದು ಹೇಗೆ',
  // Menu names as bank apps show them (in English).
  'fees.how.text': 'ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ಆ್ಯಪ್ ಅಥವಾ ನೆಟ್ ಬ್ಯಾಂಕಿಂಗ್‌ನಲ್ಲಿ: Accounts → Statement → ಕಳೆದ 12 ತಿಂಗಳು → Excel ಅಥವಾ CSV ಆಗಿ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ.',
  'fees.privacy': 'ಈ ಫೋನ್‌ನಲ್ಲೇ ಓದಲಾಗುತ್ತದೆ. Settle ಶುಲ್ಕಗಳನ್ನು ಮಾತ್ರ ಇಟ್ಟುಕೊಳ್ಳುತ್ತದೆ, ನಿಮ್ಮ ಸ್ಟೇಟ್‌ಮೆಂಟ್‌ನ ಉಳಿದ ಯಾವುದನ್ನೂ ಅಲ್ಲ.',
  'fees.android.title': 'ಶುಲ್ಕ ಕಡಿತವಾದ ಕೂಡಲೇ',
  'fees.android.text': 'ಬ್ಯಾಂಕ್ SMS ಆನ್ ಇದ್ದರೆ, ಶುಲ್ಕಗಳ ಬಗ್ಗೆ ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ಕಳುಹಿಸುವ ಸಂದೇಶಗಳನ್ನು ಬಂದ ಕೂಡಲೇ Settle ಓದಿ, ಪ್ರತಿಯೊಂದನ್ನೂ ಪರಿಶೀಲಿಸುತ್ತದೆ.',
  'fees.android.cta': 'ಬ್ಯಾಂಕ್ SMS ಆನ್ ಮಾಡಿ',
  'fees.android.on': 'ಶುಲ್ಕಗಳ ಬಗ್ಗೆ ನಿಮ್ಮ ಬ್ಯಾಂಕ್‌ನ SMS ಓದಲಾಗುತ್ತಿದೆ.',

  // Reading a statement.
  'fees.reading': 'ನಿಮ್ಮ ಸ್ಟೇಟ್‌ಮೆಂಟ್ ಓದಲಾಗುತ್ತಿದೆ…',
  'fees.read.found':
    '{count, plural, =0 {ಇದರಲ್ಲಿ ಬ್ಯಾಂಕ್ ಶುಲ್ಕಗಳಿಲ್ಲ} one {# ಶುಲ್ಕ ಸಿಕ್ಕಿತು} other {# ಶುಲ್ಕಗಳು ಸಿಕ್ಕಿದವು}} · {lines, plural, one {# ವಹಿವಾಟು} other {# ವಹಿವಾಟುಗಳು}}, {from} ರಿಂದ {to}',
  'fees.read.toast': '{count, plural, one {# ಶುಲ್ಕ ಸಿಕ್ಕಿತು} other {# ಶುಲ್ಕಗಳು ಸಿಕ್ಕಿದವು}}',
  'fees.read.nothingNew': 'ಈಗಾಗಲೇ ಪರಿಶೀಲಿಸಲಾಗಿದೆ: ಈ ಸ್ಟೇಟ್‌ಮೆಂಟ್‌ನಲ್ಲಿ ಹೊಸದೇನೂ ಇಲ್ಲ',
  'fees.read.unreadable': 'ಆ ಫೈಲ್‌ನಲ್ಲಿ ದಿನಾಂಕ ಮತ್ತು ಮೊತ್ತಗಳ ಟೇಬಲ್ Settle ಗೆ ಸಿಗಲಿಲ್ಲ. ಸ್ಟೇಟ್‌ಮೆಂಟ್ ಅನ್ನು Excel ಅಥವಾ CSV ಆಗಿ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
  'fees.read.oldXls': 'ಅದು Settle ತೆರೆಯಲಾಗದ ಹಳೆಯ Excel ಫೈಲ್. ಅದನ್ನು .xlsx ಅಥವಾ CSV ಆಗಿ ಉಳಿಸಿ, ಅಥವಾ ನೆಟ್ ಬ್ಯಾಂಕಿಂಗ್‌ನಿಂದ CSV ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ.',
  'fees.read.pdf': 'PDF ಸ್ಟೇಟ್‌ಮೆಂಟ್‌ಗಳನ್ನು ಇನ್ನೂ ಓದಲಾಗುವುದಿಲ್ಲ. ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ಆ್ಯಪ್ ಅಥವಾ ನೆಟ್ ಬ್ಯಾಂಕಿಂಗ್‌ನಿಂದ Excel ಅಥವಾ CSV ಆಗಿ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ.',
  'fees.read.empty': 'ಆ ಸ್ಟೇಟ್‌ಮೆಂಟ್‌ನಲ್ಲಿ ಯಾವುದೇ ವಹಿವಾಟು ಇಲ್ಲ.',
  'fees.read.untrusted': 'ಈ ಫೈಲ್‌ನಲ್ಲಿನ ಬ್ಯಾಲೆನ್ಸ್‌ಗಳು ಸಾಲಿನಿಂದ ಸಾಲಿಗೆ ಹೊಂದುತ್ತಿಲ್ಲ, ಹಾಗಾಗಿ ಬ್ಯಾಲೆನ್ಸ್ ಬೇಕಾದ ಪರಿಶೀಲನೆಗಳನ್ನು ಬಿಡಲಾಗಿದೆ.',

  // The top of the screen.
  'fees.hero.owed': 'ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ನಿಮಗೆ ಕೊಡಬೇಕಾದದ್ದು',
  'fees.hero.owedSub': '{count, plural, one {# ಶುಲ್ಕ RBI ನಿಯಮಗಳಿಗೆ ವಿರುದ್ಧವಾಗಿದೆ} other {# ಶುಲ್ಕಗಳು RBI ನಿಯಮಗಳಿಗೆ ವಿರುದ್ಧವಾಗಿವೆ}}',
  'fees.hero.checked': 'ಪರಿಶೀಲಿಸಿದ ಶುಲ್ಕಗಳು',
  'fees.hero.checkedSub': '{count, plural, one {# ಶುಲ್ಕ} other {# ಶುಲ್ಕಗಳು}}, ಇಲ್ಲಿಯವರೆಗೆ ಯಾವುದೂ RBI ನಿಯಮಗಳಿಗೆ ವಿರುದ್ಧವಾಗಿಲ್ಲ',
  'fees.hero.checkedAsk': '{count, plural, one {# ಶುಲ್ಕವನ್ನು} other {# ಶುಲ್ಕಗಳನ್ನು}} ಪರಿಶೀಲಿಸಲಾಗಿದೆ. ಎಷ್ಟು ವಾಪಸ್ ಕೇಳಬಹುದು ಎಂದು ನೋಡಲು ಕೆಳಗೆ ಉತ್ತರಿಸಿ.',
  'fees.hero.period': '{from} ರಿಂದ {to}',
  'fees.hero.total': 'ಒಟ್ಟು ಶುಲ್ಕ {amount}',
  'fees.hero.back': 'ಇಲ್ಲಿಯವರೆಗೆ {amount} ವಾಪಸ್ ಬಂದಿದೆ',
  'fees.hero.backLabel': 'ನಿಮ್ಮ ಬ್ಯಾಂಕ್‌ನಿಂದ ವಾಪಸ್ ಬಂದದ್ದು',
  'fees.hero.backSub':
    '{count, plural, one {# ಶುಲ್ಕ RBI ನಿಯಮಗಳಿಗೆ ವಿರುದ್ಧವಾಗಿತ್ತು} other {# ಶುಲ್ಕಗಳು RBI ನಿಯಮಗಳಿಗೆ ವಿರುದ್ಧವಾಗಿದ್ದವು}}: ಪೂರ್ತಿ ವಾಪಸ್ ಬಂದಿದೆ',
  'fees.hero.ask': '{count, plural, one {# ಶುಲ್ಕಕ್ಕೆ ಒಂದು ಉತ್ತರ ಬೇಕು} other {# ಶುಲ್ಕಗಳಿಗೆ ತಲಾ ಒಂದು ಉತ್ತರ ಬೇಕು}}',

  // Sections.
  'fees.section.account': 'ನಿಮ್ಮ ಖಾತೆಯ ಬಗ್ಗೆ',
  'fees.section.ask': 'ತಲಾ ಒಂದು ಪ್ರಶ್ನೆ',
  'fees.section.claim': 'ವಾಪಸ್ ಕೇಳಿ',
  'fees.section.claims': 'ನಿಮ್ಮ ಕ್ಲೇಮ್‌ಗಳು',
  'fees.section.late': 'ಕಾಯಿಸಿದ್ದಕ್ಕೆ ಬರಬೇಕಾದದ್ದು',
  'fees.section.avoid': 'ಅನುಮತಿ ಇದೆ, ಆದರೆ ತಪ್ಪಿಸಬಹುದು',
  'fees.section.all': 'ಎಲ್ಲ ಶುಲ್ಕಗಳು',

  // About the account: the two answers that decide the minimum-balance checks.
  'fees.account.heading': '{bank} {account}',
  'fees.account.headingAny': 'ನಿಮ್ಮ ಖಾತೆ',
  'fees.account.type': 'ಇದು ಯಾವ ರೀತಿಯ ಖಾತೆ?',
  'fees.account.type.regular': 'ಸಾಮಾನ್ಯ ಉಳಿತಾಯ ಖಾತೆ',
  'fees.account.type.basic': 'ಬೇಸಿಕ್ ಸೇವಿಂಗ್ಸ್ (BSBD) ಅಥವಾ Jan Dhan',
  'fees.account.type.salary': 'ಸಂಬಳ ಖಾತೆ',
  'fees.account.type.minor': 'ಮಗುವಿನ ಖಾತೆ',
  'fees.account.type.scholarship': 'ವಿದ್ಯಾರ್ಥಿವೇತನ ಖಾತೆ',
  'fees.account.type.senior': 'ಹಿರಿಯ ನಾಗರಿಕರ ಅಥವಾ ಪಿಂಚಣಿ ಖಾತೆ',
  'fees.account.type.unknown': 'ಖಚಿತವಿಲ್ಲ',
  'fees.account.mab': 'ಪ್ರತಿ ತಿಂಗಳು ಇದರಲ್ಲಿ ಎಷ್ಟು ಸರಾಸರಿ ಬ್ಯಾಲೆನ್ಸ್ ಇಡಬೇಕು?',
  'fees.account.mab.hint': 'ಅದು ನಿಮ್ಮ ಬ್ಯಾಂಕ್‌ನ ಶುಲ್ಕಗಳ ಪುಟದಲ್ಲಿ ಇರುತ್ತದೆ, ಅಥವಾ ಶಾಖೆಯಲ್ಲಿ ಕೇಳಿ. ನಿಮ್ಮ ಬ್ಯಾಲೆನ್ಸ್ ನಿಜಕ್ಕೂ ಕಡಿಮೆ ಇತ್ತೇ ಎಂದು ನೋಡಲು Settle ಇದನ್ನು ಬಳಸುತ್ತದೆ.',
  'fees.account.mab.none': 'ಖಚಿತವಿಲ್ಲ',
  'fees.account.mab.other': 'ಬೇರೆ ಮೊತ್ತ',
  'fees.account.mab.label': 'ಬೇಕಾದ ಸರಾಸರಿ ಬ್ಯಾಲೆನ್ಸ್',
  'fees.account.why': 'ಕನಿಷ್ಠ ಬ್ಯಾಲೆನ್ಸ್ ನಿಯಮ ಅನ್ವಯಿಸುತ್ತದೆಯೇ ಎಂಬುದನ್ನೇ ಇವು ನಿರ್ಧರಿಸುತ್ತವೆ.',
  'fees.account.saved': 'ಉಳಿಸಲಾಗಿದೆ. ಪರಿಶೀಲನೆಗಳು ಈಗ ಇದನ್ನು ಬಳಸುತ್ತವೆ.',
  'fees.account.summary': '{type} · {mab, select, none {ಸರಾಸರಿ ಬ್ಯಾಲೆನ್ಸ್ ನೀಡಿಲ್ಲ} other {ಸರಾಸರಿ {mab} ಬೇಕು}}',
  'fees.account.change': 'ಬದಲಿಸಿ',
  'fees.account.summaryBasic': '{type} · ಕನಿಷ್ಠ ಬ್ಯಾಲೆನ್ಸ್ ಇಲ್ಲ',

  // One question per charge: the answer that settles it.
  'fees.q.warned': 'ಕನಿಷ್ಠ ಬ್ಯಾಲೆನ್ಸ್ ಶುಲ್ಕ ವಿಧಿಸುವುದಕ್ಕೆ ಒಂದು ತಿಂಗಳಾದರೂ ಮೊದಲು, ನಿಮ್ಮ ಬ್ಯಾಂಕ್ SMS, ಇಮೇಲ್ ಅಥವಾ ಪತ್ರದ ಮೂಲಕ ನಿಮಗೆ ಎಚ್ಚರಿಕೆ ಕೊಟ್ಟಿತ್ತೇ?',
  'fees.q.warned.yes': 'ಹೌದು, ಎಚ್ಚರಿಕೆ ಕೊಟ್ಟಿತ್ತು',
  'fees.q.warned.no': 'ಯಾವ ಎಚ್ಚರಿಕೆಯೂ ಬರಲಿಲ್ಲ',
  'fees.q.warned.unsure': 'ಖಚಿತವಿಲ್ಲ',
  'fees.q.atmEnquiry': 'ಆ ತಿಂಗಳು ಬೇರೆ ಬ್ಯಾಂಕ್‌ನ ATM ನಲ್ಲಿ ಎಷ್ಟು ಬಾರಿ ಬ್ಯಾಲೆನ್ಸ್ ನೋಡಿದಿರಿ, ಅಥವಾ ಮಿನಿ ಸ್ಟೇಟ್‌ಮೆಂಟ್ ತೆಗೆದಿರಿ?',
  'fees.q.declineReason': 'ಖಾತೆಯಲ್ಲಿ ಸಾಕಷ್ಟು ಹಣ ಇಲ್ಲದ ಕಾರಣಕ್ಕೇ ವಹಿವಾಟು ನಿರಾಕರಿಸಲಾಯಿತೇ?',
  'fees.q.online': 'ಈ NEFT ಅನ್ನು ನೆಟ್ ಬ್ಯಾಂಕಿಂಗ್ ಅಥವಾ ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ಆ್ಯಪ್‌ನಿಂದ ಕಳುಹಿಸಿದಿರಾ?',
  'fees.q.inoperative': 'ಈ ಶುಲ್ಕಕ್ಕೂ ಮೊದಲು, ನೀವು ಎರಡು ವರ್ಷಕ್ಕೂ ಹೆಚ್ಚು ಕಾಲ ಈ ಖಾತೆಯನ್ನು ಬಳಸದೆ ಬಿಟ್ಟಿದ್ದಿರಾ?',
  'fees.q.duplicateStatement': 'ಇದು ನೀವೇ ಕೇಳಿ ಪಡೆದ ಹೆಚ್ಚುವರಿ ಅಥವಾ ಡೂಪ್ಲಿಕೇಟ್ ಸ್ಟೇಟ್‌ಮೆಂಟ್‌ಗಾಗಿ ಆಗಿತ್ತೇ?',
  'fees.q.floating': 'ಇದು ನಿಮ್ಮ ಸ್ವಂತ ಹೆಸರಿನ, ವ್ಯವಹಾರಕ್ಕಾಗಿ ಅಲ್ಲದ, ಫ್ಲೋಟಿಂಗ್ ಬಡ್ಡಿ ದರದ ಸಾಲವಾಗಿತ್ತೇ (ರೆಪೊ ದರ ಅಥವಾ MCLR ಗೆ ಜೋಡಿಸಿದ್ದು)?',
  'fees.q.paidInTime': 'ಪಾವತಿಯ ಕೊನೆಯ ದಿನಾಂಕ ಕಳೆದು 3 ದಿನಗಳೊಳಗೆ ಕನಿಷ್ಠ ಬಾಕಿ ಮೊತ್ತವನ್ನಾದರೂ ಪಾವತಿಸಿದ್ದಿರಾ?',
  'fees.q.upiSmall': 'ಈ ಶುಲ್ಕ ವಿಧಿಸಿದ UPI ಪಾವತಿ ₹2,000 ಅಥವಾ ಅದಕ್ಕಿಂತ ಕಡಿಮೆ ಇತ್ತೇ?',
  'fees.q.atmEnquiry.none': 'ಒಮ್ಮೆಯೂ ಇಲ್ಲ',
  'fees.q.atmEnquiry.many': '3 ಅಥವಾ ಹೆಚ್ಚು',
  'fees.ask.more': 'ಇದಕ್ಕೆ ಉತ್ತರಿಸಿದರೆ ಇನ್ನೂ {amount} ವಾಪಸ್ ಕೇಳಬಹುದು',
  'fees.answer.yes': 'ಹೌದು',
  'fees.answer.no': 'ಇಲ್ಲ',
  'fees.answer.all': 'ಇಂತಹ ಎಲ್ಲ {count} ಶುಲ್ಕಗಳಿಗೂ ಇದೇ ಉತ್ತರ ಅನ್ವಯಿಸುತ್ತದೆ',
  'fees.answer.toast.wrong': 'ನೀವು ವಾಪಸ್ ಕೇಳಬಹುದಾದ ಪಟ್ಟಿಗೆ ಸೇರಿಸಲಾಗಿದೆ',
  'fees.answer.toast.fine': 'ಹಾಗಾದರೆ ಇದಕ್ಕೆ ಅನುಮತಿ ಇದೆ: ನಿಮ್ಮ ಕ್ಲೇಮ್‌ನಿಂದ ಹೊರಗಿಡಲಾಗಿದೆ',

  // Why a charge breaks a rule, in a line ({before}/{after}: balances, may be negative "−₹490").
  'fees.why.minbalNegative': 'ಇದು ನಿಮ್ಮ ಬ್ಯಾಲೆನ್ಸ್ ಅನ್ನು {before} ರಿಂದ {after} ಗೆ ಇಳಿಸಿ, ಸೊನ್ನೆಗಿಂತ ಕೆಳಗೆ ತಂದಿತು. ಅದಕ್ಕೆ ಅನುಮತಿ ಇಲ್ಲ.',
  'fees.why.minorNegative': 'ಮಗುವಿನ ಖಾತೆ ಎಂದಿಗೂ ಸೊನ್ನೆಗಿಂತ ಕೆಳಗೆ ಹೋಗಬಾರದು.',
  'fees.why.minbalBasic': 'ಬೇಸಿಕ್ ಸೇವಿಂಗ್ಸ್ ಖಾತೆಗೆ ಕನಿಷ್ಠ ಬ್ಯಾಲೆನ್ಸ್ ಶುಲ್ಕ ವಿಧಿಸುವಂತಿಲ್ಲ.',
  'fees.why.minbalScholarship': 'ವಿದ್ಯಾರ್ಥಿವೇತನ ಬರುವ ಖಾತೆಗೆ ಕನಿಷ್ಠ ಬ್ಯಾಲೆನ್ಸ್ ಶುಲ್ಕ ವಿಧಿಸುವಂತಿಲ್ಲ.',
  'fees.why.minbalWaived': '{from} ರಿಂದ {bank} ಉಳಿತಾಯ ಖಾತೆಗಳಿಗೆ ಕನಿಷ್ಠ ಬ್ಯಾಲೆನ್ಸ್ ಶುಲ್ಕ ವಿಧಿಸುವುದನ್ನು ನಿಲ್ಲಿಸಿದೆ.',
  'fees.why.minbalWaived.standard': '{from} ರಿಂದ {bank} ತನ್ನ ಸಾಮಾನ್ಯ ಉಳಿತಾಯ ಖಾತೆಗಳಿಗೆ ಕನಿಷ್ಠ ಬ್ಯಾಲೆನ್ಸ್ ಶುಲ್ಕ ವಿಧಿಸುವುದನ್ನು ನಿಲ್ಲಿಸಿದೆ.',
  'fees.why.smsWaived': '{from} ರಿಂದ {bank} ಉಳಿತಾಯ ಖಾತೆಗಳಿಗೆ SMS ಅಲರ್ಟ್ ಶುಲ್ಕ ವಿಧಿಸುವುದನ್ನು ನಿಲ್ಲಿಸಿದೆ.',
  'fees.why.minbalNotShort': '{period} ರಲ್ಲಿ ನಿಮ್ಮ ಸರಾಸರಿ ಬ್ಯಾಲೆನ್ಸ್ {avg} ಇತ್ತು — ಬೇಕಾದ {mab} ಗಿಂತ ಹೆಚ್ಚು. ನಿಮ್ಮ ಬ್ಯಾಲೆನ್ಸ್ ಕಡಿಮೆ ಇರಲಿಲ್ಲ.',
  'fees.why.minbalOverShortfall': 'ನಿಮ್ಮ ಬ್ಯಾಲೆನ್ಸ್‌ನಲ್ಲಿ {shortfall} ಕೊರತೆ ಇತ್ತು, ಆದರೆ {amount} ಶುಲ್ಕ ವಿಧಿಸಲಾಗಿದೆ — ಕೊರತೆಗಿಂತಲೂ ಹೆಚ್ಚು.',
  'fees.why.minbalOverSchedule': '{bank} ನ ಸ್ವಂತ ಶುಲ್ಕ ಪಟ್ಟಿಯಂತೆ, {avg} ಸರಾಸರಿ ಬ್ಯಾಲೆನ್ಸ್‌ಗೆ ಹೆಚ್ಚೆಂದರೆ {allowed} ವಿಧಿಸಬಹುದು. ಅದು {amount} ಕಡಿತ ಮಾಡಿದೆ.',
  'fees.why.minbalNotice': 'ಈ ಶುಲ್ಕ ವಿಧಿಸುವ ಮೊದಲು ಬ್ಯಾಂಕ್ ನಿಮಗೆ ಎಚ್ಚರಿಕೆ ನೀಡಿ, ಒಂದು ತಿಂಗಳ ಸಮಯ ಕೊಡಬೇಕು.',
  'fees.why.minbalNotice.early': '{date} ರಂದು ಶುಲ್ಕ ವಿಧಿಸಲಾಗಿದೆ — {notice} ರಂದು ಬ್ಯಾಂಕ್ ಎಚ್ಚರಿಕೆ ನೀಡಿ ಒಂದು ತಿಂಗಳೂ ಆಗುವ ಮೊದಲೇ.',
  'fees.why.minbalInoperative': 'ನಿಷ್ಕ್ರಿಯ ಖಾತೆಗೆ (ಎರಡು ವರ್ಷ ಯಾವುದೇ ವಹಿವಾಟು ಇಲ್ಲದ್ದು) ಕನಿಷ್ಠ ಬ್ಯಾಲೆನ್ಸ್ ಶುಲ್ಕ ವಿಧಿಸುವಂತಿಲ್ಲ.',
  'fees.why.basicWithdrawals': 'ಬೇಸಿಕ್ ಸೇವಿಂಗ್ಸ್ ಖಾತೆಯಲ್ಲಿ ತಿಂಗಳಿಗೆ 4 ವಿತ್‌ಡ್ರಾ ಉಚಿತ. ನೀವು {count} ಬಾರಿ ಹಣ ತೆಗೆದಿದ್ದೀರಿ.',
  'fees.why.basicFree': 'ಬೇಸಿಕ್ ಸೇವಿಂಗ್ಸ್ ಖಾತೆಯಲ್ಲಿ ಇದು ಉಚಿತ.',
  'fees.why.atmFree':
    'ಆ ತಿಂಗಳು {count, plural, =0 {ಒಂದು ವಿತ್‌ಡ್ರಾ ಕೂಡ ಆಗಿರಲಿಲ್ಲ} one {# ವಿತ್‌ಡ್ರಾ ಮಾತ್ರ ಆಗಿತ್ತು} other {# ವಿತ್‌ಡ್ರಾ ಮಾತ್ರ ಆಗಿದ್ದವು}}{failed, select, 1 { (ವಿಫಲವಾದವು ಲೆಕ್ಕಕ್ಕೆ ಬರುವುದಿಲ್ಲ)} other {}}. ಯಾವುದೇ ಬ್ಯಾಂಕ್‌ನ ATM ನಲ್ಲಿ ತಿಂಗಳ ಮೊದಲ 3 ವಿತ್‌ಡ್ರಾ ಉಚಿತ (ನಿಮ್ಮ ಸ್ವಂತ ಬ್ಯಾಂಕ್‌ನ ATM ನಲ್ಲಿ 5).',
  'fees.why.atmDecline': 'ನಿಮ್ಮ ತಪ್ಪಿಲ್ಲದೆ ವಹಿವಾಟು ನಿರಾಕರಿಸಲ್ಪಟ್ಟರೆ (ಯಂತ್ರದ ದೋಷ, ATM ನಲ್ಲಿ ಹಣ ಇಲ್ಲ, ನೆಟ್‌ವರ್ಕ್) ಅದಕ್ಕೆ ಶುಲ್ಕ ವಿಧಿಸುವಂತಿಲ್ಲ.',
  'fees.why.neftOnline': 'ಉಳಿತಾಯ ಖಾತೆಯಿಂದ ಆನ್‌ಲೈನ್‌ನಲ್ಲಿ ಕಳುಹಿಸುವ NEFT ಉಚಿತ.',
  'fees.why.transferInward': 'ನಿಮ್ಮ ಖಾತೆಗೆ ಬರುವ ಹಣಕ್ಕೆ ಶುಲ್ಕ ವಿಧಿಸುವಂತಿಲ್ಲ.',
  'fees.why.upi': 'ಈ ದಿನಾಂಕದಂದು UPI ಪಾವತಿಗಳಿಗೆ ಯಾವುದೇ ಶುಲ್ಕ ವಿಧಿಸುವಂತಿರಲಿಲ್ಲ.',
  'fees.why.upi.small': '₹2,000 ವರೆಗಿನ UPI ಪಾವತಿಗಳಿಗೆ ಶುಲ್ಕ ವಿಧಿಸುವಂತಿಲ್ಲ.',
  'fees.why.statementFree': 'ನಿಮ್ಮ ಪಾಸ್‌ಬುಕ್ ಮತ್ತು ಮಾಸಿಕ ಸ್ಟೇಟ್‌ಮೆಂಟ್ ಉಚಿತವಾಗಿರಬೇಕು.',
  'fees.why.activation': 'ನಿಷ್ಕ್ರಿಯ ಖಾತೆಯನ್ನು ಮತ್ತೆ ಸಕ್ರಿಯಗೊಳಿಸುವುದು ಉಚಿತವಾಗಿರಬೇಕು.',
  'fees.why.duplicate': 'ಒಂದೇ ಅವಧಿಗೆ ಎರಡು ಬಾರಿ ಶುಲ್ಕ ವಿಧಿಸಲಾಗಿದೆ: ಮೊದಲ ಬಾರಿ {first} ರಂದು.',
  'fees.why.gstLeft': 'ಶುಲ್ಕವನ್ನು ವಾಪಸ್ ಹಾಕಲಾಯಿತು, ಆದರೆ ಅದರ ಮೇಲಿನ {gst} GST ಅನ್ನು ಹಾಕಿಲ್ಲ.',
  'fees.why.prepay': 'ನಿಮ್ಮ ಹೆಸರಿನ ಫ್ಲೋಟಿಂಗ್ ಬಡ್ಡಿ ದರದ ಸಾಲಕ್ಕೆ ಅವಧಿಪೂರ್ವ ಪಾವತಿ ಶುಲ್ಕ ವಿಧಿಸುವಂತಿಲ್ಲ.',
  'fees.why.lateFee': 'ಕೊನೆಯ ದಿನಾಂಕದಿಂದ 3 ದಿನಗಳೊಳಗೆ ಪಾವತಿಸಿದ್ದರೆ ವಿಳಂಬ ಶುಲ್ಕ ಇಲ್ಲ.',
  'fees.why.more': '+ {count, plural, one {ಇನ್ನೂ # ಕಾರಣ} other {ಇನ್ನೂ # ಕಾರಣಗಳು}}',
  'fees.rule.source': 'ನಿಯಮ: {ref}',

  // What each kind of charge is called. Also fills {kind} in brackets in the Android alerts below,
  // so each works as a bare noun there.
  'fees.kind.minbal': 'ಕನಿಷ್ಠ ಬ್ಯಾಲೆನ್ಸ್',
  'fees.kind.atm': 'ATM',
  'fees.kind.atmDecline': 'ATM ನಿರಾಕರಣೆ',
  'fees.kind.sms': 'SMS ಅಲರ್ಟ್',
  'fees.kind.card': 'ಡೆಬಿಟ್ ಕಾರ್ಡ್',
  'fees.kind.neft': 'NEFT',
  'fees.kind.rtgs': 'RTGS',
  'fees.kind.imps': 'IMPS',
  'fees.kind.upi': 'UPI',
  'fees.kind.chequeBook': 'ಚೆಕ್ ಬುಕ್',
  'fees.kind.bounce': 'ಚೆಕ್ ಅಥವಾ ಆಟೋಪೇ ಬೌನ್ಸ್',
  'fees.kind.cash': 'ಶಾಖೆಯಲ್ಲಿ ನಗದು',
  'fees.kind.dormant': 'ನಿಷ್ಕ್ರಿಯ ಖಾತೆ',
  'fees.kind.prepay': 'ಸಾಲದ ಅವಧಿಪೂರ್ವ ಪಾವತಿ',
  'fees.kind.late': 'ವಿಳಂಬ ಶುಲ್ಕ',
  'fees.kind.statement': 'ಸ್ಟೇಟ್‌ಮೆಂಟ್ ಅಥವಾ ಪಾಸ್‌ಬುಕ್',
  'fees.kind.other': 'ಇತರ ಶುಲ್ಕ',
  'fees.kind.count': '{count, plural, one {# ಶುಲ್ಕ} other {# ಶುಲ್ಕಗಳು}}',

  // A charge in a list ({gst}: its GST, shown when there's one).
  'fees.charge.amount': '{amount}{gst, select, none {} other { ({gst} GST ಸೇರಿ)}}',
  'fees.charge.back': '{amount} ವಾಪಸ್ ಹಾಕಲಾಗಿದೆ',
  'fees.charge.label.amount': 'ಮೊತ್ತ',
  'fees.charge.label.back': 'ಹಿಂತಿರುಗಿದೆ',
  'fees.charge.label.balance': 'ಬ್ಯಾಲೆನ್ಸ್',
  'fees.charge.ok': 'Settle ಗೆ ತಿಳಿದ ಮಟ್ಟಿಗೆ, RBI ನಿಯಮಗಳು ಇದಕ್ಕೆ ಅನುಮತಿ ನೀಡುತ್ತವೆ.',
  'fees.charge.text': 'ನಿಮ್ಮ ಸ್ಟೇಟ್‌ಮೆಂಟ್ ಅಥವಾ SMS ನಲ್ಲಿ ಇರುವಂತೆ',
  'fees.charge.balance': '{before} → {after}',
  'fees.charge.backFull': 'ಪೂರ್ತಿ ವಾಪಸ್ ಹಾಕಲಾಗಿದೆ: ಇದು RBI ನಿಯಮಗಳಿಗೆ ವಿರುದ್ಧವಾಗಿತ್ತು, ಮತ್ತು ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ಅದನ್ನು ಸರಿಪಡಿಸಿದೆ.',
  'fees.charge.fine': 'ಸರಿಯಿದೆ, ಕ್ಲೇಮ್‌ಗೆ ಸೇರಿಸಬೇಡಿ',
  'fees.charge.fine.toast': 'ನಿಮ್ಮ ಕ್ಲೇಮ್‌ನಿಂದ ಹೊರಗಿಡಲಾಗಿದೆ',
  'fees.charge.remove': 'ಇದು ಬ್ಯಾಂಕ್ ಶುಲ್ಕ ಅಲ್ಲ: ತೆಗೆದುಹಾಕಿ',
  'fees.charge.removed': 'ಶುಲ್ಕ ತೆಗೆದುಹಾಕಲಾಗಿದೆ',
  'fees.charge.from': '{source, select, sms {ಒಂದು SMS ನಿಂದ} alert {ನಿಮ್ಮ ಬ್ಯಾಂಕ್‌ನ SMS ನಿಂದ} other {ನಿಮ್ಮ ಸ್ಟೇಟ್‌ಮೆಂಟ್‌ನಿಂದ}}',

  // A claim: one bank's wrong charges.
  'fees.claim.title': '{bank} ನಿಮಗೆ {amount} ಕೊಡಬೇಕು',
  'fees.claim.titleAny': 'ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ನಿಮಗೆ {amount} ಕೊಡಬೇಕು',
  'fees.claim.titleBack': '{bank} {amount} ವಾಪಸ್ ಹಾಕಿದೆ',
  'fees.claim.titleBackAny': 'ನಿಮ್ಮ ಬ್ಯಾಂಕ್ {amount} ವಾಪಸ್ ಹಾಕಿದೆ',
  'fees.claim.ref': 'ದೂರು ಸಂಖ್ಯೆ {ref}',
  'fees.claim.partOf': '{amount} ಶುಲ್ಕದಲ್ಲಿ {claim}',
  'fees.claim.status.part': '{amount} ರಲ್ಲಿ ಇಲ್ಲಿಯವರೆಗೆ {back} ವಾಪಸ್ ಬಂದಿದೆ. ಉಳಿದ {rest} ಇನ್ನೂ ಬರಬೇಕು.',
  'fees.claims.count': '{count, plural, one {# ಕ್ಲೇಮ್} other {# ಕ್ಲೇಮ್‌ಗಳು}}',
  'fees.claim.count': '{count, plural, one {# ಶುಲ್ಕ} other {# ಶುಲ್ಕಗಳು}}{account, select, none {} other {, ಖಾತೆ {account}}}',
  'fees.claim.cta': '{amount} ವಾಪಸ್ ಕೇಳಿ',
  'fees.claim.status.ready': 'ಇನ್ನೂ ಕಳುಹಿಸಿಲ್ಲ',
  'fees.claim.status.raised': '{date} ರಂದು ಕಳುಹಿಸಲಾಗಿದೆ. ಇದನ್ನು ಸರಿಪಡಿಸಲು ಬ್ಯಾಂಕ್‌ಗೆ {until} ರವರೆಗೆ ಸಮಯವಿದೆ.',
  'fees.claim.status.ombudsman': 'ಬ್ಯಾಂಕ್ 30 ದಿನಗಳಲ್ಲಿ ಸರಿಪಡಿಸಿಲ್ಲ. {last} ಒಳಗೆ RBI ಒಂಬುಡ್ಸ್‌ಮನ್ ಬಳಿಗೆ ಕೊಂಡೊಯ್ಯಿರಿ.',
  'fees.claim.status.replied': 'ಬ್ಯಾಂಕ್ {date} ರಂದು ಉತ್ತರಿಸಿತು. ತೃಪ್ತಿ ಇಲ್ಲವೇ? {last} ರವರೆಗೆ RBI ಒಂಬುಡ್ಸ್‌ಮನ್ ದೂರು ಸ್ವೀಕರಿಸುತ್ತಾರೆ.',
  'fees.claim.status.ombudsmanRaised': '{date} ರಿಂದ RBI ಒಂಬುಡ್ಸ್‌ಮನ್ ಬಳಿ ಇದೆ.',
  'fees.claim.status.closed': 'RBI ಒಂಬುಡ್ಸ್‌ಮನ್ ಬಳಿ ಹೋಗುವ 90 ದಿನಗಳು {last} ರಂದು ಮುಗಿದವು.',
  'fees.claim.status.back': '{date} ರಂದು {amount} ವಾಪಸ್ ಬಂತು',
  'fees.claim.status.backAll': 'ನಿಮ್ಮ ಬ್ಯಾಂಕ್‌ನಿಂದ {amount} ವಾಪಸ್ ಬಂತು',
  'fees.claim.raise': 'ಬ್ಯಾಂಕ್‌ಗೆ ಬರೆಯಿರಿ',
  'fees.claim.raiseAgain': 'ಪತ್ರ ನೋಡಿ',
  'fees.claim.ombudsman': 'RBI ಒಂಬುಡ್ಸ್‌ಮನ್ ಬಳಿಗೆ ಕೊಂಡೊಯ್ಯಿರಿ',
  'fees.claim.replied': 'ಬ್ಯಾಂಕ್ ಉತ್ತರಿಸಿತು',
  'fees.claim.replied.title': 'ಬ್ಯಾಂಕ್ ಯಾವಾಗ ಉತ್ತರಿಸಿತು?',
  'fees.claim.replied.description':
    'ಈ ದಿನ ಮತ್ತು ಬ್ಯಾಂಕ್‌ನ 30 ದಿನಗಳು ಮುಗಿದ ದಿನ — ಇವೆರಡರಲ್ಲಿ ಯಾವುದು ನಂತರವೋ, ಅಲ್ಲಿಂದ 90 ದಿನಗಳವರೆಗೆ RBI ಒಂಬುಡ್ಸ್‌ಮನ್ ದೂರು ಸ್ವೀಕರಿಸುತ್ತಾರೆ.',
  'fees.claim.replied.toast': 'ಬರೆದಿಟ್ಟಿದ್ದೇವೆ: ಬ್ಯಾಂಕ್ {date} ರಂದು ಉತ್ತರಿಸಿತು',
  'fees.claim.back': 'ವಾಪಸ್ ಬಂತು',
  'fees.claim.back.title': 'ಎಷ್ಟು ವಾಪಸ್ ಬಂತು?',
  'fees.claim.back.amount': 'ವಾಪಸ್ ಹಾಕಿದ ಮೊತ್ತ',
  // A date field's label (also the date line in the RBI Ombudsman's form fields).
  'fees.claim.back.date': 'ದಿನಾಂಕ',
  'fees.claim.back.toast': 'ನಿಮ್ಮ ಬ್ಯಾಂಕ್‌ನಿಂದ {amount} ವಾಪಸ್ ಬಂತು. ಒಳ್ಳೆಯದಾಯಿತು.',
  'fees.claim.drop': 'ಈ ಕ್ಲೇಮ್ ಕೈಬಿಡಿ',
  'fees.claim.dropped': 'ಕ್ಲೇಮ್ ಕೈಬಿಡಲಾಗಿದೆ',

  // The letter sheet.
  'fees.sheet.bank.title': '{bank} ಗೆ ಬರೆಯಿರಿ',
  'fees.sheet.bank.titleAny': 'ನಿಮ್ಮ ಬ್ಯಾಂಕ್‌ಗೆ ಬರೆಯಿರಿ',
  'fees.sheet.bank.leadSent':
    'ನೀವು ಇದನ್ನು {date} ರಂದು ಕಳುಹಿಸಿದ್ದೀರಿ. ನೆನಪಿಸಲು ಮತ್ತೆ ಕಳುಹಿಸಿ, ಅಥವಾ ಬ್ಯಾಂಕ್‌ನ 30 ದಿನಗಳು ಮುಗಿದ ನಂತರ RBI ಒಂಬುಡ್ಸ್‌ಮನ್ ಬಳಿಗೆ ಕೊಂಡೊಯ್ಯಿರಿ.',
  'fees.sheet.bank.lead': 'ನಿಮ್ಮ ಬ್ಯಾಂಕ್ 30 ದಿನಗಳೊಳಗೆ ಉತ್ತರಿಸಬೇಕು. ಬ್ಯಾಂಕ್‌ಗೆ ಅವಕಾಶ ಸಿಕ್ಕ ನಂತರವೇ RBI ಒಂಬುಡ್ಸ್‌ಮನ್ ದೂರು ಸ್ವೀಕರಿಸುತ್ತಾರೆ, ಹಾಗಾಗಿ ಮೊದಲು ಇದು.',
  // The bank's page name as banks write it.
  'fees.sheet.bank.step1': 'ನಿಮ್ಮ ಬ್ಯಾಂಕ್‌ನ ದೂರು ಇಮೇಲ್ ವಿಳಾಸಕ್ಕೆ (ಅದರ “Grievance Redressal” ಪುಟದಲ್ಲಿರುತ್ತದೆ) ಇಮೇಲ್ ಮಾಡಿ, ಅಥವಾ ನೆಟ್ ಬ್ಯಾಂಕಿಂಗ್‌ನ ದೂರು ಫಾರ್ಮ್ ಬಳಸಿ.',
  'fees.sheet.bank.step2': 'ಅಥವಾ ಪ್ರಿಂಟ್ ಮಾಡಿ ನಿಮ್ಮ ಶಾಖೆಯಲ್ಲಿ ಕೊಡಿ: ನಿಮ್ಮ ಪ್ರತಿಯ ಮೇಲೆ ದಿನಾಂಕದೊಂದಿಗೆ ಸೀಲ್ ಹಾಕಿಕೊಡಲು ಕೇಳಿ.',
  'fees.sheet.bank.step3': 'ದೂರು ಸಂಖ್ಯೆ ಸಿಕ್ಕಿತೇ? “ಕಳುಹಿಸಿದ್ದೇನೆ” ಒತ್ತಿ ಅದನ್ನು ಉಳಿಸಿ: ಮುಂದೆ RBI ಒಂಬುಡ್ಸ್‌ಮನ್ ದೂರಿನಲ್ಲಿ ಅದು ಬೇಕಾಗುತ್ತದೆ.',
  'fees.sheet.summary':
    'ಇದು {bank} ಗೆ {amount} ವಾಪಸ್ ಹಾಕಲು ಕೇಳುತ್ತದೆ: {count, plural, one {# ಶುಲ್ಕ} other {# ಶುಲ್ಕಗಳು}}, ಪ್ರತಿಯೊಂದರ ಜೊತೆಗೆ ಅದು ಉಲ್ಲಂಘಿಸುವ RBI ನಿಯಮ.',
  'fees.sheet.summaryAny':
    'ಇದು ನಿಮ್ಮ ಬ್ಯಾಂಕ್‌ಗೆ {amount} ವಾಪಸ್ ಹಾಕಲು ಕೇಳುತ್ತದೆ: {count, plural, one {# ಶುಲ್ಕ} other {# ಶುಲ್ಕಗಳು}}, ಪ್ರತಿಯೊಂದರ ಜೊತೆಗೆ ಅದು ಉಲ್ಲಂಘಿಸುವ RBI ನಿಯಮ.',
  'fees.sheet.english': 'ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿದೆ, ಬ್ಯಾಂಕ್‌ಗಳು ನಿರೀಕ್ಷಿಸುವಂತೆ.',
  'fees.sheet.ombudsman.summary':
    'ಇದು {bank} ನಿಂದ {amount} ವಾಪಸ್ ಹಾಕಿಸಲು RBI ಒಂಬುಡ್ಸ್‌ಮನ್ ಅವರನ್ನು ಕೇಳುತ್ತದೆ: {count, plural, one {# ಶುಲ್ಕ} other {# ಶುಲ್ಕಗಳು}}, ಪ್ರತಿಯೊಂದರ ಜೊತೆಗೆ ಅದು ಉಲ್ಲಂಘಿಸುವ RBI ನಿಯಮ.',
  'fees.sheet.ombudsman.summaryAny':
    'ಇದು ನಿಮ್ಮ ಬ್ಯಾಂಕ್‌ನಿಂದ {amount} ವಾಪಸ್ ಹಾಕಿಸಲು RBI ಒಂಬುಡ್ಸ್‌ಮನ್ ಅವರನ್ನು ಕೇಳುತ್ತದೆ: {count, plural, one {# ಶುಲ್ಕ} other {# ಶುಲ್ಕಗಳು}}, ಪ್ರತಿಯೊಂದರ ಜೊತೆಗೆ ಅದು ಉಲ್ಲಂಘಿಸುವ RBI ನಿಯಮ.',
  'fees.sheet.englishRbi': 'ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿದೆ, RBI ಯ ದೂರು ಫಾರ್ಮ್ ನಿರೀಕ್ಷಿಸುವಂತೆ.',
  'fees.sheet.sent': 'ಕಳುಹಿಸಿದ್ದೇನೆ',
  'fees.sheet.sent.title': 'ಯಾವಾಗ ಕಳುಹಿಸಿದಿರಿ?',
  'fees.sheet.sent.description': 'ಬ್ಯಾಂಕ್‌ನ 30 ದಿನಗಳನ್ನು Settle ಈ ದಿನದಿಂದ ಎಣಿಸುತ್ತದೆ.',
  'fees.sheet.sent.date': 'ಕಳುಹಿಸಿದ ದಿನ',
  'fees.sheet.sent.ref': 'ದೂರು ಸಂಖ್ಯೆ',
  'fees.sheet.sent.toast': 'ಬರೆದಿಟ್ಟಿದ್ದೇವೆ. ಬ್ಯಾಂಕ್‌ನ 30 ದಿನಗಳು ಮುಗಿದಾಗ Settle ತಿಳಿಸುತ್ತದೆ.',
  'fees.sheet.ombudsman.title': 'RBI ಒಂಬುಡ್ಸ್‌ಮನ್ ಬಳಿಗೆ ಕೊಂಡೊಯ್ಯಿರಿ',
  'fees.sheet.ombudsman.lead': 'ಉಚಿತ, ಆನ್‌ಲೈನ್. ಪ್ರತಿ ವಿವರವನ್ನು cms.rbi.org.in ನ ಫಾರ್ಮ್‌ಗೆ ನಕಲಿಸಿ, ಮತ್ತು ದೂರನ್ನು ವಿವರಗಳ ಜಾಗದಲ್ಲಿ ಅಂಟಿಸಿ.',
  'fees.sheet.ombudsman.open': 'cms.rbi.org.in ತೆರೆಯಿರಿ',
  'fees.sheet.ombudsman.call': 'RBI ಗೆ ಕರೆ ಮಾಡಿ: 14448',
  'fees.sheet.ombudsman.sent.description': 'cms.rbi.org.in ನಲ್ಲಿ ದೂರು ಸಲ್ಲಿಸಿದ ದಿನ. RBI ನೀಡುವ ದೂರು ಸಂಖ್ಯೆಯನ್ನೂ ಉಳಿಸಿ: Settle ಅದನ್ನು ಕ್ಲೇಮ್‌ನಲ್ಲಿ ತೋರಿಸುತ್ತದೆ.',
  'fees.sheet.ombudsman.sent.toast': 'ಬರೆದಿಟ್ಟಿದ್ದೇವೆ. ಈಗ ಇದು RBI ಒಂಬುಡ್ಸ್‌ಮನ್ ಬಳಿ ಇದೆ.',

  // Allowed, but avoidable.
  'fees.avoid.minbal':
    'ಕನಿಷ್ಠ ಬ್ಯಾಲೆನ್ಸ್‌ಗಾಗಿ {amount} ಹೋಗಿದೆ. ಬೇಸಿಕ್ ಸೇವಿಂಗ್ಸ್ (BSBD) ಖಾತೆಗೆ ಕನಿಷ್ಠ ಬ್ಯಾಲೆನ್ಸ್ ಇಲ್ಲವೇ ಇಲ್ಲ, ಮತ್ತು ನೀವು ಕೇಳಿದ 7 ದಿನಗಳೊಳಗೆ ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ಖಾತೆಯನ್ನು ಬದಲಿಸಿಕೊಡಬೇಕು.',
  'fees.avoid.minbal.cta': 'ಬೇಸಿಕ್ ಸೇವಿಂಗ್ಸ್‌ಗೆ ಬದಲಿಸಲು ಕೇಳಿ',
  'fees.avoid.atm': 'ATM ಶುಲ್ಕಗಳಿಗೆ {amount} ಹೋಗಿದೆ. ನಿಮ್ಮದೇ ಬ್ಯಾಂಕ್‌ನ ATM ಗಳಲ್ಲಿ ತಿಂಗಳಿಗೆ 5 ಉಚಿತ; ದೊಡ್ಡ ನಗರಗಳಲ್ಲಿ ಬೇರೆ ಬ್ಯಾಂಕ್‌ಗಳ ATM ಗಳಲ್ಲಿ 3 ಮಾತ್ರ.',
  'fees.avoid.sms': 'SMS ಅಲರ್ಟ್‌ಗಳಿಗೆ {amount} ಹೋಗಿದೆ. ಯಾವ ಅಲರ್ಟ್‌ಗಳನ್ನು ನಿಲ್ಲಿಸಬಹುದು ಎಂದು ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ಅನ್ನು ಕೇಳಿ: ನಿಜವಾಗಿ ಕಳುಹಿಸಿದವುಗಳಿಗೆ ಮಾತ್ರ ಅದು ಶುಲ್ಕ ವಿಧಿಸಬಹುದು.',
  'fees.avoid.imps': 'IMPS ಗೆ {amount} ಹೋಗಿದೆ. UPI, ಮತ್ತು ಆನ್‌ಲೈನ್‌ನಲ್ಲಿ ಕಳುಹಿಸುವ NEFT ಉಚಿತ.',
  'fees.avoid.card': 'ಡೆಬಿಟ್ ಕಾರ್ಡ್ ಶುಲ್ಕಕ್ಕೆ {amount} ಹೋಗಿದೆ. ಬೇಸಿಕ್ ಸೇವಿಂಗ್ಸ್ ಖಾತೆಯ ಕಾರ್ಡ್‌ಗೆ ವಾರ್ಷಿಕ ಶುಲ್ಕ ಇಲ್ಲ.',
  'fees.avoid.bounce': 'ಬೌನ್ಸ್ ಆದ ಪಾವತಿಗಳಿಗೆ {amount} ಹೋಗಿದೆ. EMI ಅಥವಾ ಆಟೋಪೇ ದಿನಾಂಕಕ್ಕೆ ಒಂದು ದಿನ ಮೊದಲೇ ಖಾತೆಯಲ್ಲಿ ಹಣ ಇಟ್ಟುಕೊಳ್ಳಿ.',
  'fees.avoid.atmDecline': 'ATM ನಿರಾಕರಣೆಗಳಿಗೆ {amount} ಹೋಗಿದೆ. ಹಣ ತೆಗೆಯುವ ಮೊದಲು ಬ್ಯಾಲೆನ್ಸ್ ನೋಡಿಕೊಳ್ಳಿ.',
  'fees.avoid.other': 'ಇತರ ಶುಲ್ಕಗಳಿಗೆ {amount} ಹೋಗಿದೆ.',
  'fees.basic.title': 'ಬೇಸಿಕ್ ಸೇವಿಂಗ್ಸ್‌ಗೆ ಬದಲಿಸಿ',
  'fees.basic.lead': 'ಕನಿಷ್ಠ ಬ್ಯಾಲೆನ್ಸ್ ಇಲ್ಲ, ಉಚಿತ ಡೆಬಿಟ್ ಕಾರ್ಡ್, ಮತ್ತು ತಿಂಗಳಿಗೆ 4 ಉಚಿತ ವಿತ್‌ಡ್ರಾ. ನೀವು ಕೇಳಿದ 7 ದಿನಗಳೊಳಗೆ ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ನಿಮ್ಮ ಖಾತೆಯನ್ನು ಬದಲಿಸಿಕೊಡಬೇಕು.',

  // An ATM refund that came back late: owed under the RBI's 5 days and ₹100 a day (Stuck money claims it).
  'fees.late.title': 'ATM ಹಣ ತಡವಾಗಿ ವಾಪಸ್ ಬಂದದ್ದಕ್ಕೆ ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ನಿಮಗೆ {comp} ಕೊಡಬೇಕು',
  'fees.late.text':
    '{date} ರಂದು ATM ಕೊಡದ {amount}, {backOn} ರಂದು ವಾಪಸ್ ಬಂತು — RBI ಯ 5 ದಿನಗಳ ಗಡುವಿಗಿಂತ {days, plural, one {# ದಿನ} other {# ದಿನ}} ತಡವಾಗಿ. ತಡವಾದ ಪ್ರತಿ ದಿನಕ್ಕೆ ಬ್ಯಾಂಕ್ ₹100 ಕೊಡಬೇಕು.',
  'fees.late.cta': 'ಸಿಲುಕಿದ ಹಣ ವಿಭಾಗದಲ್ಲಿ ಕೇಳಿ ಪಡೆಯಿರಿ',
  'fees.late.added': 'ಸಿಲುಕಿದ ಹಣ ವಿಭಾಗಕ್ಕೆ ಸೇರಿಸಲಾಗಿದೆ',
  'fees.late.open': 'ಸಿಲುಕಿದ ಹಣ ವಿಭಾಗದಲ್ಲಿ ತೆರೆಯಿರಿ',

  // Pasting SMS. The placeholder stays an English bank SMS, as banks send them.
  'fees.paste.title': 'ನಿಮ್ಮ ಬ್ಯಾಂಕ್‌ನ SMS ಅಂಟಿಸಿ',
  'fees.paste.text': 'ಶುಲ್ಕಗಳ ಬಗ್ಗೆ ಒಂದು ಅಥವಾ ಹಲವು ಸಂದೇಶಗಳು: Settle ಪ್ರತಿಯೊಂದನ್ನೂ ಪ್ರತ್ಯೇಕವಾಗಿ ಗುರುತಿಸುತ್ತದೆ.',
  'fees.paste.label': 'ಬ್ಯಾಂಕ್ SMS',
  'fees.paste.placeholder': 'Rs.590 debited from A/c XX4821 towards non-maintenance of AMB charges…',
  'fees.paste.check': 'ಪರಿಶೀಲಿಸಿ',
  'fees.paste.fromClipboard': 'ನಕಲಿಸಿದ್ದನ್ನು ಅಂಟಿಸಿ',
  'fees.paste.none': 'ಆ ಪಠ್ಯದಲ್ಲಿ ಯಾವುದೇ ಬ್ಯಾಂಕ್ ಶುಲ್ಕ ಇಲ್ಲ.',
  'fees.paste.known': 'ಈಗಾಗಲೇ ಬ್ಯಾಂಕ್ ಶುಲ್ಕಗಳು ವಿಭಾಗದಲ್ಲಿದೆ: ಹೊಸದೇನೂ ಇಲ್ಲ',
  'fees.paste.found':
    '{count, plural, one {# ಶುಲ್ಕ ಸೇರಿಸಲಾಗಿದೆ} other {# ಶುಲ್ಕಗಳನ್ನು ಸೇರಿಸಲಾಗಿದೆ}}{back, plural, =0 {} one {, # ವಾಪಸ್ ಹಾಕಲಾಗಿದೆ} other {, # ವಾಪಸ್ ಹಾಕಲಾಗಿದೆ}}',

  // Home.
  'fees.home.owed': 'ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ನಿಮಗೆ {amount} ಕೊಡಬೇಕು',
  'fees.home.owedLine': '{count, plural, one {# ಶುಲ್ಕ RBI ನಿಯಮಗಳಿಗೆ ವಿರುದ್ಧ} other {# ಶುಲ್ಕಗಳು RBI ನಿಯಮಗಳಿಗೆ ವಿರುದ್ಧ}}: ವಾಪಸ್ ಕೇಳಿ',
  'fees.home.ask': '{count, plural, one {# ಬ್ಯಾಂಕ್ ಶುಲ್ಕಕ್ಕೆ ಒಂದು ಉತ್ತರ ಬೇಕು} other {# ಬ್ಯಾಂಕ್ ಶುಲ್ಕಗಳಿಗೆ ತಲಾ ಒಂದು ಉತ್ತರ ಬೇಕು}}',
  'fees.home.askLine': 'ಅದನ್ನು ವಾಪಸ್ ಕೇಳಬಹುದೇ ಎಂದು Settle ಹೇಳಬಲ್ಲದು',
  'fees.home.raised': 'ನಿಮ್ಮ ಬ್ಯಾಂಕ್‌ನ ಉತ್ತರಕ್ಕೆ ಕಾಯಲಾಗುತ್ತಿದೆ: {amount}',

  'fees.you.none': 'ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ವಿಧಿಸಬಾರದಿದ್ದ ಶುಲ್ಕಗಳಿಗಾಗಿ ನಿಮ್ಮ ಸ್ಟೇಟ್‌ಮೆಂಟ್ ಪರಿಶೀಲಿಸಿ',

  // Android: a charge SMS just read ({kind}: a fees.kind.* above, lower-cased).
  'fees.alert.wrong': '{bank} RBI ನಿಯಮಗಳಿಗೆ ವಿರುದ್ಧವಾಗಿ {amount} ({kind}) ಕಡಿತ ಮಾಡಿದೆ',
  'fees.home.ombudsmanDue': 'RBI ಒಂಬುಡ್ಸ್‌ಮನ್ ಬಳಿಗೆ ಕೊಂಡೊಯ್ಯಿರಿ: {amount}',
  'fees.home.ombudsmanRaised': 'RBI ಒಂಬುಡ್ಸ್‌ಮನ್ ಬಳಿ: {amount}',
  'fees.alert.wrongAny': 'ನಿಮ್ಮ ಬ್ಯಾಂಕ್ RBI ನಿಯಮಗಳಿಗೆ ವಿರುದ್ಧವಾಗಿ {amount} ({kind}) ಕಡಿತ ಮಾಡಿದೆ',
  'fees.alert.check': '{bank} {amount} ({kind}) ಕಡಿತ ಮಾಡಿದೆ: ವಾಪಸ್ ಕೇಳಬಹುದೇ ಎಂದು ಒಂದು ಪ್ರಶ್ನೆಯಿಂದ ತಿಳಿಯುತ್ತದೆ',
  'fees.alert.checkAny': 'ನಿಮ್ಮ ಬ್ಯಾಂಕ್ {amount} ({kind}) ಕಡಿತ ಮಾಡಿದೆ: ವಾಪಸ್ ಕೇಳಬಹುದೇ ಎಂದು ಒಂದು ಪ್ರಶ್ನೆಯಿಂದ ತಿಳಿಯುತ್ತದೆ',
  'fees.alert.back': 'ಬ್ಯಾಂಕ್ ಶುಲ್ಕದ {amount} ವಾಪಸ್ ಹಾಕಲಾಗಿದೆ',
  'fees.alert.many': '{count, plural, one {# ಬ್ಯಾಂಕ್ ಶುಲ್ಕವನ್ನು ಪರಿಶೀಲಿಸಲಾಗಿದೆ} other {# ಬ್ಯಾಂಕ್ ಶುಲ್ಕಗಳನ್ನು ಪರಿಶೀಲಿಸಲಾಗಿದೆ}}: ಬ್ಯಾಂಕ್ ಶುಲ್ಕಗಳು ವಿಭಾಗದಲ್ಲಿ ನೋಡಿ',

  // From Stuck money.
  'fees.fromStuck.title': 'ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ತಪ್ಪಾಗಿ ಶುಲ್ಕ ಕಡಿತ ಮಾಡಿದೆಯೇ?',
  'fees.fromStuck.text': 'RBI ನಿಯಮಗಳು ಅನುಮತಿಸದ ಶುಲ್ಕಗಳಿಗಾಗಿ Settle ನಿಮ್ಮ ಸ್ಟೇಟ್‌ಮೆಂಟ್ ಪರಿಶೀಲಿಸುತ್ತದೆ.',

  // Clearing it all.
  'fees.clear': 'ಬ್ಯಾಂಕ್ ಶುಲ್ಕಗಳು ವಿಭಾಗದ ಮಾಹಿತಿ ಅಳಿಸಿ',
  'fees.clear.confirm': 'ಬ್ಯಾಂಕ್ ಶುಲ್ಕಗಳು ವಿಭಾಗ ಈ ಫೋನ್‌ನಲ್ಲಿ ಇಟ್ಟುಕೊಂಡಿರುವ ಎಲ್ಲ ಶುಲ್ಕಗಳು ಮತ್ತು ಕ್ಲೇಮ್‌ಗಳನ್ನು ಅಳಿಸಬೇಕೇ?',
  'fees.cleared': 'ಅಳಿಸಲಾಗಿದೆ',
} as const satisfies Messages
