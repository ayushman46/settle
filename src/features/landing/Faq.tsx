import { Plus } from 'lucide-react'
import { EmailText } from '../legal/EmailText'
import { FAQ } from './faqData'
import page from './LandingPage.module.css'
import styles from './Faq.module.css'

/**
 * Questions, answered — a native `<details>` accordion (keyboard and screen-reader friendly with
 * no script, and the answers stay in the page for search engines). Opening one closes the others.
 */
export function Faq() {
  return (
    <section id="faq" className={page.section} aria-labelledby="faq-title">
      <div className={page.sectionHead}>
        <p className={page.eyebrow}>FAQ</p>
        <h2 id="faq-title" className={page.h2}>
          Questions, answered
        </h2>
      </div>
      <div className={styles.list}>
        {FAQ.map((entry) => (
          <details key={entry.id} name="faq" className={styles.item}>
            <summary className={styles.question}>
              <span>{entry.question}</span>
              <span className={styles.icon} aria-hidden="true">
                <Plus strokeWidth={2.5} />
              </span>
            </summary>
            <div className={styles.answer}>
              {entry.answer.map((paragraph) => (
                <p key={paragraph}>
                  <EmailText text={paragraph} className={styles.link} />
                </p>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}
