/** Tamil copy for share texts and cards (src/share). Keys: `share.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const share = {
  // Category names, in the app and on everything that leaves it (pay links, cards, summaries).
  'share.category.food': 'உணவு & பானங்கள்',
  'share.category.groceries': 'மளிகை',
  'share.category.rent': 'வாடகை',
  'share.category.utilities': 'பில்கள் & பயன்பாடுகள்',
  'share.category.travel': 'பயணம் & தங்குமிடம்',
  'share.category.transport': 'போக்குவரத்து',
  'share.category.shopping': 'ஷாப்பிங்',
  'share.category.entertainment': 'பொழுதுபோக்கு',
  'share.category.subscription': 'சந்தாக்கள்',
  'share.category.gift': 'பரிசுகள்',
  'share.category.health': 'உடல்நலம்',
  'share.category.other': 'மற்றவை',
  // Reminder ("nudge") tones.
  'share.nudge.tone.friendly': 'நட்பாக',
  'share.nudge.tone.funny': 'நகைச்சுவையாக',
  'share.nudge.tone.firm': 'உறுதியாக',
  // Reminder wordings, sent to the friend in the sender's language. `{to}` is their first name,
  // `{amount}` the money, `{what}` what it was for. Keep the same number of wordings per tone.
  'share.nudge.friendly.0': 'வணக்கம் {to}! 👋 ஒரு மென்மையான நினைவூட்டல்: {what} இல் உங்கள் பங்கு {amount}. அவசரமில்லை!',
  'share.nudge.friendly.1': 'வணக்கம் {to} 🙂 {what} இல் உங்கள் பங்கு {amount} ஆகிறது. உங்களுக்கு நேரம் கிடைக்கும்போது தீர்த்துவிடுங்கள்!',
  'share.nudge.friendly.2': 'வணக்கம் {to}, நலமா? ஒரு சின்ன விஷயம்: {what} இல் {amount}. மிக்க நன்றி 🙏',
  'share.nudge.friendly.3': '{to}! {what} பற்றிய சிறிய நினைவூட்டல்: உங்கள் பங்கு {amount}. நன்றி 😊',
  'share.nudge.funny.0': 'தட்டு தட்டு, {to} 🚪 யார் அது? {amount}. {amount} யார்? {what} இல் உள்ள {amount} 😄',
  'share.nudge.funny.1': 'பரபரப்புச் செய்தி 📰 {what} இல் {amount} கடைசியாக உங்கள் பக்கம் வந்துகொண்டிருந்தது, {to}. அது வீடு திரும்ப உதவுங்கள் 🏠',
  'share.nudge.funny.2': '{to}, என் பர்ஸ் உங்களைப் பற்றி அடிக்கடி கேட்கிறது 👀 {what} இல் {amount}, நீங்கள் தயாரானதும்!',
  'share.nudge.funny.3': 'திருப்பம், {to}: {what} இலவசமாக இல்லை 🍿 உங்கள் பங்கு {amount} 😅',
  'share.nudge.firm.0': 'வணக்கம் {to}, {what} இல் {amount} இன்னும் நிலுவையில் உள்ளது என்று நினைவூட்டுகிறோம். இன்றே தீர்த்துவிடுங்கள்.',
  'share.nudge.firm.1': 'வணக்கம் {to}, {what} இல் உங்கள் {amount} பங்கு செலுத்த வேண்டியுள்ளது. முடிந்தவரை விரைவில் செலுத்துங்கள்.',
  'share.nudge.firm.2': '{to}, {what} இல் {amount} பற்றித் தொடர்கிறோம். இன்றே தீர்க்க முடியுமா?',
  // The words before the pay link at the end of a reminder ("Tap to pay: https://…").
  'share.nudge.link.friendly': 'பணம் செலுத்த தட்டுங்கள்',
  'share.nudge.link.funny': 'ஒரே தட்டில் நாம் சமம்',
  'share.nudge.link.firm': 'இங்கே செலுத்துங்கள்',
  // The UPI line of a reminder.
  'share.nudge.upi.mine': 'என் UPI: {upi}',
  'share.nudge.upi': '{name} அவர்களுக்கு UPI மூலம் செலுத்துங்கள்: {upi}',
  // Greeting when there's no name ("Hey there!"), and what it was for when there's no title.
  'share.nudge.there': 'நண்பரே',
  'share.nudge.ourSplit': 'நம் பிரிப்பு',
  // A UPI payment request sent from the pay sheet (then "Pay Riya on UPI: …" and the link).
  'share.upiRequest.for': 'வணக்கம் {name}, {merchant} இல் உங்கள் பங்கு {amount}.',
  'share.upiRequest.bill': 'வணக்கம் {name}, பில்லில் உங்கள் பங்கு {amount}.',
  'share.upiRequest.tap': 'அல்லது செலுத்த தட்டுங்கள்: {link}',
  // The full text summary of a split ("Copy text").
  'share.summary.total': 'மொத்தம் {amount}',
  'share.summary.totalSplit': 'மொத்தம் {amount} · {count, plural, one {# வழியில்} other {# வழிகளில்}} பிரிக்கப்பட்டது',
  // After the payer's amount: "Ayush   ₹691.50 · paid the bill".
  'share.summary.paidTheBill': 'பில் செலுத்தியவர்',
  'share.summary.payUpi': '{name} அவர்களுக்கு UPI மூலம் செலுத்துங்கள்: {upi}',
  'share.summary.payTap': 'ஒரே தட்டில் செலுத்த: {link}',
  'share.summary.footer': '— {brand} மூலம் பிரிக்கப்பட்டது',
  // The short message that carries a pay link into the group chat. 🧾 starts the first line.
  'share.message.settled': '🧾 {title} · அனைத்தும் தீர்ந்தது ✓',
  'share.message.total': '🧾 {title} · {amount}',
  'share.message.split': '🧾 {title} · {amount} {count} வழிகளில் பிரிக்கப்பட்டது',
  'share.message.see': 'பிரிப்பைப் பாருங்கள் 👇',
  'share.message.payMe': 'எந்த UPI ஆப்பிலும் எனக்குச் செலுத்த, உங்கள் பெயரைத் தட்டுங்கள் 👇',
  'share.message.pay': 'எந்த UPI ஆப்பிலும் {name} அவர்களுக்குச் செலுத்த, உங்கள் பெயரைத் தட்டுங்கள் 👇',
  'share.message.seeShare': 'உங்கள் பங்கைப் பார்க்க, உங்கள் பெயரைத் தட்டுங்கள் 👇',
  // The share card image of a split (drawn in the sender's language).
  'share.card.morePeople': '{count, plural, one {மேலும் # நபர்} other {மேலும் # நபர்கள்}}',
  'share.card.paidBy': '{name} செலுத்தியது',
  'share.card.splitWays': '{count, plural, one {# வழியில்} other {# வழிகளில்}} பிரிக்கப்பட்டது',
  'share.card.status.payer': 'பில் செலுத்தியவர்',
  'share.card.status.paid': 'திருப்பிச் செலுத்தியது',
  'share.card.status.owes': 'இன்னும் செலுத்தவில்லை',
  'share.card.status.zero': 'செலுத்த எதுவுமில்லை',
  'share.card.paidCount': '{count} இல் {paid} செலுத்தியுள்ளனர்',
  'share.card.allSettled': 'அனைத்தும் தீர்ந்தது',
  'share.card.collected': '{owed} இல் {collected} வசூலானது',
  'share.card.madeWith': '{brand} மூலம் உருவாக்கப்பட்டது',
  // Names when there's nothing better to show (the owner, a removed friend).
  'share.card.me': 'நான்',
  'share.card.friend': 'நண்பர்',
  // The group summary card.
  'share.card.kind.trip': 'பயணம்',
  'share.card.kind.home': 'வீடு',
  'share.card.kind.couple': 'ஜோடி',
  'share.card.kind.event': 'நிகழ்வு',
  'share.card.kind.other': 'குழு',
  'share.card.someone': 'யாரோ ஒருவர்',
  'share.card.someone.object': 'யாரோ ஒருவர்',
  'share.card.pays': '{from} {to} அவர்களுக்குச் செலுத்துகிறார்',
  'share.card.people': '{count, plural, one {# நபர்} other {# நபர்கள்}}',
  'share.card.expenses': '{count, plural, one {# செலவு} other {# செலவுகள்}}',
  'share.card.totalSpent': 'மொத்த செலவு',
  'share.card.settled': 'அனைவரும் கணக்கு தீர்த்துவிட்டனர்',
  'share.card.settled.body': 'எந்தச் செலுத்தலும் தேவையில்லை',
  'share.card.empty': 'தீர்க்க இன்னும் எதுவுமில்லை',
  'share.card.empty.body': 'இதுவரை செலவுகள் இல்லை',
  'share.card.payments': '{count, plural, one {# செலுத்தல்} other {# செலுத்தல்கள்}}',
  'share.card.toSettle': 'கணக்கு தீர்க்க',
  'share.card.morePayments': '{count, plural, one {மேலும் # செலுத்தல்} other {மேலும் # செலுத்தல்கள்}}',
  // Names used when a person never gave one (share/fallbacks.ts): the organiser or payee, a numbered person, anyone unnamed.
  'share.fallback.friend': 'உங்கள் நண்பர்',
  'share.fallback.person': 'நபர் {n}',
  'share.fallback.someone': 'யாரோ ஒருவர்',
  // The note on a UPI payment that has no title (it shows in the payer's UPI app).
  'share.upi.note': 'பில் பிரிப்பு',
  // Why a share card image couldn't be made.
  'share.card.error.canvas': 'இந்த உலாவியால் படங்களை வரைய முடியாது',
  'share.card.error.render': 'படத்தை உருவாக்க முடியவில்லை',
} as const satisfies Messages
