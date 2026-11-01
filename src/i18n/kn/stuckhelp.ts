/** Kannada copy for raising a stuck payment (src/features/stuck/RaiseSheet.tsx): where to complain, the letter, and noting it was sent. */
import type { Messages } from '../types'

export const stuckhelp: Messages = {
  // The sheet's title, per rung ({amount} is pre-formatted: "₹300"; {name} a business: "Swiggy").
  'stuckhelp.title.bank': 'ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ಬಳಿ ದೂರು ನೀಡಿ',
  'stuckhelp.title.compensation': '{amount} ಪರಿಹಾರ ಕೇಳಿ',
  'stuckhelp.title.compensationAny': 'ಪರಿಹಾರ ಕೇಳಿ',
  'stuckhelp.title.ombudsman': 'RBI ಒಂಬುಡ್ಸ್‌ಮನ್ ಬಳಿಗೆ ಕೊಂಡೊಯ್ಯಿರಿ',
  'stuckhelp.title.merchant': '{name} ಬಳಿ ರಿಫಂಡ್ ಕೇಳಿ',
  'stuckhelp.title.merchantAny': 'ರಿಫಂಡ್ ಕೇಳಿ',
  'stuckhelp.title.nch': 'ರಾಷ್ಟ್ರೀಯ ಗ್ರಾಹಕ ಸಹಾಯವಾಣಿ',
  'stuckhelp.title.airsewa': 'AirSewa ನಲ್ಲಿ ದೂರು ನೀಡಿ',
  'stuckhelp.title.commission': 'ಗ್ರಾಹಕ ಆಯೋಗಕ್ಕೆ ಕೊಂಡೊಯ್ಯಿರಿ',

  // One line under the title: what this rung is.
  'stuckhelp.lead.bank': 'RBI ನಿಯಮಗಳ ಪ್ರಕಾರ ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ಹಣ ವಾಪಸ್ ಹಾಕಬೇಕು, ಮತ್ತು ತಡವಾದ ಪ್ರತಿ ದಿನಕ್ಕೆ ₹100 ಕೊಡಬೇಕು.',
  'stuckhelp.lead.compensation': 'RBI ನಿಯಮಗಳ ಪ್ರಕಾರ ಹಣ ತಡವಾದ ಪ್ರತಿ ದಿನಕ್ಕೆ ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ₹100 ಕೊಡಬೇಕು. ಅದನ್ನು ಲಿಖಿತವಾಗಿ ಕೇಳಿ.',
  'stuckhelp.lead.ombudsman': 'ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ಸರಿಪಡಿಸದಿದ್ದಾಗ ದೂರು ನೀಡಲು RBI ಯ ಸೇವೆ.',
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
    'ಆ್ಯಪ್‌ನಿಂದ ಉತ್ತರ ಬಂದಿಲ್ಲವೇ? ಪಾವತಿಯಾದ 45 ದಿನಗಳೊಳಗೆ, 12-ಅಂಕಿಯ UPI ರೆಫರೆನ್ಸ್‌ನೊಂದಿಗೆ NPCI ಯ MyUPI ವೆಬ್‌ಸೈಟ್‌ನಲ್ಲಿ (upihelp.npci.org.in) ದೂರು ನೀಡಿ.',
  'stuckhelp.bank.note': 'ದೂರು ಸಂಖ್ಯೆ ಸಿಕ್ಕಿತೇ? “ದೂರು ನೀಡಿದ್ದೇನೆ” ಒತ್ತಿ ಅದನ್ನು ಉಳಿಸಿ. 30 ದಿನಗಳಲ್ಲಿ ಸರಿಯಾಗದಿದ್ದರೆ, ಮುಂದಿನದು RBI ಒಂಬುಡ್ಸ್‌ಮನ್.',

  // The money came back late: the compensation claim.
  'stuckhelp.compensation.send': 'ಕೆಳಗಿನ ಪತ್ರವನ್ನು ನಿಮ್ಮ ಬ್ಯಾಂಕ್‌ಗೆ ಕಳುಹಿಸಿ: ಕಸ್ಟಮರ್ ಕೇರ್‌ಗೆ ಇಮೇಲ್, ನೆಟ್ ಬ್ಯಾಂಕಿಂಗ್‌ನ ದೂರು ಫಾರ್ಮ್, ಅಥವಾ ಶಾಖೆಯಲ್ಲಿ.',
  'stuckhelp.compensation.why': 'RBI ನಿಯಮಗಳ ಪ್ರಕಾರ ಬ್ಯಾಂಕ್‌ಗಳು ಇದನ್ನು ಕೇಳದೆಯೇ ಕೊಡಬೇಕು. ಈ ಪತ್ರ ದಿನಗಳ ಲೆಕ್ಕದೊಂದಿಗೆ ಲಿಖಿತವಾಗಿ ಕೇಳುತ್ತದೆ.',

  // The RBI Ombudsman ({phone}: 14448).
  'stuckhelp.ombudsman.when':
    'ಬ್ಯಾಂಕ್‌ಗೆ ದೂರು ನೀಡಿ 30 ದಿನಗಳು ಕಳೆದ ನಂತರ ದಾಖಲಿಸಬಹುದು (ಬ್ಯಾಂಕ್ ಉತ್ತರಿಸಿ ನಿಮಗೆ ತೃಪ್ತಿ ಇಲ್ಲದಿದ್ದರೆ ಅದಕ್ಕಿಂತ ಮೊದಲೇ), ಮತ್ತು ಅದರ ನಂತರ 90 ದಿನಗಳೊಳಗೆ.',
  'stuckhelp.ombudsman.file': 'cms.rbi.org.in ನಲ್ಲಿ ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ವಿರುದ್ಧ ದೂರು ದಾಖಲಿಸಿ. ಫಾರ್ಮ್‌ಗೆ ಬೇಕಾದ ವಿವರಗಳು ಕೆಳಗಿವೆ.',
  'stuckhelp.ombudsman.paste':
    'ದೂರಿನ ವಿವರಗಳ ಜಾಗದಲ್ಲಿ ಪತ್ರವನ್ನು ಅಂಟಿಸಿ. ಬ್ಯಾಂಕ್‌ಗೆ ನೀಡಿದ ದೂರು, ಅದರ ಉತ್ತರ (ಇದ್ದರೆ), ಮತ್ತು ಕಡಿತ ತೋರಿಸುವ ಸ್ಟೇಟ್‌ಮೆಂಟ್ ಲಗತ್ತಿಸಿ.',
  'stuckhelp.ombudsman.call': 'ಪ್ರಶ್ನೆಗಳಿವೆಯೇ? {phone} ಗೆ ಕರೆ ಮಾಡಿ: ಸೋಮವಾರದಿಂದ ಶನಿವಾರ, ಬೆಳಿಗ್ಗೆ 8 ರಿಂದ ರಾತ್ರಿ 10 ರವರೆಗೆ ಉತ್ತರಿಸುತ್ತಾರೆ. ಅವರು ಮಾರ್ಗದರ್ಶನ ಮಾಡುತ್ತಾರೆ, ಆದರೆ ದೂರು ಸ್ವೀಕರಿಸುವುದಿಲ್ಲ.',
  'stuckhelp.ready.heading': 'ಇವುಗಳನ್ನು ಸಿದ್ಧವಿಟ್ಟುಕೊಳ್ಳಿ',
  'stuckhelp.ready.complaint': 'ಬ್ಯಾಂಕ್‌ಗೆ ನೀಡಿದ ನಿಮ್ಮ ದೂರು ಮತ್ತು ಅದರ ಸಂಖ್ಯೆ',
  'stuckhelp.ready.reply': 'ಬ್ಯಾಂಕ್‌ನ ಉತ್ತರ, ಬಂದಿದ್ದರೆ',
  'stuckhelp.ready.payment': 'ಪಾವತಿಯ ದಿನಾಂಕ ಮತ್ತು ರೆಫರೆನ್ಸ್',
  'stuckhelp.ready.account': 'ನಿಮ್ಮ ಖಾತೆ ಅಥವಾ ಕಾರ್ಡ್ ಸಂಖ್ಯೆ',
  'stuckhelp.ready.relief': 'ನೀವು ಏನು ಕೇಳುತ್ತಿದ್ದೀರಿ, ಲೆಕ್ಕ ಹಾಕಿದ ಪರಿಹಾರದೊಂದಿಗೆ (ಕೆಳಗೆ)',

  // The business ({name}: "Swiggy").
  'stuckhelp.merchant.page': '{name} ಸಹಾಯ ಪುಟ ತೆರೆದು, ಈ ಆರ್ಡರ್ ಹುಡುಕಿ, ಅಲ್ಲಿಂದ ಸಪೋರ್ಟ್ ಸಂಪರ್ಕಿಸಿ.',
  'stuckhelp.merchant.app': '{name} ಆ್ಯಪ್ ಅಥವಾ ವೆಬ್‌ಸೈಟ್‌ನಲ್ಲಿ ಈ ಆರ್ಡರ್ ತೆರೆದು, ಅಲ್ಲಿಂದ ಸಪೋರ್ಟ್ ಸಂಪರ್ಕಿಸಿ.',
  'stuckhelp.merchant.unknown': 'ಆ ಕಂಪನಿಯ ಸಪೋರ್ಟ್ ಸಂಪರ್ಕಿಸಿ — ಸಾಧ್ಯವಾದರೆ ಆರ್ಡರ್‌ನಿಂದಲೇ.',
  'stuckhelp.merchant.paste': 'ಕೆಳಗಿನ ಸಂದೇಶ ಅಂಟಿಸಿ, ಟಿಕೆಟ್ ಸಂಖ್ಯೆ ಕೇಳಿ.',
  'stuckhelp.merchant.nextNch': 'ಒಂದು ವಾರದಲ್ಲಿ ಸರಿಯಾಗಲಿಲ್ಲವೇ? ಮುಂದಿನದು ರಾಷ್ಟ್ರೀಯ ಗ್ರಾಹಕ ಸಹಾಯವಾಣಿ.',
  'stuckhelp.merchant.nextAirsewa': 'ಒಂದು ವಾರದಲ್ಲಿ ಸರಿಯಾಗಲಿಲ್ಲವೇ? ಮುಂದಿನದು AirSewa.',
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
  'stuckhelp.link.myupi': 'NPCI ಯ MyUPI',
  'stuckhelp.link.phonepeGrievance': 'PhonePe ದೂರು ವಿಭಾಗ',
  'stuckhelp.link.merchantHelp': '{name} ಸಹಾಯ ತೆರೆಯಿರಿ',
  'stuckhelp.link.merchantRefunds': 'ರಿಫಂಡ್ ಬಗ್ಗೆ {name}',
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
  'stuckhelp.field.category': 'ಯಾವುದರ ಬಗ್ಗೆ',
  'stuckhelp.field.date': 'ಪಾವತಿಯ ದಿನಾಂಕ',
  'stuckhelp.field.amount': 'ಮೊತ್ತ',
  'stuckhelp.field.reference': 'ವಹಿವಾಟು ರೆಫರೆನ್ಸ್',
  'stuckhelp.field.account': 'ಖಾತೆ ಅಥವಾ ಕಾರ್ಡ್',
  'stuckhelp.field.bankComplaint': 'ಬ್ಯಾಂಕ್‌ಗೆ ನೀಡಿದ ನಿಮ್ಮ ದೂರು',
  'stuckhelp.field.relief': 'ಕೋರುತ್ತಿರುವ ಪರಿಹಾರ',
  'stuckhelp.field.copy': '{field} ನಕಲಿಸಿ',
  'stuckhelp.field.copied': '{field} ನಕಲಿಸಲಾಗಿದೆ',
  // The letter's box: {kind} is letter, message or summary.
  'stuckhelp.letter.heading': '{kind, select, message {ಸಂದೇಶ} summary {ಸಾರಾಂಶ} other {ಪತ್ರ}}',
  'stuckhelp.letter.subject': 'ವಿಷಯ',
  'stuckhelp.letter.fill': 'ಕಳುಹಿಸುವ ಮೊದಲು [ ] ಆವರಣಗಳಲ್ಲಿರುವ ಭಾಗಗಳನ್ನು ತುಂಬಿ.',
  'stuckhelp.letter.actions': 'ಪತ್ರ ಕಳುಹಿಸಿ',
  'stuckhelp.action.email': 'ಇಮೇಲ್',
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
