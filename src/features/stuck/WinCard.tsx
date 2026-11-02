import { useId } from 'react'
import { Share2 } from 'lucide-react'
import { Button, useToast } from '../../components'
import type { StuckPayment } from '../../data/stores'
import { useT } from '../../i18n'
import { cx } from '../../lib/cx'
import { haptic } from '../../lib/haptics'
import { shareResult } from '../../lib/share'
import { daysLate } from './rules'
import { bankLabel, inr, knownParty, stuckDate } from './view'
import styles from './Stuck.module.css'

/**
 * All back: what came back and what the wait paid, in place of "What to do now" — and a line to
 * share that brags without giving anything away (no reference, no account, no person's name).
 */
export function WinCard({ payment: s, day }: { payment: StuckPayment; day: string }) {
  const t = useT()
  const toast = useToast()
  const headingId = useId()
  const back = s.back ?? { date: day, amount: s.amount, compensation: 0 }
  const amount = inr(back.amount)
  const compensation = inr(back.compensation)
  const late = daysLate(s, day)

  const share = async (): Promise<void> => {
    const outcome = await shareResult(shareText(t, s, amount, compensation))
    if (outcome === 'copied') {
      haptic('success')
      toast(t('stuck.win.copied'), { tone: 'success' })
    } else if (outcome === 'failed') {
      haptic('error')
      toast(t('stuck.detail.copyFailed'), { tone: 'error' })
    }
  }

  return (
    <section className={cx(styles.now, styles.nowDone, styles.win)} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.nowHeading}>
        {t('stuck.win.heading')}
      </h2>
      <p className={styles.nowTitle}>{back.compensation > 0 ? t('stuck.win.titleWait', { amount, compensation }) : t('stuck.win.title', { amount })}</p>
      <p className={styles.nowText}>{late > 0 ? t('stuck.win.textLate', { date: stuckDate(back.date, day), count: late }) : t('stuck.win.text', { date: stuckDate(back.date, day) })}</p>
      <div className={styles.nowActions}>
        <Button block variant="secondary" iconStart={<Share2 />} onClick={() => void share()}>
          {t('stuck.win.share')}
        </Button>
      </div>
    </section>
  )
}

/** The brag: a business by name (a refund), a bank by name (it paid for the wait) — never the person a payment was for. */
function shareText(t: ReturnType<typeof useT>, s: StuckPayment, amount: string, compensation: string): string {
  if (s.kind === 'refund') {
    const name = knownParty(s)
    return name ? t('stuck.win.shareText.refund', { amount, name }) : t('stuck.win.shareText.refundNoName', { amount })
  }
  if ((s.back?.compensation ?? 0) > 0) {
    const bank = bankLabel(s.bank)
    return bank ? t('stuck.win.shareText.paid', { bank, compensation }) : t('stuck.win.shareText.paidNoBank', { compensation })
  }
  return t('stuck.win.shareText.failed', { amount })
}
