/** English copy for raising a stuck payment (src/features/stuck/RaiseSheet.tsx): where to complain, the letter, and noting it was sent. */
import type { Messages } from '../types'

export const stuckhelp = {
  // The sheet's title, per rung ({amount} is pre-formatted: "₹300"; {name} a business: "Swiggy").
  'stuckhelp.title.bank': 'Raise it with your bank',
  'stuckhelp.title.compensation': 'Ask for the {amount} compensation',
  'stuckhelp.title.compensationAny': 'Ask for the compensation',
  'stuckhelp.title.ombudsman': 'Take it to the RBI Ombudsman',
  'stuckhelp.title.merchant': 'Ask {name} for the refund',
  'stuckhelp.title.merchantAny': 'Ask for the refund',
  'stuckhelp.title.nch': 'National Consumer Helpline',
  'stuckhelp.title.airsewa': 'Complain on AirSewa',
  'stuckhelp.title.commission': 'Take it to a consumer commission',

  // One line under the title: what this rung is.
  'stuckhelp.lead.bank': 'The RBI’s rules say your bank must put it back, and pay ₹100 for each day it’s late.',
  'stuckhelp.lead.compensation': 'The RBI’s rules say your bank owes ₹100 for each day the money was late. Claim it in writing.',
  'stuckhelp.lead.ombudsman': 'The RBI’s complaint service, for when your bank hasn’t fixed it.',
  'stuckhelp.lead.merchant': 'Start with the business itself, in writing, with the order number.',
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
    'No answer from the app? Raise it on NPCI’s MyUPI site (upihelp.npci.org.in) with the 12-digit UPI reference, within 45 days of the payment.',
  'stuckhelp.bank.note': 'Got a complaint number? Save it with “I’ve raised it”. If it isn’t fixed in 30 days, the RBI Ombudsman is next.',

  // The money came back late: the compensation claim.
  'stuckhelp.compensation.send': 'Send the letter below to your bank: by email to customer care, in the grievance form in net banking, or at a branch.',
  'stuckhelp.compensation.why': 'The RBI’s rules say banks should pay this without being asked. The letter asks in writing, with the days counted.',

  // The RBI Ombudsman ({phone}: 14448).
  'stuckhelp.ombudsman.when':
    'You can file once 30 days have passed since your complaint to the bank (sooner if it replied and you’re not satisfied), and within 90 days after that.',
  'stuckhelp.ombudsman.file': 'On cms.rbi.org.in, file a complaint against your bank. The details for the form are below.',
  'stuckhelp.ombudsman.paste':
    'Paste the letter as the facts of the complaint. Attach your complaint to the bank, its reply if any, and the statement showing the debit.',
  'stuckhelp.ombudsman.call': 'Questions? Call {phone}: people answer Monday to Saturday, 8 AM to 10 PM. They guide you but can’t take the complaint.',
  'stuckhelp.ready.heading': 'Have these ready',
  'stuckhelp.ready.complaint': 'Your complaint to the bank, and its number',
  'stuckhelp.ready.reply': 'The bank’s reply, if it sent one',
  'stuckhelp.ready.payment': 'The payment’s date and reference',
  'stuckhelp.ready.account': 'Your account or card number',
  'stuckhelp.ready.relief': 'What you’re asking for, with the compensation worked out (below)',

  // The business ({name}: "Swiggy").
  'stuckhelp.merchant.page': 'Open {name}’s help, find this order and contact support from it.',
  'stuckhelp.merchant.app': 'In the {name} app or website, open this order and contact support from it.',
  'stuckhelp.merchant.unknown': 'Contact the business’s support, from the order if you can.',
  'stuckhelp.merchant.paste': 'Paste the message below and ask for a ticket number.',
  'stuckhelp.merchant.nextNch': 'No fix in a week? The National Consumer Helpline is next.',
  'stuckhelp.merchant.nextAirsewa': 'No fix in a week? AirSewa is next.',
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
  'stuckhelp.link.myupi': 'NPCI’s MyUPI',
  'stuckhelp.link.phonepeGrievance': 'PhonePe’s grievance desk',
  'stuckhelp.link.merchantHelp': 'Open {name} help',
  'stuckhelp.link.merchantRefunds': '{name} on refunds',
  'stuckhelp.link.whatsapp': 'Send on WhatsApp',
  'stuckhelp.link.nchSite': 'consumerhelpline.gov.in',
  'stuckhelp.link.airsewa': 'Open AirSewa',
  'stuckhelp.link.ejagriti': 'Open e-Jagriti',
  'stuckhelp.links.aria': 'Other ways to reach them',
  'stuckhelp.newTab': '{label} (opens in a new tab)',

  // The sheet.
  'stuckhelp.eyebrow': '{amount} · {name}',
  'stuckhelp.party.failed': 'Failed payment',
  'stuckhelp.party.refund': 'Refund',
  'stuckhelp.how.heading': 'Where and how',
  'stuckhelp.fields.heading': 'For the form',
  'stuckhelp.fields.hint': 'Type these into the complaint form on cms.rbi.org.in.',
  'stuckhelp.field.entity': 'Bank',
  'stuckhelp.field.category': 'What it’s about',
  'stuckhelp.field.date': 'Date of the payment',
  'stuckhelp.field.amount': 'Amount',
  'stuckhelp.field.reference': 'Transaction reference',
  'stuckhelp.field.account': 'Account or card',
  'stuckhelp.field.bankComplaint': 'Your complaint to the bank',
  'stuckhelp.field.relief': 'Relief sought',
  'stuckhelp.field.copy': 'Copy {field}',
  'stuckhelp.field.copied': '{field} copied',
  // The letter's box: {kind} is letter, message or summary.
  'stuckhelp.letter.heading': '{kind, select, message {The message} summary {The summary} other {The letter}}',
  'stuckhelp.letter.subject': 'Subject',
  'stuckhelp.letter.fill': 'Fill in the parts in [brackets] before you send it.',
  'stuckhelp.letter.actions': 'Send the letter',
  'stuckhelp.action.email': 'Email',
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
  // {date}: "2 Nov"; {name}: the business.
  'stuckhelp.raised.toast':
    '{kind, select, bank {Noted: raised with your bank on {date}} ombudsman {Noted: taken to the RBI Ombudsman on {date}} merchant {Noted: raised with {name} on {date}} nch {Noted: raised with the National Consumer Helpline on {date}} airsewa {Noted: raised on AirSewa on {date}} other {Noted: filed with the consumer commission on {date}}}',
} as const satisfies Messages
