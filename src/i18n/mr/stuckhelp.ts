import type { Messages } from '../types'

export const stuckhelp: Messages = {
  // The sheet's title, per rung — the same words as the button that opens it.
  'stuckhelp.title.bank': 'तुमच्या बँकेकडे तक्रार करा',
  'stuckhelp.title.wallet': '{name} कडे तक्रार करा',
  'stuckhelp.title.walletAny': 'वॉलेट कंपनीकडे तक्रार करा',
  'stuckhelp.title.compensation': '{amount} ची भरपाई मागा',
  'stuckhelp.title.compensationAny': 'भरपाई मागा',
  'stuckhelp.title.ombudsman': 'RBI लोकपालकडे (Ombudsman) तक्रार करा',
  'stuckhelp.title.merchant': '{name} कडे तक्रार करा',
  'stuckhelp.title.merchantAny': 'कंपनीकडे तक्रार करा',
  'stuckhelp.title.nch': 'राष्ट्रीय ग्राहक हेल्पलाइनकडे तक्रार न्या',
  'stuckhelp.title.airsewa': 'AirSewa कडे तक्रार न्या',
  'stuckhelp.title.commission': 'ग्राहक आयोगाकडे तक्रार करा',

  // One line under the title: what this rung is.
  'stuckhelp.lead.bank': 'RBI च्या नियमांनुसार तुमच्या बँकेने ते परत करायलाच हवे, आणि उशिराच्या प्रत्येक दिवसाचे ₹100 द्यायला हवेत.',
  'stuckhelp.lead.wallet': 'RBI च्या नियमांनुसार वॉलेट कंपनीने ते दुसऱ्या दिवसापर्यंत परत करायलाच हवे, आणि उशिराच्या प्रत्येक दिवसाचे ₹100 द्यायला हवेत.',
  'stuckhelp.lead.compensation': 'RBI च्या नियमांनुसार पैसे जितके दिवस उशिरा आले, त्या प्रत्येक दिवसाचे ₹100 तुमची बँक देणे लागते. ते लेखी मागा.',
  'stuckhelp.lead.compensationWallet': 'RBI च्या नियमांनुसार पैसे जितके दिवस उशिरा आले, त्या प्रत्येक दिवसाचे ₹100 वॉलेट कंपनी देणे लागते. ते लेखी मागा.',
  'stuckhelp.lead.ombudsman': 'तुमच्या बँकेने प्रश्न सोडवला नाही, तर RBI ची तक्रार सेवा.',
  'stuckhelp.lead.ombudsmanWallet': 'वॉलेट कंपनीने प्रश्न सोडवला नाही, तर RBI ची तक्रार सेवा.',
  'stuckhelp.lead.merchant': 'आधी थेट त्या कंपनीकडे, ऑर्डर नंबरसह, लेखी तक्रार करा.',
  'stuckhelp.lead.nch': 'सरकारची हेल्पलाइन तुमची तक्रार तुमच्या वतीने कंपनीपर्यंत पोहोचवते.',
  'stuckhelp.lead.airsewa': 'एअरलाइन्सविरुद्धच्या तक्रारींसाठी नागरी विमान वाहतूक मंत्रालयाचे पोर्टल.',
  'stuckhelp.lead.commission': 'ग्राहक आयोग (ग्राहक न्यायालय) प्रकरणावर निर्णय देतो. तक्रार ऑनलाइन दाखल करता येते.',

  // Your bank or UPI app, for a failed payment. App names and menu labels as each app shows them.
  'stuckhelp.bank.app.gpay':
    'Google Pay मध्ये, ट्रान्झॅक्शन हिस्ट्रीमधून हे पेमेंट उघडा, Having issues वर टॅप करा, मग Payment issue (किंवा Stuck payment) निवडा, आणि तिकीट तयार करा.',
  'stuckhelp.bank.app.phonepe': 'PhonePe मध्ये, History मध्ये हे पेमेंट उघडा आणि Contact PhonePe Support वर टॅप करा.',
  'stuckhelp.bank.app.paytm':
    'Paytm मध्ये, तुमच्या प्रोफाइलवर टॅप करा, मग Help & Support. हे पेमेंट आणि जुळणारी अडचण (money debited, failed किंवा pending) निवडा, मग तिकीट तयार करा.',
  'stuckhelp.bank.app.other': '{app} मध्ये, हिस्ट्रीमध्ये हे पेमेंट उघडा आणि तिथूनच तक्रार करा. प्रत्येक UPI ॲपने ही सोय द्यायलाच हवी.',
  'stuckhelp.bank.app.unknown': 'ज्या UPI ॲपने पैसे दिले, त्यात हे पेमेंट उघडा आणि तिथूनच तक्रार करा. प्रत्येक UPI ॲपने ही सोय द्यायलाच हवी.',
  'stuckhelp.bank.card': 'तुमच्या बँकेच्या ॲपमध्ये किंवा नेट बँकिंगमध्ये या पेमेंटसाठी डिस्प्यूट नोंदवा, किंवा कार्डच्या मागे असलेल्या नंबरवर कॉल करा.',
  'stuckhelp.bank.atm': 'ATM दुसऱ्या बँकेचे असले तरी, तुमचे कार्ड ज्या बँकेने दिले तिच्याकडे तक्रार करा: तिच्या ॲपमध्ये, कस्टमर केअरकडे किंवा शाखेत.',
  'stuckhelp.bank.wallet': 'वॉलेटच्या ॲपमध्ये हे पेमेंट उघडा आणि त्याच्या हेल्प विभागातून तक्रार करा.',
  'stuckhelp.bank.direct': 'तुमच्या बँकेकडे तक्रार करा: कस्टमर केअर, नेट बँकिंगमधला तक्रार फॉर्म, किंवा शाखा.',
  'stuckhelp.bank.letter':
    'खालील पत्रही तुमच्या बँकेला पाठवा — ईमेलने, नेट बँकिंगमध्ये किंवा शाखेत. पैसे परत करणे आणि दिवसाचे ₹100 देणे ही बँकेची जबाबदारी आहे.',
  'stuckhelp.bank.myupi':
    'ॲपकडून उत्तर नाही? UPI हेल्प वेबसाइटवर (upihelp.npci.org.in, UPI चालवणाऱ्या NPCI कंपनीची) पेमेंटपासून 45 दिवसांच्या आत तक्रार करा. तुमच्या SMS मधला 12 अंकी नंबर तयार ठेवा.',
  'stuckhelp.bank.myupiPassed': 'UPI हेल्प वेबसाइट पेमेंटपासून फक्त 45 दिवसांच्या आत तक्रारी घेते, आणि ती वेळ निघून गेली आहे. त्याऐवजी तुमच्या बँकेला पत्र पाठवा.',
  'stuckhelp.bank.note': 'तक्रार नंबर मिळाला? तो “मी तक्रार केली” मध्ये सेव्ह करा. 30 दिवसांत प्रश्न सुटला नाही, तर पुढची पायरी RBI लोकपाल.',
  // Once it's raised ({date}: "2 Nov"; {ref}: the complaint number, or "none").
  'stuckhelp.bank.raised': 'तुम्ही {date} ला तक्रार केली{ref, select, none {} other { (नंबर {ref})}}. त्यानंतर 30 दिवसांत प्रश्न सुटला नाही, तर पुढची पायरी RBI लोकपाल.',

  // A wallet payment ({name}: "Paytm").
  'stuckhelp.wallet.app': '{name} मध्ये हे पेमेंट उघडा आणि त्याच्या हेल्प विभागातून तक्रार करा.',
  'stuckhelp.wallet.letter':
    'ॲपमध्ये प्रश्न सुटला नाही? खालील पत्र वॉलेट कंपनीच्या तक्रार निवारण अधिकाऱ्याला पाठवा; संपर्क ॲपच्या हेल्पमध्ये किंवा कंपनीच्या तक्रार निवारण धोरणात असतो. पैसे परत करणे आणि दिवसाचे ₹100 देणे ही वॉलेट कंपनीची जबाबदारी आहे.',

  // The money came back late: the compensation claim.
  'stuckhelp.compensation.send': 'खालील पत्र तुमच्या बँकेला पाठवा: कस्टमर केअरला ईमेलने, नेट बँकिंगमधल्या तक्रार फॉर्ममध्ये, किंवा शाखेत.',
  'stuckhelp.compensation.sendWallet': 'खालील पत्र वॉलेट कंपनीच्या तक्रार निवारण अधिकाऱ्याला पाठवा: ईमेलने, किंवा कंपनीच्या ॲपमधील हेल्प विभागातून.',
  'stuckhelp.compensation.why': 'RBI च्या नियमांनुसार ही रक्कम न मागता मिळायला हवी. हे पत्र दिवस मोजून ती लेखी मागते.',

  // The RBI Ombudsman.
  'stuckhelp.ombudsman.when':
    'बँकेकडे तक्रार करून 30 दिवस झाले की तुम्ही इथे तक्रार करू शकता (बँकेने उत्तर दिले आणि तुमचे समाधान झाले नाही, तर त्याआधीही), आणि त्यानंतर 90 दिवसांच्या आत.',
  'stuckhelp.ombudsman.whenWallet':
    'वॉलेट कंपनीकडे तक्रार करून 30 दिवस झाले की तुम्ही इथे तक्रार करू शकता (कंपनीने उत्तर दिले आणि तुमचे समाधान झाले नाही, तर त्याआधीही), आणि त्यानंतर 90 दिवसांच्या आत.',
  'stuckhelp.ombudsman.file': 'cms.rbi.org.in वर तुमच्या बँकेविरुद्ध तक्रार दाखल करा. फॉर्मसाठी लागणारा तपशील खाली आहे.',
  'stuckhelp.ombudsman.fileWallet': 'cms.rbi.org.in वर वॉलेटमागच्या कंपनीविरुद्ध, म्हणजे {issuer} विरुद्ध, तक्रार दाखल करा. फॉर्मसाठी लागणारा तपशील खाली आहे.',
  'stuckhelp.ombudsman.fileWalletAny': 'cms.rbi.org.in वर वॉलेटमागच्या कंपनीविरुद्ध तक्रार दाखल करा. फॉर्मसाठी लागणारा तपशील खाली आहे.',
  'stuckhelp.ombudsman.paste':
    'तक्रारीचा तपशील म्हणून हे पत्र पेस्ट करा. बँकेकडे केलेली तक्रार, तिचे उत्तर असल्यास, आणि पैसे कापल्याचे दाखवणारे स्टेटमेंट जोडा.',
  'stuckhelp.ombudsman.pasteWallet':
    'तक्रारीचा तपशील म्हणून हे पत्र पेस्ट करा. वॉलेट कंपनीकडे केलेली तक्रार, तिचे उत्तर असल्यास, आणि पैसे कापल्याचे दाखवणारे वॉलेट स्टेटमेंट जोडा.',
  'stuckhelp.ombudsman.call': 'काही प्रश्न? {phone} वर कॉल करा: सोमवार ते शनिवार, सकाळी 8 ते रात्री 10 पर्यंत लोक उत्तर देतात. ते मार्गदर्शन करतात, पण तक्रार घेऊ शकत नाहीत.',
  'stuckhelp.ready.heading': 'हे तयार ठेवा',
  'stuckhelp.ready.complaint': 'बँकेकडे केलेली तक्रार आणि तिचा नंबर',
  'stuckhelp.ready.complaintWallet': 'वॉलेट कंपनीकडे केलेली तक्रार आणि तिचा नंबर',
  'stuckhelp.ready.reply': 'बँकेचे उत्तर, आले असल्यास',
  'stuckhelp.ready.replyWallet': 'वॉलेट कंपनीचे उत्तर, आले असल्यास',
  'stuckhelp.ready.payment': 'पेमेंटची तारीख आणि रेफरन्स',
  'stuckhelp.ready.account': 'तुमचा खाते किंवा कार्ड नंबर',
  'stuckhelp.ready.wallet': 'वॉलेटशी नोंदवलेला मोबाइल नंबर',
  'stuckhelp.ready.relief': 'तुम्ही काय मागत आहात, भरपाईच्या हिशोबासह (खाली)',

  // The business.
  'stuckhelp.merchant.page': '{name} चे हेल्प पेज उघडा, ही ऑर्डर शोधा आणि तिथूनच सपोर्टशी संपर्क करा.',
  'stuckhelp.merchant.app': '{name} ॲप किंवा वेबसाइटवर ही ऑर्डर उघडा आणि तिथूनच सपोर्टशी संपर्क करा.',
  'stuckhelp.merchant.unknown': 'त्या कंपनीच्या सपोर्टशी संपर्क करा, शक्य असल्यास ऑर्डरमधूनच.',
  'stuckhelp.merchant.paste': 'खालील मेसेज पेस्ट करा आणि तिकीट नंबर मागा.',
  // Settle's own advice (a week), not the law's month.
  'stuckhelp.merchant.nextNch': 'त्यांना एक आठवडा द्या. तरीही सुटले नाही? तुम्ही राष्ट्रीय ग्राहक हेल्पलाइनकडे जाऊ शकता; पूर्ण महिना थांबायची गरज नाही.',
  'stuckhelp.merchant.nextAirsewa': 'त्यांना एक आठवडा द्या. तरीही सुटले नाही? तुम्ही AirSewa कडे जाऊ शकता.',
  'stuckhelp.rule.ecommerce':
    'ऑनलाइन कंपन्यांनी तक्रार 48 तासांत स्वीकारून महिनाभरात सोडवायला हवी (ग्राहक संरक्षण (ई-कॉमर्स) नियम, 2020).',
  'stuckhelp.rule.dgca': 'DGCA चे नियम: कार्ड पेमेंटचा रिफंड 7 दिवसांत, किंवा एजंट किंवा पोर्टलवरून बुक केले असल्यास 14 कामकाजाच्या दिवसांत.',

  // The National Consumer Helpline.
  'stuckhelp.nch.send': 'खालील मेसेज WhatsApp वर {whatsapp} ला पाठवा, {phone} किंवा {tollFree} वर कॉल करा (सकाळी 8 ते रात्री 8), किंवा consumerhelpline.gov.in वर नोंदवा.',
  'stuckhelp.nch.docket': 'हेल्पलाइन {name} कडे हा प्रश्न मांडते. ती देते तो डॉकेट नंबर लिहून ठेवा.',
  'stuckhelp.nch.docketAny': 'हेल्पलाइन त्या कंपनीकडे हा प्रश्न मांडते. ती देते तो डॉकेट नंबर लिहून ठेवा.',
  'stuckhelp.nch.next': 'महिनाभरात सुटले नाही? पुढची पायरी ग्राहक आयोग.',

  // AirSewa.
  'stuckhelp.airsewa.file': 'airsewa.gov.in वर किंवा AirSewa ॲपमध्ये नोंदणी करा, आणि {name} विरुद्ध तक्रार दाखल करा.',
  'stuckhelp.airsewa.fileAny': 'airsewa.gov.in वर किंवा AirSewa ॲपमध्ये नोंदणी करा, आणि एअरलाइनविरुद्ध तक्रार दाखल करा.',
  'stuckhelp.airsewa.paste': 'PNR सह खालील मेसेज पेस्ट करा, आणि कॅन्सलेशनचा आणि रिफंडचा मेसेज जोडा.',
  'stuckhelp.airsewa.note': 'AirSewa पाठवते तो रेफरन्स नंबर लिहून ठेवा.',

  // A consumer commission.
  'stuckhelp.commission.where': 'ग्राहक तक्रारी e-Jagriti (e-jagriti.gov.in) वर ऑनलाइन दाखल होतात. ₹50 लाखांपर्यंतच्या रकमेसाठी तुमचा जिल्हा ग्राहक आयोग.',
  'stuckhelp.commission.attach': 'खालील सारांशापासून सुरुवात करा. ऑर्डर, रिफंडचा किंवा फेल झाल्याचा मेसेज, आणि तुमच्या तक्रारी त्यांच्या नंबरसह जोडा.',
  'stuckhelp.commission.advice': 'Settle कायदेशीर सल्ला देत नाही. तक्रार दाखल करायला मदत हवी असल्यास आयोगाला किंवा एखाद्या ग्राहक संस्थेला विचारा.',

  // Buttons and links that take you there.
  'stuckhelp.link.cms': 'cms.rbi.org.in उघडा',
  'stuckhelp.link.call': '{phone} वर कॉल करा',
  'stuckhelp.link.myupi': 'UPI हेल्प वेबसाइट',
  'stuckhelp.link.phonepeGrievance': 'PhonePe चा तक्रार विभाग',
  'stuckhelp.link.merchantHelp': '{name} हेल्प उघडा',
  'stuckhelp.link.merchantRefunds': '{name} ची रिफंड हेल्प उघडा',
  'stuckhelp.link.whatsapp': 'WhatsApp वर पाठवा',
  'stuckhelp.link.nchSite': 'consumerhelpline.gov.in',
  'stuckhelp.link.airsewa': 'AirSewa उघडा',
  'stuckhelp.link.ejagriti': 'e-Jagriti उघडा',
  'stuckhelp.links.aria': 'त्यांच्याशी संपर्काचे इतर मार्ग',
  'stuckhelp.newTab': '{label} (नवीन टॅबमध्ये उघडते)',

  // The sheet.
  'stuckhelp.eyebrow': '{amount} · {name}',
  'stuckhelp.party.failed': 'फेल झालेले पेमेंट',
  'stuckhelp.party.refund': 'रिफंड',
  'stuckhelp.how.heading': 'कुठे आणि कसे',
  'stuckhelp.fields.heading': 'फॉर्मसाठी',
  'stuckhelp.fields.hint': 'cms.rbi.org.in वरच्या तक्रार फॉर्ममध्ये हे टाका.',
  'stuckhelp.field.entity': 'बँक',
  'stuckhelp.field.entityWallet': 'वॉलेट कंपनी',
  'stuckhelp.field.category': 'तक्रार कशाबद्दल',
  'stuckhelp.field.date': 'पेमेंटची तारीख',
  'stuckhelp.field.amount': 'रक्कम',
  'stuckhelp.field.reference': 'ट्रान्झॅक्शन रेफरन्स',
  'stuckhelp.field.account': 'खाते किंवा कार्ड',
  'stuckhelp.field.mobile': 'नोंदवलेला मोबाइल',
  'stuckhelp.field.bankComplaint': 'बँकेकडे केलेली तक्रार',
  'stuckhelp.field.walletComplaint': 'वॉलेट कंपनीकडे केलेली तक्रार',
  'stuckhelp.field.relief': 'तुमची मागणी',
  'stuckhelp.field.copy': '{field} कॉपी करा',
  'stuckhelp.field.copied': '{field} कॉपी झाले',

  // Your details for letters: asked once, kept on this phone.
  'stuckhelp.me.heading': 'तुमचा तपशील',
  'stuckhelp.me.hint': 'Settle हा तपशील पत्रात लिहिते. तो याच फोनवर राहतो आणि कुठेही पाठवला जात नाही.',
  'stuckhelp.me.mobile': 'मोबाइल नंबर',
  'stuckhelp.me.place': 'शहर आणि राज्य',
  // Kept in English letters on purpose: what's typed here goes into the English letter.
  'stuckhelp.me.placeExample': 'Pune, Maharashtra',
  'stuckhelp.me.address': 'पत्ता (ऐच्छिक)',
  'stuckhelp.me.change': 'बदला',
  'stuckhelp.me.changeLabel': 'तुमचा तपशील बदला',

  // A NACH debit: was the mandate cancelled before it?
  'stuckhelp.mandate.heading': 'मँडेट',
  'stuckhelp.mandate.question': 'पैसे कापण्यापूर्वी तुम्ही हा मँडेट तुमच्या बँकेकडे रद्द केला होता का?',
  'stuckhelp.mandate.no': 'नाही',
  'stuckhelp.mandate.yes': 'हो, मी तो रद्द केला होता',
  'stuckhelp.mandate.date': 'रद्द केल्याची तारीख (ऐच्छिक)',
  'stuckhelp.mandate.hint': 'मँडेट रद्द केल्यानंतर कापलेले पैसे हे फेल झालेले पेमेंट नसते, म्हणून पत्रात लिहिले जाते की रद्द केल्यानंतर पैसे कापले गेले.',

  // Who the email goes to ({kind}: bank, wallet or business; {email}: "crpc@rbi.org.in").
  'stuckhelp.email.label': 'कोणाला पाठवायचे (ईमेल)',
  'stuckhelp.email.hint':
    '{kind, select, wallet {वॉलेट कंपनीचा तक्रार निवारण ईमेल, तिच्या ॲपच्या हेल्पमधून.} business {कंपनीचा सपोर्ट ईमेल, असल्यास.} other {तुमच्या बँकेचा तक्रार निवारण ईमेल, तिच्या वेबसाइट किंवा ॲपमधून.}} Settle तो याच फोनवर लक्षात ठेवते.',
  'stuckhelp.email.crpc': 'ईमेल RBI च्या तक्रार केंद्राला, {email} ला जातो.',

  // The letter's box: {kind} is letter, message or summary.
  'stuckhelp.letter.heading': '{kind, select, message {मेसेज} summary {सारांश} other {पत्र}}',
  'stuckhelp.letter.blanks':
    '{count, plural, one {[कंसात] असलेला # भाग अजून भरायचा आहे. पाठवण्यापूर्वी तो भरा.} other {[कंसात] असलेले # भाग अजून भरायचे आहेत. पाठवण्यापूर्वी ते भरा.}}',
  'stuckhelp.letter.actions': 'पत्र पाठवा',
  // Above the letter, in the app's language: what it asks for.
  'stuckhelp.summary.reverse': 'यात {amount} परत मागितले आहेत, आणि उशिराच्या प्रत्येक दिवसाचे ₹100.',
  'stuckhelp.summary.reverseOwed': 'यात {amount} परत मागितले आहेत, आणि उशिराबद्दल आतापर्यंत येणे असलेले {compensation} (दिवसाला ₹100).',
  'stuckhelp.summary.compensation': 'यात पैसे जितके दिवस उशिरा आले, त्याबद्दल येणे असलेले {compensation} मागितले आहेत (दिवसाला ₹100).',
  'stuckhelp.summary.compensationAny': 'यात पैसे जितके दिवस उशिरा आले, त्याबद्दल येणे असलेली भरपाई मागितली आहे (दिवसाला ₹100).',
  'stuckhelp.summary.ombudsman': 'यात RBI लोकपालला काय झाले आणि तुमच्या तक्रारीचे काय झाले ते सांगितले आहे, आणि आतापर्यंत तुम्हाला येणे असलेले {total} मागितले आहेत.',
  'stuckhelp.summary.ombudsmanAny': 'यात RBI लोकपालला काय झाले आणि तुमच्या तक्रारीचे काय झाले ते सांगितले आहे, आणि तुम्हाला जे येणे आहे ते मागितले आहे.',
  'stuckhelp.summary.refund': 'यात तुमचा {amount} चा रिफंड मागितला आहे, किंवा तो आधीच पाठवला असेल तर त्याचा रेफरन्स नंबर, म्हणजे तुम्ही तो शोधू शकाल.',
  'stuckhelp.summary.confirm': 'यात तुमचे {amount} त्यांच्यापर्यंत पोहोचले की नाही ते लेखी कळवायला सांगितले आहे, म्हणजे ते तुम्ही तुमच्या बँकेला दाखवू शकाल.',
  'stuckhelp.summary.nch': 'यात हेल्पलाइनला तुमच्या {amount} चा प्रश्न कंपनीकडे मांडायला सांगितले आहे, आणि तुम्ही आतापर्यंत काय केले त्याची यादी आहे.',
  'stuckhelp.summary.airsewa': 'यात DGCA च्या नियमांप्रमाणे एअरलाइनकडून तुमचा {amount} चा रिफंड मिळवून द्यायची विनंती AirSewa ला केली आहे.',
  'stuckhelp.summary.commission': 'यात आयोगासाठी तुमच्या प्रकरणाचा सारांश आहे: काय झाले, कधी, तुम्ही काय केले, आणि तुम्ही मागत असलेले {amount}.',
  'stuckhelp.summary.english':
    '{kind, select, message {मेसेज} summary {सारांश} other {पत्र}} इंग्रजीत आहे — बँका, कंपन्या आणि नियामक संस्था याच भाषेत काम करतात.',
  'stuckhelp.action.copy': '{kind, select, message {मेसेज कॉपी करा} summary {सारांश कॉपी करा} other {पत्र कॉपी करा}}',
  'stuckhelp.action.email': 'ईमेल',
  'stuckhelp.action.print': 'प्रिंट करा किंवा PDF म्हणून सेव्ह करा',
  'stuckhelp.copied.status': 'कॉपी झाले',
  'stuckhelp.copied.toast': 'कॉपी झाले. जिथे पाठवायचे तिथे पेस्ट करा.',
  'stuckhelp.copyFailed.toast': 'कॉपी करता आले नाही. मजकूर निवडून कॉपी करा.',

  // "I've raised it": the day and the number they gave you.
  'stuckhelp.raised.cta': 'मी तक्रार केली',
  'stuckhelp.raised.title': 'तुम्ही तक्रार कधी केली?',
  'stuckhelp.raised.description': 'पुढच्या पायरीसाठीची मुदत Settle या दिवसापासून मोजते.',
  'stuckhelp.raised.date': 'तक्रारीची तारीख',
  'stuckhelp.raised.ref': '{kind, select, merchant {तिकीट नंबर} nch {डॉकेट नंबर} airsewa {रेफरन्स नंबर} commission {केस नंबर} other {तक्रार नंबर}}',
  'stuckhelp.raised.refHint': 'ऐच्छिक, मिळाला असल्यास',
  'stuckhelp.raised.save': 'सेव्ह करा',
  'stuckhelp.raised.toast':
    '{kind, select, bank {नोंदवले: {date} ला तुमच्या बँकेकडे तक्रार केली} ombudsman {नोंदवले: {date} ला RBI लोकपालकडे तक्रार नेली} merchant {नोंदवले: {date} ला {name} कडे तक्रार केली} nch {नोंदवले: {date} ला राष्ट्रीय ग्राहक हेल्पलाइनकडे तक्रार केली} airsewa {नोंदवले: {date} ला AirSewa वर तक्रार केली} other {नोंदवले: {date} ला ग्राहक आयोगाकडे तक्रार दाखल केली}}',
}
