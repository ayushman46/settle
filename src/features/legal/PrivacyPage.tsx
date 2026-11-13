import { BRAND } from '../../domain/types'
import { useT } from '../../i18n'
import { SUPPORT_EMAIL } from './contact'
import { LegalLayout, LegalSection } from './LegalLayout'

const NAME = BRAND.name

/** `/privacy` — what stays on the phone, what leaves it and why, in plain words. */
export function PrivacyPage() {
  const t = useT()
  const summary = [
    t('legal.privacy.summary.0', { brand: NAME }),
    t('legal.privacy.summary.1'),
    t('legal.privacy.summary.2'),
    t('legal.privacy.summary.3'),
    t('legal.privacy.summary.4'),
    t('legal.privacy.summary.5'),
  ]
  return (
    <LegalLayout title={t('legal.privacy.title')} description={t('legal.privacy.description', { brand: NAME })} summary={summary}>
      <LegalSection title={t('legal.privacy.section.device')}>
        <p>
          Everything you put into {NAME} — your name and UPI ID, the people you split with (their names, UPI IDs and
          phone numbers), expenses, groups, recurring splits, stuck payments, bank charges, settings and your Pro pass — is saved
          in your browser’s storage on this device. It is not sent to us, and we can’t see it.
        </p>
        <p>
          Clearing this site’s data in your browser, or removing the app, deletes it. Keep a backup file (under
          You → Backup) if you’d like to move to a new phone or be safe. A backup is a plain file: anyone who opens
          it can read what’s inside, including the account digits and complaint numbers of your stuck payments, so
          keep it somewhere private.
        </p>
        <p>
          <strong>Stuck money.</strong> For each failed payment or refund you track, {NAME} keeps the amount, the
          dates, who it was paid to or who owes the refund, the reference or order number, your bank or UPI app and
          the account’s last digits as the message printed them, the complaints you’ve raised (the date and any
          complaint number), the day your bank replied, and any note you add. It stays on this phone and goes into
          your backup file with everything else. A bank SMS you paste or share is read on your phone; only what it
          says about the payment is kept. The details you add for letters — your mobile number, city and address,
          the email addresses you send complaints to, and whether you cancelled a mandate — stay on this phone too,
          and aren’t put in backups.
        </p>
        <p>
          <strong>Bank charges.</strong> A bank statement you add is read on your phone and never uploaded. {NAME} keeps
          only its charges — the date, the amount and GST, the narration as your bank printed it, the balance
          just before and after, and how many ATM withdrawals that month — plus the bank, the account’s last digits,
          the days the statement covered, your answers about the account and each charge, and the claims you make
          (the dates, complaint numbers and money back). Every other line of the statement is dropped as soon as it’s
          read. It stays on this phone and goes into your backup file with everything else.
        </p>
        <p>
          <strong>Shared groups.</strong> A group stays on your phone only, until you invite someone to it. The invite
          link then carries the group’s key (and, where the server keeps no copies, the group itself) in the part of
          the link after “#”, which is never sent to any server: anyone you send the link to can join and see the
          group. While a group is shared, each phone leaves an encrypted copy of it on our server so the others can
          pick it up: the group’s name, its members’ names and UPI IDs, its expenses and recorded payments. The copy
          is encrypted on your phone with the key from the invite link, so we cannot read it; the server sees only a
          room name made from that key, how big the copy is, and your IP address for the moment of the request. A
          copy nobody has touched for about a year is deleted. Nothing else of yours is part of it: not your other
          groups, people or expenses.
        </p>
        <p>
          <strong>Auto-settle, Stuck money and Bank charges (the Android app).</strong> Only if you turn on notification
          access:
        </p>
        <ul>
          <li>
            <strong>What it reads.</strong> The alerts Google Pay, PhonePe, Paytm, BHIM, Amazon Pay, MobiKwik and
            CRED show when money arrives, when a payment fails or is pending, when a payment goes through (only to
            clear a pending one it was tracking), and when money is reversed or refunded; refund alerts from a short
            list of shopping, food and travel apps (such as Flipkart, Swiggy, Zomato, IRCTC and airlines); and — only
            if you allow it — bank SMS that say money was credited, reversed or refunded, that money was debited
            (including a bank charge), or that your balance is below the minimum.
          </li>
          <li>
            <strong>What it keeps.</strong> These alerts stay on your phone until {NAME} reads them, then they’re
            deleted; only what they say about the payment is kept. A debit is used only to check that a payment that
            failed really took your money, or to note a bank charge for Bank charges, and isn’t kept for anything
            else.
          </li>
          <li>
            <strong>What it ignores.</strong> Every other notification and message: never stored, never sent.
          </li>
        </ul>
        <p>
          Turn it off any time in Android’s notification access settings. Bank statements and SMS you add to “Who’s
          paid?” are read on your phone too.
        </p>
      </LegalSection>

      <LegalSection title={t('legal.privacy.section.leaves')}>
        <ul>
          <li>
            <strong>Reading a bill.</strong> When you scan a bill, the photo goes over an encrypted connection to our
            server, which passes it to an AI model hosted by NVIDIA to read the items and totals. We don’t store the
            photo. NVIDIA handles it under its own terms.
          </li>
          <li>
            <strong>“Just say it”.</strong> The sentence you type, your default currency, today’s date and the names in
            your people list (so the AI can match them) are sent the same way, for the same reason, and aren’t kept by
            us either.
          </li>
          <li>
            <strong>Payment screenshots.</strong> A payment screenshot in “Paid? Drop the screenshot”, or screenshots
            of your UPI app’s history in “Who’s paid?”, go the same way to be read (amounts, names, dates and UPI
            references) and aren’t kept by us.
          </li>
          <li>
            <strong>Pay links.</strong> Everything a pay link shows lives after the “#” in the link, a part browsers
            never send to a server. Anyone who has the link can read it — names, amounts and your UPI ID — so share
            it only with the people in the split.
          </li>
          <li>
            <strong>Paying for Pro.</strong> Checkout is run by Razorpay, which handles your payment details under its
            own privacy policy. We receive only the order and payment IDs and the plan you chose, which we use to
            create your pass. With Pro, your pass code travels with each AI request so our server can apply Pro’s
            allowance.
          </li>
          <li>
            <strong>Checking in.</strong> When it opens, the app asks our server whether the AI helper is working,
            and pages that show Pro’s prices fetch them from it. These requests carry nothing you’ve entered — only
            what any web request does, like your IP address.
          </li>
          <li>
            <strong>Nudges and sharing.</strong> Sending a reminder or sharing a split opens WhatsApp, your messages
            app or your phone’s share sheet with the text ready. What you send from there is between you and that app.
          </li>
          <li>
            <strong>Complaint letters (Stuck money and Bank charges).</strong> {NAME} drafts them on your phone and never sends them
            itself, and never contacts your bank, a business or anyone else for you. A letter leaves your phone only
            when you copy, share or email it, or open the RBI’s complaint site, the National Consumer Helpline or
            AirSewa from it — what you send there is between you and them.
          </li>
          <li>
            <strong>Reminders (Stuck money).</strong> “Add to my calendar” makes the event on your phone. “Open in
            Google Calendar” sends the event to Google — its title names the amount and who owes it — so use the
            first if you’d rather not.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title={t('legal.privacy.section.server')}>
        <p>
          Our server has no database of people or accounts; the only thing it keeps is the encrypted copies of shared groups described above. To stop abuse, it counts requests per IP address (and per Pro pass, for AI) in
          memory for up to a day; the counts disappear when the server restarts. It writes short technical logs —
          like “a bill was read in 7 seconds” — that never include what was on the bill or what you typed. Our
          hosting provider may keep standard access logs.
        </p>
      </LegalSection>

      <LegalSection title={t('legal.privacy.section.cookies')}>
        <p>
          {NAME} uses no cookies, no analytics and no advertising trackers. Its fonts and icons are served from our own
          site, so opening it doesn’t tell anyone else you did.
        </p>
      </LegalSection>

      <LegalSection title={t('legal.privacy.section.choices')}>
        <ul>
          <li>Export a backup of everything, any time, under You → Backup.</li>
          <li>Delete everything with You → Clear all data, or by clearing this site’s data in your browser.</li>
          <li>Skip the AI features: then nothing you enter leaves your device unless you share it yourself.</li>
        </ul>
      </LegalSection>

      <LegalSection title={t('legal.privacy.section.children')}>
        <p>{NAME} is made for adults sharing costs and isn’t directed at children.</p>
      </LegalSection>

      <LegalSection title={t('legal.privacy.section.changes')}>
        <p>
          If this policy changes, the date at the top changes with it. We don’t have your email, so we can’t write to
          you about it — the newest version is always here.
        </p>
        <p>
          Questions about your privacy? Write to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
