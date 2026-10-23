import { useEffect, useState } from 'react'
import { BottomSheet, Button, SuccessCheck, useToast } from '../../components'
import { ME_ID, type Expense, type Friend, type Profile } from '../../domain/types'
import type { PaymentGap } from '../../engine/claims'
import { today } from '../../engine/dates'
import { useT } from '../../i18n'
import { haptic } from '../../lib/haptics'
import { UpiPaySheet } from '../../kit/UpiPaySheet'
import { friendLabel } from '../../kit/friendName'
import { whatsappUrl } from '../../share/links'
import { outsideName } from '../../share/names'
import { money } from './claimView'
import styles from './BillUpdatedSheet.module.css'

/** S4's udhaar module, when it's in this build (it's optional for claims). */
type SaveLoan = (draft: {
  direction: 'lent' | 'borrowed'
  friendId: string
  amount: number
  currency: string
  what: 'other'
  title?: string
  date: string
}) => unknown

const loanModules = import.meta.glob<{ saveLoan?: SaveLoan }>('../../data/loans.ts')

function useSaveLoan(): SaveLoan | null {
  const [fn, setFn] = useState<SaveLoan | null>(null)
  useEffect(() => {
    const load = Object.values(loanModules)[0]
    if (!load) return
    let live = true
    load()
      .then((m) => {
        if (live && typeof m.saveLoan === 'function') setFn(() => m.saveLoan as SaveLoan)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])
  return fn
}

export interface BillUpdatedSheetProps {
  open: boolean
  onClose: () => void
  onSeeBill: () => void
  expense: Expense | null
  gaps: readonly PaymentGap[]
  openItems: number
  friendsById: Readonly<Record<string, Friend>>
  profile: Profile
}

/** After "Update the bill": whose money changed — still to pay, to pay back, or square. */
export function BillUpdatedSheet({ open, onClose, onSeeBill, expense, gaps, openItems, friendsById, profile }: BillUpdatedSheetProps) {
  const t = useT()
  const toast = useToast()
  const saveLoan = useSaveLoan()
  const [payBack, setPayBack] = useState<PaymentGap | null>(null)
  const [noted, setNoted] = useState<ReadonlySet<string>>(new Set())
  const currency = expense?.currency ?? 'INR'
  const title = expense?.title ?? ''

  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        title={t('claim.updated.title')}
        footer={
          <div className={styles.footer}>
            <Button variant="secondary" block onClick={onSeeBill}>
              {t('claim.updated.seeBill')}
            </Button>
            <Button block onClick={onClose}>
              {t('claim.updated.done')}
            </Button>
          </div>
        }
      >
        <div className={styles.check}>
          <SuccessCheck size="md" />
        </div>
        {gaps.length === 0 ? (
          <p className={styles.note}>{t('claim.updated.nobody')}</p>
        ) : (
          <ul role="list" className={styles.lines}>
            {gaps.map((gap) => {
              const friend = friendsById[gap.friendId]
              const name = friendLabel(gap.friendId, friend)
              const share = money(gap.share, currency)
              const paid = gap.paid === null ? '' : money(gap.paid, currency)
              const due = money(Math.abs(gap.due), currency)
              const text = gap.settled
                ? t('claim.updated.settled', { name, share })
                : gap.paid === null
                  ? t('claim.updated.unpaid', { name, share })
                  : gap.due > 0
                    ? t('claim.updated.toGo', { name, paid, share, due })
                    : t('claim.updated.owe', { name, paid, share, due })
              return (
                <li key={gap.friendId} className={styles.line}>
                  <p className={styles.lineText}>{text}</p>
                  {!gap.settled && gap.due > 0 && (
                    <a
                      className={styles.action}
                      href={whatsappUrl(
                        t('claim.updated.nudgeMessage', { name, title, share, paid: paid || money(0, currency), due }),
                        friend?.phone,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t('claim.board.nudgeLabel', { name })}
                    >
                      {t('claim.board.nudge')}
                    </a>
                  )}
                  {!gap.settled && gap.due < 0 && (
                    <div className={styles.actions}>
                      <Button size="sm" variant="secondary" onClick={() => setPayBack(gap)}>
                        {t('claim.updated.payBack')}
                      </Button>
                      {saveLoan && !noted.has(gap.friendId) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            try {
                              saveLoan({ direction: 'borrowed', friendId: gap.friendId, amount: -gap.due, currency, what: 'other', title, date: today() })
                              haptic('success')
                              setNoted((s) => new Set([...s, gap.friendId]))
                              toast(t('claim.updated.udhaarSaved'), { tone: 'success' })
                            } catch {
                              haptic('error')
                            }
                          }}
                        >
                          {t('claim.updated.udhaar')}
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {openItems > 0 && <p className={styles.note}>{t('claim.updated.open', { n: openItems })}</p>}
      </BottomSheet>
      {payBack && (
        <UpiPaySheet
          open={payBack !== null}
          onClose={() => setPayBack(null)}
          payee={{ id: payBack.friendId, name: friendLabel(payBack.friendId, friendsById[payBack.friendId]), upiId: friendsById[payBack.friendId]?.upiId ?? null }}
          payer={{ id: ME_ID, name: outsideName(ME_ID, friendsById, profile, 'You'), color: friendsById[ME_ID]?.color ?? 0 }}
          amount={Math.abs(payBack.due)}
          currency={currency}
          note={title}
        />
      )}
    </>
  )
}
