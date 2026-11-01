/** Tamil copy for raising a stuck payment (src/features/stuck/RaiseSheet.tsx): where to complain, the letter, and noting it was sent. */
import type { Messages } from '../types'

export const stuckhelp: Messages = {
  // The sheet's title, per rung ({amount} is pre-formatted: "₹300"; {name} a business: "Swiggy").
  'stuckhelp.title.bank': 'உங்கள் வங்கியிடம் புகார் செய்யுங்கள்',
  'stuckhelp.title.compensation': '{amount} இழப்பீட்டைக் கேளுங்கள்',
  'stuckhelp.title.compensationAny': 'இழப்பீட்டைக் கேளுங்கள்',
  'stuckhelp.title.ombudsman': 'RBI Ombudsman-இடம் கொண்டு செல்லுங்கள்',
  'stuckhelp.title.merchant': '{name}-இடம் ரீஃபண்டைக் கேளுங்கள்',
  'stuckhelp.title.merchantAny': 'ரீஃபண்டைக் கேளுங்கள்',
  'stuckhelp.title.nch': 'தேசிய நுகர்வோர் உதவி எண்',
  'stuckhelp.title.airsewa': 'AirSewa-வில் புகார் செய்யுங்கள்',
  'stuckhelp.title.commission': 'நுகர்வோர் ஆணையத்திடம் கொண்டு செல்லுங்கள்',

  // One line under the title: what this rung is.
  'stuckhelp.lead.bank': 'RBI விதிகளின்படி, உங்கள் வங்கி அதைத் திருப்பித் தர வேண்டும்; தாமதமாகும் ஒவ்வொரு நாளுக்கும் ₹100 தர வேண்டும்.',
  'stuckhelp.lead.compensation': 'RBI விதிகளின்படி, பணம் தாமதமான ஒவ்வொரு நாளுக்கும் உங்கள் வங்கி ₹100 தர வேண்டும். எழுத்துமூலம் கேளுங்கள்.',
  'stuckhelp.lead.ombudsman': 'உங்கள் வங்கி சரிசெய்யாதபோது, RBI-இன் புகார் சேவை.',
  'stuckhelp.lead.merchant': 'முதலில் அந்த நிறுவனத்திடமே, ஆர்டர் எண்ணுடன், எழுத்துமூலம் கேளுங்கள்.',
  'stuckhelp.lead.nch': 'அரசின் இந்த உதவி எண், உங்கள் புகாரை உங்களுக்காக அந்த நிறுவனத்திடம் கொண்டு செல்லும்.',
  'stuckhelp.lead.airsewa': 'விமான நிறுவனங்கள் மீதான புகார்களுக்கு, மத்திய சிவில் விமானப் போக்குவரத்து அமைச்சகத்தின் தளம்.',
  'stuckhelp.lead.commission': 'நுகர்வோர் ஆணையம் (நுகர்வோர் நீதிமன்றம்) வழக்கை முடிவு செய்யும். ஆன்லைனில் தாக்கல் செய்யலாம்.',

  // Your bank or UPI app, for a failed payment. App names and menu labels as each app shows them.
  'stuckhelp.bank.app.gpay':
    'Google Pay-இல், பரிவர்த்தனை வரலாற்றிலிருந்து இந்தப் பணத்தைத் திறந்து, Having issues, பிறகு Payment issue (அல்லது Stuck payment) தட்டி, டிக்கெட் உருவாக்குங்கள்.',
  'stuckhelp.bank.app.phonepe': 'PhonePe-இல், History-இல் இந்தப் பணத்தைத் திறந்து Contact PhonePe Support தட்டுங்கள்.',
  'stuckhelp.bank.app.paytm':
    'Paytm-இல், உங்கள் profile-ஐத் தட்டி, பிறகு Help & Support. இந்தப் பணத்தையும் பொருந்தும் பிரச்சினையையும் (money debited, failed அல்லது pending) தேர்ந்தெடுத்து, டிக்கெட் உருவாக்குங்கள்.',
  'stuckhelp.bank.app.other': '{app}-இல், உங்கள் வரலாற்றில் இந்தப் பணத்தைத் திறந்து, அதிலிருந்தே புகார் செய்யுங்கள். எல்லா UPI ஆப்களும் இதை அனுமதிக்க வேண்டும்.',
  'stuckhelp.bank.app.unknown': 'நீங்கள் செலுத்திய UPI ஆப்பில், இந்தப் பணத்தைத் திறந்து, அதிலிருந்தே புகார் செய்யுங்கள். எல்லா UPI ஆப்களும் இதை அனுமதிக்க வேண்டும்.',
  'stuckhelp.bank.card': 'உங்கள் வங்கியின் ஆப் அல்லது நெட் பேங்கிங்கில் இந்தப் பணத்துக்கு dispute (ஆட்சேபனை) பதிவு செய்யுங்கள், அல்லது உங்கள் கார்டின் பின்புறம் உள்ள எண்ணை அழையுங்கள்.',
  'stuckhelp.bank.atm': 'ATM வேறு வங்கியுடையதாக இருந்தாலும், உங்கள் கார்டை வழங்கிய வங்கியிடம் புகார் செய்யுங்கள்: அதன் ஆப்பில், வாடிக்கையாளர் சேவையில் அல்லது கிளையில்.',
  'stuckhelp.bank.wallet': 'வாலெட்டின் ஆப்பில், இந்தப் பணத்தைத் திறந்து அதன் உதவிப் பகுதியிலிருந்து புகார் செய்யுங்கள்.',
  'stuckhelp.bank.direct': 'உங்கள் வங்கியிடம் புகார் செய்யுங்கள்: வாடிக்கையாளர் சேவை, நெட் பேங்கிங்கில் உள்ள குறைதீர் படிவம், அல்லது கிளை.',
  'stuckhelp.bank.letter':
    'கீழே உள்ள கடிதத்தையும் உங்கள் வங்கிக்கு அனுப்புங்கள் — மின்னஞ்சல், நெட் பேங்கிங் அல்லது கிளை மூலம். பணத்தைத் திருப்பித் தருவதும், நாளுக்கு ₹100 தருவதும் வங்கியின் பொறுப்பு.',
  'stuckhelp.bank.myupi':
    'ஆப்பிலிருந்து பதில் இல்லையா? பணம் செலுத்திய 45 நாட்களுக்குள், 12 இலக்க UPI குறிப்பு எண்ணுடன் NPCI-இன் MyUPI தளத்தில் (upihelp.npci.org.in) புகார் செய்யுங்கள்.',
  'stuckhelp.bank.note': 'புகார் எண் கிடைத்ததா? “புகார் செய்துவிட்டேன்” மூலம் அதைச் சேமியுங்கள். 30 நாட்களில் சரியாகவில்லை என்றால், அடுத்தது RBI Ombudsman.',

  // The money came back late: the compensation claim.
  'stuckhelp.compensation.send': 'கீழே உள்ள கடிதத்தை உங்கள் வங்கிக்கு அனுப்புங்கள்: வாடிக்கையாளர் சேவைக்கு மின்னஞ்சலில், நெட் பேங்கிங்கின் குறைதீர் படிவத்தில், அல்லது கிளையில்.',
  'stuckhelp.compensation.why': 'RBI விதிகளின்படி, வங்கிகள் இதைக் கேட்காமலேயே தர வேண்டும். இந்தக் கடிதம் நாட்களைக் கணக்கிட்டு, எழுத்துமூலம் கேட்கிறது.',

  // The RBI Ombudsman ({phone}: 14448).
  'stuckhelp.ombudsman.when':
    'வங்கியிடம் புகார் செய்து 30 நாட்கள் ஆன பின் (வங்கி பதில் சொல்லி, அதில் உங்களுக்குத் திருப்தி இல்லை என்றால் அதற்கு முன்பே) தாக்கல் செய்யலாம்; அதன் பிறகு 90 நாட்களுக்குள் செய்ய வேண்டும்.',
  'stuckhelp.ombudsman.file': 'cms.rbi.org.in-இல் உங்கள் வங்கி மீது புகார் தாக்கல் செய்யுங்கள். படிவத்துக்கான விவரங்கள் கீழே உள்ளன.',
  'stuckhelp.ombudsman.paste':
    'புகாரின் விவரங்களாகக் கடிதத்தை ஒட்டுங்கள். வங்கியிடம் செய்த புகார், அதன் பதில் (இருந்தால்), பணம் கழிக்கப்பட்டதைக் காட்டும் கணக்கு அறிக்கை ஆகியவற்றை இணையுங்கள்.',
  'stuckhelp.ombudsman.call': 'சந்தேகமா? {phone}-ஐ அழையுங்கள்: திங்கள் முதல் சனி வரை, காலை 8 முதல் இரவு 10 வரை பதில் சொல்வார்கள். அவர்கள் வழிகாட்டுவார்கள், ஆனால் புகாரைப் பதிவு செய்ய மாட்டார்கள்.',
  'stuckhelp.ready.heading': 'இவற்றைத் தயாராக வைத்திருங்கள்',
  'stuckhelp.ready.complaint': 'வங்கியிடம் செய்த புகாரும் அதன் எண்ணும்',
  'stuckhelp.ready.reply': 'வங்கியின் பதில், அனுப்பியிருந்தால்',
  'stuckhelp.ready.payment': 'பணம் செலுத்திய தேதியும் குறிப்பு எண்ணும்',
  'stuckhelp.ready.account': 'உங்கள் கணக்கு அல்லது கார்டு எண்',
  'stuckhelp.ready.relief': 'நீங்கள் கேட்பது என்ன — கணக்கிட்ட இழப்பீட்டுடன் (கீழே)',

  // The business ({name}: "Swiggy").
  'stuckhelp.merchant.page': '{name}-இன் உதவிப் பக்கத்தைத் திறந்து, இந்த ஆர்டரைக் கண்டுபிடித்து, அதிலிருந்தே வாடிக்கையாளர் சேவையைத் தொடர்புகொள்ளுங்கள்.',
  'stuckhelp.merchant.app': '{name} ஆப் அல்லது இணையதளத்தில், இந்த ஆர்டரைத் திறந்து, அதிலிருந்தே வாடிக்கையாளர் சேவையைத் தொடர்புகொள்ளுங்கள்.',
  'stuckhelp.merchant.unknown': 'முடிந்தால் ஆர்டரிலிருந்தே, அந்த நிறுவனத்தின் வாடிக்கையாளர் சேவையைத் தொடர்புகொள்ளுங்கள்.',
  'stuckhelp.merchant.paste': 'கீழே உள்ள செய்தியை ஒட்டி, டிக்கெட் எண் கேளுங்கள்.',
  'stuckhelp.merchant.nextNch': 'ஒரு வாரத்தில் சரியாகவில்லையா? அடுத்தது தேசிய நுகர்வோர் உதவி எண்.',
  'stuckhelp.merchant.nextAirsewa': 'ஒரு வாரத்தில் சரியாகவில்லையா? அடுத்தது AirSewa.',
  'stuckhelp.rule.ecommerce':
    'ஆன்லைன் நிறுவனங்கள் புகாரை 48 மணி நேரத்துக்குள் ஏற்று, ஒரு மாதத்துக்குள் தீர்க்க வேண்டும் (நுகர்வோர் பாதுகாப்பு (மின்-வணிகம்) விதிகள், 2020).',
  'stuckhelp.rule.dgca': 'DGCA விதிகள்: கார்டு மூலம் செலுத்தியிருந்தால் 7 நாட்களுக்குள் ரீஃபண்ட்; ஏஜென்ட் அல்லது போர்டல் மூலம் புக் செய்திருந்தால் 14 வேலை நாட்களுக்குள்.',

  // The National Consumer Helpline ({whatsapp}: "+91 88000 01915", {phone}: 1915, {tollFree}: 1800-11-4000).
  'stuckhelp.nch.send': 'கீழே உள்ள செய்தியை {whatsapp}-க்கு WhatsApp-இல் அனுப்புங்கள், {phone} அல்லது {tollFree}-ஐ அழையுங்கள் (காலை 8 முதல் இரவு 8 வரை), அல்லது consumerhelpline.gov.in-இல் பதிவு செய்யுங்கள்.',
  'stuckhelp.nch.docket': 'உதவி எண் இதை {name}-இடம் எடுத்துச் செல்லும். அவர்கள் தரும் டாக்கெட் எண்ணைக் குறித்துக்கொள்ளுங்கள்.',
  'stuckhelp.nch.docketAny': 'உதவி எண் இதை அந்த நிறுவனத்திடம் எடுத்துச் செல்லும். அவர்கள் தரும் டாக்கெட் எண்ணைக் குறித்துக்கொள்ளுங்கள்.',
  'stuckhelp.nch.next': 'ஒரு மாதத்தில் தீரவில்லையா? அடுத்தது நுகர்வோர் ஆணையம்.',

  // AirSewa ({name}: "IndiGo").
  'stuckhelp.airsewa.file': 'airsewa.gov.in அல்லது AirSewa ஆப்பில் பதிவு செய்து, {name} மீது புகார் தாக்கல் செய்யுங்கள்.',
  'stuckhelp.airsewa.fileAny': 'airsewa.gov.in அல்லது AirSewa ஆப்பில் பதிவு செய்து, விமான நிறுவனம் மீது புகார் தாக்கல் செய்யுங்கள்.',
  'stuckhelp.airsewa.paste': 'கீழே உள்ள செய்தியை PNR-உடன் ஒட்டி, ரத்து விவரத்தையும் ரீஃபண்ட் செய்தியையும் இணையுங்கள்.',
  'stuckhelp.airsewa.note': 'AirSewa அனுப்பும் குறிப்பு எண்ணைக் குறித்துக்கொள்ளுங்கள்.',

  // A consumer commission.
  'stuckhelp.commission.where': 'நுகர்வோர் புகார்கள் e-Jagriti-இல் (e-jagriti.gov.in) ஆன்லைனில் தாக்கல் செய்யப்படுகின்றன. ₹50 லட்சம் வரையிலான தொகைக்கு, உங்கள் மாவட்ட ஆணையம்.',
  'stuckhelp.commission.attach': 'கீழே உள்ள சுருக்கத்திலிருந்து தொடங்குங்கள். ஆர்டர், ரீஃபண்ட் அல்லது தோல்விச் செய்தி, உங்கள் புகார்கள் அவற்றின் எண்களுடன் — இவற்றை இணையுங்கள்.',
  'stuckhelp.commission.advice': 'Settle சட்ட ஆலோசனை தராது. தாக்கல் செய்ய உதவி தேவைப்பட்டால், ஆணையத்திடமோ ஒரு நுகர்வோர் அமைப்பிடமோ கேளுங்கள்.',

  // Buttons and links that take you there ({phone}: "1915"; {name}: a business).
  'stuckhelp.link.cms': 'cms.rbi.org.in-ஐத் திற',
  'stuckhelp.link.call': '{phone}-ஐ அழை',
  'stuckhelp.link.myupi': 'NPCI-இன் MyUPI',
  'stuckhelp.link.phonepeGrievance': 'PhonePe குறைதீர் மையம்',
  'stuckhelp.link.merchantHelp': '{name} உதவியைத் திற',
  'stuckhelp.link.merchantRefunds': 'ரீஃபண்ட் பற்றி {name}',
  'stuckhelp.link.whatsapp': 'WhatsApp-இல் அனுப்பு',
  'stuckhelp.link.nchSite': 'consumerhelpline.gov.in',
  'stuckhelp.link.airsewa': 'AirSewa-வைத் திற',
  'stuckhelp.link.ejagriti': 'e-Jagriti-ஐத் திற',
  'stuckhelp.links.aria': 'அவர்களைத் தொடர்புகொள்ள மற்ற வழிகள்',
  'stuckhelp.newTab': '{label} (புதிய டேபில் திறக்கும்)',

  // The sheet.
  'stuckhelp.eyebrow': '{amount} · {name}',
  'stuckhelp.party.failed': 'தோல்வியடைந்த பணம்',
  'stuckhelp.party.refund': 'ரீஃபண்ட்',
  'stuckhelp.how.heading': 'எங்கே, எப்படி',
  'stuckhelp.fields.heading': 'படிவத்துக்காக',
  'stuckhelp.fields.hint': 'cms.rbi.org.in-இல் உள்ள புகார்ப் படிவத்தில் இவற்றை உள்ளிடுங்கள்.',
  'stuckhelp.field.entity': 'வங்கி',
  'stuckhelp.field.category': 'எதைப் பற்றியது',
  'stuckhelp.field.date': 'பணம் செலுத்திய தேதி',
  'stuckhelp.field.amount': 'தொகை',
  'stuckhelp.field.reference': 'பரிவர்த்தனைக் குறிப்பு எண்',
  'stuckhelp.field.account': 'கணக்கு அல்லது கார்டு',
  'stuckhelp.field.bankComplaint': 'வங்கியிடம் செய்த உங்கள் புகார்',
  'stuckhelp.field.relief': 'கோரும் நிவாரணம்',
  'stuckhelp.field.copy': '{field}-ஐ நகலெடு',
  'stuckhelp.field.copied': '{field} நகலெடுக்கப்பட்டது',
  // The letter's box: {kind} is letter, message or summary.
  'stuckhelp.letter.heading': '{kind, select, message {செய்தி} summary {சுருக்கம்} other {கடிதம்}}',
  'stuckhelp.letter.subject': 'பொருள்',
  'stuckhelp.letter.fill': 'அனுப்பும் முன், [ ] அடைப்புக்குறிக்குள் உள்ள பகுதிகளை நிரப்புங்கள்.',
  'stuckhelp.letter.actions': 'கடிதத்தை அனுப்பு',
  'stuckhelp.action.email': 'மின்னஞ்சல்',
  'stuckhelp.copied.status': 'நகலெடுக்கப்பட்டது',
  'stuckhelp.copied.toast': 'நகலெடுக்கப்பட்டது. அனுப்பும் இடத்தில் ஒட்டுங்கள்.',
  'stuckhelp.copyFailed.toast': 'நகலெடுக்க முடியவில்லை. உரையைத் தேர்ந்தெடுத்து நகலெடுங்கள்.',

  // "I've raised it": the day and the number they gave you.
  'stuckhelp.raised.cta': 'புகார் செய்துவிட்டேன்',
  'stuckhelp.raised.title': 'எப்போது புகார் செய்தீர்கள்?',
  'stuckhelp.raised.description': 'அடுத்த கட்டத்துக்கான காத்திருப்பை Settle இந்த நாளிலிருந்து எண்ணும்.',
  'stuckhelp.raised.date': 'புகார் செய்த நாள்',
  'stuckhelp.raised.ref': '{kind, select, merchant {டிக்கெட் எண்} nch {டாக்கெட் எண்} airsewa {குறிப்பு எண்} commission {வழக்கு எண்} other {புகார் எண்}}',
  'stuckhelp.raised.refHint': 'விருப்பம் — கொடுத்திருந்தால்',
  'stuckhelp.raised.save': 'சேமி',
  // {date}: "2 Nov"; {name}: the business.
  'stuckhelp.raised.toast':
    '{kind, select, bank {குறித்துக்கொண்டோம்: {date} அன்று உங்கள் வங்கியிடம் புகார் செய்யப்பட்டது} ombudsman {குறித்துக்கொண்டோம்: {date} அன்று RBI Ombudsman-இடம் கொண்டு செல்லப்பட்டது} merchant {குறித்துக்கொண்டோம்: {date} அன்று {name}-இடம் புகார் செய்யப்பட்டது} nch {குறித்துக்கொண்டோம்: {date} அன்று தேசிய நுகர்வோர் உதவி எண்ணில் புகார் செய்யப்பட்டது} airsewa {குறித்துக்கொண்டோம்: {date} அன்று AirSewa-வில் புகார் செய்யப்பட்டது} other {குறித்துக்கொண்டோம்: {date} அன்று நுகர்வோர் ஆணையத்தில் தாக்கல் செய்யப்பட்டது}}',
}
