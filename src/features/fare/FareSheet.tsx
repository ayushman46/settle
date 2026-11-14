import { useId, useMemo, useState } from 'react'
import { Check, ChevronDown, RotateCcw } from 'lucide-react'
import { Avatar, BottomSheet, Button, Switch, TextField } from '../../components'
import { useT } from '../../i18n'
import { formatMoney } from '../../lib/money'
import { fairFare } from './engine'
import styles from './Fare.module.css'

export interface FareSheetProps {
  open: boolean
  onClose: () => void
  people: Array<{ id: string; name: string; color: number }>
  /** Paise. */
  total: number
  currency: string
  /** Paise per person; they add up to `total` exactly. */
  onApply: (amounts: Record<string, number>) => void
}

/** "2.5" or "2,5" → 2.5; anything else → null. */
function parseKm(text: string): number | null {
  const value = Number(text.replace(',', '.').trim())
  return text.trim() !== '' && Number.isFinite(value) && value > 0 ? value : null
}

const roundKm = (km: number) => String(Math.round(km * 10) / 10)

/**
 * A shared cab split by where each person got off: tap people in the order they got off (a
 * switch puts the next ones at the same stop), optionally give each leg's distance, and see what
 * each person pays and why. "Use this split" hands the amounts over; nothing is saved here.
 */
export function FareSheet({ open, onClose, people, total, currency, onApply }: FareSheetProps) {
  const t = useT()
  const id = useId()
  const [stops, setStops] = useState<string[][]>([])
  const [same, setSame] = useState(false)
  const [kmOpen, setKmOpen] = useState(false)
  const [kmText, setKmText] = useState<string[]>([])
  // Starts afresh each time it opens.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setStops([])
      setSame(false)
      setKmOpen(false)
      setKmText([])
    }
  }

  const valid = people.length >= 2 && Number.isSafeInteger(total) && total > 0
  const km = useMemo(() => kmText.map(parseKm), [kmText])
  const result = useMemo(() => (valid ? fairFare({ riders: people, total, stops, km }) : null), [valid, people, total, stops, km])
  if (!valid || !result) return null

  const nameOf = (pid: string) => people.find((p) => p.id === pid)?.name ?? ''
  const stopOf = (pid: string) => stops.findIndex((s) => s.includes(pid))
  const legCount = result.legs.length
  const totalKm = result.byKm ? result.legs.reduce((sum, leg) => sum + (leg.km ?? 0), 0) : 0
  const someKm = km.some((v, i) => v !== null && i < legCount)
  const money = (minor: number) => formatMoney(minor, currency, { trimZeros: true })
  const list = new Intl.ListFormat(undefined, { type: 'conjunction' })

  const tap = (pid: string) => {
    const at = stopOf(pid)
    if (at >= 0) {
      setStops((all) => all.map((s) => s.filter((x) => x !== pid)).filter((s) => s.length > 0))
      return
    }
    setStops((all) => {
      const last = all[all.length - 1]
      return same && last ? [...all.slice(0, -1), [...last, pid]] : [...all, [pid]]
    })
  }

  const action = stops.length === 0 ? t('fare.tap.first') : same ? t('fare.tap.same') : t('fare.tap.next')
  const reason = (pid: string) => {
    const person = result.people.find((p) => p.id === pid)
    if (!person) return ''
    if (result.byKm && person.kmRidden !== null) return t('fare.reason.km', { km: roundKm(person.kmRidden), total: roundKm(totalKm) })
    if (person.legsRidden >= legCount) return t('fare.reason.all', { count: legCount })
    return t('fare.reason.legs', { ridden: person.legsRidden, count: legCount })
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      eyebrow={t('fare.eyebrow')}
      title={t('fare.title')}
      description={t('fare.description')}
      size="tall"
      footer={
        <Button block iconStart={<Check />} onClick={() => onApply({ ...result.amounts })}>
          {t('fare.apply')}
        </Button>
      }
    >
      <div className={styles.body}>
        <ul className={styles.riders} aria-label={t('fare.order.aria')}>
          {people.map((p) => {
            const at = stopOf(p.id)
            return (
              <li key={p.id}>
                <button
                  type="button"
                  className={styles.rider}
                  data-off={at >= 0 ? '' : undefined}
                  onClick={() => tap(p.id)}
                  aria-label={at >= 0 ? t('fare.stop.aria', { name: p.name, n: at + 1 }) : t('fare.tap.aria', { name: p.name, action })}
                >
                  <Avatar name={p.name} color={p.color} size="sm" decorative />
                  <span className={styles.riderName}>{p.name}</span>
                  <span className={at >= 0 ? styles.stop : styles.tap} aria-hidden="true">
                    {at >= 0 ? t('fare.stop', { n: at + 1 }) : action}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <div className={styles.controls}>
          {stops.length > 0 && (
            <Switch checked={same} onChange={setSame} label={t('fare.same.label')} description={t('fare.same.description')} />
          )}
          {stops.length > 0 && (
            <Button variant="ghost" size="sm" iconStart={<RotateCcw />} onClick={() => setStops([])}>
              {t('fare.reset')}
            </Button>
          )}
        </div>

        <div className={styles.km}>
          <Button
            variant="ghost"
            size="sm"
            iconEnd={<ChevronDown className={kmOpen ? styles.flip : undefined} />}
            aria-expanded={kmOpen}
            aria-controls={`${id}-km`}
            onClick={() => setKmOpen((v) => !v)}
          >
            {kmOpen ? t('fare.km.hide') : t('fare.km.show')}
          </Button>
          {kmOpen && (
            <div id={`${id}-km`} className={styles.kmFields}>
              <p className={styles.hint}>{someKm && !result.byKm && legCount > 1 ? t('fare.km.partial') : t('fare.km.hint')}</p>
              {result.legs.map((leg, i) => (
                <TextField
                  key={i}
                  inputMode="decimal"
                  label={
                    i === legCount - 1 && stopOf(leg.offIds[0] ?? '') < 0
                      ? t('fare.km.last', { n: i + 1 })
                      : t('fare.km.leg', { n: i + 1, names: list.format(leg.offIds.map(nameOf)) })
                  }
                  value={kmText[i] ?? ''}
                  onChange={(e) => {
                    const value = e.target.value
                    setKmText((all) => {
                      const next = [...all]
                      while (next.length <= i) next.push('')
                      next[i] = value
                      return next
                    })
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <section className={styles.result} aria-label={t('fare.result.aria')}>
          {result.equal && <p className={styles.hint}>{t('fare.equal')}</p>}
          <div role="status">
          <ul className={styles.amounts}>
            {people.map((p) => (
              <li key={p.id} className={styles.amountRow}>
                <span className={styles.amountWho}>
                  <span className={styles.riderName}>{p.name}</span>
                  <span className={styles.hint}>{reason(p.id)}</span>
                </span>
                <span className={styles.amount}>{money(result.amounts[p.id] ?? 0)}</span>
              </li>
            ))}
          </ul>
          </div>
        </section>
      </div>
    </BottomSheet>
  )
}
