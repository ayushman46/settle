/** Tamil copy for client API errors (src/api). Keys: `api.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const api = {
  // What we tell people when a bill scan fails, by error code. Never the server's own words.
  'api.scan.error.bad_request': 'அந்தப் புகைப்படத்தில் ஏதோ சரியில்லை. வேறொன்றை முயற்சி செய்யுங்கள்.',
  'api.scan.error.unsupported_image': 'JPG அல்லது PNG புகைப்படத்தைப் பயன்படுத்துங்கள்.',
  'api.scan.error.image_too_large': 'அந்தப் புகைப்படம் மிகப் பெரியது. சிறியதை முயற்சி செய்யுங்கள் — அல்லது அதன் ஸ்கிரீன்ஷாட்டை எடுங்கள்.',
  'api.scan.error.not_a_bill': 'இது பில் போலத் தெரியவில்லை. முழு ரசீதின் தெளிவான புகைப்படத்தை முயற்சி செய்யுங்கள்.',
  'api.scan.error.unreadable': 'எந்தப் பொருளையும் படிக்க முடியவில்லை. இன்னும் தெளிவான, நன்கு வெளிச்சமான புகைப்படத்தை முயற்சி செய்யுங்கள் — அல்லது கைமுறையாக உள்ளிடுங்கள்.',
  'api.scan.error.not_configured': 'புகைப்பட ஸ்கேன் இப்போது கிடைக்கவில்லை — பொருட்களைத் தட்டச்சு செய்யலாம்.',
  'api.scan.error.upstream_auth': 'புகைப்பட ஸ்கேன் இப்போது வேலை செய்யவில்லை — பொருட்களைத் தட்டச்சு செய்யலாம்.',
  'api.scan.error.rate_limited': 'இப்போது நிறைய ஸ்கேன்கள். சில நிமிடங்களில் மீண்டும் முயற்சி செய்யுங்கள் — அல்லது பொருட்களைத் தட்டச்சு செய்யுங்கள்.',
  'api.scan.error.timeout': 'பில்லைப் படிக்க அதிக நேரம் ஆனது. இன்னும் தெளிவான, அருகில் எடுத்த புகைப்படத்தை முயற்சி செய்யுங்கள்.',
  'api.scan.error.upstream_error': 'AI சேவையை அடைய முடியவில்லை. மீண்டும் முயற்சி செய்யுங்கள்.',
  'api.scan.error.network': 'நீங்கள் ஆஃப்லைனில் இருப்பதுபோல் தெரிகிறது. இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சி செய்யுங்கள்.',
  'api.scan.error.aborted': 'ஸ்கேன் ரத்து செய்யப்பட்டது.',
  // A short wait: the server is busy, nobody did anything wrong.
  'api.scan.busy': 'இப்போது நிறைய பில்கள் படிக்கப்படுகின்றன — சிறிது நேரத்தில் மீண்டும் முயற்சி செய்யுங்கள்.',
  // A long wait; `{wait}` is "about 10 minutes" (api.wait.*).
  'api.scan.proLimit': 'இன்றைய AI நியாயப் பயன்பாட்டு வரம்பு முடிந்தது. மீண்டும் கிடைக்க {wait} ஆகும் — அதுவரை பொருட்களைத் தட்டச்சு செய்யலாம்.',
  'api.scan.limit': 'அதிக ஸ்கேன்கள். {wait} கழித்து மீண்டும் முயற்சி செய்யுங்கள் — அல்லது பொருட்களைத் தட்டச்சு செய்யுங்கள்.',
  'api.scan.offline': 'நீங்கள் ஆஃப்லைனில் இருக்கிறீர்கள் — பொருட்களைத் தட்டச்சு செய்யலாம்.',
  // A picked photo we can't use.
  'api.image.error.not_image': 'அது புகைப்படம் இல்லை. JPG அல்லது PNG படத்தைத் தேர்ந்தெடுங்கள்.',
  'api.image.error.decode_failed': 'அந்தப் படத்தைத் திறக்க முடியவில்லை. JPG அல்லது PNG-ஐ முயற்சி செய்யுங்கள் — அல்லது அதன் ஸ்கிரீன்ஷாட்டை எடுங்கள்.',
  'api.image.error.too_large': 'அந்தப் புகைப்படம் மிகப் பெரியது (25 MB-ஐ விடப் பெரியது). சிறியதை முயற்சி செய்யுங்கள் — அல்லது அதன் ஸ்கிரீன்ஷாட்டை எடுங்கள்.',
  // How long a wait is, rounded up.
  'api.wait.minute': 'சுமார் ஒரு நிமிடம்',
  'api.wait.minutes': 'சுமார் {count} நிமிடங்கள்',
  'api.wait.hours': 'சுமார் {count} மணி நேரம்',
} as const satisfies Messages
