import { useMemo, useState } from 'react'
import { Gift, HandCoins } from 'lucide-react'
import { Button, Card, Chip, TextField, useToast } from '../../components'
import { today } from '../../engine/dates'
import { useT } from '../../i18n'
import { haptic } from '../../lib/haptics'
import { adviseFamily, findFamily, lastGivenTo, matchNames } from './engine'
import { adviceText, givenText, rupees } from './labels'
import { addEntry, deleteEntry } from './store'
import { useShagun } from './useShagun'
import styles from './Shagun.module.css'

export interface GiveBoxProps {
  /** Start with this family picked (their own screen). */
  name?: string
  /** Hide the name field (their own screen already says who). */
  fixed?: boolean
}

/**
 * "What should I give?": type or pick a family, and the amount comes with its reason in one
 * sentence; one tap writes down that you gave it (with Undo). Null while the book is empty.
 */
export function GiveBox({ name: initial = '', fixed = false }: GiveBoxProps) {
  const t = useT()
  const toast = useToast()
  const { book, families, functionsById, names } = useShagun()
  const [query, setQuery] = useState(initial)
  const [day] = useState(() => today())
  const family = findFamily(families, query)
  const picks = useMemo(() => (family ? [] : matchNames(names, query, 6)), [family, names, query])
  const advice = family ? adviseFamily(family, functionsById, day) : null
  if (book.entries.length === 0) return null

  const record = (amount: number, who: string) => {
    const saved = addEntry({ name: who, direction: 'given', amount, date: day })
    if (!saved) {
      toast(t('shagun.give.failed'), { tone: 'error' })
      return
    }
    haptic('success')
    toast(t('shagun.give.recorded', { name: saved.name, amount: rupees(amount) }), {
      tone: 'success',
      action: { label: t('common.action.undo'), onAction: () => void deleteEntry(saved.id) },
    })
  }

  const typed = query.trim()
  const reason = advice ? adviceText(advice) : null
  // What you already gave them, when the book has it ("You gave them ₹1,101 at Neha’s wedding").
  const gaveThem = family ? givenText(lastGivenTo(family, functionsById)) : null

  return (
    <Card className={styles.give}>
      <h2 className={styles.giveTitle}>
        <Gift aria-hidden="true" />
        {t('shagun.give.title')}
      </h2>
      {!fixed && (
        <TextField
          label={t('shagun.give.field')}
          placeholder={t('shagun.give.placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          enterKeyHint="search"
          maxLength={80}
        />
      )}
      {picks.length > 0 && (
        <ul className={styles.picks} aria-label={t('shagun.give.pick.aria')}>
          {picks.map((pick) => (
            <li key={pick}>
              <Chip size="lg" onClick={() => setQuery(pick)}>{pick}</Chip>
            </li>
          ))}
        </ul>
      )}
      <div role="status" className={styles.result}>
        {family && advice?.kind === 'amount' && (
          <>
            <p className={styles.amount}>{rupees(advice.amount)}</p>
            <p className={styles.body}>{reason}</p>
            {gaveThem && <p className={styles.fine}>{gaveThem}</p>}
          </>
        )}
        {family && advice?.kind === 'gift' && <p className={styles.body}>{reason}</p>}
        {typed && !family && picks.length === 0 && (
          <>
            <p className={styles.body}>{t('shagun.give.none')}</p>
            <p className={styles.fine}>{t('shagun.give.none.hint', { name: typed })}</p>
          </>
        )}
        {family && advice?.kind === 'none' &&
          (gaveThem ? (
            <>
              <p className={styles.body}>{t('shagun.give.noneBack')}</p>
              <p className={styles.fine}>{gaveThem}</p>
            </>
          ) : (
            <p className={styles.body}>{t('shagun.give.none')}</p>
          ))}
      </div>
      {family && advice?.kind === 'amount' && (
        <Button variant="primary" block iconStart={<HandCoins />} onClick={() => record(advice.amount, family.name)}>
          {t('shagun.give.record', { amount: rupees(advice.amount) })}
        </Button>
      )}
    </Card>
  )
}
