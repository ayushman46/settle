/** Telugu copy for raising a stuck payment (src/features/stuck/RaiseSheet.tsx): where to complain, the letter, and noting it was sent. */
import type { Messages } from '../types'

export const stuckhelp: Messages = {
  // The sheet's title, per rung — the same words as the button that opens it ({amount} is pre-formatted: "₹300"; {name} a business or a wallet: "Swiggy", "Paytm").
  'stuckhelp.title.bank': 'మీ బ్యాంక్ దగ్గర ఫిర్యాదు చేయండి',
  'stuckhelp.title.wallet': '{name} దగ్గర ఫిర్యాదు చేయండి',
  'stuckhelp.title.walletAny': 'వాలెట్ కంపెనీ దగ్గర ఫిర్యాదు చేయండి',
  'stuckhelp.title.compensation': '{amount} పరిహారం అడగండి',
  'stuckhelp.title.compensationAny': 'పరిహారం అడగండి',
  'stuckhelp.title.ombudsman': 'RBI అంబుడ్స్‌మన్ దృష్టికి తీసుకెళ్లండి',
  'stuckhelp.title.merchant': '{name} దగ్గర ఫిర్యాదు చేయండి',
  'stuckhelp.title.merchantAny': 'ఆ సంస్థ దగ్గర ఫిర్యాదు చేయండి',
  'stuckhelp.title.nch': 'జాతీయ వినియోగదారుల హెల్ప్‌లైన్ దృష్టికి తీసుకెళ్లండి',
  'stuckhelp.title.airsewa': 'AirSewa దృష్టికి తీసుకెళ్లండి',
  'stuckhelp.title.commission': 'వినియోగదారుల కమిషన్ దృష్టికి తీసుకెళ్లండి',

  // One line under the title: what this rung is.
  'stuckhelp.lead.bank': 'RBI నియమాల ప్రకారం మీ బ్యాంక్ డబ్బు తిరిగి వేయాలి, ఆలస్యమైన ప్రతి రోజుకు ₹100 చెల్లించాలి.',
  'stuckhelp.lead.wallet': 'RBI నియమాల ప్రకారం వాలెట్ కంపెనీ మరుసటి రోజులోగా డబ్బు తిరిగి వేయాలి, ఆలస్యమైన ప్రతి రోజుకు ₹100 చెల్లించాలి.',
  'stuckhelp.lead.compensation': 'RBI నియమాల ప్రకారం డబ్బు ఆలస్యమైన ప్రతి రోజుకు మీ బ్యాంక్ ₹100 ఇవ్వాలి. రాతపూర్వకంగా క్లెయిమ్ చేయండి.',
  'stuckhelp.lead.compensationWallet': 'RBI నియమాల ప్రకారం డబ్బు ఆలస్యమైన ప్రతి రోజుకు వాలెట్ కంపెనీ ₹100 ఇవ్వాలి. రాతపూర్వకంగా క్లెయిమ్ చేయండి.',
  'stuckhelp.lead.ombudsman': 'మీ బ్యాంక్ పరిష్కరించనప్పుడు ఆశ్రయించాల్సిన RBI ఫిర్యాదు సేవ.',
  'stuckhelp.lead.ombudsmanWallet': 'వాలెట్ కంపెనీ పరిష్కరించనప్పుడు ఆశ్రయించాల్సిన RBI ఫిర్యాదు సేవ.',
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
    'యాప్ నుంచి జవాబు లేదా? చెల్లించిన 45 రోజుల్లోపు UPI హెల్ప్ వెబ్‌సైట్‌లో (upihelp.npci.org.in — UPI ని నడిపే NPCI సంస్థది) ఫిర్యాదు చేయండి. మీ SMS లోని 12 అంకెల నంబర్ సిద్ధంగా ఉంచుకోండి.',
  'stuckhelp.bank.myupiPassed': 'UPI హెల్ప్ వెబ్‌సైట్ చెల్లించిన 45 రోజుల్లోపు ఫిర్యాదులను మాత్రమే తీసుకుంటుంది, ఆ గడువు దాటిపోయింది. బదులుగా మీ బ్యాంక్‌కి లేఖ పంపండి.',
  'stuckhelp.bank.note': 'ఫిర్యాదు నంబర్ వచ్చిందా? “ఫిర్యాదు చేశాను”తో సేవ్ చేయండి. 30 రోజుల్లో పరిష్కారం కాకపోతే, తర్వాత RBI అంబుడ్స్‌మన్.',
  // Once it's raised ({date}: "2 Nov"; {ref}: the complaint number, or "none").
  'stuckhelp.bank.raised': 'మీరు {date} తేదీన ఫిర్యాదు చేశారు{ref, select, none {} other { (నంబర్ {ref})}}. ఆ రోజు నుంచి 30 రోజుల్లో పరిష్కారం కాకపోతే, తర్వాత RBI అంబుడ్స్‌మన్.',

  // A wallet payment ({name}: "Paytm").
  'stuckhelp.wallet.app': '{name} లో ఈ చెల్లింపు తెరిచి, దాని హెల్ప్ విభాగం నుంచి ఫిర్యాదు చేయండి.',
  'stuckhelp.wallet.letter':
    'యాప్‌లో పరిష్కారం కాలేదా? కింది లేఖను వాలెట్ కంపెనీ ఫిర్యాదుల అధికారికి పంపండి; వారి వివరాలు యాప్ హెల్ప్‌లో లేదా కంపెనీ ఫిర్యాదుల పాలసీలో ఉంటాయి. డబ్బు తిరిగి వేయడం, రోజుకు ₹100 ఇవ్వడం వాలెట్ కంపెనీ బాధ్యతే.',

  // The money came back late: the compensation claim.
  'stuckhelp.compensation.send': 'కింది లేఖను మీ బ్యాంక్‌కి పంపండి: కస్టమర్ కేర్‌కు ఈమెయిల్‌లో, నెట్ బ్యాంకింగ్ ఫిర్యాదు ఫారంలో, లేదా బ్రాంచ్‌లో.',
  'stuckhelp.compensation.sendWallet': 'కింది లేఖను వాలెట్ కంపెనీ ఫిర్యాదుల అధికారికి పంపండి: ఈమెయిల్‌లో, లేదా కంపెనీ యాప్‌లోని హెల్ప్ విభాగం నుంచి.',
  'stuckhelp.compensation.why': 'RBI నియమాల ప్రకారం దీన్ని అడగకుండానే చెల్లించాలి. ఈ లేఖ రోజులు లెక్కించి, రాతపూర్వకంగా అడుగుతుంది.',

  // The RBI Ombudsman ({phone}: 14448; {issuer}: "Paytm Payments Bank Ltd").
  'stuckhelp.ombudsman.when':
    'బ్యాంక్‌కి ఫిర్యాదు చేసి 30 రోజులు గడిచాక (బ్యాంక్ జవాబు ఇచ్చి అది మీకు నచ్చకపోతే అంతకంటే ముందే), ఆ తర్వాత 90 రోజుల్లోపు దాఖలు చేయవచ్చు.',
  'stuckhelp.ombudsman.whenWallet':
    'వాలెట్ కంపెనీకి ఫిర్యాదు చేసి 30 రోజులు గడిచాక (కంపెనీ జవాబు ఇచ్చి అది మీకు నచ్చకపోతే అంతకంటే ముందే), ఆ తర్వాత 90 రోజుల్లోపు దాఖలు చేయవచ్చు.',
  'stuckhelp.ombudsman.file': 'cms.rbi.org.in లో మీ బ్యాంక్‌పై ఫిర్యాదు దాఖలు చేయండి. ఫారంకి కావాల్సిన వివరాలు కింద ఉన్నాయి.',
  'stuckhelp.ombudsman.fileWallet': 'cms.rbi.org.in లో, వాలెట్‌ను నడిపే కంపెనీ {issuer} పై ఫిర్యాదు దాఖలు చేయండి. ఫారంకి కావాల్సిన వివరాలు కింద ఉన్నాయి.',
  'stuckhelp.ombudsman.fileWalletAny': 'cms.rbi.org.in లో, వాలెట్‌ను నడిపే కంపెనీపై ఫిర్యాదు దాఖలు చేయండి. ఫారంకి కావాల్సిన వివరాలు కింద ఉన్నాయి.',
  'stuckhelp.ombudsman.paste':
    'ఫిర్యాదులోని వాస్తవాలుగా లేఖను పేస్ట్ చేయండి. బ్యాంక్‌కి మీరు చేసిన ఫిర్యాదు, దాని జవాబు (ఉంటే), డబ్బు కట్ అయినట్టు చూపే స్టేట్‌మెంట్ జత చేయండి.',
  'stuckhelp.ombudsman.pasteWallet':
    'ఫిర్యాదులోని వాస్తవాలుగా లేఖను పేస్ట్ చేయండి. వాలెట్ కంపెనీకి మీరు చేసిన ఫిర్యాదు, దాని జవాబు (ఉంటే), డబ్బు కట్ అయినట్టు చూపే వాలెట్ స్టేట్‌మెంట్ జత చేయండి.',
  'stuckhelp.ombudsman.call': 'సందేహాలా? {phone} కి కాల్ చేయండి: సోమవారం నుంచి శనివారం, ఉదయం 8 నుంచి రాత్రి 10 వరకు జవాబిస్తారు. వారు దారి చూపిస్తారు, కానీ ఫిర్యాదు తీసుకోలేరు.',
  'stuckhelp.ready.heading': 'ఇవి సిద్ధంగా ఉంచుకోండి',
  'stuckhelp.ready.complaint': 'బ్యాంక్‌కి మీరు చేసిన ఫిర్యాదు, దాని నంబర్',
  'stuckhelp.ready.complaintWallet': 'వాలెట్ కంపెనీకి మీరు చేసిన ఫిర్యాదు, దాని నంబర్',
  'stuckhelp.ready.reply': 'బ్యాంక్ జవాబు, పంపి ఉంటే',
  'stuckhelp.ready.replyWallet': 'వాలెట్ కంపెనీ జవాబు, పంపి ఉంటే',
  'stuckhelp.ready.payment': 'చెల్లింపు తేదీ, రెఫరెన్స్',
  'stuckhelp.ready.account': 'మీ ఖాతా లేదా కార్డ్ నంబర్',
  'stuckhelp.ready.wallet': 'వాలెట్‌తో నమోదైన మొబైల్ నంబర్',
  'stuckhelp.ready.relief': 'మీరు ఏం కోరుతున్నారో, లెక్కించిన పరిహారంతో సహా (కింద)',

  // The business ({name}: "Swiggy").
  'stuckhelp.merchant.page': '{name} హెల్ప్ తెరిచి, ఈ ఆర్డర్ వెతికి, అక్కడి నుంచే సపోర్ట్‌ను సంప్రదించండి.',
  'stuckhelp.merchant.app': '{name} యాప్ లేదా వెబ్‌సైట్‌లో ఈ ఆర్డర్ తెరిచి, అక్కడి నుంచే సపోర్ట్‌ను సంప్రదించండి.',
  'stuckhelp.merchant.unknown': 'ఆ సంస్థ సపోర్ట్‌ను సంప్రదించండి — వీలైతే ఆర్డర్ నుంచే.',
  'stuckhelp.merchant.paste': 'కింది మెసేజ్ పేస్ట్ చేసి, టికెట్ నంబర్ అడగండి.',
  // Settle's own advice (a week), not the law's month.
  'stuckhelp.merchant.nextNch': 'వారికి ఒక వారం సమయం ఇవ్వండి. అప్పటికీ పరిష్కారం కాలేదా? జాతీయ వినియోగదారుల హెల్ప్‌లైన్‌ను ఆశ్రయించవచ్చు; నెల మొత్తం ఆగాల్సిన అవసరం లేదు.',
  'stuckhelp.merchant.nextAirsewa': 'వారికి ఒక వారం సమయం ఇవ్వండి. అప్పటికీ పరిష్కారం కాలేదా? AirSewa ను ఆశ్రయించవచ్చు.',
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
  'stuckhelp.link.myupi': 'UPI హెల్ప్ వెబ్‌సైట్',
  'stuckhelp.link.phonepeGrievance': 'PhonePe ఫిర్యాదుల డెస్క్',
  'stuckhelp.link.merchantHelp': '{name} హెల్ప్ తెరవండి',
  'stuckhelp.link.merchantRefunds': '{name} రీఫండ్ హెల్ప్ తెరవండి',
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
  'stuckhelp.field.entityWallet': 'వాలెట్ కంపెనీ',
  'stuckhelp.field.category': 'దేని గురించి',
  'stuckhelp.field.date': 'చెల్లింపు తేదీ',
  'stuckhelp.field.amount': 'మొత్తం',
  'stuckhelp.field.reference': 'ట్రాన్సాక్షన్ రెఫరెన్స్',
  'stuckhelp.field.account': 'ఖాతా లేదా కార్డ్',
  'stuckhelp.field.mobile': 'నమోదైన మొబైల్',
  'stuckhelp.field.bankComplaint': 'బ్యాంక్‌కి మీ ఫిర్యాదు',
  'stuckhelp.field.walletComplaint': 'వాలెట్ కంపెనీకి మీ ఫిర్యాదు',
  'stuckhelp.field.relief': 'కోరుతున్న పరిష్కారం',
  'stuckhelp.field.copy': '{field} కాపీ చేయండి',
  'stuckhelp.field.copied': '{field} కాపీ అయింది',

  // Your details for letters: asked once, kept on this phone.
  'stuckhelp.me.heading': 'మీ వివరాలు',
  'stuckhelp.me.hint': 'Settle వీటిని లేఖలో పెడుతుంది. ఇవి ఈ ఫోన్‌లోనే ఉంటాయి, ఎక్కడికీ పంపబడవు.',
  'stuckhelp.me.mobile': 'మొబైల్ నంబర్',
  'stuckhelp.me.place': 'నగరం, రాష్ట్రం',
  'stuckhelp.me.placeExample': 'Hyderabad, Telangana',
  'stuckhelp.me.address': 'చిరునామా (ఐచ్ఛికం)',
  'stuckhelp.me.change': 'మార్చండి',
  'stuckhelp.me.changeLabel': 'మీ వివరాలు మార్చండి',

  // A NACH debit: was the mandate cancelled before it?
  'stuckhelp.mandate.heading': 'మ్యాండేట్',
  'stuckhelp.mandate.question': 'డబ్బు కట్ అవ్వక ముందే ఈ మ్యాండేట్‌ను మీ బ్యాంక్‌లో రద్దు చేశారా?',
  'stuckhelp.mandate.no': 'లేదు',
  'stuckhelp.mandate.yes': 'అవును, రద్దు చేశాను',
  'stuckhelp.mandate.date': 'రద్దు చేసిన తేదీ (ఐచ్ఛికం)',
  'stuckhelp.mandate.hint': 'మ్యాండేట్ రద్దు చేశాక డబ్బు కట్ అయితే అది ఫెయిల్ అయిన చెల్లింపు కాదు, కాబట్టి మీరు రద్దు చేశాక తీసుకున్నారని లేఖ చెబుతుంది.',

  // Who the email goes to ({kind}: bank, wallet or business; {email}: "crpc@rbi.org.in").
  'stuckhelp.email.label': 'ఎవరికి పంపాలి (ఈమెయిల్)',
  'stuckhelp.email.hint':
    '{kind, select, wallet {వాలెట్ కంపెనీ ఫిర్యాదుల ఈమెయిల్, దాని యాప్ హెల్ప్‌లో ఉంటుంది.} business {ఆ సంస్థ సపోర్ట్ ఈమెయిల్, ఉంటే.} other {మీ బ్యాంక్ ఫిర్యాదుల ఈమెయిల్, దాని వెబ్‌సైట్ లేదా యాప్‌లో ఉంటుంది.}} Settle దీన్ని ఈ ఫోన్‌లో గుర్తుంచుకుంటుంది.',
  'stuckhelp.email.crpc': 'ఈమెయిల్ RBI ఫిర్యాదుల కేంద్రానికి ({email}) వెళ్తుంది.',

  // The letter's box: {kind} is letter, message or summary.
  'stuckhelp.letter.heading': '{kind, select, message {మెసేజ్} summary {సారాంశం} other {లేఖ}}',
  'stuckhelp.letter.blanks':
    '{count, plural, one {[బ్రాకెట్లలో] ఉన్న # భాగం ఇంకా నింపాలి. పంపే ముందు దాన్ని నింపండి.} other {[బ్రాకెట్లలో] ఉన్న # భాగాలు ఇంకా నింపాలి. పంపే ముందు వాటిని నింపండి.}}',
  'stuckhelp.letter.actions': 'లేఖ పంపండి',
  // Above the letter, in the app's language: what it asks for ({amount}, {compensation}, {total}: "₹500").
  'stuckhelp.summary.reverse': 'ఇది {amount} తిరిగి ఇవ్వాలని, ఆలస్యమైన ప్రతి రోజుకు ₹100 ఇవ్వాలని అడుగుతుంది.',
  'stuckhelp.summary.reverseOwed': 'ఇది {amount} తిరిగి ఇవ్వాలని, ఆలస్యానికి ఇప్పటివరకు రావాల్సిన {compensation} (రోజుకు ₹100) ఇవ్వాలని అడుగుతుంది.',
  'stuckhelp.summary.compensation': 'డబ్బు ఆలస్యమైన రోజులకు రావాల్సిన {compensation} (రోజుకు ₹100) ఇవ్వాలని ఇది అడుగుతుంది.',
  'stuckhelp.summary.compensationAny': 'డబ్బు ఆలస్యమైన రోజులకు రావాల్సిన పరిహారం (రోజుకు ₹100) ఇవ్వాలని ఇది అడుగుతుంది.',
  'stuckhelp.summary.ombudsman': 'ఏం జరిగిందో, మీ ఫిర్యాదు ఏమైందో ఇది RBI అంబుడ్స్‌మన్‌కు చెబుతుంది, ఇప్పటివరకు మీకు రావాల్సిన {total} అడుగుతుంది.',
  'stuckhelp.summary.ombudsmanAny': 'ఏం జరిగిందో, మీ ఫిర్యాదు ఏమైందో ఇది RBI అంబుడ్స్‌మన్‌కు చెబుతుంది, మీకు రావాల్సినది అడుగుతుంది.',
  'stuckhelp.summary.refund': 'ఇది మీ {amount} రీఫండ్ అడుగుతుంది — ఇప్పటికే పంపి ఉంటే, దాన్ని వెతకడానికి దాని రెఫరెన్స్ నంబర్ అడుగుతుంది.',
  'stuckhelp.summary.confirm': 'మీ {amount} వారికి చేరిందో లేదో రాతపూర్వకంగా ధృవీకరించమని ఇది అడుగుతుంది — మీ బ్యాంక్‌కు చూపించడానికి.',
  'stuckhelp.summary.nch': 'మీ {amount} విషయాన్ని ఆ సంస్థ దగ్గర లేవనెత్తమని ఇది హెల్ప్‌లైన్‌ను అడుగుతుంది, ఇప్పటివరకు మీరు ఏం చేశారో వివరిస్తుంది.',
  'stuckhelp.summary.airsewa': 'DGCA నియమాల ప్రకారం మీ {amount} రీఫండ్‌ను ఎయిర్‌లైన్ చెల్లించేలా చూడమని ఇది AirSewa ను అడుగుతుంది.',
  'stuckhelp.summary.commission': 'ఇది కమిషన్ కోసం మీ కేసును క్లుప్తంగా చెబుతుంది: ఏం జరిగింది, ఎప్పుడు, మీరు ఏం చేశారు, మీరు అడుగుతున్న {amount}.',
  'stuckhelp.summary.english':
    '{kind, select, message {మెసేజ్} summary {సారాంశం} other {లేఖ}} ఇంగ్లీష్‌లో ఉంది — బ్యాంకులు, సంస్థలు, నియంత్రణ సంస్థలు పనిచేసే భాష అదే.',
  'stuckhelp.action.copy': '{kind, select, message {మెసేజ్ కాపీ చేయండి} summary {సారాంశం కాపీ చేయండి} other {లేఖ కాపీ చేయండి}}',
  'stuckhelp.action.email': 'ఈమెయిల్',
  'stuckhelp.action.print': 'ప్రింట్ చేయండి లేదా PDF గా సేవ్ చేయండి',
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
    '{kind, select, bank {నమోదైంది: {date} తేదీన మీ బ్యాంక్‌కి ఫిర్యాదు చేశారు} ombudsman {నమోదైంది: {date} తేదీన RBI అంబుడ్స్‌మన్‌కి తీసుకెళ్లారు} merchant {నమోదైంది: {date} తేదీన {name} దగ్గర ఫిర్యాదు చేశారు} nch {నమోదైంది: {date} తేదీన జాతీయ వినియోగదారుల హెల్ప్‌లైన్‌కి ఫిర్యాదు చేశారు} airsewa {నమోదైంది: {date} తేదీన AirSewa లో ఫిర్యాదు చేశారు} other {నమోదైంది: {date} తేదీన వినియోగదారుల కమిషన్‌లో దాఖలు చేశారు}}',
}
