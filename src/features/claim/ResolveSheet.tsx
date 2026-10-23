import { useState, type ReactNode } from 'react'
import { MessageCircle, RotateCcw, Scale, Share2, UserRoundCheck, UsersRound, Clock } from 'lucide-react'
import { Avatar, BottomSheet, Button, Stepper } from '../../components'
import type { ClaimDecision } from '../../domain/types'
import type { ClaimRow } from '../../engine/claims'
import { useT } from '../../i18n'
import { cx } from '../../lib/cx'
import { portionLabel } from '../../engine/claims'
import { whatsappUrl } from '../../share/links'
import { claimedUnits, money } from './claimView'
import styles from './ResolveSheet.module.css'

export interface ResolvePerson {
  id: string
  name: string
  color: number
  phone: string | null
}

export interface ResolveSheetProps {
  open: boolean
  onClose: () => void
  row: ClaimRow | null
  item: { name: string; amount: number; quantity: number } | null
  currency: string
  decision: ClaimDecision | undefined
  /** Everyone at the table (for "Choose who had it"). */
  people: readonly ResolvePerson[]
  /** "Ayush 1 · Sam 1 · Kabir 2" — the claims in words. */
  claimsWords: string
  /** Names of the people who claimed it. */
  claimerNames: readonly string[]
  billTitle: string
  claimLink: string | null
  onDecide: (decision: ClaimDecision | null) => void
}

interface Option {
  key: string
  icon: ReactNode
  label: string
  detail: string
  onSelect?: () => void
  href?: string
}

/**
 * What really happened to an item whose claims don't add up: split it as claimed, the claimers
 * had all of it, share the rest (or all of it) with everyone, choose who had it, or ask again.
 */
export function ResolveSheet({ open, onClose, row, item, currency, decision, people, claimsWords, claimerNames, billTitle, claimLink, onDecide }: ResolveSheetProps) {
  const t = useT()
  const [choosing, setChoosing] = useState(false)
  const [weights, setWeights] = useState<Record<string, number>>({})

  // Each time it opens: back to the options, with the organiser's earlier pick (if any).
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setChoosing(false)
      setWeights(decision?.kind === 'assign' ? { ...decision.shares } : {})
    }
  }

  if (!row || !item) return <BottomSheet open={false} onClose={onClose} title="" />

  const units = claimedUnits(row, item.quantity)
  const title =
    row.status === 'over'
      ? units.quantity === 1 && units.claimed === '2'
        ? t('claim.resolve.overTitleTwice', { name: item.name })
        : t('claim.resolve.overTitle', { name: item.name, claimed: units.claimed, quantity: String(units.quantity) })
      : row.status === 'partial'
        ? t('claim.resolve.partialTitle', { name: item.name, part: portionLabel({ num: Number(row.rest.n), den: Number(row.rest.d) }, 1) })
        : t('claim.resolve.unclaimedTitle', { name: item.name })
  const decide = (d: ClaimDecision | null) => {
    onDecide(d)
    onClose()
  }
  const choose: Option = { key: 'choose', icon: <UserRoundCheck />, label: t('claim.resolve.choose'), detail: t('claim.resolve.chooseDetail'), onSelect: () => setChoosing(true) }

  const options: Option[] = []
  if (row.status === 'over') {
    options.push({
      key: 'as_claimed',
      icon: <Scale />,
      label: t('claim.resolve.asClaimed'),
      detail: t('claim.resolve.asClaimedDetail', { who: claimsWords, amount: money(item.amount, currency) }),
      onSelect: () => decide({ kind: 'as_claimed' }),
    })
    options.push(choose)
    if (claimLink) {
      options.push({
        key: 'ask',
        icon: <MessageCircle />,
        label: t('claim.resolve.askAgain'),
        detail: t('claim.resolve.askAgainDetail'),
        href: whatsappUrl(t('claim.resolve.askMessage', { name: item.name, title: billTitle, claimed: units.claimed, quantity: String(units.quantity), link: claimLink })),
      })
    }
  } else if (row.status === 'partial') {
    options.push({
      key: 'scale_up',
      icon: <UsersRound />,
      label: claimerNames.length === 1 ? t('claim.resolve.scaleUpOne', { name: claimerNames[0] ?? '' }) : t('claim.resolve.scaleUpMany'),
      detail: t('claim.resolve.scaleUpDetail'),
      onSelect: () => decide({ kind: 'scale_up' }),
    })
    options.push({ key: 'rest', icon: <Share2 />, label: t('claim.resolve.rest'), detail: t('claim.resolve.restDetail'), onSelect: () => decide({ kind: 'rest_everyone' }) })
    options.push(choose)
  } else {
    options.push({
      key: 'everyone',
      icon: <UsersRound />,
      label: t('claim.resolve.everyone'),
      detail: t('claim.resolve.everyoneDetail'),
      onSelect: () => decide({ kind: 'assign', shares: Object.fromEntries(people.map((p) => [p.id, 1])) }),
    })
    options.push(choose)
    options.push({ key: 'leave', icon: <Clock />, label: t('claim.resolve.leave'), detail: t('claim.resolve.leaveDetail'), onSelect: () => decide(null) })
  }
  if (decision && row.status !== 'unclaimed') {
    options.push({ key: 'undo', icon: <RotateCcw />, label: t('claim.resolve.undo'), detail: t('claim.resolve.undoDetail'), onSelect: () => decide(null) })
  }

  const picked = Object.entries(weights).filter(([, w]) => w > 0)

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={choosing ? t('claim.resolve.pickTitle', { name: item.name }) : title}
      description={!choosing && row.status === 'over' ? t('claim.resolve.overText', { quantity: String(units.quantity), claimed: units.claimed }) : undefined}
      contentKey={choosing ? 'choose' : 'options'}
      footer={
        choosing ? (
          <Button block disabled={picked.length === 0} onClick={() => decide({ kind: 'assign', shares: Object.fromEntries(picked) })}>
            {t('claim.resolve.pickSave')}
          </Button>
        ) : undefined
      }
    >
      {choosing ? (
        <ul role="list" className={styles.people}>
          {people.map((person) => (
            <li key={person.id} className={styles.person}>
              <Avatar name={person.name} color={person.color} size="sm" />
              <span className={styles.personName}>{person.name}</span>
              <Stepper
                value={weights[person.id] ?? 0}
                min={0}
                max={9}
                label={t('claim.resolve.pickWeight', { name: person.name })}
                onChange={(v) => setWeights((w) => ({ ...w, [person.id]: v }))}
              />
            </li>
          ))}
        </ul>
      ) : (
        <ul role="list" className={styles.list}>
          {options.map((option) => (
            <li key={option.key}>
              {option.href ? (
                <a className={styles.action} href={option.href} target="_blank" rel="noopener noreferrer" onClick={onClose}>
                  <span className={styles.icon} aria-hidden="true">
                    {option.icon}
                  </span>
                  <span className={styles.text}>
                    <span className={styles.label}>{option.label}</span>
                    <span className={styles.detail}>{option.detail}</span>
                  </span>
                </a>
              ) : (
                <button type="button" className={cx(styles.action)} onClick={option.onSelect}>
                  <span className={styles.icon} aria-hidden="true">
                    {option.icon}
                  </span>
                  <span className={styles.text}>
                    <span className={styles.label}>{option.label}</span>
                    <span className={styles.detail}>{option.detail}</span>
                  </span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {choosing && picked.length === 0 && <p className={styles.hint}>{t('claim.resolve.pickHint')}</p>}
    </BottomSheet>
  )
}
