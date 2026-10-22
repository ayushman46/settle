import { BRAND } from '../../domain/types'
import { SUPPORT_EMAIL } from './contact'
import { LegalLayout, LegalSection } from './LegalLayout'

const NAME = BRAND.name

const SUMMARY = [
  `${NAME} has no accounts and no database. Your splits, friends and groups stay on your device.`,
  'Bill photos and “Just say it” text are sent to an AI model hosted by NVIDIA only to be read, and are not kept.',
  'A pay link carries its split inside the link itself — that part never reaches our server.',
  'Pro payments are handled by Razorpay. We never see your card details or UPI PIN.',
  'No ads, no analytics, no tracking cookies.',
]

/** `/privacy` — what stays on the phone, what leaves it and why, in plain words. */
export function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy policy"
      description={`How ${NAME} handles your data: everything stays on your device, AI reads are not kept, and there's no tracking.`}
      summary={SUMMARY}
    >
      <LegalSection title="What stays on your device">
        <p>
          Everything you put into {NAME} — your name and UPI ID, the people you split with (their names, UPI IDs and
          phone numbers), expenses, groups, recurring splits, settings and your Pro pass — is saved in your
          browser’s storage on this device. It is not sent to us, and we can’t see it.
        </p>
        <p>
          Clearing this site’s data in your browser, or removing the app, deletes it. Keep a backup file (under
          You → Backup) if you’d like to move to a new phone or be safe.
        </p>
      </LegalSection>

      <LegalSection title="What leaves your device, and why">
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
            <strong>Nudges and sharing.</strong> Sending a reminder or sharing a split opens WhatsApp, your messages
            app or your phone’s share sheet with the text ready. What you send from there is between you and that app.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="What our server keeps">
        <p>
          Our server has no database. To stop abuse, it counts requests per IP address (and per Pro pass, for AI) in
          memory for up to a day; the counts disappear when the server restarts. It writes short technical logs —
          like “a bill was read in 7 seconds” — that never include what was on the bill or what you typed. Our
          hosting provider may keep standard access logs.
        </p>
      </LegalSection>

      <LegalSection title="Cookies and tracking">
        <p>
          {NAME} uses no cookies, no analytics and no advertising trackers. Its fonts and icons are served from our own
          site, so opening it doesn’t tell anyone else you did.
        </p>
      </LegalSection>

      <LegalSection title="Your choices">
        <ul>
          <li>Export a backup of everything, any time, under You → Backup.</li>
          <li>Delete everything with You → Clear all data, or by clearing this site’s data in your browser.</li>
          <li>Skip the AI features: then nothing you enter leaves your device unless you share it yourself.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Children">
        <p>{NAME} is made for adults sharing costs and isn’t directed at children.</p>
      </LegalSection>

      <LegalSection title="Changes and contact">
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
