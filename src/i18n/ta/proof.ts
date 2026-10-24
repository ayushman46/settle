/** Tamil copy for payment screenshots (src/features/proof). Keys: `proof.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const proof = {
  // The screen (`/app/proof`) and its drop area.
  'proof.screen.title': 'பணம் செலுத்தினீர்களா? ஸ்கிரீன்ஷாட்டை இடுங்கள்',
  'proof.screen.subtitle': 'GPay, PhonePe, Paytm அல்லது உங்கள் வங்கி ஆப்பிலிருந்து செலுத்திய ஸ்கிரீன்ஷாட்டை இடுங்கள். Settle அதைச் சரிபார்த்து, யார் உங்களுக்குப் பணம் கொடுத்தார் என்பதைக் குறிக்கும்.',
  'proof.drop.choose': 'ஸ்கிரீன்ஷாட்டைத் தேர்ந்தெடு',
  'proof.drop.aria': 'பணம் செலுத்திய ஸ்கிரீன்ஷாட்டைத் தேர்ந்தெடுங்கள்',
  'proof.drop.hint': 'JPG, PNG அல்லது WebP. ஒருமுறை மட்டும் படிக்கப்படும்; எதுவும் சேமிக்கப்படாது.',
  'proof.reading.title': 'ஸ்கிரீன்ஷாட்டைப் படிக்கிறது…',
  'proof.reading.cancel': 'ரத்து செய்',
  'proof.again': 'இன்னொரு ஸ்கிரீன்ஷாட்டை இடுங்கள்',
  // What goes wrong reading the screenshot.
  'proof.error.generic': 'ஸ்கிரீன்ஷாட்டைப் படிக்க முடியவில்லை. மீண்டும் முயற்சி செய்யுங்கள், அல்லது நபரை நீங்களே தேர்ந்தெடுங்கள்.',
  'proof.error.network': 'நீங்கள் ஆஃப்லைனில் இருக்கிறீர்கள். இணைத்து மீண்டும் முயற்சி செய்யுங்கள்.',
  'proof.error.not_a_payment': 'இது UPI பணப்பரிவர்த்தனை போலத் தெரியவில்லை. உங்கள் பணம் செலுத்தும் ஆப்பிலிருந்து வெற்றித் திரையை முயற்சி செய்யுங்கள்.',
  'proof.error.unsupported_image': 'JPG, PNG அல்லது WebP ஸ்கிரீன்ஷாட்டைப் பயன்படுத்துங்கள்.',
  'proof.error.image_too_large': 'அந்த ஸ்கிரீன்ஷாட் மிகப் பெரியது. சிறியதை முயற்சி செய்யுங்கள்.',
  'proof.error.rate_limited': 'இப்போது நிறைய ஸ்கிரீன்ஷாட்கள். சில நிமிடங்களில் மீண்டும் முயற்சி செய்யுங்கள்.',
  'proof.error.timeout': 'ஸ்கிரீன்ஷாட்டைப் படிக்க அதிக நேரம் ஆனது. மீண்டும் முயற்சி செய்யுங்கள்.',
  'proof.error.unreadable': 'அந்த ஸ்கிரீன்ஷாட்டைப் படிக்க முடியவில்லை. நல்ல வெளிச்சத்தில், முழு வெற்றித் திரையை முயற்சி செய்யுங்கள்.',
  'proof.error.not_configured': 'ஸ்கிரீன்ஷாட் படிக்கும் வசதி இப்போது கிடைக்கவில்லை.',
  // Refusals: the payment is not marked, and the screen says why.
  'proof.verdict.pending.title': 'இந்தப் பணம் இன்னும் நிலுவையில் உள்ளது. செலுத்தியதாகக் குறிக்கவில்லை.',
  'proof.verdict.pending.body': 'அது Paid என்று காட்டியதும் மீண்டும் ஸ்கிரீன்ஷாட்டை இடுங்கள்.',
  'proof.verdict.failed.title': 'இந்தப் பணம் தோல்வியடைந்தது. செலுத்தியதாகக் குறிக்கவில்லை.',
  'proof.verdict.failed.body': 'பணம் எதுவும் செலுத்தப்படவில்லை. மீண்டும் முயற்சி செய்யச் சொல்லுங்கள்.',
  'proof.verdict.unreadable.title': 'இந்தப் பணம் சென்றடைந்ததா என்று எங்களால் சொல்ல முடியவில்லை.',
  'proof.verdict.unreadable.body': 'வெற்றித் திரையின் ஸ்கிரீன்ஷாட்டை இடுங்கள்.',
  'proof.verdict.wrongPayee.title': 'இந்தப் பணம் உங்களுக்குச் செல்லவில்லை. செலுத்தியதாகக் குறிக்கவில்லை.',
  'proof.verdict.wrongPayee.body': 'அது {payee} என்பவருக்குச் சென்றது.',
  'proof.verdict.payeeUnknown.title': 'இந்தப் பணத்தை யார் பெற்றார் என்று எங்களுக்குத் தெரியவில்லை. செலுத்தியதாகக் குறிக்கவில்லை.',
  'proof.verdict.payeeUnknown.body': 'பெறுநரின் பெயரோ UPI ID-யோ தெரியும் ஸ்கிரீன்ஷாட்டை இடுங்கள்.',
  'proof.verdict.duplicate.title': 'இந்தப் பணம் ஏற்கனவே பதிவாகியுள்ளது.',
  'proof.verdict.duplicate.body': 'UPI ref {utr} ஏற்கனவே {name} பெயரில் குறிக்கப்பட்டுள்ளது.',
  'proof.verdict.duplicate.someone': 'உங்கள் பட்டியலில் உள்ள ஒருவர்',
  // A match: one person owes exactly this.
  'proof.match.title': '{name} கொடுக்க வேண்டிய தொகை {amount} — செலுத்தியதாகக் குறிக்கவா?',
  'proof.match.ref': 'UPI ref {utr}',
  'proof.match.noRef': 'இந்தத் திரையில் UPI ref இல்லை. இது சரியான பணப்பரிவர்த்தனைதானா என்று பாருங்கள்.',
  'proof.match.confirm': 'செலுத்தியதாகக் குறி',
  'proof.match.notThis': 'இது இல்லை',
  'proof.match.done': '{name} கொடுக்க வேண்டிய {amount} செலுத்தியதாகக் குறிக்கப்பட்டது.',
  // Nothing matches exactly: the person picks.
  'proof.nomatch.title': 'இதை யாருடனும் பொருத்த முடியவில்லை.',
  'proof.nomatch.amount': 'திரையில் {amount} காட்டுகிறது. உங்களுக்குப் பணம் கொடுத்தவர் அவர்களில் ஒருவர் என்றால் தேர்ந்தெடுங்கள்.',
  'proof.nomatch.noAmount': 'திரையில் தொகை காட்டவில்லை. உங்களுக்குப் பணம் கொடுத்தவர் அவர்களில் ஒருவர் என்றால் தேர்ந்தெடுங்கள்.',
  'proof.nomatch.none': 'சரியாக {amount} கொடுக்க வேண்டியவர் யாருமில்லை. நண்பர்கள் பகுதியில் தொகையைச் சரிபாருங்கள்.',
  'proof.nomatch.pick': 'தேர்ந்தெடு: {name} ({amount})',
  // The shared-from-another-app note and the More sheet entry.
  'proof.shared.note': 'வேறொரு ஆப்பிலிருந்து பகிரப்பட்டது',
  'proof.more.title': 'பணம் செலுத்தினீர்களா? ஸ்கிரீன்ஷாட்டை இடுங்கள்',
  'proof.more.subtitle': 'UPI பணப்பரிவர்த்தனையை அதன் ஸ்கிரீன்ஷாட்டிலிருந்து செலுத்தியதாகக் குறியுங்கள்',
} as const satisfies Messages
