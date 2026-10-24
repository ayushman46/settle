/** Tamil copy for the split screen (src/features/split). Keys: `split.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const split = {
  // `/app/split/:id/edit` when the expense no longer exists.
  'split.gone.title': 'இந்தச் செலவு இல்லை',
  'split.gone.subtitle': 'இது நீக்கப்பட்டிருக்கலாம் — இந்த ஃபோனில் அல்லது வேறொரு டேபில்.',
  'split.gone.cta': 'வரலாற்றைப் பார்',
  // The screen's title, heading and tab title.
  'split.screen.new.title': 'புதிய பிரிப்பு',
  'split.screen.edit.title': 'பிரிப்பைத் திருத்து',
  'split.screen.edit.heading': '{title} ஐத் திருத்து',
  // The browser tab while editing: "Edit Dinner at Toit · Settle".
  'split.screen.edit.docTitle': '{title} ஐத் திருத்து · {brand}',
  'split.save.new.cta': 'பிரிப்பைச் சேமி',
  'split.save.cta': 'மாற்றங்களைச் சேமி',
  'split.currency.toast': 'இப்போது {code} இல்',
  'split.undo.cta': 'செயல்தவிர்',
  'split.saved.title': 'பிரிப்பு சேமிக்கப்பட்டது',
  // The amount and the details.
  'split.amount.label': 'தொகை',
  'split.amount.itemized.label': 'மொத்தம் செலுத்தியது',
  'split.amount.itemized.hint': 'வரி, டிப் மற்றும் தள்ளுபடிகள் மீண்டும் பொருட்களுக்கு இடையே பிரிக்கப்படும்.',
  'split.title.label': 'இது எதற்காக?',
  // Under the details when the group keeps balances in another currency.
  'split.groupCurrency.note': '{currency} இல் இருப்பதால், இது நபருக்கு நபர் தீர்க்கப்படும் — {group} இன் {groupCurrency} இருப்புகளில் அல்ல.',
  // The trip tip (travel without a group).
  'split.tip.trip.title': 'முழுப் பயணத்தையும் பிரிக்கிறீர்களா?',
  'split.tip.trip.body': 'ஒரு குழுவில் வையுங்கள்: ஒவ்வொரு செலவும் சேரும், கடைசியில் {brand} குறைந்த எண்ணிக்கையிலான பணப் பரிமாற்றங்களைக் கணக்கிடும்.',
  'split.tip.trip.cta': 'பயணக் குழுவைத் தொடங்கு',
  'split.tip.trip.dismiss': 'இந்த ஒரு முறை மட்டும்',
  // The rent tip.
  'split.tip.rent.cta': 'சதவீதப்படி பிரி',
  'split.tip.rent.body': 'அறைகள் வெவ்வேறு அளவா? வாடகையை சதவீதப்படி பிரிப்பது பெரும்பாலும் நியாயமாக இருக்கும்.',
  // Sections.
  'split.section.items.title': 'பொருள் பொருளாகப் பிரி',
  'split.section.people.title': 'யாருடன் பிரிக்க',
  'split.section.how.title': 'எப்படிப் பிரிப்பது',
  // An itemized bill being edited or copied.
  'split.bill.line': '{items, plural, one {# பொருள்} other {# பொருட்கள்}} · {people, plural, one {# நபர்} other {# நபர்கள்}}',
  'split.bill.editing.body': 'யார் எதை எடுத்தார்கள் என்பது அப்படியே இருக்கும். மாற்ற, பில்லைத் திறவுங்கள்.',
  'split.bill.copy.body': 'அசல் பிரிப்பில் உள்ள அதே பொருட்களும் நபர்களும் — சேமித்த பின் யார் எதை எடுத்தார்கள் என்பதை மாற்றுங்கள்.',
  'split.bill.change.cta': 'யார் எடுத்தது மாற்று',
  // Discard confirm.
  'split.discard.new.title': 'இந்தப் பிரிப்பை நிராகரிக்கவா?',
  'split.discard.title': 'மாற்றங்களை நிராகரிக்கவா?',
  'split.discard.new.description': 'நீங்கள் உள்ளிட்டவை சேமிக்கப்படாது.',
  'split.discard.description': '{title} இல் உங்கள் மாற்றங்கள் சேமிக்கப்படாது.',
  'split.discard.cta': 'நிராகரி',
  'split.keep.cta': 'தொடர்ந்து திருத்து',
  // Where a prefilled split came from.
  'split.origin.describe.title': 'நீங்கள் தட்டச்சு செய்ததிலிருந்து நிரப்பப்பட்டது',
  'split.origin.scan.title': 'உங்கள் பில்லிலிருந்து நிரப்பப்பட்டது',
  'split.origin.scan.body': 'தொகையைச் சரிபாருங்கள் — மங்கலான புகைப்படத்தை AI தவறாகப் படிக்கக்கூடும்.',
  'split.origin.recurring.title': 'இந்த மாதத்தின் {title}',
  'split.origin.recurring.untitled': 'தொடர் பிரிப்பிலிருந்து',
  'split.origin.recurring.body': 'சரிபார்த்து, வசூலிக்கத் தொடங்க சேமியுங்கள்.',
  'split.origin.duplicate.title': '{title} இன் நகல்',
  'split.origin.duplicate.untitled': 'ஒரு நகல்',
  'split.origin.duplicate.body': 'இன்றைய தேதியில், இன்னும் யாரும் செலுத்தியதாகக் குறிக்கப்படவில்லை.',
  'split.origin.sms.title': 'உங்கள் SMS இலிருந்து நிரப்பப்பட்டது',
  'split.origin.sms.body': 'யார் இருக்கிறார்கள் என்பதைச் சேர்த்து, சரிபார்த்து, சேமியுங்கள்.',
  'split.origin.voice.title': 'நீங்கள் சொன்னதிலிருந்து நிரப்பப்பட்டது',
  'split.origin.rotation.title': 'அடுத்த முறை',
  // Body for "what you typed", "what you said" and the next round.
  'split.origin.check.body': 'தொகையையும் யார் இருக்கிறார்கள் என்பதையும் சரிபார்த்து, சேமியுங்கள்.',
  // The note field.
  'split.note.label': 'குறிப்பு',
  'split.note.placeholder': 'நினைவில் வைக்க ஏதேனும் — விருப்பமானது',
  'split.note.full': 'அதுதான் வரம்பு',
  'split.note.left': '{count} மீதம்',
  // What saving means (Save's hint) and what it means once saved (the success moment).
  'split.outcome.nothingToCollect': 'வசூலிக்க எதுவும் இல்லை — எல்லாம் உங்கள் பொறுப்பு.',
  'split.outcome.one.future': '{name} உங்களுக்கு {amount} தர வேண்டியிருக்கும்',
  'split.outcome.one.now': '{name} உங்களுக்கு {amount} தர வேண்டும்',
  // {names}: "Riya and Sam", "Riya, Sam and Ali".
  'split.outcome.each.future': '{names} ஒவ்வொருவரும் உங்களுக்கு {amount} தர வேண்டியிருக்கும்',
  'split.outcome.each.now': '{names} ஒவ்வொருவரும் உங்களுக்கு {amount} தர வேண்டும்',
  'split.outcome.inAll.future': '{names} இடமிருந்து மொத்தம் {amount} திரும்பக் கிடைக்கும்',
  'split.outcome.inAll.now': '{names} உங்களுக்கு மொத்தம் {amount} தர வேண்டும்',
  'split.outcome.many.future': '{count} நபர்களிடமிருந்து மொத்தம் {amount} திரும்பக் கிடைக்கும்',
  'split.outcome.many.now': '{count} நபர்கள் உங்களுக்கு {amount} தர வேண்டும்',
  'split.outcome.owe.future': 'நீங்கள் {name} அவர்களுக்கு {amount} தர வேண்டியிருக்கும்',
  'split.outcome.owe.now': 'நீங்கள் {name} அவர்களுக்கு {amount} தர வேண்டும்',
  'split.outcome.nothingToPay': 'திருப்பிச் செலுத்த எதுவும் இல்லை.',
  'split.outcome.getsBack.future': '{name} அவர்களுக்கு {amount} திரும்பக் கிடைக்கும்',
  'split.outcome.getsBack.now': '{name} அவர்களுக்கு {amount} திரும்பக் கிடைக்கிறது',
  // After saving an edit.
  'split.changes.toast': 'மாற்றங்கள் சேமிக்கப்பட்டன',
  'split.changes.meAgain.toast': 'மாற்றங்கள் சேமிக்கப்பட்டன. இப்போது நீங்கள் அதிகம் தர வேண்டும், அதனால் நீங்கள் இன்னும் செலுத்தவில்லை என்று குறிக்கப்பட்டுள்ளீர்கள்.',
  'split.changes.othersAgain.toast':
    '{count, plural, one {மாற்றங்கள் சேமிக்கப்பட்டன. {names} இப்போது அதிகம் தர வேண்டும், அதனால் இன்னும் செலுத்தவில்லை என்று குறிக்கப்பட்டுள்ளார்.} other {மாற்றங்கள் சேமிக்கப்பட்டன. {names} இப்போது அதிகம் தர வேண்டும், அதனால் இன்னும் செலுத்தவில்லை என்று குறிக்கப்பட்டுள்ளனர்.}}',
  // Quick starts: the title field's examples per category (and the title a rent split starts with).
  'split.placeholder.food': 'Toit உணவகத்தில் இரவு உணவு, Swiggy ஆர்டர்…',
  'split.placeholder.groceries': 'Blinkit, DMart, வாராந்திரக் காய்கறிகள்…',
  'split.placeholder.rent': 'வாடகை, பராமரிப்பு, முன்பணம்…',
  'split.placeholder.utilities': 'மின்சாரம், Wi-Fi, கேஸ் சிலிண்டர்…',
  'split.placeholder.travel': 'விமானம், ஹோட்டல், கோவா பயணம்…',
  'split.placeholder.transport': 'விமான நிலையத்துக்கு Uber, பெட்ரோல்…',
  'split.placeholder.shopping': 'Amazon ஆர்டர், புதிய திரைச்சீலைகள்…',
  'split.placeholder.entertainment': 'சினிமா டிக்கெட், கச்சேரி…',
  'split.placeholder.subscription': 'Netflix, Spotify, YouTube Premium…',
  'split.placeholder.gift': 'Neha-வுக்கு பிறந்தநாள் பரிசு…',
  'split.placeholder.health': 'மருந்தகம், மருத்துவர் சந்திப்பு…',
  'split.placeholder.other': 'இரவு உணவு, வாடகை, கேப், Netflix…',
  'split.template.rent.title': 'வாடகை',
} as const satisfies Messages
