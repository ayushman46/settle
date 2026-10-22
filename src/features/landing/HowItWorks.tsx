import { Illustration, type IllustrationName } from '../../components'
import page from './LandingPage.module.css'
import styles from './HowItWorks.module.css'

const STEPS: ReadonlyArray<{ art: IllustrationName; title: string; text: string }> = [
  {
    art: 'welcome-scan',
    title: 'Add what you spent',
    text: 'Snap the bill, say it in a sentence, or type the amount. Pick who was in.',
  },
  {
    art: 'welcome-split',
    title: 'Share one link',
    text: 'Send the pay link to the group chat. Everyone sees exactly what they owe, and why.',
  },
  {
    art: 'welcome-settle',
    title: 'Get paid by UPI',
    text: 'Friends tap their name and pay with GPay, PhonePe, Paytm or any UPI app. You tick them off.',
  },
]

/** Three steps from bill to paid. */
export function HowItWorks() {
  return (
    <section id="how" className={page.section} aria-labelledby="how-title">
      <div className={page.sectionHead}>
        <p className={page.eyebrow}>How it works</p>
        <h2 id="how-title" className={page.h2}>
          From bill to paid in three taps
        </h2>
      </div>
      <ol className={styles.steps} role="list">
        {STEPS.map((step, i) => (
          <li key={step.art} className={styles.step}>
            <div className={styles.art}>
              <Illustration name={step.art} size={176} />
            </div>
            <p className={styles.number} aria-hidden="true">
              {i + 1}
            </p>
            <h3 className={styles.title}>
              <span className="visually-hidden">Step {i + 1}: </span>
              {step.title}
            </h3>
            <p className={styles.text}>{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
