/** Tamil copy for Stuck money's alerts in the Android app (src/features/autosettle/useAutoSettle.ts): failed payments and refunds noticed, and money come back. */
import type { Messages } from '../types'

export const stuckalerts: Messages = {
  'stuckalerts.failed': '{amount} பணம் தோல்வியடைந்தது (பெறுநர்: {name}), ஆனால் உங்கள் பணம் போய்விட்டது — சிக்கிய பணம் பகுதியில் கண்காணிக்கிறோம்',
  'stuckalerts.failed.anon': '{amount} பணம் தோல்வியடைந்தது, ஆனால் உங்கள் பணம் போய்விட்டது — சிக்கிய பணம் பகுதியில் கண்காணிக்கிறோம்',
  'stuckalerts.failed.late':
    '{amount} பணம் தோல்வியடைந்தது (பெறுநர்: {name}), ஆனால் உங்கள் பணம் போய்விட்டது — {days, plural, one {# நாள்} other {# நாட்கள்}} தாமதம்: இதுவரை காத்திருந்ததற்கு உங்கள் வங்கி உங்களுக்கு {compensation} தர வேண்டும்',
  'stuckalerts.failed.anon.late':
    '{amount} பணம் தோல்வியடைந்தது, ஆனால் உங்கள் பணம் போய்விட்டது — {days, plural, one {# நாள்} other {# நாட்கள்}} தாமதம்: இதுவரை காத்திருந்ததற்கு உங்கள் வங்கி உங்களுக்கு {compensation} தர வேண்டும்',
  'stuckalerts.failed.atm': 'ATM உங்களுக்கு {amount} தரவில்லை, ஆனால் உங்கள் கணக்கிலிருந்து எடுத்துவிட்டது — சிக்கிய பணம் பகுதியில் கண்காணிக்கிறோம்',
  'stuckalerts.failed.atm.late':
    'ATM உங்களுக்கு {amount} தரவில்லை, ஆனால் உங்கள் கணக்கிலிருந்து எடுத்துவிட்டது — {days, plural, one {# நாள்} other {# நாட்கள்}} தாமதம்: இதுவரை காத்திருந்ததற்கு உங்கள் வங்கி உங்களுக்கு {compensation} தர வேண்டும்',
  'stuckalerts.check': '{amount} பணம் சிக்கியிருக்கலாம் (பெறுநர்: {name}) — உங்கள் கணக்கிலிருந்து போனதா?',
  'stuckalerts.check.anon': '{amount} பணம் சிக்கியிருக்கலாம் — உங்கள் கணக்கிலிருந்து போனதா?',
  'stuckalerts.refund': '{name} தர வேண்டிய {amount} ரீஃபண்ட் வந்து சேரும் வரை கண்காணிக்கிறோம்',
  'stuckalerts.refund.anon': '{amount} ரீஃபண்ட் வந்து சேரும் வரை கண்காணிக்கிறோம்',
  'stuckalerts.added.many': '{count, plural, one {# பணம் சிக்கிய பணம் பகுதியில் சேர்க்கப்பட்டது} other {# பணங்கள் சிக்கிய பணம் பகுதியில் சேர்க்கப்பட்டன}}',
  'stuckalerts.back.failed': 'தோல்வியடைந்த {amount} பணம் திரும்பக் கிடைத்தது (பெறுநர்: {name})',
  'stuckalerts.back.failed.anon': 'தோல்வியடைந்த {amount} பணம் திரும்பக் கிடைத்தது',
  'stuckalerts.back.failed.late':
    'தோல்வியடைந்த {amount} பணம் திரும்பக் கிடைத்தது (பெறுநர்: {name}) — {days, plural, one {# நாள்} other {# நாட்கள்}} தாமதம்: காத்திருந்ததற்கு உங்கள் வங்கி உங்களுக்கு {compensation} தர வேண்டும்',
  'stuckalerts.back.failed.anon.late':
    'தோல்வியடைந்த {amount} பணம் திரும்பக் கிடைத்தது — {days, plural, one {# நாள்} other {# நாட்கள்}} தாமதம்: காத்திருந்ததற்கு உங்கள் வங்கி உங்களுக்கு {compensation} தர வேண்டும்',
  'stuckalerts.back.refund': '{name} தர வேண்டிய {amount} ரீஃபண்ட் வந்துவிட்டது',
  'stuckalerts.back.refund.anon': '{amount} ரீஃபண்ட் வந்துவிட்டது',
  'stuckalerts.back.part': 'உங்கள் {amount} பணத்தில் {back} திரும்பியது — இன்னும் {rest} வர வேண்டும், Settle தொடர்ந்து கண்காணிக்கும்',
  'stuckalerts.back.many': '{count, plural, one {# சிக்கிய பணம் திரும்பக் கிடைத்தது} other {# சிக்கிய பணங்கள் திரும்பக் கிடைத்தன}}',
  'stuckalerts.cleared': '{amount} பணம் (பெறுநர்: {name}) இறுதியில் வெற்றிகரமாகச் சென்றது — எதுவும் சிக்கவில்லை',
  'stuckalerts.cleared.anon': '{amount} பணம் இறுதியில் வெற்றிகரமாகச் சென்றது — எதுவும் சிக்கவில்லை',
  'stuckalerts.cleared.many':
    '{count, plural, one {# பணம் இறுதியில் வெற்றிகரமாகச் சென்றது} other {# பணங்கள் இறுதியில் வெற்றிகரமாகச் சென்றன}} — எதுவும் சிக்கவில்லை',
}
