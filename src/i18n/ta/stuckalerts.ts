/** Tamil copy for Stuck money's alerts in the Android app (src/features/autosettle/useAutoSettle.ts): failed payments and refunds noticed, and money come back. */
import type { Messages } from '../types'

export const stuckalerts: Messages = {
  'stuckalerts.failed': '{name}-க்கு அனுப்பிய {amount} தோல்வியடைந்தது, ஆனால் உங்கள் பணம் போய்விட்டது — சிக்கிய பணம் பகுதியில் கண்காணிக்கிறோம்',
  'stuckalerts.failed.anon': '{amount} பணம் தோல்வியடைந்தது, ஆனால் உங்கள் பணம் போய்விட்டது — சிக்கிய பணம் பகுதியில் கண்காணிக்கிறோம்',
  'stuckalerts.check': '{name}-க்கு அனுப்பிய {amount} சிக்கியிருக்கலாம் — உங்கள் கணக்கிலிருந்து போனதா?',
  'stuckalerts.check.anon': '{amount} பணம் சிக்கியிருக்கலாம் — உங்கள் கணக்கிலிருந்து போனதா?',
  'stuckalerts.refund': '{name}-இன் {amount} ரீஃபண்ட் வந்து சேரும் வரை கண்காணிக்கிறோம்',
  'stuckalerts.refund.anon': '{amount} ரீஃபண்ட் வந்து சேரும் வரை கண்காணிக்கிறோம்',
  'stuckalerts.added.many': '{count, plural, one {# பணம் சிக்கிய பணம் பகுதியில் சேர்க்கப்பட்டது} other {# பணங்கள் சிக்கிய பணம் பகுதியில் சேர்க்கப்பட்டன}}',
  'stuckalerts.back.failed': '{name}-க்கு அனுப்பித் தோல்வியடைந்த {amount} திரும்பக் கிடைத்தது',
  'stuckalerts.back.failed.anon': 'தோல்வியடைந்த {amount} பணம் திரும்பக் கிடைத்தது',
  'stuckalerts.back.failed.late':
    '{name}-க்கு அனுப்பித் தோல்வியடைந்த {amount} திரும்பக் கிடைத்தது — {days, plural, one {# நாள்} other {# நாட்கள்}} தாமதம்: காத்திருந்ததற்கு உங்கள் வங்கி உங்களுக்கு {compensation} தர வேண்டும்',
  'stuckalerts.back.failed.anon.late':
    'தோல்வியடைந்த {amount} பணம் திரும்பக் கிடைத்தது — {days, plural, one {# நாள்} other {# நாட்கள்}} தாமதம்: காத்திருந்ததற்கு உங்கள் வங்கி உங்களுக்கு {compensation} தர வேண்டும்',
  'stuckalerts.back.refund': '{name}-இன் {amount} ரீஃபண்ட் வந்துவிட்டது',
  'stuckalerts.back.refund.anon': '{amount} ரீஃபண்ட் வந்துவிட்டது',
  'stuckalerts.back.many': '{count, plural, one {# சிக்கிய பணம் திரும்பக் கிடைத்தது} other {# சிக்கிய பணங்கள் திரும்பக் கிடைத்தன}}',
}
