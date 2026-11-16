/** English copy for raising a stuck payment (src/features/stuck/RaiseSheet.tsx): where to complain, the letter, and noting it was sent. */
import type { Messages } from '../types'

export const stuckhelp = {
  // The sheet's title, per rung — the same words as the button that opens it ({amount} is pre-formatted: "₹300"; {name} a business or a wallet: "Swiggy", "Paytm").
  'stuckhelp.title.bank': 'Raise it with your bank',
  'stuckhelp.title.wallet': 'Raise it with {name}',
  'stuckhelp.title.walletAny': 'Raise it with the wallet company',
  'stuckhelp.title.compensation': 'Ask for the {amount} compensation',
  'stuckhelp.title.compensationAny': 'Ask for the compensation',
  'stuckhelp.title.ombudsman': 'Take it to the RBI Ombudsman',
  'stuckhelp.title.merchant': 'Raise it with {name}',
  'stuckhelp.title.merchantAny': 'Raise it with the business',
  'stuckhelp.title.nch': 'Take it to the National Consumer Helpline',
  'stuckhelp.title.airsewa': 'Take it to AirSewa',
  'stuckhelp.title.commission': 'Take it to a consumer commission',

  // One line under the title: what this rung is.
  'stuckhelp.lead.bank': 'The RBI’s rules say your bank must put it back, and pay ₹100 for each day it’s late.',
  'stuckhelp.lead.wallet': 'The RBI’s rules say the wallet company must put it back by the next day, and pay ₹100 for each day it’s late.',
  'stuckhelp.lead.compensation': 'The RBI’s rules say your bank owes ₹100 for each day the money was late. Claim it in writing.',
  'stuckhelp.lead.compensationWallet': 'The RBI’s rules say the wallet company owes ₹100 for each day the money was late. Claim it in writing.',
  'stuckhelp.lead.ombudsman': 'The RBI’s complaint service, for when your bank hasn’t fixed it.',
  'stuckhelp.lead.ombudsmanWallet': 'The RBI’s complaint service, for when the wallet company hasn’t fixed it.',
  'stuckhelp.lead.merchant': 'Start with the business itself, in writing, with the order number.',
  'stuckhelp.lead.airline': 'Start with the airline itself, in writing, with your PNR.',
  'stuckhelp.lead.nch': 'The government’s helpline takes your complaint to the business for you.',
  'stuckhelp.lead.airsewa': 'The Ministry of Civil Aviation’s portal for complaints about airlines.',
  'stuckhelp.lead.commission': 'A consumer commission (the consumer court) decides the case. You file it online.',

  // Your bank or UPI app, for a failed payment. App names and menu labels as each app shows them.
  'stuckhelp.bank.app.gpay':
    'In Google Pay, open this payment from your transaction history, tap Having issues, then Payment issue (or Stuck payment), and create a ticket.',
  'stuckhelp.bank.app.phonepe': 'In PhonePe, open this payment in History and tap Contact PhonePe Support.',
  'stuckhelp.bank.app.paytm':
    'In Paytm, tap your profile, then Help & Support. Pick this payment and the problem that fits (money debited, failed or pending), then raise a ticket.',
  'stuckhelp.bank.app.other': 'In {app}, open this payment in your history and raise a complaint from it. Every UPI app has to let you.',
  'stuckhelp.bank.app.unknown': 'In the UPI app you paid with, open this payment and raise a complaint from it. Every UPI app has to let you.',
  'stuckhelp.bank.card': 'Raise a dispute for this payment in your bank’s app or net banking, or call the number on the back of your card.',
  'stuckhelp.bank.atm': 'Complain to the bank that issued your card, even if the ATM was another bank’s: in its app, to customer care or at a branch.',
  'stuckhelp.bank.wallet': 'In the wallet’s app, open this payment and raise a complaint from its help section.',
  'stuckhelp.bank.direct': 'Complain to your bank: customer care, the grievance form in net banking, or a branch.',
  'stuckhelp.bank.letter':
    'Send your bank the letter below too, by email, in net banking or at a branch. Putting the money back, and the ₹100 a day, are the bank’s to do.',
  'stuckhelp.bank.myupi':
    'No answer from the app? Complain on the UPI help website (upihelp.npci.org.in, run by NPCI, the company behind UPI) within 45 days of the payment. Keep the 12-digit number from your SMS ready.',
  'stuckhelp.bank.myupiPassed': 'The UPI help website only takes complaints within 45 days of the payment, and that time has passed. Send your bank the letter instead.',
  'stuckhelp.bank.note': 'Got a complaint number? Save it with “I’ve raised it”. If it isn’t fixed in 30 days, the RBI Ombudsman is next.',
  // Once it's raised ({date}: "2 Nov"; {ref}: the complaint number, or "none").
  'stuckhelp.bank.raised': 'You raised it on {date}{ref, select, none {} other { (number {ref})}}. If it isn’t fixed within 30 days of that, the RBI Ombudsman is next.',

  // A wallet payment ({name}: "Paytm").
  'stuckhelp.wallet.app': 'In {name}, open this payment and raise a complaint from its help section.',
  'stuckhelp.wallet.letter':
    'No fix in the app? Send the letter below to the wallet company’s grievance officer; the contact is in the app’s help or its grievance policy. Putting the money back, and the ₹100 a day, are the wallet company’s to do.',

  // The money came back late: the compensation claim.
  'stuckhelp.compensation.send': 'Send the letter below to your bank: by email to customer care, in the grievance form in net banking, or at a branch.',
  'stuckhelp.compensation.sendWallet': 'Send the letter below to the wallet company’s grievance officer: by email, or from the help section of its app.',
  'stuckhelp.compensation.why': 'The RBI’s rules say this should be paid without being asked. The letter asks in writing, with the days counted.',

  // The RBI Ombudsman ({phone}: 14448; {issuer}: "Paytm Payments Bank Ltd"; {email}: crpc@rbi.org.in; {address}: the RBI's postal address, in English).
  'stuckhelp.ombudsman.when':
    'You can file once 30 days have passed since your complaint to the bank (sooner if it replied and you’re not satisfied). You then have 90 days from the later of the end of those 30 days and the bank’s last reply.',
  'stuckhelp.ombudsman.whenWallet':
    'You can file once 30 days have passed since your complaint to the wallet company (sooner if it replied and you’re not satisfied). You then have 90 days from the later of the end of those 30 days and its last reply.',
  // This case's last day ({date}: "2 Mar 2027"; {kind}: bank or wallet).
  'stuckhelp.ombudsman.lastDay':
    '{kind, select, wallet {File by {date} at the latest: 90 days from the later of the end of the wallet company’s 30 days and its last reply (RBI Integrated Ombudsman Scheme, 2026).} other {File by {date} at the latest: 90 days from the later of the end of your bank’s 30 days and its last reply (RBI Integrated Ombudsman Scheme, 2026).}}',
  'stuckhelp.ombudsman.post': 'Can’t use the website? Email the complaint to {email}, or post it, signed, with copies of your papers to: {address}.',
  'stuckhelp.ombudsman.file': 'On cms.rbi.org.in, file a complaint against your bank. The details for the form are below.',
  'stuckhelp.ombudsman.fileWallet': 'On cms.rbi.org.in, file a complaint against {issuer}, the company behind the wallet. The details for the form are below.',
  'stuckhelp.ombudsman.fileWalletAny': 'On cms.rbi.org.in, file a complaint against the company behind the wallet. The details for the form are below.',
  'stuckhelp.ombudsman.paste':
    'Paste the letter as the facts of the complaint. Attach your complaint to the bank, its reply if any, and the statement showing the debit.',
  'stuckhelp.ombudsman.pasteWallet':
    'Paste the letter as the facts of the complaint. Attach your complaint to the wallet company, its reply if any, and the wallet statement showing the debit.',
  'stuckhelp.ombudsman.call': 'Questions? Call {phone}: people answer Monday to Saturday, 8 AM to 10 PM. They guide you but can’t take the complaint.',
  'stuckhelp.ready.heading': 'Have these ready',
  'stuckhelp.ready.complaint': 'Your complaint to the bank, and its number',
  'stuckhelp.ready.complaintWallet': 'Your complaint to the wallet company, and its number',
  'stuckhelp.ready.reply': 'The bank’s reply, if it sent one',
  'stuckhelp.ready.replyWallet': 'The wallet company’s reply, if it sent one',
  'stuckhelp.ready.payment': 'The payment’s date and reference',
  'stuckhelp.ready.account': 'Your account or card number',
  'stuckhelp.ready.wallet': 'The mobile number registered with the wallet',
  'stuckhelp.ready.relief': 'What you’re asking for, with the compensation worked out (below)',

  // The business ({name}: "Swiggy").
  'stuckhelp.merchant.page': 'Open {name}’s help, find this order and contact support from it.',
  'stuckhelp.merchant.app': 'In the {name} app or website, open this order and contact support from it.',
  'stuckhelp.merchant.unknown': 'Contact the business’s support, from the order if you can.',
  // An airline: a booking, not an order.
  'stuckhelp.merchant.pageBooking': 'Open {name}’s help, find this booking and contact support from it.',
  'stuckhelp.merchant.appBooking': 'In the {name} app or website, open this booking and contact support from it.',
  'stuckhelp.merchant.nodal': 'No reply in a few days? Write to {name}’s Nodal Officer for complaints (the contact is on its website), with your PNR and ticket number.',
  'stuckhelp.merchant.nodalAny': 'No reply in a few days? Write to the airline’s Nodal Officer for complaints (the contact is on its website), with your PNR and ticket number.',
  'stuckhelp.merchant.paste': 'Paste the message below and ask for a ticket number.',
  // Settle's own advice (a week), not the law's month.
  'stuckhelp.merchant.nextNch': 'Give them a week. Still not sorted? You can go to the National Consumer Helpline; you don’t have to wait the full month.',
  'stuckhelp.merchant.nextAirsewa': 'Give them a week. Still not sorted? You can go to AirSewa.',
  'stuckhelp.rule.ecommerce':
    'Online businesses have to acknowledge a complaint within 48 hours and resolve it within a month (Consumer Protection (E-Commerce) Rules, 2020).',
  'stuckhelp.rule.dgca': 'The DGCA’s rules: a refund within 7 days for a card payment, or within 14 working days if you booked through an agent or portal.',

  // The National Consumer Helpline ({whatsapp}: "+91 88000 01915", {phone}: 1915, {tollFree}: 1800-11-4000).
  'stuckhelp.nch.send': 'Send the message below on WhatsApp to {whatsapp}, call {phone} or {tollFree} (8 AM to 8 PM), or register it on consumerhelpline.gov.in.',
  'stuckhelp.nch.docket': 'The helpline takes it up with {name}. Note the docket number it gives you.',
  'stuckhelp.nch.docketAny': 'The helpline takes it up with the business. Note the docket number it gives you.',
  'stuckhelp.nch.next': 'Not resolved in a month? A consumer commission is next.',

  // AirSewa ({name}: "IndiGo").
  'stuckhelp.airsewa.file': 'Register on airsewa.gov.in or the AirSewa app, and file a grievance against {name}.',
  'stuckhelp.airsewa.fileAny': 'Register on airsewa.gov.in or the AirSewa app, and file a grievance against the airline.',
  'stuckhelp.airsewa.paste': 'Paste the message below with the PNR, and attach the cancellation and the refund message.',
  'stuckhelp.airsewa.note': 'Note the reference number AirSewa sends you.',

  // A consumer commission.
  'stuckhelp.commission.where': 'Consumer complaints are filed online on e-Jagriti (e-jagriti.gov.in). For amounts up to ₹50 lakh, it’s your district commission.',
  'stuckhelp.commission.attach': 'Start from the summary below. Attach the order, the refund or failure message, and your complaints with their numbers.',
  'stuckhelp.commission.advice': 'Settle doesn’t give legal advice. For help with the filing, ask the commission or a consumer organisation.',

  // Buttons and links that take you there ({phone}: "1915"; {name}: a business).
  'stuckhelp.link.cms': 'Open cms.rbi.org.in',
  'stuckhelp.link.call': 'Call {phone}',
  'stuckhelp.link.myupi': 'UPI help website',
  'stuckhelp.link.phonepeGrievance': 'PhonePe’s grievance desk',
  'stuckhelp.link.merchantHelp': 'Open {name} help',
  'stuckhelp.link.merchantRefunds': 'Open {name}’s refund help',
  'stuckhelp.link.whatsapp': 'Send on WhatsApp',
  'stuckhelp.link.nchSite': 'consumerhelpline.gov.in',
  'stuckhelp.link.airsewa': 'Open AirSewa',
  'stuckhelp.link.ejagriti': 'Open e-Jagriti',
  'stuckhelp.links.aria': 'Other ways to reach them',
  'stuckhelp.newTab': '{label} (opens in a new tab)',

  // The sheet. Above the title, what's still owed ({amount}, {rest}, {owed}: "₹49"; {name}: who it was paid to, or the business).
  'stuckhelp.eyebrow': '{amount} · {name}',
  'stuckhelp.eyebrow.part': '{rest} of {amount} · {name}',
  'stuckhelp.eyebrow.owed': '{owed} for the wait · {name}',
  'stuckhelp.party.failed': 'Failed payment',
  'stuckhelp.party.refund': 'Refund',
  'stuckhelp.how.heading': 'Where and how',
  'stuckhelp.fields.heading': 'For the form',
  'stuckhelp.fields.hint': 'Type these into the complaint form on cms.rbi.org.in.',
  'stuckhelp.field.entity': 'Bank',
  'stuckhelp.field.entityWallet': 'Wallet company',
  'stuckhelp.field.category': 'What it’s about',
  'stuckhelp.field.date': 'Date of the payment',
  'stuckhelp.field.amount': 'Amount',
  'stuckhelp.field.reference': 'Transaction reference',
  'stuckhelp.field.account': 'Account or card',
  'stuckhelp.field.mobile': 'Registered mobile',
  'stuckhelp.field.bankComplaint': 'Your complaint to the bank',
  'stuckhelp.field.walletComplaint': 'Your complaint to the wallet company',
  'stuckhelp.field.relief': 'Relief sought',
  'stuckhelp.field.copy': 'Copy {field}',
  'stuckhelp.field.copied': '{field} copied',

  // Your details for letters: asked once, kept on this phone. The name and UPI ID go to your profile.
  'stuckhelp.me.heading': 'Your details',
  'stuckhelp.me.hint': 'Settle puts these in the letter. They’re saved to your account and only go out in a letter you send.',
  'stuckhelp.me.name': 'Your name',
  'stuckhelp.me.mobile': 'Mobile number',
  'stuckhelp.me.upi': 'Your UPI ID (optional)',
  'stuckhelp.me.upiHint': 'It helps the bank find a UPI payment. Settle saves it to your profile.',
  'stuckhelp.me.place': 'City and state',
  // Under the empty field, so it never looks filled in.
  'stuckhelp.me.placeExample': 'For example: Pune, Maharashtra',
  'stuckhelp.me.address': 'Address (optional)',
  'stuckhelp.me.change': 'Change',
  'stuckhelp.me.changeLabel': 'Change your details',

  // A NACH debit: was the mandate cancelled before it?
  'stuckhelp.mandate.heading': 'The mandate',
  'stuckhelp.mandate.question': 'Had you cancelled this mandate with your bank before the debit?',
  'stuckhelp.mandate.no': 'No',
  'stuckhelp.mandate.yes': 'Yes, I’d cancelled it',
  'stuckhelp.mandate.date': 'Cancelled on (optional)',
  'stuckhelp.mandate.hint': 'A debit after you cancel a mandate isn’t a failed payment, so the letter says it was taken after you cancelled.',

  // Who the email goes to ({kind}: bank, wallet or business; {email}: "crpc@rbi.org.in").
  'stuckhelp.email.label': 'Send it to (email)',
  'stuckhelp.email.hint':
    '{kind, select, wallet {The wallet company’s grievance email, from its app’s help.} business {The business’s support email, if it has one.} other {Your bank’s grievance email, from its website or app.}} Settle remembers it on this phone.',
  'stuckhelp.email.crpc': 'Email goes to the RBI’s complaint centre, {email}.',

  // The payment's reference, when it wasn't saved ({kind}: upi, imps, wallet, nach or other).
  'stuckhelp.ref.label':
    '{kind, select, upi {UPI reference (12 digits)} imps {IMPS reference (12 digits)} wallet {Wallet transaction ID} nach {Mandate (UMRN) or debit reference} other {Transaction reference}}',
  'stuckhelp.ref.hint': 'From the bank’s SMS, or the payment in your app. Settle saves it with this payment.',

  // The letter's box: {kind} is letter, message or summary.
  'stuckhelp.letter.heading': '{kind, select, message {The message} summary {The summary} other {The letter}}',
  'stuckhelp.letter.blanks':
    '{count, plural, one {# part in [brackets] is still to fill in. Fill it in before you send it.} other {# parts in [brackets] are still to fill in. Fill them in before you send it.}}',
  'stuckhelp.letter.actions': 'Send the letter',
  // Sending while a [bracket] is still empty: said first ({count}: how many; {action}: copy, share, print, email or send).
  'stuckhelp.blanks.title': '{count, plural, one {# part is still empty} other {# parts are still empty}}',
  'stuckhelp.blanks.description':
    '{count, plural, one {It’s marked in [brackets]. Fill it in first, or send it as it is and fill it in where you paste it.} other {They’re marked in [brackets]. Fill them in first, or send it as it is and fill them in where you paste it.}}',
  'stuckhelp.blanks.list': 'Still empty',
  'stuckhelp.blanks.fill': '{count, plural, one {Fill it in} other {Fill them in}}',
  'stuckhelp.blanks.anyway': '{action, select, copy {Copy it anyway} share {Share it anyway} print {Print it anyway} email {Email it anyway} other {Send it anyway}}',
  // Above the letter, in the app's language: what it asks for ({amount}, {compensation}, {total}: "₹500").
  'stuckhelp.summary.reverse': 'It asks for {amount} back, and ₹100 for each day it’s late.',
  'stuckhelp.summary.reverseOwed': 'It asks for {amount} back, and the {compensation} owed so far for the delay (₹100 a day).',
  'stuckhelp.summary.compensation': 'It asks for the {compensation} owed for the days the money was late (₹100 a day).',
  'stuckhelp.summary.compensationAny': 'It asks for the compensation owed for the days the money was late (₹100 a day).',
  'stuckhelp.summary.ombudsman': 'It tells the RBI Ombudsman what happened and how your complaint went, and asks for the {total} you’re owed so far.',
  'stuckhelp.summary.ombudsmanBoth':
    'It tells the RBI Ombudsman what happened and how your complaint went, and asks for your {amount} back and the {compensation} owed so far for the delay (₹100 a day).',
  'stuckhelp.summary.ombudsmanAny': 'It tells the RBI Ombudsman what happened and how your complaint went, and asks for what you’re owed.',
  'stuckhelp.summary.refund': 'It asks for your {amount} refund, or its reference number if it was already sent, so you can trace it.',
  'stuckhelp.summary.confirm': 'It asks them to confirm in writing whether your {amount} reached them, so you can show your bank.',
  'stuckhelp.summary.nch': 'It asks the helpline to take up your {amount} with the business, and lists what you’ve done so far.',
  'stuckhelp.summary.airsewa': 'It asks AirSewa to have the airline pay your {amount} refund, as the DGCA’s rules say.',
  'stuckhelp.summary.commission': 'It sums up your case for the commission: what happened, when, what you did, and the {amount} you’re asking for.',
  'stuckhelp.summary.english':
    '{kind, select, message {The message is} summary {The summary is} other {The letter is}} in English, the language banks, businesses and regulators work in.',
  'stuckhelp.action.copy': '{kind, select, message {Copy the message} summary {Copy the summary} other {Copy the letter}}',
  'stuckhelp.action.email': 'Email',
  'stuckhelp.action.print': 'Print or save as PDF',
  'stuckhelp.copied.status': 'Copied',
  'stuckhelp.copied.toast': 'Copied. Paste it where you’re sending it.',
  'stuckhelp.copyFailed.toast': 'Couldn’t copy it. Select the text and copy it instead.',

  // "I've raised it": the day and the number they gave you.
  'stuckhelp.raised.cta': 'I’ve raised it',
  'stuckhelp.raised.title': 'When did you raise it?',
  'stuckhelp.raised.description': 'Settle counts the wait for the next step from this day.',
  'stuckhelp.raised.date': 'Raised on',
  'stuckhelp.raised.ref': '{kind, select, merchant {Ticket number} nch {Docket number} airsewa {Reference number} commission {Case number} other {Complaint number}}',
  'stuckhelp.raised.refHint': 'Optional, if you were given one',
  'stuckhelp.raised.save': 'Save',
  // Not "Back": in a money app that reads as money returned ({kind}: letter, message or summary).
  'stuckhelp.raised.back': '{kind, select, message {Back to the message} summary {Back to the summary} other {Back to the letter}}',
  // {date}: "2 Nov"; {name}: the business.
  'stuckhelp.raised.toast':
    '{kind, select, bank {Noted: raised with your bank on {date}} ombudsman {Noted: taken to the RBI Ombudsman on {date}} merchant {Noted: raised with {name} on {date}} nch {Noted: raised with the National Consumer Helpline on {date}} airsewa {Noted: raised on AirSewa on {date}} other {Noted: filed with the consumer commission on {date}}}',
} as const satisfies Messages
