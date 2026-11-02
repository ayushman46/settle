/** Kannada copy for raising a stuck payment (src/features/stuck/RaiseSheet.tsx): where to complain, the letter, and noting it was sent. */
import type { Messages } from '../types'

export const stuckhelp: Messages = {
  // The sheet's title, per rung — the same words as the button that opens it ({amount} is pre-formatted: "₹300"; {name} a business or a wallet: "Swiggy", "Paytm").
  'stuckhelp.title.bank': 'ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ಬಳಿ ದೂರು ನೀಡಿ',
  'stuckhelp.title.wallet': '{name} ಬಳಿ ದೂರು ನೀಡಿ',
  'stuckhelp.title.walletAny': 'ವಾಲೆಟ್ ಕಂಪನಿಯ ಬಳಿ ದೂರು ನೀಡಿ',
  'stuckhelp.title.compensation': '{amount} ಪರಿಹಾರ ಕೇಳಿ',
  'stuckhelp.title.compensationAny': 'ಪರಿಹಾರ ಕೇಳಿ',
  'stuckhelp.title.ombudsman': 'RBI ಒಂಬುಡ್ಸ್‌ಮನ್ ಬಳಿಗೆ ಕೊಂಡೊಯ್ಯಿರಿ',
  'stuckhelp.title.merchant': '{name} ಬಳಿ ದೂರು ನೀಡಿ',
  'stuckhelp.title.merchantAny': 'ಆ ಕಂಪನಿಯ ಬಳಿ ದೂರು ನೀಡಿ',
  'stuckhelp.title.nch': 'ರಾಷ್ಟ್ರೀಯ ಗ್ರಾಹಕ ಸಹಾಯವಾಣಿ ಬಳಿಗೆ ಕೊಂಡೊಯ್ಯಿರಿ',
  'stuckhelp.title.airsewa': 'AirSewa ಬಳಿಗೆ ಕೊಂಡೊಯ್ಯಿರಿ',
  'stuckhelp.title.commission': 'ಗ್ರಾಹಕ ಆಯೋಗಕ್ಕೆ ಕೊಂಡೊಯ್ಯಿರಿ',

  // One line under the title: what this rung is.
  'stuckhelp.lead.bank': 'RBI ನಿಯಮಗಳ ಪ್ರಕಾರ ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ಹಣ ವಾಪಸ್ ಹಾಕಬೇಕು, ಮತ್ತು ತಡವಾದ ಪ್ರತಿ ದಿನಕ್ಕೆ ₹100 ಕೊಡಬೇಕು.',
  'stuckhelp.lead.wallet': 'RBI ನಿಯಮಗಳ ಪ್ರಕಾರ ವಾಲೆಟ್ ಕಂಪನಿ ಮರುದಿನದೊಳಗೆ ಹಣ ವಾಪಸ್ ಹಾಕಬೇಕು, ಮತ್ತು ತಡವಾದ ಪ್ರತಿ ದಿನಕ್ಕೆ ₹100 ಕೊಡಬೇಕು.',
  'stuckhelp.lead.compensation': 'RBI ನಿಯಮಗಳ ಪ್ರಕಾರ ಹಣ ತಡವಾದ ಪ್ರತಿ ದಿನಕ್ಕೆ ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ₹100 ಕೊಡಬೇಕು. ಅದನ್ನು ಲಿಖಿತವಾಗಿ ಕೇಳಿ.',
  'stuckhelp.lead.compensationWallet': 'RBI ನಿಯಮಗಳ ಪ್ರಕಾರ ಹಣ ತಡವಾದ ಪ್ರತಿ ದಿನಕ್ಕೆ ವಾಲೆಟ್ ಕಂಪನಿ ₹100 ಕೊಡಬೇಕು. ಅದನ್ನು ಲಿಖಿತವಾಗಿ ಕೇಳಿ.',
  'stuckhelp.lead.ombudsman': 'ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ಸರಿಪಡಿಸದಿದ್ದಾಗ ದೂರು ನೀಡಲು RBI ಯ ಸೇವೆ.',
  'stuckhelp.lead.ombudsmanWallet': 'ವಾಲೆಟ್ ಕಂಪನಿ ಸರಿಪಡಿಸದಿದ್ದಾಗ ದೂರು ನೀಡಲು RBI ಯ ಸೇವೆ.',
  'stuckhelp.lead.merchant': 'ಮೊದಲು ಆ ಕಂಪನಿಗೇ ಲಿಖಿತವಾಗಿ, ಆರ್ಡರ್ ಸಂಖ್ಯೆಯೊಂದಿಗೆ ದೂರು ನೀಡಿ.',
  'stuckhelp.lead.nch': 'ಸರ್ಕಾರದ ಸಹಾಯವಾಣಿ ನಿಮ್ಮ ಪರವಾಗಿ ನಿಮ್ಮ ದೂರನ್ನು ಆ ಕಂಪನಿಗೆ ತಲುಪಿಸುತ್ತದೆ.',
  'stuckhelp.lead.airsewa': 'ಏರ್‌ಲೈನ್‌ಗಳ ಬಗ್ಗೆ ದೂರು ನೀಡಲು ನಾಗರಿಕ ವಿಮಾನಯಾನ ಸಚಿವಾಲಯದ ಪೋರ್ಟಲ್.',
  'stuckhelp.lead.commission': 'ಗ್ರಾಹಕ ಆಯೋಗ (ಗ್ರಾಹಕ ನ್ಯಾಯಾಲಯ) ಪ್ರಕರಣವನ್ನು ತೀರ್ಮಾನಿಸುತ್ತದೆ. ಆನ್‌ಲೈನ್‌ನಲ್ಲಿ ದಾಖಲಿಸಬಹುದು.',

  // Your bank or UPI app, for a failed payment. App names and menu labels as each app shows them.
  'stuckhelp.bank.app.gpay':
    'Google Pay ನಲ್ಲಿ, ವಹಿವಾಟು ಇತಿಹಾಸದಿಂದ ಈ ಪಾವತಿ ತೆರೆಯಿರಿ, “Having issues” ಒತ್ತಿ, ನಂತರ “Payment issue” (ಅಥವಾ “Stuck payment”) ಆಯ್ಕೆಮಾಡಿ ಟಿಕೆಟ್ ರಚಿಸಿ.',
  'stuckhelp.bank.app.phonepe': 'PhonePe ನಲ್ಲಿ, “History” ಯಲ್ಲಿ ಈ ಪಾವತಿ ತೆರೆದು “Contact PhonePe Support” ಒತ್ತಿ.',
  'stuckhelp.bank.app.paytm':
    'Paytm ನಲ್ಲಿ, ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಒತ್ತಿ, ನಂತರ “Help & Support”. ಈ ಪಾವತಿ ಮತ್ತು ಹೊಂದುವ ಸಮಸ್ಯೆ (ಹಣ ಕಡಿತ, ವಿಫಲ ಅಥವಾ ಬಾಕಿ) ಆಯ್ಕೆಮಾಡಿ, ನಂತರ ಟಿಕೆಟ್ ಮಾಡಿ.',
  'stuckhelp.bank.app.other': '{app} ನಲ್ಲಿ, ನಿಮ್ಮ ಇತಿಹಾಸದಲ್ಲಿ ಈ ಪಾವತಿ ತೆರೆದು ಅಲ್ಲಿಂದಲೇ ದೂರು ನೀಡಿ. ಪ್ರತಿ UPI ಆ್ಯಪ್ ಇದಕ್ಕೆ ಅವಕಾಶ ಕೊಡಲೇಬೇಕು.',
  'stuckhelp.bank.app.unknown': 'ನೀವು ಪಾವತಿಸಿದ UPI ಆ್ಯಪ್‌ನಲ್ಲಿ ಈ ಪಾವತಿ ತೆರೆದು ಅಲ್ಲಿಂದಲೇ ದೂರು ನೀಡಿ. ಪ್ರತಿ UPI ಆ್ಯಪ್ ಇದಕ್ಕೆ ಅವಕಾಶ ಕೊಡಲೇಬೇಕು.',
  'stuckhelp.bank.card': 'ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ಆ್ಯಪ್ ಅಥವಾ ನೆಟ್ ಬ್ಯಾಂಕಿಂಗ್‌ನಲ್ಲಿ ಈ ಪಾವತಿಗೆ ಡಿಸ್ಪ್ಯೂಟ್ ದಾಖಲಿಸಿ, ಅಥವಾ ಕಾರ್ಡ್‌ನ ಹಿಂಭಾಗದಲ್ಲಿರುವ ಸಂಖ್ಯೆಗೆ ಕರೆ ಮಾಡಿ.',
  'stuckhelp.bank.atm': 'ATM ಬೇರೆ ಬ್ಯಾಂಕ್‌ನದ್ದಾಗಿದ್ದರೂ, ನಿಮ್ಮ ಕಾರ್ಡ್ ಕೊಟ್ಟ ಬ್ಯಾಂಕ್‌ಗೇ ದೂರು ನೀಡಿ: ಅದರ ಆ್ಯಪ್‌ನಲ್ಲಿ, ಕಸ್ಟಮರ್ ಕೇರ್‌ಗೆ ಅಥವಾ ಶಾಖೆಯಲ್ಲಿ.',
  'stuckhelp.bank.wallet': 'ವಾಲೆಟ್‌ನ ಆ್ಯಪ್‌ನಲ್ಲಿ ಈ ಪಾವತಿ ತೆರೆದು, ಅದರ ಸಹಾಯ ವಿಭಾಗದಿಂದ ದೂರು ನೀಡಿ.',
  'stuckhelp.bank.direct': 'ನಿಮ್ಮ ಬ್ಯಾಂಕ್‌ಗೆ ದೂರು ನೀಡಿ: ಕಸ್ಟಮರ್ ಕೇರ್, ನೆಟ್ ಬ್ಯಾಂಕಿಂಗ್‌ನ ದೂರು ಫಾರ್ಮ್, ಅಥವಾ ಶಾಖೆ.',
  'stuckhelp.bank.letter':
    'ಕೆಳಗಿನ ಪತ್ರವನ್ನೂ ನಿಮ್ಮ ಬ್ಯಾಂಕ್‌ಗೆ ಕಳುಹಿಸಿ — ಇಮೇಲ್, ನೆಟ್ ಬ್ಯಾಂಕಿಂಗ್ ಅಥವಾ ಶಾಖೆಯ ಮೂಲಕ. ಹಣ ವಾಪಸ್ ಹಾಕುವುದು ಮತ್ತು ದಿನಕ್ಕೆ ₹100 ಕೊಡುವುದು ಬ್ಯಾಂಕ್‌ನ ಜವಾಬ್ದಾರಿ.',
  'stuckhelp.bank.myupi':
    'ಆ್ಯಪ್‌ನಿಂದ ಉತ್ತರ ಬಂದಿಲ್ಲವೇ? ಪಾವತಿಯಾದ 45 ದಿನಗಳೊಳಗೆ UPI ಸಹಾಯ ವೆಬ್‌ಸೈಟ್‌ನಲ್ಲಿ ದೂರು ನೀಡಿ (upihelp.npci.org.in; ಇದು UPI ಯ ಹಿಂದಿರುವ ಕಂಪನಿ NPCI ಯದು). ನಿಮ್ಮ SMS ನಲ್ಲಿರುವ 12-ಅಂಕಿಯ ಸಂಖ್ಯೆಯನ್ನು ಸಿದ್ಧವಿಟ್ಟುಕೊಳ್ಳಿ.',
  'stuckhelp.bank.myupiPassed':
    'UPI ಸಹಾಯ ವೆಬ್‌ಸೈಟ್ ಪಾವತಿಯಾದ 45 ದಿನಗಳೊಳಗಿನ ದೂರುಗಳನ್ನು ಮಾತ್ರ ಸ್ವೀಕರಿಸುತ್ತದೆ, ಆ ಸಮಯ ಮುಗಿದಿದೆ. ಬದಲಿಗೆ ನಿಮ್ಮ ಬ್ಯಾಂಕ್‌ಗೆ ಪತ್ರ ಕಳುಹಿಸಿ.',
  'stuckhelp.bank.note': 'ದೂರು ಸಂಖ್ಯೆ ಸಿಕ್ಕಿತೇ? “ದೂರು ನೀಡಿದ್ದೇನೆ” ಒತ್ತಿ ಅದನ್ನು ಉಳಿಸಿ. 30 ದಿನಗಳಲ್ಲಿ ಸರಿಯಾಗದಿದ್ದರೆ, ಮುಂದಿನದು RBI ಒಂಬುಡ್ಸ್‌ಮನ್.',
  // Once it's raised ({date}: "2 Nov"; {ref}: the complaint number, or "none").
  'stuckhelp.bank.raised':
    '{date} ರಂದು ದೂರು ನೀಡಿದ್ದೀರಿ{ref, select, none {} other { (ಸಂಖ್ಯೆ {ref})}}. ಅಂದಿನಿಂದ 30 ದಿನಗಳೊಳಗೆ ಸರಿಯಾಗದಿದ್ದರೆ, ಮುಂದಿನ ಹಂತ: RBI ಒಂಬುಡ್ಸ್‌ಮನ್.',

  // A wallet payment ({name}: "Paytm").
  'stuckhelp.wallet.app': '{name} ನಲ್ಲಿ ಈ ಪಾವತಿ ತೆರೆದು, ಅದರ ಸಹಾಯ ವಿಭಾಗದಿಂದ ದೂರು ನೀಡಿ.',
  'stuckhelp.wallet.letter':
    'ಆ್ಯಪ್‌ನಲ್ಲಿ ಸರಿಯಾಗಲಿಲ್ಲವೇ? ಕೆಳಗಿನ ಪತ್ರವನ್ನು ವಾಲೆಟ್ ಕಂಪನಿಯ ದೂರು ನಿವಾರಣಾ ಅಧಿಕಾರಿಗೆ ಕಳುಹಿಸಿ; ಸಂಪರ್ಕ ವಿವರ ಆ್ಯಪ್‌ನ ಸಹಾಯ ವಿಭಾಗದಲ್ಲಿ ಅಥವಾ ಅದರ ದೂರು ನಿವಾರಣಾ ನೀತಿಯಲ್ಲಿ ಇರುತ್ತದೆ. ಹಣ ವಾಪಸ್ ಹಾಕುವುದು ಮತ್ತು ದಿನಕ್ಕೆ ₹100 ಕೊಡುವುದು ವಾಲೆಟ್ ಕಂಪನಿಯ ಜವಾಬ್ದಾರಿ.',

  // The money came back late: the compensation claim.
  'stuckhelp.compensation.send': 'ಕೆಳಗಿನ ಪತ್ರವನ್ನು ನಿಮ್ಮ ಬ್ಯಾಂಕ್‌ಗೆ ಕಳುಹಿಸಿ: ಕಸ್ಟಮರ್ ಕೇರ್‌ಗೆ ಇಮೇಲ್, ನೆಟ್ ಬ್ಯಾಂಕಿಂಗ್‌ನ ದೂರು ಫಾರ್ಮ್, ಅಥವಾ ಶಾಖೆಯಲ್ಲಿ.',
  'stuckhelp.compensation.sendWallet': 'ಕೆಳಗಿನ ಪತ್ರವನ್ನು ವಾಲೆಟ್ ಕಂಪನಿಯ ದೂರು ನಿವಾರಣಾ ಅಧಿಕಾರಿಗೆ ಕಳುಹಿಸಿ: ಇಮೇಲ್ ಮೂಲಕ, ಅಥವಾ ಅದರ ಆ್ಯಪ್‌ನ ಸಹಾಯ ವಿಭಾಗದಿಂದ.',
  'stuckhelp.compensation.why': 'RBI ನಿಯಮಗಳ ಪ್ರಕಾರ ಇದನ್ನು ಕೇಳದೆಯೇ ಕೊಡಬೇಕು. ಈ ಪತ್ರ ದಿನಗಳ ಲೆಕ್ಕದೊಂದಿಗೆ ಲಿಖಿತವಾಗಿ ಕೇಳುತ್ತದೆ.',

  // The RBI Ombudsman ({phone}: 14448; {issuer}: "Paytm Payments Bank Ltd").
  'stuckhelp.ombudsman.when':
    'ಬ್ಯಾಂಕ್‌ಗೆ ದೂರು ನೀಡಿ 30 ದಿನಗಳು ಕಳೆದ ನಂತರ ದಾಖಲಿಸಬಹುದು (ಬ್ಯಾಂಕ್ ಉತ್ತರಿಸಿ ನಿಮಗೆ ತೃಪ್ತಿ ಇಲ್ಲದಿದ್ದರೆ ಅದಕ್ಕಿಂತ ಮೊದಲೇ), ಮತ್ತು ಅದರ ನಂತರ 90 ದಿನಗಳೊಳಗೆ.',
  'stuckhelp.ombudsman.whenWallet':
    'ವಾಲೆಟ್ ಕಂಪನಿಗೆ ದೂರು ನೀಡಿ 30 ದಿನಗಳು ಕಳೆದ ನಂತರ ದಾಖಲಿಸಬಹುದು (ಕಂಪನಿ ಉತ್ತರಿಸಿ ನಿಮಗೆ ತೃಪ್ತಿ ಇಲ್ಲದಿದ್ದರೆ ಅದಕ್ಕಿಂತ ಮೊದಲೇ), ಮತ್ತು ಅದರ ನಂತರ 90 ದಿನಗಳೊಳಗೆ.',
  'stuckhelp.ombudsman.file': 'cms.rbi.org.in ನಲ್ಲಿ ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ವಿರುದ್ಧ ದೂರು ದಾಖಲಿಸಿ. ಫಾರ್ಮ್‌ಗೆ ಬೇಕಾದ ವಿವರಗಳು ಕೆಳಗಿವೆ.',
  'stuckhelp.ombudsman.fileWallet': 'cms.rbi.org.in ನಲ್ಲಿ, ವಾಲೆಟ್ ನಡೆಸುವ ಕಂಪನಿಯಾದ {issuer} ವಿರುದ್ಧ ದೂರು ದಾಖಲಿಸಿ. ಫಾರ್ಮ್‌ಗೆ ಬೇಕಾದ ವಿವರಗಳು ಕೆಳಗಿವೆ.',
  'stuckhelp.ombudsman.fileWalletAny': 'cms.rbi.org.in ನಲ್ಲಿ, ವಾಲೆಟ್ ನಡೆಸುವ ಕಂಪನಿಯ ವಿರುದ್ಧ ದೂರು ದಾಖಲಿಸಿ. ಫಾರ್ಮ್‌ಗೆ ಬೇಕಾದ ವಿವರಗಳು ಕೆಳಗಿವೆ.',
  'stuckhelp.ombudsman.paste':
    'ದೂರಿನ ವಿವರಗಳ ಜಾಗದಲ್ಲಿ ಪತ್ರವನ್ನು ಅಂಟಿಸಿ. ಬ್ಯಾಂಕ್‌ಗೆ ನೀಡಿದ ದೂರು, ಅದರ ಉತ್ತರ (ಇದ್ದರೆ), ಮತ್ತು ಕಡಿತ ತೋರಿಸುವ ಸ್ಟೇಟ್‌ಮೆಂಟ್ ಲಗತ್ತಿಸಿ.',
  'stuckhelp.ombudsman.pasteWallet':
    'ದೂರಿನ ವಿವರಗಳ ಜಾಗದಲ್ಲಿ ಪತ್ರವನ್ನು ಅಂಟಿಸಿ. ವಾಲೆಟ್ ಕಂಪನಿಗೆ ನೀಡಿದ ದೂರು, ಅದರ ಉತ್ತರ (ಇದ್ದರೆ), ಮತ್ತು ಕಡಿತ ತೋರಿಸುವ ವಾಲೆಟ್ ಸ್ಟೇಟ್‌ಮೆಂಟ್ ಲಗತ್ತಿಸಿ.',
  'stuckhelp.ombudsman.call': 'ಪ್ರಶ್ನೆಗಳಿವೆಯೇ? {phone} ಗೆ ಕರೆ ಮಾಡಿ: ಸೋಮವಾರದಿಂದ ಶನಿವಾರ, ಬೆಳಿಗ್ಗೆ 8 ರಿಂದ ರಾತ್ರಿ 10 ರವರೆಗೆ ಉತ್ತರಿಸುತ್ತಾರೆ. ಅವರು ಮಾರ್ಗದರ್ಶನ ಮಾಡುತ್ತಾರೆ, ಆದರೆ ದೂರು ಸ್ವೀಕರಿಸುವುದಿಲ್ಲ.',
  'stuckhelp.ready.heading': 'ಇವುಗಳನ್ನು ಸಿದ್ಧವಿಟ್ಟುಕೊಳ್ಳಿ',
  'stuckhelp.ready.complaint': 'ಬ್ಯಾಂಕ್‌ಗೆ ನೀಡಿದ ನಿಮ್ಮ ದೂರು ಮತ್ತು ಅದರ ಸಂಖ್ಯೆ',
  'stuckhelp.ready.complaintWallet': 'ವಾಲೆಟ್ ಕಂಪನಿಗೆ ನೀಡಿದ ನಿಮ್ಮ ದೂರು ಮತ್ತು ಅದರ ಸಂಖ್ಯೆ',
  'stuckhelp.ready.reply': 'ಬ್ಯಾಂಕ್‌ನ ಉತ್ತರ, ಬಂದಿದ್ದರೆ',
  'stuckhelp.ready.replyWallet': 'ವಾಲೆಟ್ ಕಂಪನಿಯ ಉತ್ತರ, ಬಂದಿದ್ದರೆ',
  'stuckhelp.ready.payment': 'ಪಾವತಿಯ ದಿನಾಂಕ ಮತ್ತು ರೆಫರೆನ್ಸ್',
  'stuckhelp.ready.account': 'ನಿಮ್ಮ ಖಾತೆ ಅಥವಾ ಕಾರ್ಡ್ ಸಂಖ್ಯೆ',
  'stuckhelp.ready.wallet': 'ವಾಲೆಟ್‌ನಲ್ಲಿ ನೋಂದಾಯಿಸಿದ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ',
  'stuckhelp.ready.relief': 'ನೀವು ಏನು ಕೇಳುತ್ತಿದ್ದೀರಿ, ಲೆಕ್ಕ ಹಾಕಿದ ಪರಿಹಾರದೊಂದಿಗೆ (ಕೆಳಗೆ)',

  // The business ({name}: "Swiggy").
  'stuckhelp.merchant.page': '{name} ಸಹಾಯ ಪುಟ ತೆರೆದು, ಈ ಆರ್ಡರ್ ಹುಡುಕಿ, ಅಲ್ಲಿಂದ ಸಪೋರ್ಟ್ ಸಂಪರ್ಕಿಸಿ.',
  'stuckhelp.merchant.app': '{name} ಆ್ಯಪ್ ಅಥವಾ ವೆಬ್‌ಸೈಟ್‌ನಲ್ಲಿ ಈ ಆರ್ಡರ್ ತೆರೆದು, ಅಲ್ಲಿಂದ ಸಪೋರ್ಟ್ ಸಂಪರ್ಕಿಸಿ.',
  'stuckhelp.merchant.unknown': 'ಆ ಕಂಪನಿಯ ಸಪೋರ್ಟ್ ಸಂಪರ್ಕಿಸಿ — ಸಾಧ್ಯವಾದರೆ ಆರ್ಡರ್‌ನಿಂದಲೇ.',
  'stuckhelp.merchant.paste': 'ಕೆಳಗಿನ ಸಂದೇಶ ಅಂಟಿಸಿ, ಟಿಕೆಟ್ ಸಂಖ್ಯೆ ಕೇಳಿ.',
  // Settle's own advice (a week), not the law's month.
  'stuckhelp.merchant.nextNch':
    'ಅವರಿಗೆ ಒಂದು ವಾರ ಸಮಯ ಕೊಡಿ. ಆಗಲೂ ಬಗೆಹರಿಯಲಿಲ್ಲವೇ? ನೀವು ರಾಷ್ಟ್ರೀಯ ಗ್ರಾಹಕ ಸಹಾಯವಾಣಿಗೆ ಹೋಗಬಹುದು; ಪೂರ್ತಿ ತಿಂಗಳು ಕಾಯಬೇಕಿಲ್ಲ.',
  'stuckhelp.merchant.nextAirsewa': 'ಅವರಿಗೆ ಒಂದು ವಾರ ಸಮಯ ಕೊಡಿ. ಆಗಲೂ ಬಗೆಹರಿಯಲಿಲ್ಲವೇ? ನೀವು AirSewa ಗೆ ಹೋಗಬಹುದು.',
  'stuckhelp.rule.ecommerce':
    'ಆನ್‌ಲೈನ್ ಕಂಪನಿಗಳು ದೂರನ್ನು 48 ಗಂಟೆಗಳೊಳಗೆ ಸ್ವೀಕರಿಸಿ, ಒಂದು ತಿಂಗಳೊಳಗೆ ಬಗೆಹರಿಸಬೇಕು (ಗ್ರಾಹಕ ಸಂರಕ್ಷಣೆ (ಇ-ಕಾಮರ್ಸ್) ನಿಯಮಗಳು, 2020).',
  'stuckhelp.rule.dgca': 'DGCA ನಿಯಮಗಳು: ಕಾರ್ಡ್ ಪಾವತಿಗೆ 7 ದಿನಗಳೊಳಗೆ ರಿಫಂಡ್, ಏಜೆಂಟ್ ಅಥವಾ ಪೋರ್ಟಲ್ ಮೂಲಕ ಬುಕ್ ಮಾಡಿದ್ದರೆ 14 ಕೆಲಸದ ದಿನಗಳೊಳಗೆ.',

  // The National Consumer Helpline ({whatsapp}: "+91 88000 01915", {phone}: 1915, {tollFree}: 1800-11-4000).
  'stuckhelp.nch.send': 'ಕೆಳಗಿನ ಸಂದೇಶವನ್ನು WhatsApp ನಲ್ಲಿ {whatsapp} ಗೆ ಕಳುಹಿಸಿ, {phone} ಅಥವಾ {tollFree} ಗೆ ಕರೆ ಮಾಡಿ (ಬೆಳಿಗ್ಗೆ 8 ರಿಂದ ರಾತ್ರಿ 8), ಅಥವಾ consumerhelpline.gov.in ನಲ್ಲಿ ದಾಖಲಿಸಿ.',
  'stuckhelp.nch.docket': 'ಸಹಾಯವಾಣಿ ಇದನ್ನು {name} ಜೊತೆ ಕೈಗೆತ್ತಿಕೊಳ್ಳುತ್ತದೆ. ಅದು ಕೊಡುವ ಡಾಕೆಟ್ ಸಂಖ್ಯೆಯನ್ನು ಬರೆದಿಟ್ಟುಕೊಳ್ಳಿ.',
  'stuckhelp.nch.docketAny': 'ಸಹಾಯವಾಣಿ ಇದನ್ನು ಆ ಕಂಪನಿಯ ಜೊತೆ ಕೈಗೆತ್ತಿಕೊಳ್ಳುತ್ತದೆ. ಅದು ಕೊಡುವ ಡಾಕೆಟ್ ಸಂಖ್ಯೆಯನ್ನು ಬರೆದಿಟ್ಟುಕೊಳ್ಳಿ.',
  'stuckhelp.nch.next': 'ಒಂದು ತಿಂಗಳಲ್ಲಿ ಬಗೆಹರಿಯಲಿಲ್ಲವೇ? ಮುಂದಿನದು ಗ್ರಾಹಕ ಆಯೋಗ.',

  // AirSewa ({name}: "IndiGo").
  'stuckhelp.airsewa.file': 'airsewa.gov.in ಅಥವಾ AirSewa ಆ್ಯಪ್‌ನಲ್ಲಿ ನೋಂದಾಯಿಸಿ, {name} ವಿರುದ್ಧ ದೂರು ದಾಖಲಿಸಿ.',
  'stuckhelp.airsewa.fileAny': 'airsewa.gov.in ಅಥವಾ AirSewa ಆ್ಯಪ್‌ನಲ್ಲಿ ನೋಂದಾಯಿಸಿ, ಏರ್‌ಲೈನ್ ವಿರುದ್ಧ ದೂರು ದಾಖಲಿಸಿ.',
  'stuckhelp.airsewa.paste': 'PNR ಜೊತೆಗೆ ಕೆಳಗಿನ ಸಂದೇಶ ಅಂಟಿಸಿ, ರದ್ದತಿ ಮತ್ತು ರಿಫಂಡ್ ಸಂದೇಶಗಳನ್ನು ಲಗತ್ತಿಸಿ.',
  'stuckhelp.airsewa.note': 'AirSewa ಕಳುಹಿಸುವ ರೆಫರೆನ್ಸ್ ಸಂಖ್ಯೆಯನ್ನು ಬರೆದಿಟ್ಟುಕೊಳ್ಳಿ.',

  // A consumer commission.
  'stuckhelp.commission.where': 'ಗ್ರಾಹಕ ದೂರುಗಳನ್ನು e-Jagriti (e-jagriti.gov.in) ನಲ್ಲಿ ಆನ್‌ಲೈನ್ ದಾಖಲಿಸಲಾಗುತ್ತದೆ. ₹50 ಲಕ್ಷದವರೆಗಿನ ಮೊತ್ತಕ್ಕೆ ನಿಮ್ಮ ಜಿಲ್ಲಾ ಆಯೋಗ.',
  'stuckhelp.commission.attach': 'ಕೆಳಗಿನ ಸಾರಾಂಶದಿಂದ ಆರಂಭಿಸಿ. ಆರ್ಡರ್, ರಿಫಂಡ್ ಅಥವಾ ವೈಫಲ್ಯದ ಸಂದೇಶ, ಮತ್ತು ಸಂಖ್ಯೆಗಳೊಂದಿಗೆ ನಿಮ್ಮ ದೂರುಗಳನ್ನು ಲಗತ್ತಿಸಿ.',
  'stuckhelp.commission.advice': 'Settle ಕಾನೂನು ಸಲಹೆ ನೀಡುವುದಿಲ್ಲ. ದಾಖಲಿಸಲು ಸಹಾಯ ಬೇಕಿದ್ದರೆ, ಆಯೋಗ ಅಥವಾ ಗ್ರಾಹಕ ಸಂಘಟನೆಯನ್ನು ಕೇಳಿ.',

  // Buttons and links that take you there ({phone}: "1915"; {name}: a business).
  'stuckhelp.link.cms': 'cms.rbi.org.in ತೆರೆಯಿರಿ',
  'stuckhelp.link.call': '{phone} ಗೆ ಕರೆ ಮಾಡಿ',
  'stuckhelp.link.myupi': 'UPI ಸಹಾಯ ವೆಬ್‌ಸೈಟ್',
  'stuckhelp.link.phonepeGrievance': 'PhonePe ದೂರು ವಿಭಾಗ',
  'stuckhelp.link.merchantHelp': '{name} ಸಹಾಯ ತೆರೆಯಿರಿ',
  'stuckhelp.link.merchantRefunds': '{name} ರಿಫಂಡ್ ಸಹಾಯ ತೆರೆಯಿರಿ',
  'stuckhelp.link.whatsapp': 'WhatsApp ನಲ್ಲಿ ಕಳುಹಿಸಿ',
  'stuckhelp.link.nchSite': 'consumerhelpline.gov.in',
  'stuckhelp.link.airsewa': 'AirSewa ತೆರೆಯಿರಿ',
  'stuckhelp.link.ejagriti': 'e-Jagriti ತೆರೆಯಿರಿ',
  'stuckhelp.links.aria': 'ಅವರನ್ನು ತಲುಪುವ ಇತರ ದಾರಿಗಳು',
  'stuckhelp.newTab': '{label} (ಹೊಸ ಟ್ಯಾಬ್‌ನಲ್ಲಿ ತೆರೆಯುತ್ತದೆ)',

  // The sheet.
  'stuckhelp.eyebrow': '{amount} · {name}',
  'stuckhelp.party.failed': 'ವಿಫಲ ಪಾವತಿ',
  'stuckhelp.party.refund': 'ರಿಫಂಡ್',
  'stuckhelp.how.heading': 'ಎಲ್ಲಿ ಮತ್ತು ಹೇಗೆ',
  'stuckhelp.fields.heading': 'ಫಾರ್ಮ್‌ಗಾಗಿ',
  'stuckhelp.fields.hint': 'cms.rbi.org.in ನ ದೂರು ಫಾರ್ಮ್‌ನಲ್ಲಿ ಇವುಗಳನ್ನು ಟೈಪ್ ಮಾಡಿ.',
  'stuckhelp.field.entity': 'ಬ್ಯಾಂಕ್',
  'stuckhelp.field.entityWallet': 'ವಾಲೆಟ್ ಕಂಪನಿ',
  'stuckhelp.field.category': 'ಯಾವುದರ ಬಗ್ಗೆ',
  'stuckhelp.field.date': 'ಪಾವತಿಯ ದಿನಾಂಕ',
  'stuckhelp.field.amount': 'ಮೊತ್ತ',
  'stuckhelp.field.reference': 'ವಹಿವಾಟು ರೆಫರೆನ್ಸ್',
  'stuckhelp.field.account': 'ಖಾತೆ ಅಥವಾ ಕಾರ್ಡ್',
  'stuckhelp.field.mobile': 'ನೋಂದಾಯಿತ ಮೊಬೈಲ್',
  'stuckhelp.field.bankComplaint': 'ಬ್ಯಾಂಕ್‌ಗೆ ನೀಡಿದ ನಿಮ್ಮ ದೂರು',
  'stuckhelp.field.walletComplaint': 'ವಾಲೆಟ್ ಕಂಪನಿಗೆ ನೀಡಿದ ನಿಮ್ಮ ದೂರು',
  'stuckhelp.field.relief': 'ಕೋರುತ್ತಿರುವ ಪರಿಹಾರ',
  'stuckhelp.field.copy': '{field} ನಕಲಿಸಿ',
  'stuckhelp.field.copied': '{field} ನಕಲಿಸಲಾಗಿದೆ',

  // Your details for letters: asked once, kept on this phone.
  'stuckhelp.me.heading': 'ನಿಮ್ಮ ವಿವರಗಳು',
  'stuckhelp.me.hint': 'Settle ಇವುಗಳನ್ನು ಪತ್ರದಲ್ಲಿ ಸೇರಿಸುತ್ತದೆ. ಇವು ಈ ಫೋನ್‌ನಲ್ಲೇ ಇರುತ್ತವೆ, ಎಲ್ಲಿಗೂ ಕಳುಹಿಸಲಾಗುವುದಿಲ್ಲ.',
  'stuckhelp.me.mobile': 'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ',
  'stuckhelp.me.place': 'ನಗರ ಮತ್ತು ರಾಜ್ಯ',
  // The letter is in English, so the example stays in English letters.
  'stuckhelp.me.placeExample': 'Bengaluru, Karnataka',
  'stuckhelp.me.address': 'ವಿಳಾಸ (ಐಚ್ಛಿಕ)',
  'stuckhelp.me.change': 'ಬದಲಿಸಿ',
  'stuckhelp.me.changeLabel': 'ನಿಮ್ಮ ವಿವರಗಳನ್ನು ಬದಲಿಸಿ',

  // A NACH debit: was the mandate cancelled before it?
  'stuckhelp.mandate.heading': 'ಮ್ಯಾಂಡೇಟ್',
  'stuckhelp.mandate.question': 'ಕಡಿತಕ್ಕೂ ಮೊದಲೇ ನೀವು ಈ ಮ್ಯಾಂಡೇಟ್ ಅನ್ನು ನಿಮ್ಮ ಬ್ಯಾಂಕ್‌ನಲ್ಲಿ ರದ್ದುಮಾಡಿದ್ದಿರಾ?',
  'stuckhelp.mandate.no': 'ಇಲ್ಲ',
  'stuckhelp.mandate.yes': 'ಹೌದು, ರದ್ದುಮಾಡಿದ್ದೆ',
  'stuckhelp.mandate.date': 'ರದ್ದುಮಾಡಿದ ದಿನ (ಐಚ್ಛಿಕ)',
  'stuckhelp.mandate.hint': 'ಮ್ಯಾಂಡೇಟ್ ರದ್ದುಮಾಡಿದ ನಂತರದ ಕಡಿತ ವಿಫಲ ಪಾವತಿ ಅಲ್ಲ. ಹಾಗಾಗಿ, ನೀವು ರದ್ದುಮಾಡಿದ ನಂತರ ಹಣ ತೆಗೆಯಲಾಗಿದೆ ಎಂದು ಪತ್ರ ಹೇಳುತ್ತದೆ.',

  // Who the email goes to ({kind}: bank, wallet or business; {email}: "crpc@rbi.org.in").
  'stuckhelp.email.label': 'ಇಮೇಲ್ ಯಾರಿಗೆ ಕಳುಹಿಸಬೇಕು',
  'stuckhelp.email.hint':
    '{kind, select, wallet {ವಾಲೆಟ್ ಕಂಪನಿಯ ದೂರು ಇಮೇಲ್ — ಅದರ ಆ್ಯಪ್‌ನ ಸಹಾಯ ವಿಭಾಗದಲ್ಲಿ ಇರುತ್ತದೆ.} business {ಆ ಕಂಪನಿಯ ಸಪೋರ್ಟ್ ಇಮೇಲ್, ಇದ್ದರೆ.} other {ನಿಮ್ಮ ಬ್ಯಾಂಕ್‌ನ ದೂರು ಇಮೇಲ್ — ಅದರ ವೆಬ್‌ಸೈಟ್ ಅಥವಾ ಆ್ಯಪ್‌ನಲ್ಲಿ ಇರುತ್ತದೆ.}} Settle ಇದನ್ನು ಈ ಫೋನ್‌ನಲ್ಲಿ ನೆನಪಿಟ್ಟುಕೊಳ್ಳುತ್ತದೆ.',
  'stuckhelp.email.crpc': 'ಇಮೇಲ್ RBI ಯ ದೂರು ಕೇಂದ್ರಕ್ಕೆ ({email}) ಹೋಗುತ್ತದೆ.',

  // The letter's box: {kind} is letter, message or summary.
  'stuckhelp.letter.heading': '{kind, select, message {ಸಂದೇಶ} summary {ಸಾರಾಂಶ} other {ಪತ್ರ}}',
  'stuckhelp.letter.blanks':
    '{count, plural, one {[ ] ಒಳಗಿರುವ # ಭಾಗ ಇನ್ನೂ ತುಂಬಬೇಕಿದೆ. ಕಳುಹಿಸುವ ಮೊದಲು ಅದನ್ನು ತುಂಬಿ.} other {[ ] ಒಳಗಿರುವ # ಭಾಗಗಳು ಇನ್ನೂ ತುಂಬಬೇಕಿವೆ. ಕಳುಹಿಸುವ ಮೊದಲು ಅವುಗಳನ್ನು ತುಂಬಿ.}}',
  'stuckhelp.letter.actions': 'ಪತ್ರ ಕಳುಹಿಸಿ',
  // Above the letter, in the app's language: what it asks for ({amount}, {compensation}, {total}: "₹500").
  'stuckhelp.summary.reverse': 'ಇದು {amount} ವಾಪಸ್ ಕೇಳುತ್ತದೆ, ಜೊತೆಗೆ ತಡವಾದ ಪ್ರತಿ ದಿನಕ್ಕೆ ₹100.',
  'stuckhelp.summary.reverseOwed': 'ಇದು {amount} ವಾಪಸ್ ಕೇಳುತ್ತದೆ, ಜೊತೆಗೆ ತಡವಾದದ್ದಕ್ಕೆ ಇಲ್ಲಿಯವರೆಗೆ ಬರಬೇಕಾದ {compensation} (ದಿನಕ್ಕೆ ₹100).',
  'stuckhelp.summary.compensation': 'ಹಣ ತಡವಾದ ದಿನಗಳಿಗೆ ಬರಬೇಕಾದ {compensation} ಪರಿಹಾರವನ್ನು ಇದು ಕೇಳುತ್ತದೆ (ದಿನಕ್ಕೆ ₹100).',
  'stuckhelp.summary.compensationAny': 'ಹಣ ತಡವಾದ ದಿನಗಳಿಗೆ ಬರಬೇಕಾದ ಪರಿಹಾರವನ್ನು ಇದು ಕೇಳುತ್ತದೆ (ದಿನಕ್ಕೆ ₹100).',
  'stuckhelp.summary.ombudsman':
    'ಏನಾಯಿತು, ನಿಮ್ಮ ದೂರಿನ ಮೇಲೆ ಏನು ಕ್ರಮವಾಯಿತು ಎಂದು ಇದು RBI ಒಂಬುಡ್ಸ್‌ಮನ್‌ಗೆ ತಿಳಿಸುತ್ತದೆ, ಮತ್ತು ಇಲ್ಲಿಯವರೆಗೆ ನಿಮಗೆ ಬರಬೇಕಾದ {total} ಕೇಳುತ್ತದೆ.',
  'stuckhelp.summary.ombudsmanAny':
    'ಏನಾಯಿತು, ನಿಮ್ಮ ದೂರಿನ ಮೇಲೆ ಏನು ಕ್ರಮವಾಯಿತು ಎಂದು ಇದು RBI ಒಂಬುಡ್ಸ್‌ಮನ್‌ಗೆ ತಿಳಿಸುತ್ತದೆ, ಮತ್ತು ನಿಮಗೆ ಬರಬೇಕಾದದ್ದನ್ನು ಕೇಳುತ್ತದೆ.',
  'stuckhelp.summary.refund': 'ಇದು ನಿಮ್ಮ {amount} ರಿಫಂಡ್ ಕೇಳುತ್ತದೆ — ಈಗಾಗಲೇ ಕಳುಹಿಸಿದ್ದರೆ, ಅದನ್ನು ಪತ್ತೆಹಚ್ಚಲು ಅದರ ರೆಫರೆನ್ಸ್ ಸಂಖ್ಯೆ ಕೇಳುತ್ತದೆ.',
  'stuckhelp.summary.confirm': 'ನಿಮ್ಮ {amount} ಅವರಿಗೆ ತಲುಪಿತೇ ಎಂದು ಲಿಖಿತವಾಗಿ ಖಚಿತಪಡಿಸಲು ಇದು ಕೇಳುತ್ತದೆ — ಅದನ್ನು ನಿಮ್ಮ ಬ್ಯಾಂಕ್‌ಗೆ ತೋರಿಸಬಹುದು.',
  'stuckhelp.summary.nch': 'ನಿಮ್ಮ {amount} ವಿಷಯವನ್ನು ಆ ಕಂಪನಿಯ ಜೊತೆ ಕೈಗೆತ್ತಿಕೊಳ್ಳಲು ಇದು ಸಹಾಯವಾಣಿಯನ್ನು ಕೇಳುತ್ತದೆ, ಮತ್ತು ನೀವು ಇಲ್ಲಿಯವರೆಗೆ ಮಾಡಿದ್ದನ್ನು ಪಟ್ಟಿ ಮಾಡುತ್ತದೆ.',
  'stuckhelp.summary.airsewa': 'DGCA ನಿಯಮಗಳಂತೆ ಏರ್‌ಲೈನ್ ನಿಮ್ಮ {amount} ರಿಫಂಡ್ ಕೊಡುವಂತೆ ಮಾಡಲು ಇದು AirSewa ಅನ್ನು ಕೇಳುತ್ತದೆ.',
  'stuckhelp.summary.commission': 'ಇದು ಆಯೋಗಕ್ಕಾಗಿ ನಿಮ್ಮ ಪ್ರಕರಣದ ಸಾರಾಂಶ ನೀಡುತ್ತದೆ: ಏನಾಯಿತು, ಯಾವಾಗ, ನೀವು ಏನು ಮಾಡಿದಿರಿ, ಮತ್ತು ನೀವು ಕೇಳುತ್ತಿರುವ {amount}.',
  'stuckhelp.summary.english':
    '{kind, select, message {ಸಂದೇಶ} summary {ಸಾರಾಂಶ} other {ಪತ್ರ}} ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿದೆ — ಬ್ಯಾಂಕ್‌ಗಳು, ಕಂಪನಿಗಳು ಮತ್ತು ನಿಯಂತ್ರಕ ಸಂಸ್ಥೆಗಳು ಕೆಲಸ ಮಾಡುವ ಭಾಷೆ ಅದು.',
  'stuckhelp.action.copy': '{kind, select, message {ಸಂದೇಶ ನಕಲಿಸಿ} summary {ಸಾರಾಂಶ ನಕಲಿಸಿ} other {ಪತ್ರ ನಕಲಿಸಿ}}',
  'stuckhelp.action.email': 'ಇಮೇಲ್',
  'stuckhelp.action.print': 'ಪ್ರಿಂಟ್ ಮಾಡಿ ಅಥವಾ PDF ಆಗಿ ಉಳಿಸಿ',
  'stuckhelp.copied.status': 'ನಕಲಿಸಲಾಗಿದೆ',
  'stuckhelp.copied.toast': 'ನಕಲಿಸಲಾಗಿದೆ. ನೀವು ಕಳುಹಿಸುವಲ್ಲಿ ಅಂಟಿಸಿ.',
  'stuckhelp.copyFailed.toast': 'ನಕಲಿಸಲಾಗಲಿಲ್ಲ. ಪಠ್ಯವನ್ನು ಆಯ್ಕೆಮಾಡಿ ನಕಲಿಸಿ.',

  // "I've raised it": the day and the number they gave you.
  'stuckhelp.raised.cta': 'ದೂರು ನೀಡಿದ್ದೇನೆ',
  'stuckhelp.raised.title': 'ಯಾವಾಗ ದೂರು ನೀಡಿದಿರಿ?',
  'stuckhelp.raised.description': 'ಮುಂದಿನ ಹಂತದವರೆಗಿನ ಕಾಯುವಿಕೆಯನ್ನು Settle ಈ ದಿನದಿಂದ ಎಣಿಸುತ್ತದೆ.',
  'stuckhelp.raised.date': 'ದೂರು ನೀಡಿದ ದಿನ',
  'stuckhelp.raised.ref': '{kind, select, merchant {ಟಿಕೆಟ್ ಸಂಖ್ಯೆ} nch {ಡಾಕೆಟ್ ಸಂಖ್ಯೆ} airsewa {ರೆಫರೆನ್ಸ್ ಸಂಖ್ಯೆ} commission {ಪ್ರಕರಣ ಸಂಖ್ಯೆ} other {ದೂರು ಸಂಖ್ಯೆ}}',
  'stuckhelp.raised.refHint': 'ಐಚ್ಛಿಕ, ನಿಮಗೆ ಕೊಟ್ಟಿದ್ದರೆ',
  'stuckhelp.raised.save': 'ಉಳಿಸಿ',
  // {date}: "2 Nov"; {name}: the business.
  'stuckhelp.raised.toast':
    '{kind, select, bank {ಬರೆದಿಟ್ಟಿದ್ದೇವೆ: {date} ರಂದು ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ಬಳಿ ದೂರು ನೀಡಲಾಗಿದೆ} ombudsman {ಬರೆದಿಟ್ಟಿದ್ದೇವೆ: {date} ರಂದು RBI ಒಂಬುಡ್ಸ್‌ಮನ್ ಬಳಿಗೆ ಕೊಂಡೊಯ್ಯಲಾಗಿದೆ} merchant {ಬರೆದಿಟ್ಟಿದ್ದೇವೆ: {date} ರಂದು {name} ಬಳಿ ದೂರು ನೀಡಲಾಗಿದೆ} nch {ಬರೆದಿಟ್ಟಿದ್ದೇವೆ: {date} ರಂದು ರಾಷ್ಟ್ರೀಯ ಗ್ರಾಹಕ ಸಹಾಯವಾಣಿಗೆ ದೂರು ನೀಡಲಾಗಿದೆ} airsewa {ಬರೆದಿಟ್ಟಿದ್ದೇವೆ: {date} ರಂದು AirSewa ನಲ್ಲಿ ದೂರು ನೀಡಲಾಗಿದೆ} other {ಬರೆದಿಟ್ಟಿದ್ದೇವೆ: {date} ರಂದು ಗ್ರಾಹಕ ಆಯೋಗದಲ್ಲಿ ದಾಖಲಿಸಲಾಗಿದೆ}}',
}
