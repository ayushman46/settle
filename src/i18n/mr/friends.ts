/** Marathi copy for people (the people list, one person, settling up with them, removing someone). Keys: `friends.<screen>.<element>`. */
import type { Messages } from '../types'

export const friends = {
  // The people list (`/app/friends`).
  'friends.list.title': 'लोक',
  'friends.list.subtitle': 'तुम्ही ज्यांच्यासोबत वाटता — त्यांना ॲप लागत नाही.',
  'friends.list.empty.title': 'अजून लोक नाहीत',
  'friends.list.empty.body': 'ज्या मित्रांसोबत वाटता त्यांना जोडा. फक्त नाव पुरे — UPI ID असेल तर एका टॅपमध्ये पैसे देता येतात.',
  'friends.list.empty.cta': 'एक व्यक्ती जोडा',
  'friends.list.search.label': 'लोक शोधा',
  'friends.list.search.placeholder': 'नावाने शोधा',
  'friends.list.search.clear.aria': 'शोध पुसा',
  'friends.list.results.aria': 'शोध निकाल',
  'friends.list.all.aria': 'तुमचे लोक',
  // A row that adds what was searched for as a new person.
  'friends.list.add.title': '“{name}” जोडा',
  'friends.list.add.subtitle': 'तुमच्या लोकांमध्ये नवीन',
  'friends.list.none': '“{query}” नावाचे कोणी नाही.',
  'friends.list.count': '{count, plural, one {# व्यक्ती} other {# जण}}',
  'friends.list.add.cta': 'व्यक्ती जोडा',
  // Under each name: where you stand (or their UPI ID when square).
  'friends.line.owesYou': 'तुम्हाला {amount} देणे आहे',
  'friends.line.youOwe': 'तुमचे {amount} देणे आहे',
  'friends.line.settled': 'हिशोब मिटला',

  // Add or edit a person.
  'friends.form.add.title': 'व्यक्ती जोडा',
  'friends.form.edit.title': '{name} बदला',
  'friends.form.add.description': 'त्यांना ॲप लागत नाही — वाटण्यासाठी फक्त एक नाव.',
  'friends.form.add.cta': 'व्यक्ती जोडा',
  'friends.form.saved.toast': 'सेव्ह झाले',
  'friends.form.added.toast': '{name} जोडले',
  'friends.form.name.label': 'नाव',
  // An example name in the empty name field.
  'friends.form.name.placeholder': 'Riya',
  'friends.form.name.taken': '{name} आधीपासून तुमच्या लोकांमध्ये आहेत.',
  'friends.form.upi.label': 'UPI ID',
  'friends.form.upi.hint': 'ऐच्छिक — एका टॅपमध्ये पैसे देता यावेत म्हणून.',
  'friends.form.upi.error': 'हा UPI ID वाटत नाही. तो name@bank सारखा असायला हवा.',
  'friends.form.phone.label': 'फोन',
  'friends.form.phone.hint': 'ऐच्छिक — WhatsApp आणि SMS आठवणींसाठी.',
  'friends.form.phone.error': 'हा फोन नंबर वाटत नाही. 7 ते 15 अंक वापरा, उदा. 98765 43210.',
  'friends.form.color.label': 'अवतारचा रंग',
  'friends.color.peach': 'पीच',
  'friends.color.mint': 'मिंट',
  'friends.color.sky': 'स्काय',
  'friends.color.lilac': 'लिलॅक',
  'friends.color.lemon': 'लिंबू',
  'friends.color.rose': 'गुलाबी',
  'friends.color.teal': 'टील',
  'friends.color.sand': 'वाळू',

  // One person (`/app/friends/:id`).
  'friends.gone.title': 'ही व्यक्ती इथे नाही',
  'friends.gone.subtitle': 'कदाचित काढून टाकली गेली असेल — या फोनवर किंवा दुसऱ्या टॅबमध्ये.',
  'friends.gone.cta': 'तुमचे लोक पहा',
  'friends.detail.edit.aria': '{name} बदला',
  'friends.detail.split.cta': '{name} सोबत वाटा',
  'friends.detail.upi.aria': 'UPI ID {upi}. कॉपी करा',
  'friends.detail.upi.add': 'UPI ID जोडा',
  'friends.detail.upi.copied.toast': 'UPI ID कॉपी झाला',
  'friends.detail.upi.copy.error': 'कॉपी करता आले नाही. कॉपी करण्यासाठी UPI ID दाबून धरा.',
  'friends.detail.call.aria': '{phone} वर {name} यांना कॉल करा',
  'friends.detail.groups.title': 'एकत्र असलेले ग्रुप',
  'friends.detail.expenses.title': '{name} यांच्यासोबतचे खर्च',
  'friends.detail.expenses.empty.title': 'अजून काही वाटले नाही',
  'friends.detail.expenses.empty.body': '{name} यांच्यासोबत बिल, कॅब किंवा भाडे वाटा — ते इथे दिसेल.',
  'friends.detail.expenses.fewer.cta': 'कमी दाखवा',
  'friends.detail.expenses.all.cta': 'सर्व {count} दाखवा',
  'friends.detail.remove.cta': 'तुमच्या लोकांमधून काढा',
  'friends.detail.removed.toast': '{name} तुमच्या लोकांमधून काढले',
  // "Someone" is what past splits call a removed person.
  'friends.remove.title': '{name} काढायचे?',
  'friends.remove.body': '{name} तुमच्या लोकांमधून आणि कोणत्याही ग्रुपमधून बाहेर जातील. जुन्या वाटण्या राहतील, तिथे त्यांना “कोणीतरी” असे दाखवले जाईल.',
  'friends.remove.cta': '{name} काढा',
  'friends.remove.keep.cta': '{name} ठेवा',
  'friends.blocked.title': '{name} आत्ता काढता येणार नाहीत',
  'friends.blocked.ok.cta': 'ठीक आहे',

  // Where I stand with them.
  'friends.standing.square': 'तुमचा आणि {name} यांचा हिशोब बरोबर आहे',
  'friends.standing.owesYou': '{name} तुम्हाला देणे लागतात',
  'friends.standing.youOwe': 'तुम्ही {name} यांना देणे लागता',
  // Other currencies under the amount: "Also owes you $20 · you owe €5".
  'friends.standing.also': 'शिवाय {list}',
  'friends.standing.nothing': 'मिटवण्यासारखे काही नाही — छान.',
  'friends.standing.remind.cta': 'आठवण करा',
  'friends.standing.pay.cta': 'UPI द्वारे द्या',
  'friends.settle.cta': 'हिशोब मिटवा',
  'friends.allSquare': '{name} यांच्यासोबत सर्व बरोबर',
  'friends.allSquare.subtitle': 'मिटवण्यासारखे काही उरलेले नाही.',

  // Where the money comes from: each shared group, and splits outside groups.
  'friends.sources.title': 'हे कुठून आले',
  'friends.sources.splits': 'ग्रुपबाहेरील {count, plural, one {# वाटणी} other {# वाटण्या}}',
  'friends.sources.paysYou': '{name} तुम्हाला देतात',
  'friends.sources.youPay': 'तुम्ही {name} यांना देता',
  'friends.sources.even': 'बरोबर झाले',
  // What a reminder is for when it covers several splits ("for our splits").
  'friends.sources.ourSplits': 'आपल्या वाटण्या',

  // Settle up with one person.
  'friends.settle.title': '{name} यांच्यासोबत हिशोब मिटवा',
  'friends.settle.owesYou': '{name} तुम्हाला एकूण {amount} देणे लागतात.',
  'friends.settle.youOwe': 'तुम्ही {name} यांना एकूण {amount} देणे लागता.',
  'friends.settle.square': 'तुमचा आणि {name} यांचा हिशोब बरोबर आहे.',
  'friends.settle.all.cta': 'सर्व मिटवा',
  'friends.settle.inGroup.aria': '{name} यांच्यासोबत ग्रुपमध्ये हिशोब मिटवा',
  'friends.settle.inGroup.cta': 'ग्रुपमध्ये मिटवा',
  'friends.settle.mark.cta': 'मिटले म्हणून चिन्हांकित करा',
  'friends.settle.marked.toast': '{count, plural, one {# वाटणी मिटले म्हणून चिन्हांकित} other {# वाटण्या मिटले म्हणून चिन्हांकित}}',

  // Why someone can't be removed yet. {groups} is a list of group names.
  'friends.blocked.money': '{name} यांचे अजून मिटवायचे पैसे बाकी आहेत.',
  'friends.blocked.money.groups': '{name} यांचे {groups} मध्ये अजून मिटवायचे पैसे बाकी आहेत.',
  'friends.blocked.money.splits': 'ग्रुपबाहेरील {count, plural, one {# वाटणीवर} other {# वाटण्यांवर}} {name} यांचे अजून मिटवायचे पैसे बाकी आहेत.',
  'friends.blocked.money.both': '{groups} मध्ये आणि ग्रुपबाहेरील {count, plural, one {# वाटणीवर} other {# वाटण्यांवर}} {name} यांचे अजून मिटवायचे पैसे बाकी आहेत.',
  // {titles}: the recurring splits' names, in quotes.
  'friends.blocked.recurring': '{name} तुमच्या नियमित {count, plural, one {वाटणीत} other {वाटण्यांमध्ये}} आहेत: {titles}.',
  'friends.blocked.settleFirst': 'आधी हिशोब मिटवा, मग ते जाऊ शकतात.',
  'friends.blocked.takeOut': 'आधी त्यांना यातून बाहेर काढा, मग ते जाऊ शकतात.',
} as const satisfies Messages
