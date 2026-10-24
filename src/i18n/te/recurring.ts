/** Telugu copy for recurring splits (src/features/recurring). Keys: `recurring.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const recurring = {
  // A day of the month as people say it: "1st", "2nd", "3rd", "11th" (picked by code; {n} is the day).
  'recurring.ordinal.st': '{n}వ',
  'recurring.ordinal.nd': '{n}వ',
  'recurring.ordinal.rd': '{n}వ',
  'recurring.ordinal.th': '{n}వ',
  // The day picker's chip; {day} is an ordinal above ("1st").
  'recurring.repeats': 'ప్రతి నెలా {day} న',
  // When it's due ({date} = "1 Oct").
  'recurring.due.overdue': '{date} నుంచి ఆలస్యం',
  'recurring.due.today': 'ఈరోజు చెల్లించాలి',
  'recurring.due.tomorrow': 'రేపు చెల్లించాలి',
  'recurring.due.inDays': '{count, plural, one {# రోజులో చెల్లించాలి} other {# రోజుల్లో చెల్లించాలి}}',
  // Short badge on a list row.
  'recurring.due.badge.overdue': 'ఆలస్యం',
  'recurring.next': 'తర్వాత: {date}',
  // What it means for me each month.
  'recurring.standing.owed.future': 'మీకు {amount} రావాలి',
  'recurring.standing.owed.now': 'మీకు {amount} రావాలి',
  'recurring.standing.owe.future': 'మీరు {name} గారికి {amount} ఇవ్వాల్సి ఉంటుంది',
  'recurring.standing.owe.now': 'మీరు {name} గారికి {amount} ఇవ్వాలి',
  // "For November" — which month a split is for.
  'recurring.forMonth': '{month} కోసం',
  // Quick-start presets (also the title they start with).
  'recurring.preset.rent': 'అద్దె',
  'recurring.preset.wifi': 'Wi-Fi',
  'recurring.preset.electricity': 'కరెంట్',
  'recurring.preset.netflix': 'Netflix',
  'recurring.preset.help': 'ఇంటి పని మనిషి',
  // "Split now" (list, editor).
  'recurring.splitNow.cta': 'ఇప్పుడే పంచండి',
  'recurring.splitNow.error.toast': '{title} పంచలేకపోయాం. {reason}',
  'recurring.splitNow.edit.cta': 'మార్చండి',
  // The success moment's title: "Rent split".
  'recurring.splitNow.done.title': '{title} పంచబడింది',
  // Pro banners (list and editor).
  'recurring.pro.ended.title': 'మీ Pro పాస్ ముగిసింది',
  'recurring.pro.locked.title': 'రిపీట్ స్ప్లిట్‌లు Pro లో భాగం',
  'recurring.pro.renew.cta': 'Pro ను పునరుద్ధరించండి',
  'recurring.pro.see.cta': 'Pro చూడండి',
  // The list (`/app/recurring`).
  'recurring.list.title': 'రిపీట్ స్ప్లిట్‌లు',
  'recurring.list.subtitle': 'అద్దె, Wi-Fi, సబ్‌స్క్రిప్షన్‌లు — ఒక్కసారి సెట్ చేయండి, ప్రతి నెలా పంచండి.',
  'recurring.list.paused.body': 'ఇప్పటికి ఆపివేయబడ్డాయి — అన్నీ ఇక్కడే ఉన్నాయి, ఏదీ తొలగించలేదు. ఎప్పుడైనా మార్చవచ్చు; పంచడానికి Pro కావాలి.',
  'recurring.list.due.title': 'ఇప్పుడు చెల్లించాల్సినవి',
  'recurring.list.all.title': 'అన్ని రిపీట్ స్ప్లిట్‌లు',
  'recurring.list.yours.title': 'మీ రిపీట్ స్ప్లిట్‌లు',
  'recurring.list.paused.title': 'ఆపివేసినవి',
  'recurring.list.paused.description': 'మళ్ళీ ఆన్ చేసే వరకు రిమైండర్లు ఉండవు.',
  'recurring.list.new.cta': 'కొత్త రిపీట్ స్ప్లిట్',
  'recurring.list.due.split.aria': '{month} కోసం {title} ను ఇప్పుడే పంచండి',
  'recurring.list.edit.aria': '{title} మార్చండి',
  'recurring.list.edit.cta': 'మార్చండి',
  'recurring.list.paused.badge': 'ఆపివేయబడింది',
  // A row's subtitle: "₹32,000 · on the 1st · 3 people".
  'recurring.list.row.subtitle': '{amount} · ప్రతి {day} న · {count, plural, one {# వ్యక్తి} other {# మంది}}',
  'recurring.list.empty.title': 'ఒక్కసారి సెట్ చేయండి, ప్రతి నెలా పంచండి',
  'recurring.list.empty.body': 'ప్రతిదీ ఎప్పుడు చెల్లించాలో Settle గుర్తు చేస్తుంది, ఒక్క ట్యాప్‌తో పంచుతుంది.',
  'recurring.list.presets.aria': 'త్వరిత ప్రారంభం',
  // The editor (`/app/recurring/new`, `/app/recurring/:id`).
  'recurring.editor.new.title': 'కొత్త రిపీట్ స్ప్లిట్',
  'recurring.editor.title': 'రిపీట్ స్ప్లిట్',
  'recurring.editor.edit.title': '{title} మార్చండి',
  'recurring.editor.gone.title': 'ఈ రిపీట్ స్ప్లిట్ లేదు',
  'recurring.editor.gone.subtitle': 'ఇది తొలగించబడి ఉండవచ్చు — ఈ ఫోన్‌లో లేదా మరో ట్యాబ్‌లో.',
  'recurring.editor.gone.cta': 'రిపీట్ స్ప్లిట్‌లు చూడండి',
  'recurring.editor.saved.toast': 'రిపీట్ స్ప్లిట్ సేవ్ అయింది',
  'recurring.editor.changesSaved.toast': 'మార్పులు సేవ్ అయ్యాయి',
  'recurring.editor.deleted.toast': '{title} తొలగించబడింది',
  'recurring.editor.undo.cta': 'వెనక్కి తీసుకోండి',
  'recurring.editor.delete.aria': '{title} తొలగించండి',
  'recurring.editor.save.new.cta': 'రిపీట్ స్ప్లిట్ సేవ్ చేయండి',
  'recurring.editor.save.cta': 'మార్పులు సేవ్ చేయండి',
  'recurring.editor.paused.body': 'ఇది ఆపివేయబడింది. ఇప్పటికీ మార్చవచ్చు లేదా తొలగించవచ్చు; పంచడానికి Pro కావాలి.',
  'recurring.editor.nextSplit': 'తర్వాతి స్ప్లిట్: {date}',
  'recurring.editor.saveFirst.hint': 'మీ మార్పులతో పంచడానికి ముందుగా సేవ్ చేయండి.',
  'recurring.editor.amount.label': 'ప్రతి నెలా మొత్తం',
  'recurring.editor.what.label': 'దేనికోసం?',
  'recurring.editor.what.placeholder': 'అద్దె, Wi-Fi, Netflix…',
  'recurring.editor.repeats.title': 'పునరావృతం',
  'recurring.editor.firstReminder': 'మొదటి రిమైండర్ {date}, ఆ తర్వాత ప్రతి నెలా.',
  'recurring.editor.nextDue': 'తర్వాత చెల్లించాల్సింది {date}.',
  'recurring.editor.people.title': 'ఎవరితో పంచాలి',
  'recurring.editor.how.title': 'ఎలా పంచాలి',
  'recurring.editor.remind.label': 'ప్రతి నెలా గుర్తు చేయండి',
  'recurring.editor.remind.description': 'చెల్లించాల్సినప్పుడు హోమ్‌లో కనిపిస్తుంది. ఆపడానికి ఆఫ్ చేయండి — ఏదీ తొలగించబడదు.',
  'recurring.editor.discard.title': 'మార్పులను తీసేయాలా?',
  'recurring.editor.discard.new.description': 'ఈ రిపీట్ స్ప్లిట్ సేవ్ కాదు.',
  'recurring.editor.discard.description': 'ఈ రిపీట్ స్ప్లిట్‌లో మీ మార్పులు సేవ్ కావు.',
  'recurring.editor.discard.cta': 'తీసేయండి',
  'recurring.editor.keep.cta': 'మార్చడం కొనసాగించండి',
  // The day-of-month picker.
  'recurring.day.sheet.title': 'ప్రతి నెలా ఏ రోజు?',
  'recurring.day.sheet.description': 'ప్రతి నెలా కనీసం 28 రోజులు ఉంటాయి, కాబట్టి 28 చివరిది.',
  'recurring.day.grid.aria': 'నెలలో రోజు',
  // One day's button: "The 1st".
  'recurring.day.option.aria': '{day} తేదీ',
} as const satisfies Messages
