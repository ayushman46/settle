/** Telugu copy for raising a stuck payment (src/features/stuck/RaiseSheet.tsx): where to complain, the letter, and noting it was sent. */
import type { Messages } from '../types'

export const stuckhelp: Messages = {
  // The sheet's title, per rung ({amount} is pre-formatted: "₹300"; {name} a business: "Swiggy").
  'stuckhelp.title.bank': 'మీ బ్యాంక్‌కి ఫిర్యాదు చేయండి',
  'stuckhelp.title.compensation': '{amount} పరిహారం అడగండి',
  'stuckhelp.title.compensationAny': 'పరిహారం అడగండి',
  'stuckhelp.title.ombudsman': 'RBI అంబుడ్స్‌మన్‌కి తీసుకెళ్లండి',
  'stuckhelp.title.merchant': '{name} ని రీఫండ్ అడగండి',
  'stuckhelp.title.merchantAny': 'రీఫండ్ అడగండి',
  'stuckhelp.title.nch': 'జాతీయ వినియోగదారుల హెల్ప్‌లైన్',
  'stuckhelp.title.airsewa': 'AirSewa లో ఫిర్యాదు చేయండి',
  'stuckhelp.title.commission': 'వినియోగదారుల కమిషన్‌కి తీసుకెళ్లండి',

  // One line under the title: what this rung is.
  'stuckhelp.lead.bank': 'RBI నియమాల ప్రకారం మీ బ్యాంక్ డబ్బు తిరిగి వేయాలి, ఆలస్యమైన ప్రతి రోజుకు ₹100 చెల్లించాలి.',
  'stuckhelp.lead.compensation': 'RBI నియమాల ప్రకారం డబ్బు ఆలస్యమైన ప్రతి రోజుకు మీ బ్యాంక్ ₹100 ఇవ్వాలి. రాతపూర్వకంగా క్లెయిమ్ చేయండి.',
  'stuckhelp.lead.ombudsman': 'మీ బ్యాంక్ పరిష్కరించనప్పుడు ఆశ్రయించాల్సిన RBI ఫిర్యాదు సేవ.',
  'stuckhelp.lead.merchant': 'ముందు ఆ సంస్థకే, ఆర్డర్ నంబర్‌తో, రాతపూర్వకంగా చెప్పండి.',
  'stuckhelp.lead.nch': 'ప్రభుత్వ హెల్ప్‌లైన్ మీ తరఫున మీ ఫిర్యాదును ఆ సంస్థ దగ్గరకు తీసుకెళ్తుంది.',
  'stuckhelp.lead.airsewa': 'ఎయిర్‌లైన్‌లపై ఫిర్యాదుల కోసం పౌర విమానయాన మంత్రిత్వ శాఖ పోర్టల్.',
  'stuckhelp.lead.commission': 'వినియోగదారుల కమిషన్ (వినియోగదారుల కోర్టు) కేసును తేలుస్తుంది. ఆన్‌లైన్‌లో దాఖలు చేయవచ్చు.',

  // Your bank or UPI app, for a failed payment. App names and menu labels as each app shows them.
  'stuckhelp.bank.app.gpay':
    'Google Pay లో, ట్రాన్సాక్షన్ హిస్టరీ నుంచి ఈ చెల్లింపు తెరిచి, Having issues ట్యాప్ చేయండి, తర్వాత Payment issue (లేదా Stuck payment) ఎంచుకుని టికెట్ క్రియేట్ చేయండి.',
  'stuckhelp.bank.app.phonepe': 'PhonePe లో, History లో ఈ చెల్లింపు తెరిచి Contact PhonePe Support ట్యాప్ చేయండి.',
  'stuckhelp.bank.app.paytm':
    'Paytm లో మీ ప్రొఫైల్ ట్యాప్ చేసి, Help & Support తెరవండి. ఈ చెల్లింపును, సరిపోయే సమస్యను (డబ్బు కట్ అయింది, ఫెయిల్ అయింది లేదా పెండింగ్‌లో ఉంది) ఎంచుకుని, టికెట్ రైజ్ చేయండి.',
  'stuckhelp.bank.app.other': '{app} లో, హిస్టరీలో ఈ చెల్లింపు తెరిచి అక్కడి నుంచే ఫిర్యాదు చేయండి. ప్రతి UPI యాప్ దీనికి వీలు ఇవ్వాలి.',
  'stuckhelp.bank.app.unknown': 'మీరు చెల్లించిన UPI యాప్‌లో ఈ చెల్లింపు తెరిచి అక్కడి నుంచే ఫిర్యాదు చేయండి. ప్రతి UPI యాప్ దీనికి వీలు ఇవ్వాలి.',
  'stuckhelp.bank.card': 'మీ బ్యాంక్ యాప్‌లో లేదా నెట్ బ్యాంకింగ్‌లో ఈ చెల్లింపుపై డిస్‌ప్యూట్ రైజ్ చేయండి, లేదా మీ కార్డ్ వెనుక ఉన్న నంబర్‌కు కాల్ చేయండి.',
  'stuckhelp.bank.atm': 'ATM వేరే బ్యాంక్‌దైనా సరే, మీ కార్డ్ ఇచ్చిన బ్యాంక్‌కే ఫిర్యాదు చేయండి: దాని యాప్‌లో, కస్టమర్ కేర్‌కు లేదా బ్రాంచ్‌లో.',
  'stuckhelp.bank.wallet': 'వాలెట్ యాప్‌లో ఈ చెల్లింపు తెరిచి, దాని హెల్ప్ విభాగం నుంచి ఫిర్యాదు చేయండి.',
  'stuckhelp.bank.direct': 'మీ బ్యాంక్‌కి ఫిర్యాదు చేయండి: కస్టమర్ కేర్, నెట్ బ్యాంకింగ్‌లోని ఫిర్యాదు ఫారం, లేదా బ్రాంచ్.',
  'stuckhelp.bank.letter':
    'కింది లేఖను కూడా మీ బ్యాంక్‌కి పంపండి — ఈమెయిల్‌లో, నెట్ బ్యాంకింగ్‌లో లేదా బ్రాంచ్‌లో. డబ్బు తిరిగి వేయడం, రోజుకు ₹100 ఇవ్వడం బ్యాంక్ బాధ్యతే.',
  'stuckhelp.bank.myupi':
    'యాప్ నుంచి జవాబు లేదా? చెల్లించిన 45 రోజుల్లోపు, 12 అంకెల UPI రెఫరెన్స్‌తో NPCI MyUPI సైట్‌లో (upihelp.npci.org.in) ఫిర్యాదు చేయండి.',
  'stuckhelp.bank.note': 'ఫిర్యాదు నంబర్ వచ్చిందా? “ఫిర్యాదు చేశాను”తో సేవ్ చేయండి. 30 రోజుల్లో పరిష్కారం కాకపోతే, తర్వాత RBI అంబుడ్స్‌మన్.',

  // The money came back late: the compensation claim.
  'stuckhelp.compensation.send': 'కింది లేఖను మీ బ్యాంక్‌కి పంపండి: కస్టమర్ కేర్‌కు ఈమెయిల్‌లో, నెట్ బ్యాంకింగ్ ఫిర్యాదు ఫారంలో, లేదా బ్రాంచ్‌లో.',
  'stuckhelp.compensation.why': 'RBI నియమాల ప్రకారం బ్యాంకులు దీన్ని అడగకుండానే చెల్లించాలి. ఈ లేఖ రోజులు లెక్కించి, రాతపూర్వకంగా అడుగుతుంది.',

  // The RBI Ombudsman ({phone}: 14448).
  'stuckhelp.ombudsman.when':
    'బ్యాంక్‌కి ఫిర్యాదు చేసి 30 రోజులు గడిచాక (బ్యాంక్ జవాబు ఇచ్చి అది మీకు నచ్చకపోతే అంతకంటే ముందే), ఆ తర్వాత 90 రోజుల్లోపు దాఖలు చేయవచ్చు.',
  'stuckhelp.ombudsman.file': 'cms.rbi.org.in లో మీ బ్యాంక్‌పై ఫిర్యాదు దాఖలు చేయండి. ఫారంకి కావాల్సిన వివరాలు కింద ఉన్నాయి.',
  'stuckhelp.ombudsman.paste':
    'ఫిర్యాదులోని వాస్తవాలుగా లేఖను పేస్ట్ చేయండి. బ్యాంక్‌కి మీరు చేసిన ఫిర్యాదు, దాని జవాబు (ఉంటే), డబ్బు కట్ అయినట్టు చూపే స్టేట్‌మెంట్ జత చేయండి.',
  'stuckhelp.ombudsman.call': 'సందేహాలా? {phone} కి కాల్ చేయండి: సోమవారం నుంచి శనివారం, ఉదయం 8 నుంచి రాత్రి 10 వరకు జవాబిస్తారు. వారు దారి చూపిస్తారు, కానీ ఫిర్యాదు తీసుకోలేరు.',
  'stuckhelp.ready.heading': 'ఇవి సిద్ధంగా ఉంచుకోండి',
  'stuckhelp.ready.complaint': 'బ్యాంక్‌కి మీరు చేసిన ఫిర్యాదు, దాని నంబర్',
  'stuckhelp.ready.reply': 'బ్యాంక్ జవాబు, పంపి ఉంటే',
  'stuckhelp.ready.payment': 'చెల్లింపు తేదీ, రెఫరెన్స్',
  'stuckhelp.ready.account': 'మీ ఖాతా లేదా కార్డ్ నంబర్',
  'stuckhelp.ready.relief': 'మీరు ఏం కోరుతున్నారో, లెక్కించిన పరిహారంతో సహా (కింద)',

  // The business ({name}: "Swiggy").
  'stuckhelp.merchant.page': '{name} హెల్ప్ తెరిచి, ఈ ఆర్డర్ వెతికి, అక్కడి నుంచే సపోర్ట్‌ను సంప్రదించండి.',
  'stuckhelp.merchant.app': '{name} యాప్ లేదా వెబ్‌సైట్‌లో ఈ ఆర్డర్ తెరిచి, అక్కడి నుంచే సపోర్ట్‌ను సంప్రదించండి.',
  'stuckhelp.merchant.unknown': 'ఆ సంస్థ సపోర్ట్‌ను సంప్రదించండి — వీలైతే ఆర్డర్ నుంచే.',
  'stuckhelp.merchant.paste': 'కింది మెసేజ్ పేస్ట్ చేసి, టికెట్ నంబర్ అడగండి.',
  'stuckhelp.merchant.nextNch': 'వారంలో పరిష్కారం కాలేదా? తర్వాత జాతీయ వినియోగదారుల హెల్ప్‌లైన్.',
  'stuckhelp.merchant.nextAirsewa': 'వారంలో పరిష్కారం కాలేదా? తర్వాత AirSewa.',
  'stuckhelp.rule.ecommerce':
    'ఆన్‌లైన్ సంస్థలు ఫిర్యాదు అందినట్టు 48 గంటల్లో తెలపాలి, నెల రోజుల్లో పరిష్కరించాలి (Consumer Protection (E-Commerce) Rules, 2020).',
  'stuckhelp.rule.dgca': 'DGCA నియమాలు: కార్డ్ చెల్లింపుకు 7 రోజుల్లో రీఫండ్, ఏజెంట్ లేదా పోర్టల్ ద్వారా బుక్ చేస్తే 14 పని దినాల్లో.',

  // The National Consumer Helpline ({whatsapp}: "+91 88000 01915", {phone}: 1915, {tollFree}: 1800-11-4000).
  'stuckhelp.nch.send': 'కింది మెసేజ్‌ను {whatsapp} కి WhatsApp చేయండి, {phone} లేదా {tollFree} కి కాల్ చేయండి (ఉదయం 8 – రాత్రి 8), లేదా consumerhelpline.gov.in లో నమోదు చేయండి.',
  'stuckhelp.nch.docket': 'హెల్ప్‌లైన్ దీన్ని {name} దగ్గర లేవనెత్తుతుంది. అది ఇచ్చే డాకెట్ నంబర్ రాసుకోండి.',
  'stuckhelp.nch.docketAny': 'హెల్ప్‌లైన్ దీన్ని ఆ సంస్థ దగ్గర లేవనెత్తుతుంది. అది ఇచ్చే డాకెట్ నంబర్ రాసుకోండి.',
  'stuckhelp.nch.next': 'నెలలో పరిష్కారం కాలేదా? తర్వాత వినియోగదారుల కమిషన్.',

  // AirSewa ({name}: "IndiGo").
  'stuckhelp.airsewa.file': 'airsewa.gov.in లో లేదా AirSewa యాప్‌లో నమోదు చేసుకుని, {name} పై ఫిర్యాదు దాఖలు చేయండి.',
  'stuckhelp.airsewa.fileAny': 'airsewa.gov.in లో లేదా AirSewa యాప్‌లో నమోదు చేసుకుని, ఆ ఎయిర్‌లైన్‌పై ఫిర్యాదు దాఖలు చేయండి.',
  'stuckhelp.airsewa.paste': 'కింది మెసేజ్‌ను PNR తో పేస్ట్ చేసి, క్యాన్సలేషన్, రీఫండ్ మెసేజ్‌లను జత చేయండి.',
  'stuckhelp.airsewa.note': 'AirSewa పంపే రెఫరెన్స్ నంబర్ రాసుకోండి.',

  // A consumer commission.
  'stuckhelp.commission.where': 'వినియోగదారుల ఫిర్యాదులు e-Jagriti (e-jagriti.gov.in) లో ఆన్‌లైన్‌లో దాఖలు చేయాలి. ₹50 లక్షల వరకు మొత్తాలకు, మీ జిల్లా కమిషన్.',
  'stuckhelp.commission.attach': 'కింది సారాంశంతో మొదలుపెట్టండి. ఆర్డర్, రీఫండ్ లేదా ఫెయిల్ మెసేజ్, మీ ఫిర్యాదులను వాటి నంబర్లతో జత చేయండి.',
  'stuckhelp.commission.advice': 'Settle న్యాయ సలహా ఇవ్వదు. దాఖలు చేయడంలో సాయం కోసం, కమిషన్‌ను లేదా వినియోగదారుల సంస్థను అడగండి.',

  // Buttons and links that take you there ({phone}: "1915"; {name}: a business).
  'stuckhelp.link.cms': 'cms.rbi.org.in తెరవండి',
  'stuckhelp.link.call': '{phone} కి కాల్ చేయండి',
  'stuckhelp.link.myupi': 'NPCI MyUPI',
  'stuckhelp.link.phonepeGrievance': 'PhonePe ఫిర్యాదుల డెస్క్',
  'stuckhelp.link.merchantHelp': '{name} హెల్ప్ తెరవండి',
  'stuckhelp.link.merchantRefunds': 'రీఫండ్‌లపై {name}',
  'stuckhelp.link.whatsapp': 'WhatsApp లో పంపండి',
  'stuckhelp.link.nchSite': 'consumerhelpline.gov.in',
  'stuckhelp.link.airsewa': 'AirSewa తెరవండి',
  'stuckhelp.link.ejagriti': 'e-Jagriti తెరవండి',
  'stuckhelp.links.aria': 'వారిని సంప్రదించే ఇతర మార్గాలు',
  'stuckhelp.newTab': '{label} (కొత్త ట్యాబ్‌లో తెరుచుకుంటుంది)',

  // The sheet.
  'stuckhelp.eyebrow': '{amount} · {name}',
  'stuckhelp.party.failed': 'ఫెయిల్ అయిన చెల్లింపు',
  'stuckhelp.party.refund': 'రీఫండ్',
  'stuckhelp.how.heading': 'ఎక్కడ, ఎలా',
  'stuckhelp.fields.heading': 'ఫారం కోసం',
  'stuckhelp.fields.hint': 'cms.rbi.org.in లోని ఫిర్యాదు ఫారంలో వీటిని టైప్ చేయండి.',
  'stuckhelp.field.entity': 'బ్యాంక్',
  'stuckhelp.field.category': 'దేని గురించి',
  'stuckhelp.field.date': 'చెల్లింపు తేదీ',
  'stuckhelp.field.amount': 'మొత్తం',
  'stuckhelp.field.reference': 'ట్రాన్సాక్షన్ రెఫరెన్స్',
  'stuckhelp.field.account': 'ఖాతా లేదా కార్డ్',
  'stuckhelp.field.bankComplaint': 'బ్యాంక్‌కి మీ ఫిర్యాదు',
  'stuckhelp.field.relief': 'కోరుతున్న పరిష్కారం',
  'stuckhelp.field.copy': '{field} కాపీ చేయండి',
  'stuckhelp.field.copied': '{field} కాపీ అయింది',
  // The letter's box: {kind} is letter, message or summary.
  'stuckhelp.letter.heading': '{kind, select, message {మెసేజ్} summary {సారాంశం} other {లేఖ}}',
  'stuckhelp.letter.subject': 'విషయం',
  'stuckhelp.letter.fill': 'పంపే ముందు [బ్రాకెట్లలో] ఉన్న భాగాలు నింపండి.',
  'stuckhelp.letter.actions': 'లేఖ పంపండి',
  'stuckhelp.action.email': 'ఈమెయిల్',
  'stuckhelp.copied.status': 'కాపీ అయింది',
  'stuckhelp.copied.toast': 'కాపీ అయింది. మీరు పంపే చోట పేస్ట్ చేయండి.',
  'stuckhelp.copyFailed.toast': 'కాపీ కాలేదు. బదులుగా టెక్స్ట్ ఎంచుకుని కాపీ చేయండి.',

  // "I've raised it": the day and the number they gave you.
  'stuckhelp.raised.cta': 'ఫిర్యాదు చేశాను',
  'stuckhelp.raised.title': 'ఎప్పుడు ఫిర్యాదు చేశారు?',
  'stuckhelp.raised.description': 'తర్వాతి అడుగు కోసం గడువును Settle ఈ రోజు నుంచి లెక్కిస్తుంది.',
  'stuckhelp.raised.date': 'ఫిర్యాదు చేసిన తేదీ',
  'stuckhelp.raised.ref': '{kind, select, merchant {టికెట్ నంబర్} nch {డాకెట్ నంబర్} airsewa {రెఫరెన్స్ నంబర్} commission {కేసు నంబర్} other {ఫిర్యాదు నంబర్}}',
  'stuckhelp.raised.refHint': 'ఐచ్ఛికం, మీకు ఇచ్చి ఉంటే',
  'stuckhelp.raised.save': 'సేవ్ చేయండి',
  // {date}: "2 Nov"; {name}: the business.
  'stuckhelp.raised.toast':
    '{kind, select, bank {నమోదైంది: {date} న మీ బ్యాంక్‌కి ఫిర్యాదు చేశారు} ombudsman {నమోదైంది: {date} న RBI అంబుడ్స్‌మన్‌కి తీసుకెళ్లారు} merchant {నమోదైంది: {date} న {name} కి ఫిర్యాదు చేశారు} nch {నమోదైంది: {date} న జాతీయ వినియోగదారుల హెల్ప్‌లైన్‌కి ఫిర్యాదు చేశారు} airsewa {నమోదైంది: {date} న AirSewa లో ఫిర్యాదు చేశారు} other {నమోదైంది: {date} న వినియోగదారుల కమిషన్‌లో దాఖలు చేశారు}}',
}
