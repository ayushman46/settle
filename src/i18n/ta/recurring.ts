/** Tamil copy for recurring splits (src/features/recurring). Keys: `recurring.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const recurring = {
  // A day of the month as people say it: "1st", "2nd", "3rd", "11th" (picked by code; {n} is the day).
  'recurring.ordinal.st': '{n}-ஆம்',
  'recurring.ordinal.nd': '{n}-ஆம்',
  'recurring.ordinal.rd': '{n}-ஆம்',
  'recurring.ordinal.th': '{n}-ஆம்',
  // The day picker's chip; {day} is an ordinal above ("1st").
  'recurring.repeats': 'ஒவ்வொரு மாதமும் {day} அன்று',
  // When it's due ({date} = "1 Oct").
  'recurring.due.overdue': '{date} முதல் தாமதம்',
  'recurring.due.today': 'இன்று செலுத்த வேண்டும்',
  'recurring.due.tomorrow': 'நாளை செலுத்த வேண்டும்',
  'recurring.due.inDays': '{count, plural, one {# நாளில் செலுத்த வேண்டும்} other {# நாட்களில் செலுத்த வேண்டும்}}',
  // Short badge on a list row.
  'recurring.due.badge.overdue': 'தாமதம்',
  'recurring.next': 'அடுத்தது: {date}',
  // What it means for me each month.
  'recurring.standing.owed.future': 'உங்களுக்கு {amount} வரும்',
  'recurring.standing.owed.now': 'உங்களுக்கு {amount} வர வேண்டும்',
  'recurring.standing.owe.future': 'நீங்கள் {name} அவர்களுக்கு {amount} தர வேண்டியிருக்கும்',
  'recurring.standing.owe.now': 'நீங்கள் {name} அவர்களுக்கு {amount} தர வேண்டும்',
  // "For November" — which month a split is for.
  'recurring.forMonth': '{month} மாதத்துக்கு',
  // Quick-start presets (also the title they start with).
  'recurring.preset.rent': 'வாடகை',
  'recurring.preset.wifi': 'Wi-Fi',
  'recurring.preset.electricity': 'மின்சாரம்',
  'recurring.preset.netflix': 'Netflix',
  'recurring.preset.help': 'வீட்டு வேலையாள்',
  // "Split now" (list, editor).
  'recurring.splitNow.cta': 'இப்போதே பிரி',
  'recurring.splitNow.error.toast': '{title} ஐப் பிரிக்க முடியவில்லை. {reason}',
  'recurring.splitNow.edit.cta': 'திருத்து',
  // The success moment's title: "Rent split".
  'recurring.splitNow.done.title': '{title} பிரிக்கப்பட்டது',
  // Pro banners (list and editor).
  'recurring.pro.ended.title': 'உங்கள் Pro பாஸ் முடிந்துவிட்டது',
  'recurring.pro.locked.title': 'தொடர் பிரிப்புகள் Pro இன் ஒரு பகுதி',
  'recurring.pro.renew.cta': 'Pro ஐப் புதுப்பி',
  'recurring.pro.see.cta': 'Pro ஐப் பார்',
  // The list (`/app/recurring`).
  'recurring.list.title': 'தொடர் பிரிப்புகள்',
  'recurring.list.subtitle': 'வாடகை, Wi-Fi, சந்தாக்கள் — ஒரு முறை அமைத்தால் போதும், ஒவ்வொரு மாதமும் பிரிக்கலாம்.',
  'recurring.list.paused.body': 'இப்போதைக்கு நிறுத்தி வைக்கப்பட்டுள்ளன — எல்லாம் இங்கேயே உள்ளன, எதுவும் நீக்கப்படவில்லை. எப்போது வேண்டுமானாலும் திருத்தலாம்; பிரிக்க Pro தேவை.',
  'recurring.list.due.title': 'இப்போது செலுத்த வேண்டியவை',
  'recurring.list.all.title': 'எல்லா தொடர் பிரிப்புகளும்',
  'recurring.list.yours.title': 'உங்கள் தொடர் பிரிப்புகள்',
  'recurring.list.paused.title': 'நிறுத்தப்பட்டவை',
  'recurring.list.paused.description': 'நீங்கள் மீண்டும் இயக்கும் வரை நினைவூட்டல்கள் இருக்காது.',
  'recurring.list.new.cta': 'புதிய தொடர் பிரிப்பு',
  'recurring.list.due.split.aria': '{month} மாதத்துக்கான {title} ஐ இப்போதே பிரி',
  'recurring.list.edit.aria': '{title} ஐத் திருத்து',
  'recurring.list.edit.cta': 'திருத்து',
  'recurring.list.paused.badge': 'நிறுத்தப்பட்டது',
  // A row's subtitle: "₹32,000 · on the 1st · 3 people".
  'recurring.list.row.subtitle': '{amount} · {day} அன்று · {count, plural, one {# நபர்} other {# நபர்கள்}}',
  'recurring.list.empty.title': 'ஒரு முறை அமைத்தால், ஒவ்வொரு மாதமும் பிரிக்கலாம்',
  'recurring.list.empty.body': 'ஒவ்வொன்றும் எப்போது செலுத்த வேண்டும் என்று Settle நினைவூட்டும், ஒரே தட்டில் பிரிக்கும்.',
  'recurring.list.presets.aria': 'விரைவுத் தொடக்கம்',
  // The editor (`/app/recurring/new`, `/app/recurring/:id`).
  'recurring.editor.new.title': 'புதிய தொடர் பிரிப்பு',
  'recurring.editor.title': 'தொடர் பிரிப்பு',
  'recurring.editor.edit.title': '{title} ஐத் திருத்து',
  'recurring.editor.gone.title': 'இந்தத் தொடர் பிரிப்பு இல்லை',
  'recurring.editor.gone.subtitle': 'இது நீக்கப்பட்டிருக்கலாம் — இந்த ஃபோனில் அல்லது வேறொரு டேபில்.',
  'recurring.editor.gone.cta': 'தொடர் பிரிப்புகளைப் பார்',
  'recurring.editor.saved.toast': 'தொடர் பிரிப்பு சேமிக்கப்பட்டது',
  'recurring.editor.changesSaved.toast': 'மாற்றங்கள் சேமிக்கப்பட்டன',
  'recurring.editor.deleted.toast': '{title} நீக்கப்பட்டது',
  'recurring.editor.undo.cta': 'செயல்தவிர்',
  'recurring.editor.delete.aria': '{title} ஐ நீக்கு',
  'recurring.editor.save.new.cta': 'தொடர் பிரிப்பைச் சேமி',
  'recurring.editor.save.cta': 'மாற்றங்களைச் சேமி',
  'recurring.editor.paused.body': 'இது நிறுத்தி வைக்கப்பட்டுள்ளது. இன்னும் திருத்தலாம் அல்லது நீக்கலாம்; பிரிக்க Pro தேவை.',
  'recurring.editor.nextSplit': 'அடுத்த பிரிப்பு: {date}',
  'recurring.editor.saveFirst.hint': 'உங்கள் மாற்றங்களுடன் பிரிக்க முதலில் சேமியுங்கள்.',
  'recurring.editor.amount.label': 'ஒவ்வொரு மாதமும் தொகை',
  'recurring.editor.what.label': 'இது எதற்காக?',
  'recurring.editor.what.placeholder': 'வாடகை, Wi-Fi, Netflix…',
  'recurring.editor.repeats.title': 'திரும்பும்',
  'recurring.editor.firstReminder': 'முதல் நினைவூட்டல் {date}, அதன்பின் ஒவ்வொரு மாதமும்.',
  'recurring.editor.nextDue': 'அடுத்து செலுத்த வேண்டியது {date}.',
  'recurring.editor.people.title': 'யாருடன் பிரிக்க',
  'recurring.editor.how.title': 'எப்படிப் பிரிப்பது',
  'recurring.editor.remind.label': 'ஒவ்வொரு மாதமும் நினைவூட்டு',
  'recurring.editor.remind.description': 'செலுத்த வேண்டிய நேரத்தில் முகப்பில் காட்டும். நிறுத்த அணைக்கவும் — எதுவும் நீக்கப்படாது.',
  'recurring.editor.discard.title': 'மாற்றங்களை நிராகரிக்கவா?',
  'recurring.editor.discard.new.description': 'இந்தத் தொடர் பிரிப்பு சேமிக்கப்படாது.',
  'recurring.editor.discard.description': 'இந்தத் தொடர் பிரிப்பில் உங்கள் மாற்றங்கள் சேமிக்கப்படாது.',
  'recurring.editor.discard.cta': 'நிராகரி',
  'recurring.editor.keep.cta': 'தொடர்ந்து திருத்து',
  // The day-of-month picker.
  'recurring.day.sheet.title': 'ஒவ்வொரு மாதமும் எந்த நாள்?',
  'recurring.day.sheet.description': 'எல்லா மாதங்களிலும் குறைந்தது 28 நாட்கள் உள்ளன, அதனால் 28 தான் கடைசி.',
  'recurring.day.grid.aria': 'மாதத்தின் நாள்',
  // One day's button: "The 1st".
  'recurring.day.option.aria': '{day} தேதி',
} as const satisfies Messages
