/** Tamil copy for the /pay page (src/features/pay). Keys: `pay.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const pay = {
  // The frame of every public page a friend opens from a link (/pay, /claim, /pool).
  'pay.shell.home.aria': '{brand} முகப்பு',
  'pay.shell.what': '{brand} என்றால் என்ன?',
  'pay.shell.pitch.title': 'அடுத்த முறை பில்லைப் பிரிக்கப் போகிறீர்களா?',
  'pay.shell.pitch.body': 'பில்லை புகைப்படம் எடுங்கள், இதைப் போன்ற ஒரு இணைப்பைப் பகிருங்கள், UPI மூலம் திருப்பிப் பெறுங்கள். பதிவு இல்லை, விளம்பரங்கள் இல்லை.',
  'pay.shell.pitch.cta': '{brand} மூலம் உங்கள் பில்களைப் பிரியுங்கள்',
  'pay.shell.privacy': 'தனியுரிமை',
  'pay.shell.terms': 'விதிமுறைகள்',
  // The request card, the page's h1. <by> is the small line, <what> the big title (user content).
  'pay.request.title': '<by>{name} இதற்காகப் பணம் கேட்கிறார்</by> <what>{title}</what>',
  // In the line under the title: "21 Oct · Food · Total ₹2,766".
  'pay.request.total': 'மொத்தம் {amount}',
  'pay.request.collected': '{owed} இல் {collected} வசூலானது',
  'pay.request.paidCount': '{count} இல் {paid} பேர் செலுத்தியுள்ளனர்',
  // "Which one are you?" — the list of everyone on the link.
  'pay.who.title': 'நீங்கள் யார்?',
  'pay.who.empty': 'இந்த இணைப்பில் யாரும் எதுவும் தர வேண்டியதில்லை.',
  'pay.who.hint': 'உங்கள் பங்கைப் பார்க்கவும் செலுத்தவும் உங்கள் பெயரைத் தட்டுங்கள்.',
  // Badge next to someone the payee has marked as paid.
  'pay.who.paid': 'செலுத்தியது',
  // One person's share.
  'pay.panel.notYou.cta': '{name} இல்லையா? பெயர் தேர்',
  'pay.panel.share.title': '{name} இன் பங்கு',
  'pay.panel.partPaid': '{share}-இல் {paid} ஏற்கனவே செலுத்தப்பட்டது — இது மீதி',
  'pay.panel.paid.title': 'கணக்கு சரியாக உள்ளது',
  'pay.panel.paid.body': 'உங்கள் பங்கை {name} செலுத்தியதாகக் குறித்துள்ளார்.',
  'pay.panel.reveal.cta': 'எப்படியும் விவரங்களைக் காட்டு',
  'pay.panel.nothing.title': 'செலுத்த எதுவுமில்லை',
  'pay.panel.nothing.body': 'இதில் உங்கள் பங்கு {amount}.',
  'pay.panel.noUpi.title': '{name} UPI ID சேர்க்கவில்லை',
  'pay.panel.noUpi.body': 'வழக்கம்போல் அவர்களுக்குச் செலுத்துங்கள் — அல்லது அவர்களின் UPI ID-ஐக் கேட்டு, எந்த UPI ஆப்பிலிருந்தும் செலுத்துங்கள்.',
  'pay.panel.notInr.title': 'வழக்கம்போல் செலுத்துங்கள்',
  'pay.panel.notInr.body': 'UPI ரூபாயில் மட்டுமே வேலை செய்யும், அதனால் வழக்கம்போல் {name} அவர்களுக்குச் செலுத்துங்கள்.',
  'pay.panel.breakdown.title': 'உங்கள் பங்கில் உள்ளவை',
  'pay.panel.breakdown.share': 'உங்கள் பங்கு',
  // Under an item someone shared: "Shared 3 ways", or "2 of 3 shares" for unequal shares.
  'pay.breakdown.sharedWays': '{count} வழிகளில் பகிரப்பட்டது',
  'pay.breakdown.shares': '{total} பங்கில் {shares}',
  'pay.breakdown.extras.added': 'வரி, கட்டணங்கள் & சுற்றல்',
  'pay.breakdown.extras.taken': 'தள்ளுபடிகள் மற்றும் சுற்றல்',
  // "Paid? Tell them" — a ready message the payer sends to the payee's chat.
  'pay.tell.title': 'செலுத்தினீர்களா?',
  'pay.tell.cta': '{name}: செலுத்தியதைச் சொல்',
  'pay.tell.copied.status': 'செய்தி நகலெடுக்கப்பட்டது — உங்கள் அரட்டையில் ஒட்டுங்கள்.',
  'pay.tell.shared.status': 'அனுப்பப்பட்டது. கணக்கைத் தீர்த்ததற்கு நன்றி!',
  'pay.tell.failed.status': 'செய்தியைப் பகிர முடியவில்லை. மீண்டும் முயற்சி செய்யுங்கள்.',
  // The message itself ({title} is what the bill was for).
  'pay.tell.message': 'வணக்கம் {name}! {title} க்கான {amount} இப்போதுதான் செலுத்தினேன் ✓',
  'pay.tell.message.noName': 'வணக்கம்! {title} க்கான {amount} இப்போதுதான் செலுத்தினேன் ✓',
  'pay.tell.message.cash': 'வணக்கம் {name}! {title}-க்கு {amount} ரொக்கமாகக் கொடுத்தேன் ✓',
  'pay.tell.message.cash.noName': 'வணக்கம்! {title}-க்கு {amount} ரொக்கமாகக் கொடுத்தேன் ✓',
  'pay.tell.message.ref': 'UPI குறிப்பு: {ref}',
  'pay.tell.message.link': 'நான் செலுத்தியதாகக் குறிக்கத் தட்டுங்கள் 👇',
  'pay.tell.how.upi': 'UPI-ல்',
  'pay.tell.how.cash': 'ரொக்கமாக',
  'pay.tell.utr.label': 'UPI குறிப்பு எண் (விருப்பம்)',
  'pay.tell.utr.hint': '12 இலக்கங்கள், உங்கள் UPI ஆப்பின் பணம் விவரங்களில்',
  'pay.tell.utr.error': 'UPI குறிப்பு எண்ணில் 12 இலக்கங்கள் இருக்கும்.',
  'pay.tell.opened.status': 'WhatsApp திறந்தது — {name}-க்கு அனுப்புங்கள்.',
  // A link that can't be shown.
  'pay.problem.invalid.title': 'இந்தப் பணம் செலுத்தும் இணைப்பு வேலை செய்யவில்லை',
  'pay.problem.invalid.body': 'நகலெடுக்கும்போது அது பாதியில் வெட்டப்பட்டிருக்கலாம். அனுப்பியவரிடம் மீண்டும் பகிரச் சொல்லுங்கள்.',
  'pay.problem.empty.title': 'இங்கு பணம் செலுத்தும் இணைப்பு இல்லை',
  'pay.problem.empty.body': 'உங்கள் நண்பர் பகிர்ந்த இணைப்பைத் திறவுங்கள் — அவருக்குச் செலுத்த வேண்டிய அனைத்தும் அதில் உள்ளன.',
  'pay.loading.status': 'பணம் செலுத்தும் இணைப்பைத் திறக்கிறது…',
  // The browser tab title and the link preview.
  'pay.meta.title': '{name} அவர்களுக்குச் செலுத்து · {title} · {brand}',
  'pay.meta.title.empty': 'பணம் செலுத்தும் இணைப்பு · {brand}',
  'pay.meta.description': 'உங்கள் சரியான பங்கைப் பார்த்து, எந்த UPI ஆப்பிலும் செலுத்துங்கள். {brand} மூலம் அனுப்பப்பட்டது.',
} as const satisfies Messages
