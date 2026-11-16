/** Tamil copy for raising a stuck payment (src/features/stuck/RaiseSheet.tsx): where to complain, the letter, and noting it was sent. */
import type { Messages } from '../types'

export const stuckhelp: Messages = {
  // The sheet's title, per rung — the same words as the button that opens it ({amount} is pre-formatted: "₹300"; {name} a business or a wallet: "Swiggy", "Paytm").
  'stuckhelp.title.bank': 'உங்கள் வங்கியிடம் புகார் செய்யுங்கள்',
  'stuckhelp.title.wallet': '{name} நிறுவனத்திடம் புகார் செய்யுங்கள்',
  'stuckhelp.title.walletAny': 'வாலெட் நிறுவனத்திடம் புகார் செய்யுங்கள்',
  'stuckhelp.title.compensation': '{amount} இழப்பீட்டைக் கேளுங்கள்',
  'stuckhelp.title.compensationAny': 'இழப்பீட்டைக் கேளுங்கள்',
  'stuckhelp.title.ombudsman': 'RBI Ombudsman-இடம் கொண்டு செல்லுங்கள்',
  'stuckhelp.title.merchant': '{name} நிறுவனத்திடம் புகார் செய்யுங்கள்',
  'stuckhelp.title.merchantAny': 'அந்த நிறுவனத்திடம் புகார் செய்யுங்கள்',
  'stuckhelp.title.nch': 'தேசிய நுகர்வோர் உதவி எண்ணிடம் கொண்டு செல்லுங்கள்',
  'stuckhelp.title.airsewa': 'AirSewa தளத்துக்குக் கொண்டு செல்லுங்கள்',
  'stuckhelp.title.commission': 'நுகர்வோர் ஆணையத்திடம் கொண்டு செல்லுங்கள்',

  // One line under the title: what this rung is.
  'stuckhelp.lead.bank': 'RBI விதிகளின்படி, உங்கள் வங்கி அதைத் திருப்பித் தர வேண்டும்; தாமதமாகும் ஒவ்வொரு நாளுக்கும் ₹100 தர வேண்டும்.',
  'stuckhelp.lead.wallet': 'RBI விதிகளின்படி, வாலெட் நிறுவனம் அதை அடுத்த நாளுக்குள் திருப்பித் தர வேண்டும்; தாமதமாகும் ஒவ்வொரு நாளுக்கும் ₹100 தர வேண்டும்.',
  'stuckhelp.lead.compensation': 'RBI விதிகளின்படி, பணம் தாமதமான ஒவ்வொரு நாளுக்கும் உங்கள் வங்கி ₹100 தர வேண்டும். எழுத்துமூலம் கேளுங்கள்.',
  'stuckhelp.lead.compensationWallet': 'RBI விதிகளின்படி, பணம் தாமதமான ஒவ்வொரு நாளுக்கும் வாலெட் நிறுவனம் ₹100 தர வேண்டும். எழுத்துமூலம் கேளுங்கள்.',
  'stuckhelp.lead.ombudsman': 'உங்கள் வங்கி சரிசெய்யாதபோது, RBI-இன் புகார் சேவை.',
  'stuckhelp.lead.ombudsmanWallet': 'வாலெட் நிறுவனம் சரிசெய்யாதபோது, RBI-இன் புகார் சேவை.',
  'stuckhelp.lead.merchant': 'முதலில் அந்த நிறுவனத்திடமே, ஆர்டர் எண்ணுடன், எழுத்துமூலம் கேளுங்கள்.',
  'stuckhelp.lead.airline': 'முதலில் அந்த விமான நிறுவனத்திடமே, உங்கள் PNR-உடன், எழுத்துமூலம் கேளுங்கள்.',
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
    'ஆப்பிலிருந்து பதில் இல்லையா? பணம் செலுத்திய 45 நாட்களுக்குள் UPI உதவி இணையதளத்தில் (upihelp.npci.org.in; UPI-ஐ இயக்கும் NPCI நிறுவனம் நடத்துவது) புகார் செய்யுங்கள். உங்கள் SMS-இல் உள்ள 12 இலக்க எண்ணைத் தயாராக வைத்திருங்கள்.',
  'stuckhelp.bank.myupiPassed':
    'UPI உதவி இணையதளம் பணம் செலுத்திய 45 நாட்களுக்குள் மட்டுமே புகார்களை ஏற்கும்; அந்தக் காலம் கடந்துவிட்டது. அதற்குப் பதிலாக, கடிதத்தை உங்கள் வங்கிக்கு அனுப்புங்கள்.',
  'stuckhelp.bank.note': 'புகார் எண் கிடைத்ததா? “புகார் செய்துவிட்டேன்” மூலம் அதைச் சேமியுங்கள். 30 நாட்களில் சரியாகவில்லை என்றால், அடுத்தது RBI Ombudsman.',
  // Once it's raised ({date}: "2 Nov"; {ref}: the complaint number, or "none").
  'stuckhelp.bank.raised':
    '{date} அன்று புகார் செய்தீர்கள்{ref, select, none {} other { (புகார் எண் {ref})}}. அன்றிலிருந்து 30 நாட்களுக்குள் சரியாகவில்லை என்றால், அடுத்தது RBI Ombudsman.',

  // A wallet payment ({name}: "Paytm").
  'stuckhelp.wallet.app': '{name} ஆப்பில், இந்தப் பணத்தைத் திறந்து, அதன் உதவிப் பகுதியிலிருந்து புகார் செய்யுங்கள்.',
  'stuckhelp.wallet.letter':
    'ஆப்பில் சரியாகவில்லையா? கீழே உள்ள கடிதத்தை வாலெட் நிறுவனத்தின் குறைதீர் அதிகாரிக்கு அனுப்புங்கள்; தொடர்பு விவரம் ஆப்பின் உதவிப் பகுதியில் அல்லது அதன் குறைதீர் கொள்கையில் இருக்கும். பணத்தைத் திருப்பித் தருவதும், நாளுக்கு ₹100 தருவதும் வாலெட் நிறுவனத்தின் பொறுப்பு.',

  // The money came back late: the compensation claim.
  'stuckhelp.compensation.send': 'கீழே உள்ள கடிதத்தை உங்கள் வங்கிக்கு அனுப்புங்கள்: வாடிக்கையாளர் சேவைக்கு மின்னஞ்சலில், நெட் பேங்கிங்கின் குறைதீர் படிவத்தில், அல்லது கிளையில்.',
  'stuckhelp.compensation.sendWallet': 'கீழே உள்ள கடிதத்தை வாலெட் நிறுவனத்தின் குறைதீர் அதிகாரிக்கு அனுப்புங்கள்: மின்னஞ்சலில், அல்லது அதன் ஆப்பின் உதவிப் பகுதியிலிருந்து.',
  'stuckhelp.compensation.why': 'RBI விதிகளின்படி, இதைக் கேட்காமலேயே தர வேண்டும். இந்தக் கடிதம் நாட்களைக் கணக்கிட்டு, எழுத்துமூலம் கேட்கிறது.',

  // The RBI Ombudsman ({phone}: 14448; {issuer}: "Paytm Payments Bank Ltd"; {email}: crpc@rbi.org.in; {address}: the RBI's postal address, in English).
  'stuckhelp.ombudsman.when':
    'வங்கியிடம் புகார் செய்து 30 நாட்கள் ஆன பின் (வங்கி பதில் சொல்லி, அதில் உங்களுக்குத் திருப்தி இல்லை என்றால் அதற்கு முன்பே) தாக்கல் செய்யலாம். அந்த 30 நாட்கள் முடிந்த நாள், வங்கியின் கடைசிப் பதில் வந்த நாள் — இவற்றில் எது பிந்தையதோ, அதிலிருந்து 90 நாட்கள் உங்களுக்கு உள்ளன.',
  'stuckhelp.ombudsman.whenWallet':
    'வாலெட் நிறுவனத்திடம் புகார் செய்து 30 நாட்கள் ஆன பின் (அது பதில் சொல்லி, அதில் உங்களுக்குத் திருப்தி இல்லை என்றால் அதற்கு முன்பே) தாக்கல் செய்யலாம். அந்த 30 நாட்கள் முடிந்த நாள், அதன் கடைசிப் பதில் வந்த நாள் — இவற்றில் எது பிந்தையதோ, அதிலிருந்து 90 நாட்கள் உங்களுக்கு உள்ளன.',
  // This case's last day ({date}: "2 Mar 2027"; {kind}: bank or wallet).
  'stuckhelp.ombudsman.lastDay':
    '{kind, select, wallet {அதிகபட்சம் {date} தேதிக்குள் தாக்கல் செய்யுங்கள்: வாலெட் நிறுவனத்தின் 30 நாட்கள் முடிந்த நாள், அதன் கடைசிப் பதில் வந்த நாள் — இவற்றில் எது பிந்தையதோ, அதிலிருந்து 90 நாட்கள் (RBI ஒருங்கிணைந்த Ombudsman திட்டம், 2026).} other {அதிகபட்சம் {date} தேதிக்குள் தாக்கல் செய்யுங்கள்: உங்கள் வங்கியின் 30 நாட்கள் முடிந்த நாள், அதன் கடைசிப் பதில் வந்த நாள் — இவற்றில் எது பிந்தையதோ, அதிலிருந்து 90 நாட்கள் (RBI ஒருங்கிணைந்த Ombudsman திட்டம், 2026).}}',
  'stuckhelp.ombudsman.post': 'இணையதளத்தைப் பயன்படுத்த முடியவில்லையா? புகாரை {email} முகவரிக்கு மின்னஞ்சல் செய்யுங்கள், அல்லது அதில் கையொப்பமிட்டு, உங்கள் ஆவணங்களின் நகல்களுடன் இந்த முகவரிக்குத் தபாலில் அனுப்புங்கள்: {address}.',
  'stuckhelp.ombudsman.file': 'cms.rbi.org.in-இல் உங்கள் வங்கி மீது புகார் தாக்கல் செய்யுங்கள். படிவத்துக்கான விவரங்கள் கீழே உள்ளன.',
  'stuckhelp.ombudsman.fileWallet': 'cms.rbi.org.in-இல், வாலெட்டை நடத்தும் நிறுவனமான {issuer} மீது புகார் தாக்கல் செய்யுங்கள். படிவத்துக்கான விவரங்கள் கீழே உள்ளன.',
  'stuckhelp.ombudsman.fileWalletAny': 'cms.rbi.org.in-இல், வாலெட்டை நடத்தும் நிறுவனம் மீது புகார் தாக்கல் செய்யுங்கள். படிவத்துக்கான விவரங்கள் கீழே உள்ளன.',
  'stuckhelp.ombudsman.paste':
    'புகாரின் விவரங்களாகக் கடிதத்தை ஒட்டுங்கள். வங்கியிடம் செய்த புகார், அதன் பதில் (இருந்தால்), பணம் கழிக்கப்பட்டதைக் காட்டும் கணக்கு அறிக்கை ஆகியவற்றை இணையுங்கள்.',
  'stuckhelp.ombudsman.pasteWallet':
    'புகாரின் விவரங்களாகக் கடிதத்தை ஒட்டுங்கள். வாலெட் நிறுவனத்திடம் செய்த புகார், அதன் பதில் (இருந்தால்), பணம் கழிக்கப்பட்டதைக் காட்டும் வாலெட் அறிக்கை ஆகியவற்றை இணையுங்கள்.',
  'stuckhelp.ombudsman.call': 'சந்தேகமா? {phone}-ஐ அழையுங்கள்: திங்கள் முதல் சனி வரை, காலை 8 முதல் இரவு 10 வரை பதில் சொல்வார்கள். அவர்கள் வழிகாட்டுவார்கள், ஆனால் புகாரைப் பதிவு செய்ய மாட்டார்கள்.',
  'stuckhelp.ready.heading': 'இவற்றைத் தயாராக வைத்திருங்கள்',
  'stuckhelp.ready.complaint': 'வங்கியிடம் செய்த புகாரும் அதன் எண்ணும்',
  'stuckhelp.ready.complaintWallet': 'வாலெட் நிறுவனத்திடம் செய்த புகாரும் அதன் எண்ணும்',
  'stuckhelp.ready.reply': 'வங்கியின் பதில், அனுப்பியிருந்தால்',
  'stuckhelp.ready.replyWallet': 'வாலெட் நிறுவனத்தின் பதில், அனுப்பியிருந்தால்',
  'stuckhelp.ready.payment': 'பணம் செலுத்திய தேதியும் குறிப்பு எண்ணும்',
  'stuckhelp.ready.account': 'உங்கள் கணக்கு அல்லது கார்டு எண்',
  'stuckhelp.ready.wallet': 'வாலெட்டில் பதிவு செய்த மொபைல் எண்',
  'stuckhelp.ready.relief': 'நீங்கள் கேட்பது என்ன — கணக்கிட்ட இழப்பீட்டுடன் (கீழே)',

  // The business ({name}: "Swiggy").
  'stuckhelp.merchant.page': '{name} நிறுவனத்தின் உதவிப் பக்கத்தைத் திறந்து, இந்த ஆர்டரைக் கண்டுபிடித்து, அதிலிருந்தே வாடிக்கையாளர் சேவையைத் தொடர்புகொள்ளுங்கள்.',
  'stuckhelp.merchant.app': '{name} ஆப் அல்லது இணையதளத்தில், இந்த ஆர்டரைத் திறந்து, அதிலிருந்தே வாடிக்கையாளர் சேவையைத் தொடர்புகொள்ளுங்கள்.',
  'stuckhelp.merchant.unknown': 'முடிந்தால் ஆர்டரிலிருந்தே, அந்த நிறுவனத்தின் வாடிக்கையாளர் சேவையைத் தொடர்புகொள்ளுங்கள்.',
  // An airline: a booking, not an order.
  'stuckhelp.merchant.pageBooking': '{name} நிறுவனத்தின் உதவிப் பக்கத்தைத் திறந்து, இந்த புக்கிங்கைக் கண்டுபிடித்து, அதிலிருந்தே வாடிக்கையாளர் சேவையைத் தொடர்புகொள்ளுங்கள்.',
  'stuckhelp.merchant.appBooking': '{name} ஆப் அல்லது இணையதளத்தில், இந்த புக்கிங்கைத் திறந்து, அதிலிருந்தே வாடிக்கையாளர் சேவையைத் தொடர்புகொள்ளுங்கள்.',
  'stuckhelp.merchant.nodal': 'சில நாட்களில் பதில் இல்லையா? உங்கள் PNR, டிக்கெட் எண்ணுடன், {name} நிறுவனத்தின் புகார்களுக்கான நோடல் அதிகாரிக்கு எழுதுங்கள் (தொடர்பு விவரம் அதன் இணையதளத்தில் இருக்கும்).',
  'stuckhelp.merchant.nodalAny': 'சில நாட்களில் பதில் இல்லையா? உங்கள் PNR, டிக்கெட் எண்ணுடன், விமான நிறுவனத்தின் புகார்களுக்கான நோடல் அதிகாரிக்கு எழுதுங்கள் (தொடர்பு விவரம் அதன் இணையதளத்தில் இருக்கும்).',
  'stuckhelp.merchant.paste': 'கீழே உள்ள செய்தியை ஒட்டி, டிக்கெட் எண் கேளுங்கள்.',
  // Settle's own advice (a week), not the law's month.
  'stuckhelp.merchant.nextNch': 'ஒரு வாரம் அவகாசம் கொடுங்கள். இன்னும் சரியாகவில்லையா? தேசிய நுகர்வோர் உதவி எண்ணை அணுகலாம்; முழு மாதம் காத்திருக்க வேண்டியதில்லை.',
  'stuckhelp.merchant.nextAirsewa': 'ஒரு வாரம் அவகாசம் கொடுங்கள். இன்னும் சரியாகவில்லையா? AirSewa தளத்தை அணுகலாம்.',
  'stuckhelp.rule.ecommerce':
    'ஆன்லைன் நிறுவனங்கள் புகாரை 48 மணி நேரத்துக்குள் ஏற்று, ஒரு மாதத்துக்குள் தீர்க்க வேண்டும் (நுகர்வோர் பாதுகாப்பு (மின்வணிகம்) விதிகள், 2020).',
  'stuckhelp.rule.dgca': 'DGCA விதிகள்: கார்டு மூலம் செலுத்தியிருந்தால் 7 நாட்களுக்குள் ரீஃபண்ட்; ஏஜென்ட் அல்லது போர்டல் மூலம் புக் செய்திருந்தால் 14 வேலை நாட்களுக்குள்.',

  // The National Consumer Helpline ({whatsapp}: "+91 88000 01915", {phone}: 1915, {tollFree}: 1800-11-4000).
  'stuckhelp.nch.send': 'கீழே உள்ள செய்தியை {whatsapp}-க்கு WhatsApp-இல் அனுப்புங்கள், {phone} அல்லது {tollFree}-ஐ அழையுங்கள் (காலை 8 முதல் இரவு 8 வரை), அல்லது consumerhelpline.gov.in-இல் பதிவு செய்யுங்கள்.',
  'stuckhelp.nch.docket': 'உதவி எண் இதை {name} நிறுவனத்திடம் எடுத்துச் செல்லும். அவர்கள் தரும் டாக்கெட் எண்ணைக் குறித்துக்கொள்ளுங்கள்.',
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
  'stuckhelp.link.myupi': 'UPI உதவி இணையதளம்',
  'stuckhelp.link.phonepeGrievance': 'PhonePe குறைதீர் மையம்',
  'stuckhelp.link.merchantHelp': '{name} உதவியைத் திற',
  'stuckhelp.link.merchantRefunds': '{name} ரீஃபண்ட் உதவியைத் திற',
  'stuckhelp.link.whatsapp': 'WhatsApp-இல் அனுப்பு',
  'stuckhelp.link.nchSite': 'consumerhelpline.gov.in',
  'stuckhelp.link.airsewa': 'AirSewa-வைத் திற',
  'stuckhelp.link.ejagriti': 'e-Jagriti-ஐத் திற',
  'stuckhelp.links.aria': 'அவர்களைத் தொடர்புகொள்ள மற்ற வழிகள்',
  'stuckhelp.newTab': '{label} (புதிய டேபில் திறக்கும்)',

  // The sheet. Above the title, what's still owed ({amount}, {rest}, {owed}: "₹49"; {name}: who it was paid to, or the business).
  'stuckhelp.eyebrow': '{amount} · {name}',
  'stuckhelp.eyebrow.part': '{amount} தொகையில் {rest} · {name}',
  'stuckhelp.eyebrow.owed': 'காத்திருந்ததற்கு {owed} · {name}',
  'stuckhelp.party.failed': 'தோல்வியடைந்த பணம்',
  'stuckhelp.party.refund': 'ரீஃபண்ட்',
  'stuckhelp.how.heading': 'எங்கே, எப்படி',
  'stuckhelp.fields.heading': 'படிவத்துக்காக',
  'stuckhelp.fields.hint': 'cms.rbi.org.in-இல் உள்ள புகார்ப் படிவத்தில் இவற்றை உள்ளிடுங்கள்.',
  'stuckhelp.field.entity': 'வங்கி',
  'stuckhelp.field.entityWallet': 'வாலெட் நிறுவனம்',
  'stuckhelp.field.category': 'எதைப் பற்றியது',
  'stuckhelp.field.date': 'பணம் செலுத்திய தேதி',
  'stuckhelp.field.amount': 'தொகை',
  'stuckhelp.field.reference': 'பரிவர்த்தனைக் குறிப்பு எண்',
  'stuckhelp.field.account': 'கணக்கு அல்லது கார்டு',
  'stuckhelp.field.mobile': 'பதிவு செய்த மொபைல் எண்',
  'stuckhelp.field.bankComplaint': 'வங்கியிடம் செய்த உங்கள் புகார்',
  'stuckhelp.field.walletComplaint': 'வாலெட் நிறுவனத்திடம் செய்த உங்கள் புகார்',
  'stuckhelp.field.relief': 'கோரும் நிவாரணம்',
  'stuckhelp.field.copy': 'நகலெடு: {field}',
  'stuckhelp.field.copied': '{field} நகலெடுக்கப்பட்டது',

  // Your details for letters: asked once, kept on this phone. The name and UPI ID go to your profile.
  'stuckhelp.me.heading': 'உங்கள் விவரங்கள்',
  'stuckhelp.me.name': 'உங்கள் பெயர்',
  'stuckhelp.me.mobile': 'மொபைல் எண்',
  'stuckhelp.me.upi': 'உங்கள் UPI ID (விருப்பம்)',
  'stuckhelp.me.upiHint': 'UPI பணத்தைக் கண்டறிய இது வங்கிக்கு உதவும். Settle இதை உங்கள் சுயவிவரத்தில் சேமிக்கும்.',
  'stuckhelp.me.place': 'நகரம், மாநிலம்',
  // Under the empty field, so it never looks filled in.
  'stuckhelp.me.placeExample': 'எடுத்துக்காட்டு: Chennai, Tamil Nadu',
  'stuckhelp.me.address': 'முகவரி (விருப்பம்)',
  'stuckhelp.me.change': 'மாற்று',
  'stuckhelp.me.changeLabel': 'உங்கள் விவரங்களை மாற்று',

  // A NACH debit: was the mandate cancelled before it?
  'stuckhelp.mandate.heading': 'மேண்டேட்',
  'stuckhelp.mandate.question': 'டெபிட்டுக்கு முன்பே இந்த மேண்டேட்டை உங்கள் வங்கியில் ரத்து செய்திருந்தீர்களா?',
  'stuckhelp.mandate.no': 'இல்லை',
  'stuckhelp.mandate.yes': 'ஆம், ரத்து செய்திருந்தேன்',
  'stuckhelp.mandate.date': 'ரத்து செய்த நாள் (விருப்பம்)',
  'stuckhelp.mandate.hint': 'மேண்டேட்டை ரத்து செய்த பிறகு நடக்கும் டெபிட் தோல்வியடைந்த பணம் அல்ல; எனவே, நீங்கள் ரத்து செய்த பிறகு பணம் எடுக்கப்பட்டது என்று கடிதம் சொல்லும்.',

  // Who the email goes to ({kind}: bank, wallet or business; {email}: "crpc@rbi.org.in").
  'stuckhelp.email.label': 'யாருக்கு அனுப்புவது (மின்னஞ்சல்)',
  'stuckhelp.email.hint':
    '{kind, select, wallet {வாலெட் நிறுவனத்தின் குறைதீர் மின்னஞ்சல் — அதன் ஆப்பின் உதவிப் பகுதியில் இருக்கும்.} business {அந்த நிறுவனத்தின் வாடிக்கையாளர் சேவை மின்னஞ்சல், இருந்தால்.} other {உங்கள் வங்கியின் குறைதீர் மின்னஞ்சல் — அதன் இணையதளத்தில் அல்லது ஆப்பில் இருக்கும்.}} Settle இதை இந்த ஃபோனில் நினைவில் வைத்திருக்கும்.',
  'stuckhelp.email.crpc': 'மின்னஞ்சல் RBI-இன் புகார் மையத்துக்குச் செல்லும்: {email}.',

  // The payment's reference, when it wasn't saved ({kind}: upi, imps, wallet, nach or other).
  'stuckhelp.ref.label':
    '{kind, select, upi {UPI குறிப்பு எண் (12 இலக்கங்கள்)} imps {IMPS குறிப்பு எண் (12 இலக்கங்கள்)} wallet {வாலெட் பரிவர்த்தனை ID} nach {மேண்டேட் (UMRN) அல்லது டெபிட் குறிப்பு எண்} other {பரிவர்த்தனைக் குறிப்பு எண்}}',
  'stuckhelp.ref.hint': 'வங்கியின் SMS-இல், அல்லது உங்கள் ஆப்பில் இந்தப் பணத்தின் விவரத்தில் இருக்கும். Settle இதை இந்தப் பணத்துடன் சேமிக்கும்.',

  // The letter's box: {kind} is letter, message or summary.
  'stuckhelp.letter.heading': '{kind, select, message {செய்தி} summary {சுருக்கம்} other {கடிதம்}}',
  'stuckhelp.letter.blanks':
    '{count, plural, one {[ ] அடைப்புக்குறிக்குள் உள்ள # பகுதி இன்னும் நிரப்பப்படவில்லை. அனுப்பும் முன் அதை நிரப்புங்கள்.} other {[ ] அடைப்புக்குறிக்குள் உள்ள # பகுதிகள் இன்னும் நிரப்பப்படவில்லை. அனுப்பும் முன் அவற்றை நிரப்புங்கள்.}}',
  'stuckhelp.letter.actions': 'கடிதத்தை அனுப்பு',
  // Sending while a [bracket] is still empty: said first ({count}: how many; {action}: copy, share, print, email or send).
  'stuckhelp.blanks.title': '{count, plural, one {# பகுதி இன்னும் காலியாக உள்ளது} other {# பகுதிகள் இன்னும் காலியாக உள்ளன}}',
  'stuckhelp.blanks.description':
    '{count, plural, one {அது [ ] அடைப்புக்குறிக்குள் குறிக்கப்பட்டுள்ளது. முதலில் அதை நிரப்புங்கள், அல்லது இப்படியே அனுப்பிவிட்டு, ஒட்டும் இடத்தில் நிரப்புங்கள்.} other {அவை [ ] அடைப்புக்குறிக்குள் குறிக்கப்பட்டுள்ளன. முதலில் அவற்றை நிரப்புங்கள், அல்லது இப்படியே அனுப்பிவிட்டு, ஒட்டும் இடத்தில் நிரப்புங்கள்.}}',
  'stuckhelp.blanks.list': 'இன்னும் காலியாக உள்ளவை',
  'stuckhelp.blanks.fill': '{count, plural, one {அதை நிரப்பு} other {அவற்றை நிரப்பு}}',
  'stuckhelp.blanks.anyway': '{action, select, copy {எப்படியும் நகலெடு} share {எப்படியும் பகிர்} print {எப்படியும் அச்சிடு} email {எப்படியும் மின்னஞ்சல் செய்} other {எப்படியும் அனுப்பு}}',
  // Above the letter, in the app's language: what it asks for ({amount}, {compensation}, {total}: "₹500").
  'stuckhelp.summary.reverse': '{amount} திரும்பத் தரவும், தாமதமாகும் ஒவ்வொரு நாளுக்கும் ₹100 தரவும் இது கேட்கிறது.',
  'stuckhelp.summary.reverseOwed': '{amount} திரும்பத் தரவும், தாமதத்துக்காக இதுவரை வர வேண்டிய {compensation} தரவும் (நாளுக்கு ₹100) இது கேட்கிறது.',
  'stuckhelp.summary.compensation': 'பணம் தாமதமான நாட்களுக்கு வர வேண்டிய {compensation} இழப்பீட்டை (நாளுக்கு ₹100) இது கேட்கிறது.',
  'stuckhelp.summary.compensationAny': 'பணம் தாமதமான நாட்களுக்கு வர வேண்டிய இழப்பீட்டை (நாளுக்கு ₹100) இது கேட்கிறது.',
  'stuckhelp.summary.ombudsman':
    'என்ன நடந்தது, உங்கள் புகார் என்ன ஆனது என்பதை இது RBI Ombudsman-இடம் சொல்கிறது; இதுவரை உங்களுக்கு வர வேண்டிய {total} தொகையையும் கேட்கிறது.',
  'stuckhelp.summary.ombudsmanBoth':
    'என்ன நடந்தது, உங்கள் புகார் என்ன ஆனது என்பதை இது RBI Ombudsman-இடம் சொல்கிறது; உங்கள் {amount} தொகையைத் திரும்பத் தரவும், தாமதத்துக்காக இதுவரை வர வேண்டிய {compensation} தரவும் (நாளுக்கு ₹100) கேட்கிறது.',
  'stuckhelp.summary.ombudsmanAny': 'என்ன நடந்தது, உங்கள் புகார் என்ன ஆனது என்பதை இது RBI Ombudsman-இடம் சொல்கிறது; உங்களுக்கு வர வேண்டியதையும் கேட்கிறது.',
  'stuckhelp.summary.refund': 'உங்கள் {amount} ரீஃபண்டை இது கேட்கிறது; ஏற்கனவே அனுப்பியிருந்தால், அதைக் கண்டறிய அதன் குறிப்பு எண்ணைக் கேட்கிறது.',
  'stuckhelp.summary.confirm': 'உங்கள் {amount} அவர்களுக்கு வந்து சேர்ந்ததா என்று எழுத்துமூலம் உறுதிப்படுத்துமாறு இது கேட்கிறது — உங்கள் வங்கியிடம் காட்டுவதற்காக.',
  'stuckhelp.summary.nch': 'உங்கள் {amount} விஷயத்தை அந்த நிறுவனத்திடம் எடுத்துச் செல்லுமாறு இது உதவி எண்ணிடம் கேட்கிறது; இதுவரை நீங்கள் செய்தவற்றையும் பட்டியலிடுகிறது.',
  'stuckhelp.summary.airsewa': 'DGCA விதிகளின்படி, விமான நிறுவனத்திடமிருந்து உங்கள் {amount} ரீஃபண்டைப் பெற்றுத் தருமாறு இது AirSewa தளத்திடம் கேட்கிறது.',
  'stuckhelp.summary.commission': 'ஆணையத்துக்காக உங்கள் வழக்கை இது சுருக்கமாகச் சொல்கிறது: என்ன நடந்தது, எப்போது, நீங்கள் என்ன செய்தீர்கள், நீங்கள் கேட்கும் {amount}.',
  'stuckhelp.summary.english':
    '{kind, select, message {செய்தி} summary {சுருக்கம்} other {கடிதம்}} ஆங்கிலத்தில் உள்ளது — வங்கிகளும் நிறுவனங்களும் ஒழுங்குமுறை அமைப்புகளும் பயன்படுத்தும் மொழி அது.',
  'stuckhelp.action.copy': '{kind, select, message {செய்தியை நகலெடு} summary {சுருக்கத்தை நகலெடு} other {கடிதத்தை நகலெடு}}',
  'stuckhelp.action.email': 'மின்னஞ்சல்',
  'stuckhelp.action.print': 'அச்சிடு அல்லது PDF ஆகச் சேமி',
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
  // Not "Back": in a money app that reads as money returned ({kind}: letter, message or summary).
  'stuckhelp.raised.back': '{kind, select, message {செய்திக்குத் திரும்பு} summary {சுருக்கத்துக்குத் திரும்பு} other {கடிதத்துக்குத் திரும்பு}}',
  // {date}: "2 Nov"; {name}: the business.
  'stuckhelp.raised.toast':
    '{kind, select, bank {குறித்துக்கொண்டோம்: {date} அன்று உங்கள் வங்கியிடம் புகார் செய்யப்பட்டது} ombudsman {குறித்துக்கொண்டோம்: {date} அன்று RBI Ombudsman-இடம் கொண்டு செல்லப்பட்டது} merchant {குறித்துக்கொண்டோம்: {date} அன்று {name} நிறுவனத்திடம் புகார் செய்யப்பட்டது} nch {குறித்துக்கொண்டோம்: {date} அன்று தேசிய நுகர்வோர் உதவி எண்ணில் புகார் செய்யப்பட்டது} airsewa {குறித்துக்கொண்டோம்: {date} அன்று AirSewa-வில் புகார் செய்யப்பட்டது} other {குறித்துக்கொண்டோம்: {date} அன்று நுகர்வோர் ஆணையத்தில் தாக்கல் செய்யப்பட்டது}}',
}
