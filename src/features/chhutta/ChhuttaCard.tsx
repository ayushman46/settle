import { memo, useMemo } from 'react'
import { Coins } from 'lucide-react'
import { Banner, Button, useToast } from '../../components'
import { useExpenses, useFriendsById, useGroup } from '../../data'
import { ME_ID, type Group } from '../../domain/types'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { friendLabel } from '../../kit/friendName'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { callGroupEven } from './actions'
import { gentleKey, smallDues, type SmallDue } from './engine'
import { skipChhutta, unskipChhutta, useChhuttaRule, useChhuttaSkipped } from './store'
import styles from './Chhutta.module.css'

/**
 * Above a group's expenses: a suggested payment too small to chase ("₹7 between Riya and Sam is
 * small change. Call it even?"). One tap records it as settled and logs it, with Undo. Under the
 * group's limit; with no limit set, one gentle offer for a due under ₹10. Null when there is none.
 */
export const ChhuttaCard = memo(function ChhuttaCard({ group: given }: { group: Group }) {
  const t = useT()
  const toast = useToast()
  // The live group, so a payment recorded here takes its offer away at once.
  const group = useGroup(given.id) ?? given
  const expenses = useExpenses({ groupId: group.id })
  const rule = useChhuttaRule(group.id)
  const skipped = useChhuttaSkipped()
  const friendsById = useFriendsById()
  const dues = useMemo(
    () => smallDues(group, expenses, rule, skipped, (id) => friendsById[id]?.name ?? ''),
    [group, expenses, rule, skipped, friendsById],
  )
  if (dues.length === 0) return null

  const money = (paise: number): string => formatMoney(paise, group.currency, { trimZeros: true })
  const nameOf = (id: string): string => friendLabel(id, friendsById[id] ?? null)
  /** The other person, when the due is yours either way. */
  const otherOf = (due: SmallDue): string | null => (due.fromId === ME_ID ? due.toId : due.toId === ME_ID ? due.fromId : null)

  const callEven = (due: SmallDue): void => {
    const undo = callGroupEven(group, due, todayIso())
    if (!undo) {
      haptic('error')
      toast(t('chhutta.card.failed'), { tone: 'error' })
      return
    }
    haptic('success')
    const other = otherOf(due)
    const amount = money(due.amount)
    toast(other ? t('chhutta.card.done.you', { amount, name: nameOf(other) }) : t('chhutta.card.done.between', { amount, from: nameOf(due.fromId), to: nameOf(due.toId) }), {
      tone: 'success',
      action: { label: t('common.action.undo'), onAction: undo },
    })
  }

  const keep = (due: SmallDue): void => {
    const key = due.gentle ? gentleKey(group.id) : due.key
    skipChhutta(key)
    toast(t('chhutta.card.kept', { amount: money(due.amount) }), { action: { label: t('common.action.undo'), onAction: () => unskipChhutta(key) } })
  }

  return (
    <div className={styles.offers}>
      {dues.map((due) => {
        const other = otherOf(due)
        const amount = money(due.amount)
        const from = nameOf(due.fromId)
        const to = nameOf(due.toId)
        return (
          <Banner
            key={due.key}
            tone="info"
            icon={<Coins aria-hidden="true" />}
            title={due.gentle ? t('chhutta.card.title.gentle') : t('chhutta.card.title')}
            actions={
              <div className={styles.actions}>
                <Button
                  size="md"
                  onClick={() => callEven(due)}
                  aria-label={other ? t('chhutta.card.cta.aria.you', { amount, name: nameOf(other) }) : t('chhutta.card.cta.aria.between', { amount, from, to })}
                >
                  {t('chhutta.card.cta')}
                </Button>
                <Button size="md" variant="ghost" onClick={() => keep(due)}>
                  {due.gentle ? t('chhutta.card.notNow') : t('chhutta.card.keep')}
                </Button>
              </div>
            }
          >
            {due.fromId === ME_ID
              ? t('chhutta.card.youOwe', { name: to, amount })
              : due.toId === ME_ID
                ? t('chhutta.card.owesYou', { name: from, amount })
                : t('chhutta.card.between', { amount, from, to })}
            {due.gentle && <span className={styles.fine}> {t('chhutta.card.gentle.fine')}</span>}
          </Banner>
        )
      })}
    </div>
  )
})
