/** Kannada copy for Stuck money's alerts in the Android app (src/features/autosettle/useAutoSettle.ts): failed payments and refunds noticed, and money come back. */
import type { Messages } from '../types'

export const stuckalerts: Messages = {
  'stuckalerts.failed': '{name} ಗೆ {amount} ಪಾವತಿ ವಿಫಲವಾಯಿತು, ಆದರೆ ಹಣ ಕಡಿತವಾಗಿದೆ — ಸಿಲುಕಿದ ಹಣ ವಿಭಾಗದಲ್ಲಿ ಟ್ರ್ಯಾಕ್ ಮಾಡುತ್ತಿದ್ದೇವೆ',
  'stuckalerts.failed.anon': '{amount} ಪಾವತಿ ವಿಫಲವಾಯಿತು, ಆದರೆ ಹಣ ಕಡಿತವಾಗಿದೆ — ಸಿಲುಕಿದ ಹಣ ವಿಭಾಗದಲ್ಲಿ ಟ್ರ್ಯಾಕ್ ಮಾಡುತ್ತಿದ್ದೇವೆ',
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
  'stuckalerts.back.many': '{count, plural, one {# ಸಿಲುಕಿದ ಪಾವತಿ ವಾಪಸ್ ಬಂತು} other {# ಸಿಲುಕಿದ ಪಾವತಿಗಳು ವಾಪಸ್ ಬಂದವು}}',
}
