import { memo, useMemo } from 'react'
import { Check, CircleHelp, UserPlus } from 'lucide-react'
import { Money } from '../../components'
import type { Friend } from '../../domain/types'
import { useT } from '../../i18n'
import { cx } from '../../lib/cx'
import type { LiveHeard } from '../../lib/speech'
import { livePreview, type LivePerson, type LiveToken } from './livePreview'
import type { Nicknames } from './nicknames'
import styles from './LiveDashboard.module.css'

/** Below this the recogniser itself isn't sure of a stretch: its words are underlined. */
export const UNSURE_CONFIDENCE = 0.6

export interface LiveDashboardProps {
  /** Everything heard so far. */
  text: string
  /** The same split into settled stretches (with confidence) and the part still changing. */
  live: LiveHeard | null
  people: readonly Friend[]
  nicknames: Nicknames
  currency: string
}

/**
 * The live check while speaking: the words as they're heard, with amounts and names lit up
 * (green: one of your people; amber: could be someone, check after; new names marked), and a
 * running summary — total, who paid, who's in, how it's split. Worked out on the phone on every
 * word; the AI's full read comes after.
 */
export const LiveDashboard = memo(function LiveDashboard({ text, live, people, nicknames, currency }: LiveDashboardProps) {
  const t = useT()
  const preview = useMemo(() => livePreview(text, people, nicknames, currency), [text, people, nicknames, currency])
  const stretches = useMemo(() => {
    if (!live) return text ? [{ text, unsure: false, changing: true }] : []
    const out = live.segments.map((s) => ({
      text: s.alternatives[0] ?? '',
      unsure: s.confidence !== null && s.confidence < UNSURE_CONFIDENCE,
      changing: false,
    }))
    if (live.pending) out.push({ text: live.pending, unsure: false, changing: true })
    return out
  }, [live, text])
  const anyUnsure = stretches.some((s) => s.unsure)

  if (!text) {
    return (
      <div className={styles.dash} aria-hidden="true">
        <p className={styles.waiting}>{t('voice.live.waiting')}</p>
      </div>
    )
  }

  const others = preview.people.filter((p) => p.match !== 'me')
  const me = preview.people.find((p) => p.match === 'me')
  return (
    <div className={styles.dash}>
      <p className={styles.heading}>{t('voice.live.title')}</p>
      <p className={styles.transcript} aria-live="off">
        {stretches.map((s, i) => (
          <span key={i} className={cx(s.unsure && styles.unsure, s.changing && styles.changing)}>
            <Highlighted text={s.text} people={people} nicknames={nicknames} currency={currency} />{' '}
          </span>
        ))}
      </p>
      {anyUnsure && <p className={styles.unsureNote}>{t('voice.live.unsure')}</p>}

      <dl className={styles.facts}>
        <div className={cx(styles.fact, preview.total === null && styles.factMissing)}>
          <dt>{t('voice.live.total')}</dt>
          <dd>
            {preview.total !== null ? (
              <>
                <Money value={Math.round(preview.total * 100)} currency={currency} trimZeros strong />
                {(preview.bills > 1 || preview.amounts.length > 1) && (
                  <span className={styles.sub}>
                    {preview.bills > 1 ? t('voice.live.bills', { count: preview.bills }) : t('voice.live.amounts', { count: preview.amounts.length })}
                  </span>
                )}
              </>
            ) : (
              t('voice.live.totalMissing')
            )}
          </dd>
        </div>
        <div className={styles.fact}>
          <dt>{t('voice.live.paidBy')}</dt>
          <dd>{preview.payer ? <PersonChip person={preview.payer} /> : <span className={styles.sub}>{t('voice.live.paidByMissing')}</span>}</dd>
        </div>
        <div className={cx(styles.fact, styles.factWide, others.length === 0 && styles.factMissing)}>
          <dt>{t('voice.live.people')}</dt>
          <dd className={styles.chips}>
            {others.length === 0 && !me ? t('voice.live.peopleMissing') : null}
            {me && <PersonChip person={me} />}
            {others.map((p) => (
              <PersonChip key={`${p.said}:${p.id ?? ''}`} person={p} />
            ))}
          </dd>
        </div>
        <div className={styles.fact}>
          <dt>{t('voice.live.split')}</dt>
          <dd>{t(`voice.live.mode.${preview.mode}` as 'voice.live.mode.equal')}</dd>
        </div>
      </dl>
      <p className={styles.note}>{t('voice.live.note')}</p>
    </div>
  )
})

function PersonChip({ person }: { person: LivePerson }) {
  const t = useT()
  const icon =
    person.match === 'sure' || person.match === 'me' ? <Check aria-hidden="true" /> : person.match === 'maybe' ? <CircleHelp aria-hidden="true" /> : <UserPlus aria-hidden="true" />
  const label =
    person.match === 'maybe' ? t('voice.live.person.maybe', { name: person.said }) : person.match === 'new' ? t('voice.live.person.new', { name: person.said }) : person.name
  return (
    <span className={cx(styles.chip, styles[`chip_${person.match}`])}>
      {icon}
      {label}
    </span>
  )
}

/** One stretch of the transcript with its amounts and names lit up. */
function Highlighted({ text, people, nicknames, currency }: { text: string; people: readonly Friend[]; nicknames: Nicknames; currency: string }) {
  const tokens = useMemo(() => livePreview(text, people, nicknames, currency).tokens, [text, people, nicknames, currency])
  return (
    <>
      {tokens.map((token, i) => (
        <Token key={i} token={token} last={i === tokens.length - 1} />
      ))}
    </>
  )
}

function Token({ token, last }: { token: LiveToken; last: boolean }) {
  const cls =
    token.kind === 'amount'
      ? styles.tAmount
      : token.kind === 'person' || token.kind === 'me'
        ? styles.tPerson
        : token.kind === 'maybe'
          ? styles.tMaybe
          : token.kind === 'newName'
            ? styles.tNew
            : undefined
  return (
    <>
      <span className={cls}>{token.text}</span>
      {last ? '' : ' '}
    </>
  )
}
