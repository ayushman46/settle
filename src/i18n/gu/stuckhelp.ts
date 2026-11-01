/** Gujarati copy for raising a stuck payment (src/features/stuck/RaiseSheet.tsx): where to complain, the letter, and noting it was sent. */
import type { Messages } from '../types'

export const stuckhelp: Messages = {
  // The sheet's title, per rung ({amount} is pre-formatted: "₹300"; {name} a business: "Swiggy").
  'stuckhelp.title.bank': 'તમારી બૅન્કને ફરિયાદ કરો',
  'stuckhelp.title.compensation': '{amount}નું વળતર માગો',
  'stuckhelp.title.compensationAny': 'વળતર માગો',
  'stuckhelp.title.ombudsman': 'RBI લોકપાલ પાસે જાઓ',
  'stuckhelp.title.merchant': '{name} પાસે રિફંડ માગો',
  'stuckhelp.title.merchantAny': 'રિફંડ માગો',
  'stuckhelp.title.nch': 'રાષ્ટ્રીય ગ્રાહક હેલ્પલાઇન',
  'stuckhelp.title.airsewa': 'AirSewa પર ફરિયાદ કરો',
  'stuckhelp.title.commission': 'ગ્રાહક આયોગ પાસે જાઓ',

  // One line under the title: what this rung is.
  'stuckhelp.lead.bank': 'RBIના નિયમો મુજબ તમારી બૅન્કે પૈસા પાછા મૂકવા પડે, અને મોડું થાય તે દરેક દિવસના ₹100 આપવા પડે.',
  'stuckhelp.lead.compensation': 'RBIના નિયમો મુજબ પૈસા જેટલા દિવસ મોડા આવ્યા, તે દરેક દિવસના ₹100 તમારી બૅન્કે આપવાના છે. લેખિતમાં માગો.',
  'stuckhelp.lead.ombudsman': 'RBIની ફરિયાદ સેવા, જ્યારે તમારી બૅન્કે ઉકેલ ન આપ્યો હોય.',
  'stuckhelp.lead.merchant': 'શરૂઆત કંપનીથી જ કરો — લેખિતમાં, ઓર્ડર નંબર સાથે.',
  'stuckhelp.lead.nch': 'સરકારની આ હેલ્પલાઇન (National Consumer Helpline) તમારા વતી તમારી ફરિયાદ કંપની સુધી પહોંચાડે છે.',
  'stuckhelp.lead.airsewa': 'એરલાઇન વિશેની ફરિયાદો માટે નાગરિક ઉડ્ડયન મંત્રાલયનું પોર્ટલ.',
  'stuckhelp.lead.commission': 'ગ્રાહક આયોગ (ગ્રાહક અદાલત) કેસનો નિર્ણય કરે છે. ફરિયાદ ઑનલાઇન નોંધાવાય છે.',

  // Your bank or UPI app, for a failed payment. App names and menu labels as each app shows them.
  'stuckhelp.bank.app.gpay':
    'Google Payમાં, ટ્રાન્ઝૅક્શન હિસ્ટરીમાંથી આ પેમેન્ટ ખોલો, “Having issues” દબાવો, પછી “Payment issue” (કે “Stuck payment”), અને ટિકિટ બનાવો.',
  'stuckhelp.bank.app.phonepe': 'PhonePeમાં, “History”માં આ પેમેન્ટ ખોલો અને “Contact PhonePe Support” દબાવો.',
  'stuckhelp.bank.app.paytm':
    'Paytmમાં, તમારી પ્રોફાઇલ દબાવો, પછી “Help & Support”. આ પેમેન્ટ અને તેને લાગુ પડતી સમસ્યા (પૈસા કપાયા, ફેલ કે પેન્ડિંગ) પસંદ કરો, પછી ટિકિટ બનાવો.',
  'stuckhelp.bank.app.other': '{app}માં, હિસ્ટરીમાં આ પેમેન્ટ ખોલો અને ત્યાંથી ફરિયાદ કરો. દરેક UPI એપે આ સગવડ આપવી જ પડે.',
  'stuckhelp.bank.app.unknown': 'જે UPI એપથી ચૂકવ્યું હતું, તેમાં આ પેમેન્ટ ખોલો અને ત્યાંથી ફરિયાદ કરો. દરેક UPI એપે આ સગવડ આપવી જ પડે.',
  'stuckhelp.bank.card': 'તમારી બૅન્કની એપ કે નેટ બૅન્કિંગમાં આ પેમેન્ટ માટે ડિસ્પ્યુટ નોંધાવો, કે તમારા કાર્ડની પાછળ લખેલા નંબર પર ફોન કરો.',
  'stuckhelp.bank.atm': 'ATM બીજી બૅન્કનું હોય તોપણ, તમારું કાર્ડ આપનાર બૅન્કને ફરિયાદ કરો: તેની એપમાં, કસ્ટમર કેરમાં કે શાખામાં.',
  'stuckhelp.bank.wallet': 'વૉલેટની એપમાં આ પેમેન્ટ ખોલો અને તેના હેલ્પ વિભાગમાંથી ફરિયાદ કરો.',
  'stuckhelp.bank.direct': 'તમારી બૅન્કને ફરિયાદ કરો: કસ્ટમર કેર, નેટ બૅન્કિંગમાં ફરિયાદ ફોર્મ, કે શાખા.',
  'stuckhelp.bank.letter':
    'નીચેનો પત્ર પણ તમારી બૅન્કને મોકલો — ઇમેઇલથી, નેટ બૅન્કિંગમાં કે શાખામાં. પૈસા પાછા મૂકવા અને રોજના ₹100 આપવા, એ બૅન્કની જવાબદારી છે.',
  'stuckhelp.bank.myupi':
    'એપમાંથી જવાબ નથી આવ્યો? NPCIની MyUPI સાઇટ (upihelp.npci.org.in) પર 12 અંકના UPI રેફરન્સ સાથે, પેમેન્ટના 45 દિવસમાં ફરિયાદ કરો.',
  'stuckhelp.bank.note': 'ફરિયાદ નંબર મળ્યો? “મેં ફરિયાદ કરી” દબાવીને સેવ કરો. 30 દિવસમાં ઉકેલ ન આવે, તો પછી RBI લોકપાલ.',

  // The money came back late: the compensation claim.
  'stuckhelp.compensation.send': 'નીચેનો પત્ર તમારી બૅન્કને મોકલો: કસ્ટમર કેરને ઇમેઇલથી, નેટ બૅન્કિંગના ફરિયાદ ફોર્મમાં, કે શાખામાં.',
  'stuckhelp.compensation.why': 'RBIના નિયમો મુજબ બૅન્કોએ આ માગ્યા વગર આપવું જોઈએ. આ પત્ર દિવસો ગણીને લેખિતમાં માગણી કરે છે.',

  // The RBI Ombudsman ({phone}: 14448).
  'stuckhelp.ombudsman.when':
    'બૅન્કને ફરિયાદ કર્યાના 30 દિવસ પછી અહીં ફરિયાદ કરી શકો (બૅન્કે જવાબ આપ્યો હોય અને તમને સંતોષ ન હોય તો વહેલી), અને તે પછીના 90 દિવસની અંદર.',
  'stuckhelp.ombudsman.file': 'cms.rbi.org.in પર તમારી બૅન્ક સામે ફરિયાદ નોંધાવો. ફોર્મ માટેની વિગતો નીચે છે.',
  'stuckhelp.ombudsman.paste':
    'ફરિયાદની હકીકતોમાં આ પત્ર પેસ્ટ કરો. બૅન્કને કરેલી ફરિયાદ, તેનો જવાબ (હોય તો), અને પૈસા કપાયા તે બતાવતું સ્ટેટમેન્ટ જોડો.',
  'stuckhelp.ombudsman.call': 'કંઈ પૂછવું છે? {phone} પર ફોન કરો: સોમથી શનિ, સવારે 8 થી રાત્રે 10 સુધી લોકો જવાબ આપે છે. તેઓ માર્ગદર્શન આપે છે, પણ ફરિયાદ લઈ શકતા નથી.',
  'stuckhelp.ready.heading': 'આ તૈયાર રાખો',
  'stuckhelp.ready.complaint': 'બૅન્કને કરેલી ફરિયાદ, અને તેનો નંબર',
  'stuckhelp.ready.reply': 'બૅન્કનો જવાબ, જો આવ્યો હોય',
  'stuckhelp.ready.payment': 'પેમેન્ટની તારીખ અને રેફરન્સ',
  'stuckhelp.ready.account': 'તમારો ખાતા કે કાર્ડ નંબર',
  'stuckhelp.ready.relief': 'તમે શું માગો છો, ગણેલા વળતર સાથે (નીચે)',

  // The business ({name}: "Swiggy").
  'stuckhelp.merchant.page': '{name}નું હેલ્પ ખોલો, આ ઓર્ડર શોધો અને ત્યાંથી સપોર્ટનો સંપર્ક કરો.',
  'stuckhelp.merchant.app': '{name}ની એપ કે વેબસાઇટમાં આ ઓર્ડર ખોલો અને ત્યાંથી સપોર્ટનો સંપર્ક કરો.',
  'stuckhelp.merchant.unknown': 'કંપનીના સપોર્ટનો સંપર્ક કરો, બને તો ઓર્ડરમાંથી જ.',
  'stuckhelp.merchant.paste': 'નીચેનો મેસેજ પેસ્ટ કરો અને ટિકિટ નંબર માગો.',
  'stuckhelp.merchant.nextNch': 'અઠવાડિયામાં ઉકેલ ન આવ્યો? પછી રાષ્ટ્રીય ગ્રાહક હેલ્પલાઇન.',
  'stuckhelp.merchant.nextAirsewa': 'અઠવાડિયામાં ઉકેલ ન આવ્યો? પછી AirSewa.',
  'stuckhelp.rule.ecommerce':
    'ઑનલાઇન કંપનીઓએ 48 કલાકમાં ફરિયાદ સ્વીકારવી પડે અને એક મહિનામાં ઉકેલવી પડે (ગ્રાહક સુરક્ષા (ઈ-કૉમર્સ) નિયમો, 2020).',
  'stuckhelp.rule.dgca': 'DGCAના નિયમો: કાર્ડથી ચૂકવ્યું હોય તો 7 દિવસમાં રિફંડ, કે એજન્ટ કે પોર્ટલથી બુક કર્યું હોય તો 14 કામકાજના દિવસમાં.',

  // The National Consumer Helpline ({whatsapp}: "+91 88000 01915", {phone}: 1915, {tollFree}: 1800-11-4000).
  'stuckhelp.nch.send': 'નીચેનો મેસેજ WhatsAppથી {whatsapp} પર મોકલો, {phone} કે {tollFree} પર ફોન કરો (સવારે 8 થી રાત્રે 8), કે consumerhelpline.gov.in પર નોંધાવો.',
  'stuckhelp.nch.docket': 'હેલ્પલાઇન આ મામલો {name} સામે ઉઠાવે છે. તે આપે તે ડૉકેટ નંબર નોંધી લો.',
  'stuckhelp.nch.docketAny': 'હેલ્પલાઇન આ મામલો કંપની સામે ઉઠાવે છે. તે આપે તે ડૉકેટ નંબર નોંધી લો.',
  'stuckhelp.nch.next': 'મહિનામાં ઉકેલ ન આવ્યો? પછી ગ્રાહક આયોગ.',

  // AirSewa ({name}: "IndiGo").
  'stuckhelp.airsewa.file': 'airsewa.gov.in કે AirSewa એપ પર રજિસ્ટર કરો, અને {name} સામે ફરિયાદ નોંધાવો.',
  'stuckhelp.airsewa.fileAny': 'airsewa.gov.in કે AirSewa એપ પર રજિસ્ટર કરો, અને એરલાઇન સામે ફરિયાદ નોંધાવો.',
  'stuckhelp.airsewa.paste': 'નીચેનો મેસેજ PNR સાથે પેસ્ટ કરો, અને કૅન્સલેશન તથા રિફંડનો મેસેજ જોડો.',
  'stuckhelp.airsewa.note': 'AirSewa મોકલે તે રેફરન્સ નંબર નોંધી લો.',

  // A consumer commission.
  'stuckhelp.commission.where': 'ગ્રાહક ફરિયાદો e-Jagriti (e-jagriti.gov.in) પર ઑનલાઇન નોંધાય છે. ₹50 લાખ સુધીની રકમ માટે, તમારું જિલ્લા ગ્રાહક આયોગ.',
  'stuckhelp.commission.attach': 'નીચેના સારાંશથી શરૂ કરો. ઓર્ડર, રિફંડ કે ફેલ થયાનો મેસેજ, અને નંબર સાથે તમારી ફરિયાદો જોડો.',
  'stuckhelp.commission.advice': 'Settle કાનૂની સલાહ આપતું નથી. ફરિયાદ નોંધાવવામાં મદદ માટે આયોગને કે કોઈ ગ્રાહક સંસ્થાને પૂછો.',

  // Buttons and links that take you there ({phone}: "1915"; {name}: a business).
  'stuckhelp.link.cms': 'cms.rbi.org.in ખોલો',
  'stuckhelp.link.call': '{phone} પર ફોન કરો',
  'stuckhelp.link.myupi': 'NPCIનું MyUPI',
  'stuckhelp.link.phonepeGrievance': 'PhonePeનો ફરિયાદ વિભાગ',
  'stuckhelp.link.merchantHelp': '{name}નું હેલ્પ ખોલો',
  'stuckhelp.link.merchantRefunds': 'રિફંડ વિશે {name}',
  'stuckhelp.link.whatsapp': 'WhatsApp પર મોકલો',
  'stuckhelp.link.nchSite': 'consumerhelpline.gov.in',
  'stuckhelp.link.airsewa': 'AirSewa ખોલો',
  'stuckhelp.link.ejagriti': 'e-Jagriti ખોલો',
  'stuckhelp.links.aria': 'તેમનો સંપર્ક કરવાની બીજી રીતો',
  'stuckhelp.newTab': '{label} (નવા ટૅબમાં ખૂલશે)',

  // The sheet.
  'stuckhelp.eyebrow': '{amount} · {name}',
  'stuckhelp.party.failed': 'ફેલ પેમેન્ટ',
  'stuckhelp.party.refund': 'રિફંડ',
  'stuckhelp.how.heading': 'ક્યાં અને કેવી રીતે',
  'stuckhelp.fields.heading': 'ફોર્મ માટે',
  'stuckhelp.fields.hint': 'cms.rbi.org.in પરના ફરિયાદ ફોર્મમાં આ ભરો.',
  'stuckhelp.field.entity': 'બૅન્ક',
  'stuckhelp.field.category': 'શેના વિશે',
  'stuckhelp.field.date': 'પેમેન્ટની તારીખ',
  'stuckhelp.field.amount': 'રકમ',
  'stuckhelp.field.reference': 'ટ્રાન્ઝૅક્શન રેફરન્સ',
  'stuckhelp.field.account': 'ખાતું કે કાર્ડ',
  'stuckhelp.field.bankComplaint': 'બૅન્કને કરેલી ફરિયાદ',
  'stuckhelp.field.relief': 'માગેલી રાહત',
  'stuckhelp.field.copy': '{field} કૉપી કરો',
  'stuckhelp.field.copied': '{field} કૉપી થયું',
  // The letter's box: {kind} is letter, message or summary.
  'stuckhelp.letter.heading': '{kind, select, message {મેસેજ} summary {સારાંશ} other {પત્ર}}',
  'stuckhelp.letter.subject': 'વિષય',
  'stuckhelp.letter.fill': 'મોકલતાં પહેલાં [કૌંસ]માંના ભાગ ભરો.',
  'stuckhelp.letter.actions': 'પત્ર મોકલો',
  'stuckhelp.action.email': 'ઇમેઇલ',
  'stuckhelp.copied.status': 'કૉપી થયું',
  'stuckhelp.copied.toast': 'કૉપી થયું. જ્યાં મોકલવું હોય ત્યાં પેસ્ટ કરો.',
  'stuckhelp.copyFailed.toast': 'કૉપી ન થયું. લખાણ પસંદ કરીને કૉપી કરો.',

  // "I've raised it": the day and the number they gave you.
  'stuckhelp.raised.cta': 'મેં ફરિયાદ કરી',
  'stuckhelp.raised.title': 'તમે ક્યારે ફરિયાદ કરી?',
  'stuckhelp.raised.description': 'આગળના પગલા માટેની રાહ Settle આ દિવસથી ગણે છે.',
  'stuckhelp.raised.date': 'ફરિયાદની તારીખ',
  'stuckhelp.raised.ref': '{kind, select, merchant {ટિકિટ નંબર} nch {ડૉકેટ નંબર} airsewa {રેફરન્સ નંબર} commission {કેસ નંબર} other {ફરિયાદ નંબર}}',
  'stuckhelp.raised.refHint': 'વૈકલ્પિક, જો મળ્યો હોય તો',
  'stuckhelp.raised.save': 'સેવ કરો',
  // {date}: "2 Nov"; {name}: the business.
  'stuckhelp.raised.toast':
    '{kind, select, bank {નોંધ્યું: {date} ના રોજ તમારી બૅન્કને ફરિયાદ કરી} ombudsman {નોંધ્યું: {date} ના રોજ RBI લોકપાલ પાસે લઈ ગયા} merchant {નોંધ્યું: {date} ના રોજ {name}ને ફરિયાદ કરી} nch {નોંધ્યું: {date} ના રોજ રાષ્ટ્રીય ગ્રાહક હેલ્પલાઇનને ફરિયાદ કરી} airsewa {નોંધ્યું: {date} ના રોજ AirSewa પર ફરિયાદ કરી} other {નોંધ્યું: {date} ના રોજ ગ્રાહક આયોગમાં ફરિયાદ નોંધાવી}}',
}
