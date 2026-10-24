/** Tamil copy for S4 · next round's on you. Keys: `rotation.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const rotation = {
  // "Everyone" in a round: the current members, you included.
  'rotation.everyone': '{count, plural, =2 {நீங்கள் இருவரும்} other {உங்களில் அனைத்து # பேரும்}}',
  'rotation.everyone.you': '{count, plural, =2 {நீங்கள் இருவரும்} other {அனைத்து #}}',
  // The card on a group, between where you stand and the tabs.
  'rotation.card.title': 'அடுத்த முறை {name} செலுத்த வேண்டும்',
  'rotation.card.title.you': 'அடுத்த முறை உங்கள் பொறுப்பு',
  'rotation.card.body': '{name} {behind} பின்தங்கியுள்ளார். {everyone} சார்பாக அடுத்த {squares} {name} செலுத்தினால், {name} அவர்களுக்குக் கணக்கு சமமாகும்.',
  'rotation.card.body.you': 'நீங்கள் {behind} பின்தங்கியுள்ளீர்கள். {everyone} சார்பாக அடுத்த {squares} செலுத்தினால் உங்கள் கணக்கு சமமாகும்.',
  'rotation.card.usual': 'இங்கு வழக்கமான சுற்று {usual}. அது குழுவின் பாக்கி {out} இல் {settles} தீர்க்கும்.',
  // When the usual round is bigger than helps.
  'rotation.card.fallback': '{name} {behind} பின்தங்கியுள்ளார். {everyone} சார்பாக {squares} வரை செலுத்தினால் {name} அவர்களுக்குக் கணக்கு சமமாகும் — பெரிய சுற்று {name} அவர்களை முன்னால் கொண்டு சென்றுவிடும்.',
  'rotation.card.fallback.you': 'நீங்கள் {behind} பின்தங்கியுள்ளீர்கள். {everyone} சார்பாக {squares} வரை செலுத்தினால் உங்கள் கணக்கு சமமாகும் — பெரிய சுற்று உங்களை முன்னால் கொண்டு சென்றுவிடும்.',
  // When only people who left the group are behind.
  'rotation.card.left.title': 'அதற்குப் பதிலாகக் கணக்கு தீர்',
  'rotation.card.left': 'குழுவை விட்டு வெளியேறிய {name} {amount} தர வேண்டியுள்ளது — அதற்குப் பதிலாகக் கணக்கு தீர்க்கவும்.',
  'rotation.card.left.many': 'குழுவை விட்டு வெளியேறிய {count} பேர் {amount} தர வேண்டியுள்ளது — அதற்குப் பதிலாகக் கணக்கு தீர்க்கவும்.',
  'rotation.card.log.cta': 'அடுத்த சுற்றைப் பதிவு செய்',
  'rotation.card.plan.cta': 'சுற்று அட்டவணையைப் பார்',
  'rotation.card.settle.cta': 'கணக்கு தீர்',
  // The banner on the new split the card opens.
  'rotation.banner.title': '{name} சுற்று',
  'rotation.banner.title.you': 'உங்கள் சுற்று',
  'rotation.banner.body': '{amount} வரை {name} அவர்களுக்குக் கணக்கு சமமாகும். அதற்கு மேல் {name} முன்னால் இருப்பார்.',
  'rotation.banner.body.you': '{amount} வரை உங்கள் கணக்கு சமமாகும். அதற்கு மேல் நீங்கள் முன்னால் இருப்பீர்கள்.',
  // The rotation sheet.
  'rotation.sheet.title': 'முன்னே செலுத்துங்கள்',
  'rotation.sheet.description': 'ஒருவருக்கொருவர் திருப்பிச் செலுத்துவதற்குப் பதிலாக, மாறி மாறி அனைவருக்காகவும் செலுத்துங்கள். ஒவ்வொரு சுற்றும் {everyone} இடையே சமமாகப் பிரிக்கப்படும்.',
  'rotation.sheet.amount.label': 'ஒவ்வொரு சுற்றும், சுமார்',
  'rotation.sheet.amount.error': 'தொகையை உள்ளிடுங்கள்',
  'rotation.sheet.reset.cta': 'மீட்டமை',
  'rotation.sheet.reset.aria': 'வழக்கமான சுற்றுக்கு மீட்டமை',
  'rotation.sheet.rounds.label': 'சுற்றுகள்',
  'rotation.sheet.round.title': '{n} · {name} செலுத்துகிறார்',
  'rotation.sheet.round.title.you': '{n} · நீங்கள் செலுத்துகிறீர்கள்',
  'rotation.sheet.round.subtitle': 'குழு பாக்கி {before} → {after}',
  'rotation.sheet.round.settles': '{amount} தீர்க்கிறது',
  'rotation.sheet.round.aria': 'சுற்று {n}, {name} செலுத்துகிறார், குழு பாக்கி {before} இலிருந்து {after} ஆக, {amount} தீர்க்கிறது',
  'rotation.sheet.round.aria.you': 'சுற்று {n}, நீங்கள் செலுத்துகிறீர்கள், குழு பாக்கி {before} இலிருந்து {after} ஆக, {amount} தீர்க்கிறது',
  'rotation.sheet.square': 'சுற்று {n} முடிந்ததும் அனைவரின் கணக்கும் சமம் 🎉',
  'rotation.sheet.leftover': 'பிறகு கடைசி {amount} ஐத் தீர்க்கவும்:',
  'rotation.sheet.empty.title': '{amount} சுற்று யாருடைய பாக்கியையும் விடப் பெரியது',
  'rotation.sheet.empty.body': 'சிறிய சுற்றை முயற்சி செய்யுங்கள் — அல்லது கணக்கு தீர்க்கவும்.',
  'rotation.sheet.settle.cta': 'கணக்கு தீர்',
  'rotation.sheet.log.cta': '{name} செலுத்த, சுற்று 1 ஐப் பதிவு செய்',
  'rotation.sheet.log.cta.you': 'நீங்கள் செலுத்த, சுற்று 1 ஐப் பதிவு செய்',
  'rotation.sheet.live': 'திட்டம் புதுப்பிக்கப்பட்டது: {count, plural, one {# சுற்று} other {# சுற்றுகள்}}',
  'rotation.sheet.live.none': 'திட்டம் புதுப்பிக்கப்பட்டது: எந்தச் சுற்றும் உதவாது',
} as const satisfies Messages
