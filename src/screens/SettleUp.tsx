import { useEffect, useId, useRef, useState, type KeyboardEvent, type Ref } from 'react'
import { QrCode } from 'lucide-react'
import { Avatar, Button, Card, Money, TextField } from '../components'
import { cx } from '../lib/cx'
import { haptic } from '../lib/haptics'
import type { Settlement } from '../lib/settle'
import { isValidUpiId } from '../lib/upi'
import type { Person } from '../types'
import { revealElement } from './screenUtils'
import styles from './SettleUp.module.css'

export interface SettleUpProps {
  people: readonly Person[]
  payerId: string | null
  onPayerChange: (personId: string | null) => void
  /** From `settleUp(split, payerId)`; null until a payer is chosen. */
  settlement: Settlement | null
  currency: string
  /** The payer's UPI ID as typed (INR bills only). */
  upiText: string
  onUpiTextChange: (text: string) => void
  /** Show the UPI QR / request for this person. */
  onRequest: (personId: string) => void
  /** The section element (e.g. to scroll it into view). */
  ref?: Ref<HTMLElement>
}

/**
 * "Who paid the bill?" — pick the payer (a radio group of avatars) and see who owes them what.
 * For rupee bills the payer's UPI ID turns every debt into a scannable UPI request.
 */
export function SettleUp({
  people,
  payerId,
  onPayerChange,
  settlement,
  currency,
  upiText,
  onUpiTextChange,
  onRequest,
  ref,
}: SettleUpProps) {
  const headingId = useId()
  const radios = useRef<Array<HTMLButtonElement | null>>([])
  const cardRef = useRef<HTMLDivElement>(null)
  const revealNext = useRef(false)
  const [upiTouched, setUpiTouched] = useState(false)

  const payer = settlement?.payer ?? null
  const payerKey = payer?.id ?? null
  const inr = currency === 'INR'
  const upiBlank = upiText.trim() === ''
  const upiValid = isValidUpiId(upiText)
  const canRequest = inr && upiValid

  // The first pick reveals the settle-up card, which may sit below the fold.
  useEffect(() => {
    if (!revealNext.current || payerKey === null) return
    revealNext.current = false
    revealElement(cardRef.current)
  }, [payerKey])

  const choose = (personId: string) => {
    if (personId === payerId) return
    if (payerId === null) revealNext.current = true
    onPayerChange(personId)
  }

  const activeIndex = Math.max(
    0,
    people.findIndex((p) => p.id === payerId),
  )

  const onRadioKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = people.length - 1
    let next: number | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = index >= last ? 0 : index + 1
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = index <= 0 ? last : index - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last
    if (next === null) return
    event.preventDefault()
    const person = people[next]
    if (!person) return
    haptic('select')
    choose(person.id)
    radios.current[next]?.focus()
  }

  const upiError =
    upiTouched && !upiBlank && !upiValid ? "That doesn't look like a UPI ID. It's like name@bank" : undefined
  const upiHint = upiValid
    ? 'Saved on this device for next time.'
    : upiBlank
      ? 'Add it to get a UPI QR code for each person.'
      : 'Like name@okaxis or 98xxxxxx10@ybl'

  return (
    <section ref={ref} className={styles.section} aria-labelledby={headingId}>
      <div className={styles.head}>
        <div className={styles.headText}>
          <h2 id={headingId} className={styles.title}>
            Who paid the bill?
          </h2>
          <p className={styles.subtitle}>
            {payer ? `Everyone else pays ${payer.name} back.` : 'Pick who paid to see who owes whom.'}
          </p>
        </div>
        {payer && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onPayerChange(null)
              // "Clear" disappears with the payer: keep focus in the picker, not on the page.
              radios.current[0]?.focus()
            }}
          >
            Clear
          </Button>
        )}
      </div>

      <div role="radiogroup" aria-labelledby={headingId} className={styles.payers}>
        {people.map((person, index) => {
          const checked = person.id === payerId
          return (
            <button
              key={person.id}
              ref={(el) => {
                radios.current[index] = el
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={index === activeIndex ? 0 : -1}
              className={cx(styles.payer, checked && styles.payerOn)}
              onClick={() => {
                haptic('select')
                choose(person.id)
              }}
              onKeyDown={(event) => onRadioKeyDown(event, index)}
            >
              <Avatar name={person.name} color={person.color} size="lg" selected={checked} />
              <span className={styles.payerName}>{person.name}</span>
            </button>
          )
        })}
      </div>

      {settlement && payer && (
        <Card ref={cardRef} padding="none" className={styles.card}>
          <div className={styles.summary}>
            <Avatar name={payer.name} color={payer.color} size="md" />
            <div className={styles.summaryText}>
              <p className={styles.summaryTitle}>
                {settlement.getsBack > 0 ? (
                  <>
                    {payer.name} gets back{' '}
                    <Money value={settlement.getsBack} currency={currency} size="inherit" strong />
                  </>
                ) : (
                  `Nobody owes ${payer.name} anything`
                )}
              </p>
              <p className={styles.summarySub}>
                Paid <Money value={settlement.paid} currency={currency} size="inherit" /> · own share{' '}
                <Money value={settlement.payerShare} currency={currency} size="inherit" />
              </p>
            </div>
          </div>

          {inr && (
            <div className={styles.upi}>
              <TextField
                label={`${payer.name}'s UPI ID`}
                placeholder="name@okaxis"
                value={upiText}
                onChange={(event) => onUpiTextChange(event.target.value.replace(/\s+/g, ''))}
                onBlur={() => setUpiTouched(true)}
                error={upiError}
                hint={upiHint}
                inputMode="email"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="done"
              />
            </div>
          )}

          {settlement.debts.length > 0 ? (
            <ul role="list" className={styles.debts} aria-label={`What everyone owes ${payer.name}`}>
              {settlement.debts.map((debt) => (
                <li key={debt.person.id} className={styles.debt}>
                  <Avatar name={debt.person.name} color={debt.person.color} size="sm" />
                  <span className={styles.debtText}>
                    <span className={styles.debtName}>{debt.person.name}</span>{' '}
                    <span className={styles.debtSub}>{debt.owes > 0 ? `owes ${payer.name}` : 'all square'}</span>
                  </span>
                  <Money value={debt.owes} currency={currency} strong className={styles.debtAmount} />
                  {canRequest && debt.owes > 0 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      iconStart={<QrCode />}
                      className={styles.request}
                      onClick={() => onRequest(debt.person.id)}
                    >
                      Pay via UPI <span className="visually-hidden">— {debt.person.name}</span>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.nobody}>Nobody else to settle up with.</p>
          )}
        </Card>
      )}
    </section>
  )
}
