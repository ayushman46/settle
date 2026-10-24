/** Marathi copy for one expense (its page, toasts, the bill as printed, the ⋮ menu). Keys: `expense.<part>.<element>`. */
import type { Messages } from '../types'

export const expense = {
  // `/app/expense/:id` when the expense no longer exists.
  'expense.gone.title': 'हा खर्च आता नाही',
  'expense.gone.subtitle': 'कदाचित हटवला गेला असेल — या फोनवर किंवा दुसऱ्या टॅबमध्ये.',
  'expense.gone.cta': 'व्यवहार पहा',

  // The standing pill under the big amount (owner's side).
  'expense.standing.notIn': 'तुम्ही यात नाही आहात',
  'expense.standing.lent': 'तुम्ही {amount} दिले',
  'expense.standing.borrowed': 'तुम्ही {amount} उधार घेतले',
  'expense.standing.owed': 'तुम्हाला {amount} येणे आहे',
  'expense.standing.settled': 'मिटले',
  'expense.standing.owe': 'तुम्ही {name} यांना {amount} देणे आहे',
  'expense.standing.paidBack': 'तुम्ही {name} यांना परत दिले',

  // The hero (receipt header).
  'expense.hero.group.aria': '{name} ग्रुपमध्ये',
  'expense.hero.paidBy': '{who, select, me {तुम्ही दिले} other {{name} यांनी दिले}}',

  // Toasts when someone is ticked off (or back on).
  'expense.toast.allBack': 'सर्वांनी दिले — {amount} पूर्ण परत आले',
  'expense.toast.allSettled': '{name} यांच्याशी सगळे मिटले',
  'expense.toast.markedPaid': '{who, select, me {तुम्ही दिले म्हणून चिन्हांकित} other {{name} दिले म्हणून चिन्हांकित}}',
  'expense.toast.markedUnpaid': '{who, select, me {तुम्ही अजून दिले नाही म्हणून चिन्हांकित} other {{name} अजून दिले नाही म्हणून चिन्हांकित}}',
  'expense.toast.deleted': '{title} हटवले',
  'expense.toast.undo': 'पूर्ववत करा',

  // The main button.
  'expense.primary.group.cta': '{group} मध्ये हिशोब मिटवा',
  'expense.primary.pay.cta': '{name} यांना {amount} द्या',
  'expense.primary.markPaid.cta': 'मी {name} यांना परत दिले आहेत',
  'expense.primary.payLink.cta': 'पे लिंक शेअर करा',
  'expense.primary.share.cta': 'शेअर करा',
  'expense.share.aria': 'शेअर करा',
  'expense.edit.aria': '{title} बदला',
  'expense.more.aria': 'अधिक पर्याय',

  // Sections.
  'expense.shares.title': 'सर्वांचे हिस्से',
  'expense.shares.markAll.cta': 'सर्वांचे दिले म्हणून चिन्हांकित करा',
  'expense.note.title': 'नोंद',

  // The small print: "Added 18 Oct, 9:41 pm · from a scanned bill · last changed 19 Oct, 8:02 am".
  'expense.added': '{date} ला जोडले',
  'expense.added.changed': 'शेवटचे बदल {date}',
  'expense.added.source.scan': 'स्कॅन केलेल्या बिलावरून',
  'expense.added.source.describe': '“Just say it” द्वारे',
  'expense.added.source.sample': 'नमुना बिलावरून',
  'expense.added.source.recurring': 'नियमित वाटणीवरून',
  'expense.added.source.sms': 'बँक SMS वरून',
  'expense.added.source.voice': 'आवाजाद्वारे',

  // The bill as printed.
  'expense.bill.title': 'बिल',
  'expense.bill.description': '{count, plural, one {# वस्तू · कोणी काय घेतले} other {# वस्तू · कोणी काय घेतले}}',
  'expense.bill.items.aria': 'वस्तू',
  'expense.bill.everyone': 'सर्वांनी मिळून वाटले',
  'expense.bill.showAll.cta': 'सर्व {count} वस्तू दाखवा',
  'expense.bill.items': 'वस्तू',
  'expense.bill.totalPaid': 'एकूण दिलेले',
  'expense.bill.fees.equal.aria': 'शुल्क, समान वाटणी',
  'expense.bill.fees.proportional.aria': 'शुल्क, प्रत्येकाने जे घेतले त्या प्रमाणात',
  // One person's part of the delivery fees: "Fees · Riya".
  'expense.bill.fees.person': 'शुल्क · {name}',
  'expense.bill.tax': 'कर',
  'expense.bill.service': 'सर्व्हिस चार्ज',
  'expense.bill.tip': 'टिप',
  'expense.bill.discount': 'सवलत',
  'expense.bill.roundOff': 'राउंड-ऑफ',
  'expense.bill.otherCharges': 'इतर शुल्क',
  'expense.bill.otherDiscounts': 'इतर सवलती',

  // The ⋮ menu.
  'expense.actions.eyebrow': 'खर्च',
  'expense.actions.editBill': 'बिल बदला',
  'expense.actions.editBill.detail': 'वस्तू, कोणी काय घेतले, कोणी दिले',
  'expense.actions.edit': 'बदला',
  'expense.actions.edit.detail': 'रक्कम, लोक, वाटणी कशी झाली',
  'expense.actions.duplicate': 'कॉपी करा',
  'expense.actions.duplicate.detail': 'आजच्या तारखेची प्रत, बदलून सेव्ह करण्यासाठी',
  'expense.actions.markAll': 'सर्वांना दिले म्हणून चिन्हांकित करा',
  'expense.actions.markAll.detail': 'सगळे पैसे परत आल्यावर',
  'expense.actions.delete': 'हटवा',
  'expense.actions.delete.detail': 'लगेच नंतर तुम्ही पूर्ववत करू शकता',
} as const satisfies Messages
