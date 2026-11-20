import { useId, useMemo, useState } from 'react'
import { Check, ChevronDown, CircleHelp, Search, UserPlus } from 'lucide-react'
import { fold, rankNameCandidates, sureMatch, type MatchKind, type NameCandidate } from '../../../shared/nameMatch'
import { Avatar, Badge } from '../../components'
import type { Friend } from '../../domain/types'
import { useT } from '../../i18n'
import { cx } from '../../lib/cx'
import type { OnSettle } from '../account/onSettle'
import type { Nicknames } from './nicknames'
import styles from './WhoPicker.module.css'

/** One name from the split, as said, and who it's going to now. */
export interface WhoRow {
  /** The name as the text (or speech) had it. */
  said: string
  /** Who it's set to now: a friend id, or null for someone new. */
  friendId: string | null
  /** "Paid" or a share, shown on the right of the row. */
  role: 'paid' | 'in'
}

export type WhoStatus = 'sure' | 'check' | 'new'

export interface WhoAssessment {
  status: WhoStatus
  candidates: NameCandidate<Friend>[]
}

/**
 * Is this name settled? `sure`: one person is clearly meant (or you picked them). `check`: more
 * than one person could be meant, or the match is only a guess from spelling or sound. `new`:
 * nobody you know is called anything like it.
 */
export function assessName(row: WhoRow, people: readonly Friend[], nicknames: Nicknames, picked: boolean): WhoAssessment {
  const candidates = rankNameCandidates(row.said, people, nicknames, 8)
  if (picked) return { status: row.friendId === null && candidates.length === 0 ? 'new' : 'sure', candidates }
  if (candidates.length === 0) return { status: 'new', candidates }
  const sure = sureMatch(candidates)
  if (sure && sure.id === row.friendId) {
    // Sure, unless another person is nearly as likely ("Rahul" → Rahul Sharma, with a Rahul Verma too, is caught by sureMatch).
    return { status: 'sure', candidates }
  }
  return { status: 'check', candidates }
}

const KIND_KEYS: Readonly<Record<MatchKind, string>> = {
  nickname: 'voice.who.why.nickname',
  exact: 'voice.who.why.exact',
  first: 'voice.who.why.first',
  word: 'voice.who.why.word',
  short: 'voice.who.why.short',
  spelling: 'voice.who.why.spelling',
  sound: 'voice.who.why.sound',
  close: 'voice.who.why.close',
}

export interface WhoPickerProps {
  rows: readonly WhoRow[]
  /** Your people, without you. */
  people: readonly Friend[]
  nicknames: Nicknames
  onSettle: OnSettle
  /** Names you've already picked for in this draft (folded). */
  picked: ReadonlySet<string>
  /** `friendId` null: someone new, called what was said. */
  onPick: (said: string, friendId: string | null) => void
}

/**
 * "Who's that?": every name in a voice split, checked against your people. A name that clearly
 * means one person shows them with a tick; one that could be several people (two Rahuls, "Adi",
 * a name speech recognition bent) opens a list of everyone it sounds like, best match first, each
 * with the end of their number and whether they're on Settle. Pick one and Settle remembers what
 * you call them.
 */
export function WhoPicker({ rows, people, nicknames, onSettle, picked, onPick }: WhoPickerProps) {
  const t = useT()
  const assessed = useMemo(
    () => rows.map((row) => ({ row, ...assessName(row, people, nicknames, picked.has(fold(row.said))) })),
    [rows, people, nicknames, picked],
  )
  const firstToCheck = assessed.find((a) => a.status === 'check')?.row.said ?? null
  const [open, setOpen] = useState<string | null>(firstToCheck)
  const [seenFirst, setSeenFirst] = useState(firstToCheck)
  // A new draft with something to check: open that one.
  if (firstToCheck !== seenFirst) {
    setSeenFirst(firstToCheck)
    if (firstToCheck !== null) setOpen(firstToCheck)
  }
  if (rows.length === 0) return null
  const toCheck = assessed.filter((a) => a.status === 'check').length
  const byId = new Map(people.map((p) => [p.id, p]))

  return (
    <section className={styles.who} aria-label={t('voice.who.title')}>
      <header className={styles.head}>
        <h4 className={styles.title}>{t('voice.who.title')}</h4>
        <p className={cx(styles.summary, toCheck > 0 && styles.summaryCheck)}>
          {toCheck > 0 ? t('voice.who.toCheck', { count: toCheck }) : t('voice.who.allSure')}
        </p>
      </header>
      <ul role="list" className={styles.rows}>
        {assessed.map(({ row, status, candidates }) => (
          <WhoRowView
            key={`${row.role}:${row.said}`}
            row={row}
            status={status}
            candidates={candidates}
            current={row.friendId ? (byId.get(row.friendId) ?? null) : null}
            people={people}
            onSettle={onSettle}
            open={open === row.said}
            onToggle={() => setOpen((o) => (o === row.said ? null : row.said))}
            onPick={(id) => {
              onPick(row.said, id)
              setOpen(null)
            }}
          />
        ))}
      </ul>
    </section>
  )
}

interface WhoRowViewProps {
  row: WhoRow
  status: WhoStatus
  candidates: NameCandidate<Friend>[]
  current: Friend | null
  people: readonly Friend[]
  onSettle: OnSettle
  open: boolean
  onToggle: () => void
  onPick: (friendId: string | null) => void
}

function WhoRowView({ row, status, candidates, current, people, onSettle, open, onToggle, onPick }: WhoRowViewProps) {
  const t = useT()
  const listId = useId()
  const [query, setQuery] = useState('')
  const shownName = current?.name ?? row.said
  const exactExists = people.some((p) => fold(p.name) === fold(row.said))

  // Search: anyone in your people, beyond the names that sound alike.
  const q = fold(query)
  const searched = q
    ? people.filter((p) => fold(p.name).includes(q) && !candidates.some((c) => c.person.id === p.id)).slice(0, 8)
    : []

  const icon = status === 'sure' ? <Check aria-hidden="true" /> : status === 'check' ? <CircleHelp aria-hidden="true" /> : <UserPlus aria-hidden="true" />
  return (
    <li className={cx(styles.row, styles[status])}>
      <button type="button" className={styles.rowButton} aria-expanded={open} aria-controls={listId} onClick={onToggle}>
        <span className={styles.state}>{icon}</span>
        <span className={styles.rowText}>
          <span className={styles.said}>
            {t('voice.who.said', { said: row.said })}
            {row.role === 'paid' && <span className={styles.role}>{t('voice.who.paid')}</span>}
          </span>
          <span className={styles.match}>
            {status === 'new'
              ? t('voice.who.new')
              : status === 'check' && !current
                ? t('voice.who.pick', { count: candidates.length })
                : shownName}
            {current && onSettle.has(current.id) && (
              <Badge tone="positive" className={styles.badge}>
                {t('voice.who.onSettle')}
              </Badge>
            )}
            {status === 'check' && current && <span className={styles.guess}>{t('voice.who.guess')}</span>}
          </span>
        </span>
        <ChevronDown aria-hidden="true" className={cx(styles.chevron, open && styles.chevronOpen)} />
      </button>

      {open && (
        <div id={listId} className={styles.panel}>
          <ul role="listbox" aria-label={t('voice.who.listAria', { said: row.said })} className={styles.options}>
            {candidates.map((c) => (
              <Option
                key={c.person.id}
                friend={c.person}
                why={t(KIND_KEYS[c.kind] as 'voice.who.why.exact')}
                selected={current?.id === c.person.id}
                settleName={onSettle.get(c.person.id) ?? null}
                onPick={() => onPick(c.person.id)}
              />
            ))}
            {searched.map((p) => (
              <Option
                key={p.id}
                friend={p}
                why={t('voice.who.why.search')}
                selected={current?.id === p.id}
                settleName={onSettle.get(p.id) ?? null}
                onPick={() => onPick(p.id)}
              />
            ))}
            {!exactExists && (
              <li
                role="option"
                aria-selected={current === null}
                tabIndex={0}
                className={cx(styles.option, current === null && styles.optionOn)}
                onClick={() => onPick(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onPick(null)
                  }
                }}
              >
                <span className={styles.newIcon}>
                  <UserPlus aria-hidden="true" />
                </span>
                <span className={styles.optionText}>
                  <span className={styles.optionName}>{t('voice.who.addNew', { said: row.said })}</span>
                  <span className={styles.optionWhy}>{t('voice.who.addNewWhy')}</span>
                </span>
                {current === null && <Check aria-hidden="true" className={styles.tick} />}
              </li>
            )}
          </ul>
          {people.length > candidates.length && (
            <label className={styles.search}>
              <Search aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('voice.who.search')}
                aria-label={t('voice.who.search')}
                enterKeyHint="search"
              />
            </label>
          )}
        </div>
      )}
    </li>
  )
}

function lastDigits(phone: string | null): string | null {
  const digits = phone?.replace(/\D/g, '') ?? ''
  return digits.length >= 4 ? digits.slice(-4) : null
}

function Option({ friend, why, selected, settleName, onPick }: { friend: Friend; why: string; selected: boolean; settleName: string | null; onPick: () => void }) {
  const t = useT()
  const digits = lastDigits(friend.phone)
  const pick = (): void => onPick()
  return (
    <li
      role="option"
      aria-selected={selected}
      tabIndex={0}
      className={cx(styles.option, selected && styles.optionOn)}
      onClick={pick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          pick()
        }
      }}
    >
      <Avatar name={friend.name} color={friend.color} size="sm" />
      <span className={styles.optionText}>
        <span className={styles.optionName}>
          {friend.name}
          {settleName && (
            <Badge tone="positive" className={styles.badge}>
              {t('voice.who.onSettle')}
            </Badge>
          )}
        </span>
        <span className={styles.optionWhy}>
          {why}
          {digits && ` · ${t('voice.who.phone', { digits })}`}
          {settleName && fold(settleName) !== fold(friend.name) && ` · ${t('voice.who.settleAs', { name: settleName })}`}
        </span>
      </span>
      {selected && <Check aria-hidden="true" className={styles.tick} />}
    </li>
  )
}
