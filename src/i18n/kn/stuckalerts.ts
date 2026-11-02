/** Kannada copy for Stuck money's alerts in the Android app (src/features/autosettle/useAutoSettle.ts): failed payments and refunds noticed, and money come back. */
import type { Messages } from '../types'

export const stuckalerts: Messages = {
  'stuckalerts.failed': '{name} ಗೆ {amount} ಪಾವತಿ ವಿಫಲವಾಯಿತು, ಆದರೆ ಹಣ ಕಡಿತವಾಗಿದೆ — ಸಿಲುಕಿದ ಹಣ ವಿಭಾಗದಲ್ಲಿ ಟ್ರ್ಯಾಕ್ ಮಾಡುತ್ತಿದ್ದೇವೆ',
  'stuckalerts.failed.anon': '{amount} ಪಾವತಿ ವಿಫಲವಾಯಿತು, ಆದರೆ ಹಣ ಕಡಿತವಾಗಿದೆ — ಸಿಲುಕಿದ ಹಣ ವಿಭಾಗದಲ್ಲಿ ಟ್ರ್ಯಾಕ್ ಮಾಡುತ್ತಿದ್ದೇವೆ',
  'stuckalerts.failed.late':
    '{name} ಗೆ {amount} ಪಾವತಿ ವಿಫಲವಾಯಿತು, ಆದರೆ ಹಣ ಕಡಿತವಾಗಿದೆ — {days, plural, one {# ದಿನ} other {# ದಿನ}} ತಡವಾಗಿದೆ: ಇಲ್ಲಿಯವರೆಗೆ ಕಾಯಿಸಿದ್ದಕ್ಕೆ ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ನಿಮಗೆ {compensation} ಕೊಡಬೇಕು',
  'stuckalerts.failed.anon.late':
    '{amount} ಪಾವತಿ ವಿಫಲವಾಯಿತು, ಆದರೆ ಹಣ ಕಡಿತವಾಗಿದೆ — {days, plural, one {# ದಿನ} other {# ದಿನ}} ತಡವಾಗಿದೆ: ಇಲ್ಲಿಯವರೆಗೆ ಕಾಯಿಸಿದ್ದಕ್ಕೆ ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ನಿಮಗೆ {compensation} ಕೊಡಬೇಕು',
  'stuckalerts.failed.atm': 'ATM ನಿಂದ {amount} ಬರಲಿಲ್ಲ, ಆದರೆ ನಿಮ್ಮ ಖಾತೆಯಿಂದ ಕಡಿತವಾಗಿದೆ — ಸಿಲುಕಿದ ಹಣ ವಿಭಾಗದಲ್ಲಿ ಟ್ರ್ಯಾಕ್ ಮಾಡುತ್ತಿದ್ದೇವೆ',
  'stuckalerts.failed.atm.late':
    'ATM ನಿಂದ {amount} ಬರಲಿಲ್ಲ, ಆದರೆ ನಿಮ್ಮ ಖಾತೆಯಿಂದ ಕಡಿತವಾಗಿದೆ — {days, plural, one {# ದಿನ} other {# ದಿನ}} ತಡವಾಗಿದೆ: ಇಲ್ಲಿಯವರೆಗೆ ಕಾಯಿಸಿದ್ದಕ್ಕೆ ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ನಿಮಗೆ {compensation} ಕೊಡಬೇಕು',
  'stuckalerts.check': '{name} ಗೆ ಕಳುಹಿಸಿದ {amount} ಸಿಲುಕಿರಬಹುದು — ನಿಮ್ಮ ಖಾತೆಯಿಂದ ಕಡಿತವಾಯಿತೇ?',
  'stuckalerts.check.anon': '{amount} ಪಾವತಿ ಸಿಲುಕಿರಬಹುದು — ನಿಮ್ಮ ಖಾತೆಯಿಂದ ಕಡಿತವಾಯಿತೇ?',
  'stuckalerts.refund': '{name} ಕೊಡಬೇಕಾದ {amount} ರಿಫಂಡ್ ಬರುವವರೆಗೆ ಟ್ರ್ಯಾಕ್ ಮಾಡುತ್ತಿದ್ದೇವೆ',
  'stuckalerts.refund.anon': '{amount} ರಿಫಂಡ್ ಬರುವವರೆಗೆ ಟ್ರ್ಯಾಕ್ ಮಾಡುತ್ತಿದ್ದೇವೆ',
  'stuckalerts.added.many': '{count, plural, one {# ಪಾವತಿ ಸಿಲುಕಿದ ಹಣ ವಿಭಾಗಕ್ಕೆ ಸೇರಿತು} other {# ಪಾವತಿಗಳು ಸಿಲುಕಿದ ಹಣ ವಿಭಾಗಕ್ಕೆ ಸೇರಿದವು}}',
  'stuckalerts.back.failed': '{name} ಗೆ ಮಾಡಿದ ವಿಫಲ ಪಾವತಿಯ {amount} ವಾಪಸ್ ಬಂತು',
  'stuckalerts.back.failed.anon': 'ವಿಫಲ ಪಾವತಿಯ {amount} ವಾಪಸ್ ಬಂತು',
  'stuckalerts.back.failed.late':
    '{name} ಗೆ ಮಾಡಿದ ವಿಫಲ ಪಾವತಿಯ {amount} ವಾಪಸ್ ಬಂತು — {days, plural, one {# ದಿನ} other {# ದಿನ}} ತಡವಾಗಿ: ಕಾಯಿಸಿದ್ದಕ್ಕೆ ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ನಿಮಗೆ {compensation} ಕೊಡಬೇಕು',
  'stuckalerts.back.failed.anon.late':
    'ವಿಫಲ ಪಾವತಿಯ {amount} ವಾಪಸ್ ಬಂತು — {days, plural, one {# ದಿನ} other {# ದಿನ}} ತಡವಾಗಿ: ಕಾಯಿಸಿದ್ದಕ್ಕೆ ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ನಿಮಗೆ {compensation} ಕೊಡಬೇಕು',
  'stuckalerts.back.refund': '{name} ಕಡೆಯಿಂದ {amount} ರಿಫಂಡ್ ಬಂತು',
  'stuckalerts.back.refund.anon': '{amount} ರಿಫಂಡ್ ಬಂತು',
  'stuckalerts.back.part': 'ನಿಮ್ಮ {amount} ರಲ್ಲಿ {back} ವಾಪಸ್ ಬಂತು — ಇನ್ನೂ {rest} ಬರಬೇಕು, Settle ಅದನ್ನು ಟ್ರ್ಯಾಕ್ ಮಾಡುತ್ತಲೇ ಇರುತ್ತದೆ',
  'stuckalerts.back.many': '{count, plural, one {# ಸಿಲುಕಿದ ಪಾವತಿ ವಾಪಸ್ ಬಂತು} other {# ಸಿಲುಕಿದ ಪಾವತಿಗಳು ವಾಪಸ್ ಬಂದವು}}',
  'stuckalerts.cleared': '{name} ಗೆ {amount} ಪಾವತಿ ಕೊನೆಗೂ ಯಶಸ್ವಿಯಾಯಿತು — ಏನೂ ಸಿಲುಕಿಲ್ಲ',
  'stuckalerts.cleared.anon': '{amount} ಪಾವತಿ ಕೊನೆಗೂ ಯಶಸ್ವಿಯಾಯಿತು — ಏನೂ ಸಿಲುಕಿಲ್ಲ',
  'stuckalerts.cleared.many':
    '{count, plural, one {# ಪಾವತಿ ಕೊನೆಗೂ ಯಶಸ್ವಿಯಾಯಿತು} other {# ಪಾವತಿಗಳು ಕೊನೆಗೂ ಯಶಸ್ವಿಯಾದವು}} — ಏನೂ ಸಿಲುಕಿಲ್ಲ',
}
