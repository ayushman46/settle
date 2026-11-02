import { useId } from 'react'
import { Share2 } from 'lucide-react'
import { Button, useToast } from '../../components'
import type { StuckBackPart, StuckPayment } from '../../data/stores'
import { getLanguage, intlLocale, useT } from '../../i18n'
import { cx } from '../../lib/cx'
import { haptic } from '../../lib/haptics'
import { shareResult } from '../../lib/share'
import { SETTLE_URL } from './reminder'
import { backParts, daysLate } from './rules'
import { inr, knownParty, stuckDate } from './view'
import styles from './Stuck.module.css'

type Translate = ReturnType<typeof useT>

/**
 * All back: what came back and what the wait paid (and the two together), when each part came, in
 * place of "What to do now" — and a line to share, with Settle's link, that brags without giving
 * anything away (no reference, no account, no bank, no person's name).
 */
export function WinCard({ payment: s, day }: { payment: StuckPayment; day: string }) {
  const t = useT()
  const toast = useToast()
  const headingId = useId()
  const back = s.back ?? { date: day, amount: s.amount, compensation: 0 }
  const amount = inr(back.amount)
  const compensation = inr(back.compensation)
  const late = daysLate(s, day)
  const parts = backParts(s)
  const money = parts.filter((p) => p.amount > 0)
  // Compensation has a day of its own only once parts are kept (before that, it was noted with the money).
  const paid = (s.back?.parts?.length ?? 0) > 0 ? parts.filter((p) => p.compensation > 0) : []
  const list = (items: StuckBackPart[], value: (p: StuckBackPart) => number): string =>
    joinList(items.map((p) => t('stuck.win.part', { amount: inr(value(p)), date: stuckDate(p.date, day) })))
  // Parts on different days are each told with their day; on one day, it came back on that day.
  const when =
    new Set(money.map((p) => p.date)).size > 1
      ? late > 0
        ? t('stuck.win.textPartsLate', { parts: list(money, (p) => p.amount), count: late })
        : t('stuck.win.textParts', { parts: list(money, (p) => p.amount) })
      : late > 0
        ? t('stuck.win.textLate', { date: stuckDate(back.date, day), count: late })
        : t('stuck.win.text', { date: stuckDate(back.date, day) })

  const share = async (): Promise<void> => {
    const outcome = await shareResult(`${shareText(t, s, amount, compensation)}\n${SETTLE_URL}`)
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
      {back.compensation > 0 && <p className={styles.winTotal}>{t('stuck.win.total', { total: inr(back.amount + back.compensation) })}</p>}
      <p className={styles.nowText}>{when}</p>
      {paid.length > 0 && <p className={styles.nowText}>{t('stuck.win.waitPaid', { parts: list(paid, (p) => p.compensation) })}</p>}
      <div className={styles.nowActions}>
        <Button block variant="secondary" iconStart={<Share2 />} onClick={() => void share()}>
          {t('stuck.win.share')}
        </Button>
      </div>
    </section>
  )
}

/** "₹2,000 on 30 Oct and ₹3,000 on 1 Nov", in the language (plain commas where the browser can't). */
function joinList(items: string[]): string {
  try {
    return new Intl.ListFormat(intlLocale(getLanguage()), { type: 'conjunction' }).format(items)
  } catch {
    return items.join(', ')
  }
}

/**
 * The brag: a business by name (a refund) — never the bank, the account or the person a payment
 * was for. "Claimed" only when a complaint was raised; paid on its own, Settle only tracked it.
 */
function shareText(t: Translate, s: StuckPayment, amount: string, compensation: string): string {
  if (s.kind === 'refund') {
    const name = knownParty(s)
    return name ? t('stuck.win.shareText.refund', { amount, name }) : t('stuck.win.shareText.refundNoName', { amount })
  }
  const wallet = s.rail === 'wallet'
  if ((s.back?.compensation ?? 0) > 0) {
    const claimed = s.steps.length > 0
    if (wallet) return t(claimed ? 'stuck.win.shareText.paidWallet' : 'stuck.win.shareText.paidWalletTracked', { compensation })
    return t(claimed ? 'stuck.win.shareText.paidNoBank' : 'stuck.win.shareText.paidTracked', { compensation })
  }
  return t(wallet ? 'stuck.win.shareText.failedWallet' : 'stuck.win.shareText.failed', { amount })
}
