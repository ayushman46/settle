import { BRAND, FREE_AI_PER_DAY } from '../../domain/types'
import { SUPPORT_EMAIL } from './contact'
import { LegalLayout, LegalSection } from './LegalLayout'

const NAME = BRAND.name

const SUMMARY = [
  `${NAME} works out and tracks who owes what. It never holds or moves money — payments happen in your UPI app.`,
  'Check amounts, names and AI results before you pay or ask anyone to pay.',
  'Pro passes are one-time payments. They never renew by themselves.',
  'Your data lives on your device, so keeping a backup is up to you.',
]

/** `/terms` — the rules of the road, short and plain. */
export function TermsPage() {
  return (
    <LegalLayout
      title="Terms of use"
      description={`The terms for using ${NAME}: a free tool for splitting costs, with optional one-time Pro passes.`}
      summary={SUMMARY}
    >
      <LegalSection title={`Using ${NAME}`}>
        <p>
          By using {NAME} you agree to these terms. Use it to split and track shared costs with people you know, and
          only in lawful ways. Please don’t try to break, overload or misuse the service — for example by automating
          requests to the AI, or by sending pay links that pretend to be someone else.
        </p>
      </LegalSection>

      <LegalSection title="Money and UPI">
        <p>
          {NAME} doesn’t process, hold or transfer money. When someone pays through a pay link or a QR code, their UPI
          app moves the money between banks; {NAME} only fills in the payee and the amount.
        </p>
        <p>
          <strong>Always check the name and amount your UPI app shows before you pay.</strong> We can’t reverse
          payments, and we’re not responsible for money sent to the wrong person or for the wrong amount, or for
          disagreements about who owes what.
        </p>
      </LegalSection>

      <LegalSection title="AI features">
        <p>
          Reading bills and “Just say it” use AI, which can make mistakes. {NAME} always shows you the result before
          anything is saved — please check it. Free use includes {FREE_AI_PER_DAY} AI reads a day; Pro removes that
          limit, subject to the fair-use allowance shown in the app. We may change the AI models we use or these
          allowances to keep the service running well.
        </p>
      </LegalSection>

      <LegalSection title={`${NAME} Pro`}>
        <ul>
          <li>
            Pro is sold as one-time passes — for a month, a year or for life — at the price shown before you pay. A pass
            never renews by itself, so there’s nothing to cancel.
          </li>
          <li>
            A “lifetime” pass lasts for as long as {NAME} is offered. A pass is a signed code saved on your device;
            redeem the same code to use Pro on a new phone.
          </li>
          <li>
            If you were charged twice, or paid and Pro didn’t unlock, write to us with your payment ID and we’ll fix it
            or refund you. Because passes unlock straight away, they aren’t otherwise refundable, except where the law
            says they must be.
          </li>
          <li>Promo codes we give you are for you to use — please don’t sell them or post them publicly.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Your data">
        <p>
          Your splits are stored on your device, not with us, so we can’t recover them if they’re deleted or the
          device is lost. Keeping a backup file is your choice and your responsibility. See the privacy policy for
          what is sent where.
        </p>
      </LegalSection>

      <LegalSection title="The service">
        <p>
          We work to keep {NAME} running smoothly, but it’s provided as it is, and features may change or be paused.
          To the extent the law allows, we aren’t liable for indirect or unforeseeable losses, and our total liability
          to you is limited to what you paid us for Pro in the twelve months before the issue.
        </p>
      </LegalSection>

      <LegalSection title="Changes and contact">
        <p>
          If these terms change, the date at the top changes with them, and using {NAME} after that means you accept
          the new version.
        </p>
        <p>
          Questions? Write to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
