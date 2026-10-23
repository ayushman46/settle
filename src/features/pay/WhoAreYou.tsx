import { Check, ChevronRight } from 'lucide-react'
import { Avatar, Badge, Money } from '../../components'
import { useT } from '../../i18n'
import { haptic } from '../../lib/haptics'
import type { PayPerson } from './payView'
import styles from './WhoAreYou.module.css'

export interface WhoAreYouProps {
  people: readonly PayPerson[]
  currency: string
  onPick: (index: number) => void
}

/**
 * "Which one are you?" — everyone who owes, with their share or a Paid tick. Each person's button
 * carries `data-person={index}`, so focus can return to it after "Not you?".
 */
export function WhoAreYou({ people, currency, onPick }: WhoAreYouProps) {
  const t = useT()
  return (
    <section className={styles.who} aria-labelledby="pay-who-title">
      <h2 id="pay-who-title" className={styles.title}>
        {t('pay.who.title')}
      </h2>
      {people.length === 0 ? (
        <p className={styles.hint}>{t('pay.who.empty')}</p>
      ) : (
        <>
          <p className={styles.hint}>{t('pay.who.hint')}</p>
          <ul className={styles.list} role="list">
            {people.map((person) => (
              <li key={person.index}>
                <button
                  type="button"
                  data-person={person.index}
                  className={styles.person}
                  onClick={() => {
                    haptic('tap')
                    onPick(person.index)
                  }}
                >
                  <Avatar name={person.name} color={person.color} size="md" />
                  <span className={styles.name}>{person.name}</span>
                  {person.paid ? (
                    <Badge tone="positive" icon={<Check strokeWidth={3} />}>
                      {t('pay.who.paid')}
                    </Badge>
                  ) : (
                    <Money value={person.amount} currency={currency} trimZeros strong className={styles.amount} />
                  )}
                  <ChevronRight aria-hidden="true" className={styles.chevron} strokeWidth={2.25} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
