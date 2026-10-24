/** Marathi copy for recurring splits (the list, the editor, the day picker). Keys: `recurring.<screen>.<element>`. */
import type { Messages } from '../types'

export const recurring = {
  // A day of the month as people say it (picked by code; {n} is the day).
  'recurring.ordinal.st': '{n}',
  'recurring.ordinal.nd': '{n}',
  'recurring.ordinal.rd': '{n}',
  'recurring.ordinal.th': '{n}',
  // The day picker's chip; {day} is an ordinal above ("1").
  'recurring.repeats': 'दर महिन्याच्या {day} तारखेला',
  // When it's due ({date} = "1 Oct").
  'recurring.due.overdue': '{date} पासून थकीत',
  'recurring.due.today': 'आज देय आहे',
  'recurring.due.tomorrow': 'उद्या देय आहे',
  'recurring.due.inDays': '{count, plural, one {# दिवसात देय} other {# दिवसांत देय}}',
  // Short badge on a list row.
  'recurring.due.badge.overdue': 'थकीत',
  'recurring.next': 'पुढील: {date}',
  // What it means for me each month.
  'recurring.standing.owed.future': 'तुम्हाला {amount} येणे असेल',
  'recurring.standing.owed.now': 'तुम्हाला {amount} येणे आहे',
  'recurring.standing.owe.future': 'तुम्ही {name} यांना {amount} द्याल',
  'recurring.standing.owe.now': 'तुम्ही {name} यांना {amount} देणे आहे',
  // "For November" — which month a split is for.
  'recurring.forMonth': '{month} साठी',

  // Quick-start presets (also the title they start with).
  'recurring.preset.rent': 'भाडे',
  'recurring.preset.wifi': 'Wi-Fi',
  'recurring.preset.electricity': 'वीज बिल',
  'recurring.preset.netflix': 'Netflix',
  'recurring.preset.help': 'घरकाम मदतनीस',

  // "Split now" (list, editor).
  'recurring.splitNow.cta': 'आत्ता वाटा',
  'recurring.splitNow.error.toast': '{title} वाटता आले नाही. {reason}',
  'recurring.splitNow.edit.cta': 'बदला',
  // The success moment's title: "Rent split".
  'recurring.splitNow.done.title': '{title} वाटले',

  // Pro banners (list and editor).
  'recurring.pro.ended.title': 'तुमच्या Pro पासची मुदत संपली आहे',
  'recurring.pro.locked.title': 'नियमित वाटण्या Pro चा भाग आहेत',
  'recurring.pro.renew.cta': 'Pro नूतनीकरण करा',
  'recurring.pro.see.cta': 'Pro पहा',

  // The list (`/app/recurring`).
  'recurring.list.title': 'नियमित वाटण्या',
  'recurring.list.subtitle': 'भाडे, Wi-Fi, सबस्क्रिप्शन — एकदा सेट करा, दर महिन्याला वाटा.',
  'recurring.list.paused.body': 'त्या सध्या थांबवलेल्या आहेत — सर्व इथेच आहेत, काहीही हटवलेले नाही. कधीही बदला; वाटण्यासाठी Pro लागेल.',
  'recurring.list.due.title': 'आत्ता देय',
  'recurring.list.all.title': 'सर्व नियमित वाटण्या',
  'recurring.list.yours.title': 'तुमच्या नियमित वाटण्या',
  'recurring.list.paused.title': 'थांबवलेल्या',
  'recurring.list.paused.description': 'पुन्हा सुरू करेपर्यंत कोणतीही आठवण येणार नाही.',
  'recurring.list.new.cta': 'नवीन नियमित वाटणी',
  'recurring.list.due.split.aria': '{month} साठी {title} आत्ता वाटा',
  'recurring.list.edit.aria': '{title} बदला',
  'recurring.list.edit.cta': 'बदला',
  'recurring.list.paused.badge': 'थांबवले',
  // A row's subtitle: "₹32,000 · on the 1st · 3 people".
  'recurring.list.row.subtitle': '{amount} · दर महिन्याच्या {day} तारखेला · {count, plural, one {# व्यक्ती} other {# जण}}',
  'recurring.list.empty.title': 'एकदा सेट करा, दर महिन्याला वाटा',
  'recurring.list.empty.body': 'प्रत्येक कधी देय आहे ते Settle आठवण करून देईल, आणि एका टॅपमध्ये वाटून देईल.',
  'recurring.list.presets.aria': 'झटपट सुरुवात',

  // The editor (`/app/recurring/new`, `/app/recurring/:id`).
  'recurring.editor.new.title': 'नवीन नियमित वाटणी',
  'recurring.editor.title': 'नियमित वाटणी',
  'recurring.editor.edit.title': '{title} बदला',
  'recurring.editor.gone.title': 'ही नियमित वाटणी आता नाही',
  'recurring.editor.gone.subtitle': 'कदाचित हटवली गेली असेल — या फोनवर किंवा दुसऱ्या टॅबमध्ये.',
  'recurring.editor.gone.cta': 'नियमित वाटण्या पहा',
  'recurring.editor.saved.toast': 'नियमित वाटणी सेव्ह झाली',
  'recurring.editor.changesSaved.toast': 'बदल सेव्ह झाले',
  'recurring.editor.deleted.toast': '{title} हटवले',
  'recurring.editor.undo.cta': 'पूर्ववत करा',
  'recurring.editor.delete.aria': '{title} हटवा',
  'recurring.editor.save.new.cta': 'नियमित वाटणी सेव्ह करा',
  'recurring.editor.save.cta': 'बदल सेव्ह करा',
  'recurring.editor.paused.body': 'ही सध्या थांबवलेली आहे. तरीही बदलू किंवा हटवू शकता; वाटण्यासाठी Pro लागेल.',
  'recurring.editor.nextSplit': 'पुढील वाटणी: {date}',
  'recurring.editor.saveFirst.hint': 'तुमच्या बदलांसह वाटण्यासाठी आधी सेव्ह करा.',
  'recurring.editor.amount.label': 'दर महिन्याची रक्कम',
  'recurring.editor.what.label': 'हे कशासाठी आहे?',
  'recurring.editor.what.placeholder': 'भाडे, Wi-Fi, Netflix…',
  'recurring.editor.repeats.title': 'पुनरावृत्ती',
  'recurring.editor.firstReminder': 'पहिली आठवण {date}, नंतर दर महिन्याला.',
  'recurring.editor.nextDue': 'पुढे देय {date}.',
  'recurring.editor.people.title': 'यांच्यासोबत वाटा',
  'recurring.editor.how.title': 'कसे वाटायचे',
  'recurring.editor.remind.label': 'दर महिन्याला मला आठवण करा',
  'recurring.editor.remind.description': 'देय असताना होममध्ये दिसेल. थांबवण्यासाठी बंद करा — काहीही हटवले जाणार नाही.',
  'recurring.editor.discard.title': 'बदल टाकून द्यायचे?',
  'recurring.editor.discard.new.description': 'ही नियमित वाटणी सेव्ह होणार नाही.',
  'recurring.editor.discard.description': 'या नियमित वाटणीमधील तुमचे बदल सेव्ह होणार नाहीत.',
  'recurring.editor.discard.cta': 'टाकून द्या',
  'recurring.editor.keep.cta': 'संपादन सुरू ठेवा',

  // The day-of-month picker.
  'recurring.day.sheet.title': 'दर महिन्याला कोणत्या तारखेला?',
  'recurring.day.sheet.description': 'महिन्यात किमान 28 दिवस असतात, त्यामुळे 28 ही सर्वात उशिराची तारीख आहे.',
  'recurring.day.grid.aria': 'महिन्याची तारीख',
  // One day's button: "The 1st".
  'recurring.day.option.aria': '{day} तारीख',
} as const satisfies Messages
