import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ArrowRight, PenLine, RotateCcw, Sparkles } from 'lucide-react'
import { DESCRIBE_EXAMPLES, DescribeError, describeSplit, type DescribeErrorCode } from '../../ai'
import { describedToPrefill } from '../../ai/prefill'
import { navigate } from '../../app/router'
import { Avatar, Badge, Banner, BottomSheet, Button, CategoryIcon, Chip, Money, SearchPill, Skeleton } from '../../components'
import { addFriend, setSplitPrefill, useFriends, useProfile } from '../../data'
import { FREE_AI_PER_DAY, ME_ID, type DescribedSplit } from '../../domain/types'
import { today } from '../../engine/dates'
import { relativeDateLabel } from '../../kit/dateLabel'
import { cx } from '../../lib/cx'
import { haptic } from '../../lib/haptics'
import { aiUsedToday, quotaFor, useAiQuota } from '../../pro/quota'
import { hasFeature } from '../../pro/store'
import { useHealth } from '../../state/health'
import { openPaywall } from '../pro/paywall'
import { describeView, peopleSummary, type DescribeView } from './describeView'
import { NEW_SPLIT_PATH } from './homeLinks'
import styles from './AiDescribeSheet.module.css'

export interface AiDescribeSheetProps {
  open: boolean
  onClose: () => void
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'reading'; text: string }
  | { kind: 'draft'; text: string; draft: DescribedSplit }
  | { kind: 'error'; text: string; error: DescribeError }

/** Failures worth simply trying again (the text itself was fine). */
const RETRYABLE: ReadonlySet<DescribeErrorCode> = new Set(['timeout', 'upstream_error', 'network', 'rate_limited'])


/** Examples offered as one-tap chips (the field's placeholder cycles through all of them). */
const CHIP_EXAMPLES = DESCRIBE_EXAMPLES.slice(0, 3)

function quotaLine(remaining: number): string {
  if (remaining <= 0) return `You’ve used today’s ${FREE_AI_PER_DAY} free AI splits`
  return `${remaining} of ${FREE_AI_PER_DAY} free AI splits left today`
}

/**
 * "Just say it": type an expense the way you'd text a friend ("Cab 840 with Riya and Sam, Sam
 * pays double"), the AI turns it into a draft, and a confirm card shows exactly how it would split
 * — title, amount, who paid, everyone's share. "Looks right" opens the split screen filled in
 * (new names become people then, not before). Free users get `FREE_AI_PER_DAY` a day; at zero
 * the Pro paywall offers unlimited, and carries on reading once unlocked.
 */
export function AiDescribeSheet({ open, onClose }: AiDescribeSheetProps) {
  const profile = useProfile()
  const friends = useFriends()
  const quota = useAiQuota()
  const health = useHealth()
  const inputRef = useRef<HTMLInputElement>(null)
  const request = useRef<AbortController | null>(null)
  const [text, setText] = useState('')
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [wasOpen, setWasOpen] = useState(open)

  // Closing cancels a read in flight; reopening keeps the text and any draft for that text.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (!open && phase.kind === 'reading') setPhase({ kind: 'idle' })
  }

  // Leaving (or closing the sheet) cancels a read in flight.
  useEffect(() => {
    if (!open) return
    return () => {
      request.current?.abort()
      request.current = null
    }
  }, [open])

  const aiOff = health !== 'loading' && health !== null && !health.configured
  const busy = phase.kind === 'reading'
  const view = useMemo<DescribeView | null>(
    () => (phase.kind === 'draft' ? describeView(phase.draft, { friends, meId: ME_ID, currency: profile.currency }) : null),
    [phase, friends, profile.currency],
  )

  const close = (): void => {
    request.current?.abort()
    request.current = null
    onClose()
  }

  const read = async (value: string): Promise<void> => {
    const clean = value.trim()
    if (!clean || aiOff) return
    // Read fresh, not from this render: after unlocking Pro from the paywall this runs again.
    if (!quotaFor(aiUsedToday(), hasFeature('unlimited_ai')).canUse) {
      haptic('warning')
      openPaywall('unlimited_ai', { onUnlock: () => void read(clean) })
      return
    }
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setPhase({ kind: 'reading', text: clean })
    try {
      const people = friends.filter((f) => f.id !== ME_ID).map((f) => f.name)
      const draft = await describeSplit(clean, { currency: profile.currency, people, today: today() }, controller.signal)
      if (controller.signal.aborted) return
      quota.consume()
      haptic('success')
      setPhase({ kind: 'draft', text: clean, draft })
    } catch (error) {
      if (controller.signal.aborted) return
      const failure = error instanceof DescribeError ? error : new DescribeError('upstream_error')
      if (failure.code === 'aborted') return
      haptic('error')
      setPhase({ kind: 'error', text: clean, error: failure })
    } finally {
      if (request.current === controller) request.current = null
    }
  }

  const edit = (value: string): void => {
    setText(value)
    // A changed sentence is a new request: the old answer no longer applies.
    if (phase.kind === 'draft' || phase.kind === 'error') setPhase({ kind: 'idle' })
  }

  const useDraft = (): void => {
    if (phase.kind !== 'draft') return
    const prefill = describedToPrefill(phase.draft, {
      friends,
      meId: ME_ID,
      currency: profile.currency,
      addFriend: (name) => addFriend({ name }),
    })
    setSplitPrefill(prefill)
    haptic('tap')
    close()
    navigate(`${NEW_SPLIT_PATH}?from=describe`)
  }

  const byHand = (): void => {
    close()
    navigate(NEW_SPLIT_PATH)
  }

  const rewrite = (): void => {
    setPhase({ kind: 'idle' })
    inputRef.current?.focus()
  }

  const limited = Number.isFinite(quota.limit)

  return (
    <BottomSheet
      open={open}
      onClose={close}
      title="Just say it"
      description="Type it like you’d text a friend — Settle sets up the split."
      initialFocus={inputRef}
      footer={
        view ? (
          <div className={styles.actions}>
            <Button block onClick={useDraft} iconEnd={<ArrowRight strokeWidth={2.5} />}>
              Looks right
            </Button>
            <Button block variant="ghost" onClick={rewrite} iconStart={<PenLine />}>
              Change what I said
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className={styles.body}>
        <SearchPill
          placeholder="Dinner 2400 with Riya and Sam"
          label="Describe the expense"
          submitLabel="Read it"
          examples={DESCRIBE_EXAMPLES}
          value={text}
          onChange={edit}
          onSubmit={(value) => void read(value)}
          busy={busy}
          disabled={aiOff}
          inputRef={inputRef}
          className={styles.pill}
        />

        {aiOff ? (
          <Banner tone="info" title="The AI helper is off right now" action={{ label: 'Split it by hand', onAction: byHand }}>
            You can still split anything by hand — it only takes a moment.
          </Banner>
        ) : (
          <QuotaLine limited={limited} remaining={quota.remaining} onUpgrade={() => openPaywall('unlimited_ai')} />
        )}

        <p className="visually-hidden" aria-live="polite">
          {view ? announce(view) : ''}
        </p>

        <div className={styles.status}>
          {phase.kind === 'reading' && <Reading />}
          {phase.kind === 'error' && (
            <Banner
              tone={phase.error.code === 'not_a_split' || phase.error.code === 'bad_request' ? 'warning' : 'error'}
              title={RETRYABLE.has(phase.error.code) ? 'Couldn’t read that' : 'Let’s try that again'}
              actions={
                <div className={styles.errorActions}>
                  {RETRYABLE.has(phase.error.code) && (
                    <Button size="sm" variant="secondary" iconStart={<RotateCcw />} onClick={() => void read(phase.text)}>
                      Try again
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={byHand}>
                    Split it by hand
                  </Button>
                </div>
              }
            >
              {phase.error.message}
            </Banner>
          )}
          {view && <DraftCard view={view} />}
        </div>

        {phase.kind === 'idle' && text.trim() === '' && !aiOff && (
          <div className={styles.examples}>
            <p className={styles.examplesLabel}>Try one</p>
            <ul role="list" className={styles.exampleList}>
              {CHIP_EXAMPLES.map((example) => (
                <li key={example}>
                  <Chip
                    leading={<Sparkles />}
                    onClick={() => {
                      edit(example)
                      inputRef.current?.focus()
                    }}
                  >
                    {example}
                  </Chip>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </BottomSheet>
  )
}

/** What a screen reader hears when the draft appears. */
function announce(view: DescribeView): string {
  const people = view.people.length > 0 || view.missing > 0 ? `, ${peopleSummary(view.people, view.missing)}` : ''
  return `Here’s the split: ${view.title}${people}. ${view.modeLabel}, paid by ${view.payerName}.`
}

function QuotaLine({ limited, remaining, onUpgrade }: { limited: boolean; remaining: number; onUpgrade: () => void }) {
  if (!limited) {
    return (
      <p className={styles.quota}>
        <Badge tone="pro">Pro</Badge>
        <span>Unlimited AI splits</span>
      </p>
    )
  }
  return (
    <p className={cx(styles.quota, remaining <= 0 && styles.quotaOut)}>
      <span>{quotaLine(remaining)}</span>
      <button type="button" className={styles.quotaLink} onClick={onUpgrade}>
        {remaining <= 0 ? 'Get unlimited' : 'Go unlimited'}
      </button>
    </p>
  )
}

function Reading() {
  return (
    <div className={styles.reading} role="status">
      <div className={styles.readingTop} aria-hidden="true">
        <Skeleton shape="md" width={44} height={44} />
        <div className={styles.readingLines}>
          <Skeleton width="55%" />
          <Skeleton width="35%" />
        </div>
      </div>
      <Skeleton shape="md" width="45%" height={36} className={styles.readingAmount} />
      <p className={styles.readingText}>
        <Sparkles aria-hidden="true" className={styles.readingSpark} />
        Reading your split…
      </p>
    </div>
  )
}

function DraftCard({ view }: { view: DescribeView }) {
  const titleId = useId()
  const date = view.date ? relativeDateLabel(view.date) : 'Today'
  return (
    <article className={styles.card} aria-labelledby={titleId}>
      <header className={styles.cardTop}>
        <CategoryIcon category={view.category} size="md" />
        <div className={styles.cardHeading}>
          <h3 id={titleId} className={styles.cardTitle}>
            {view.title}
          </h3>
          <p className={styles.cardMeta}>{date}</p>
        </div>
      </header>

      <div className={styles.amountBlock}>
        {view.total !== null ? (
          <Money value={view.total} currency={view.currency} size="xl" trimZeros strong className={styles.amount} />
        ) : (
          <p className={styles.noAmount}>Add the amount on the next screen</p>
        )}
        <p className={styles.howLine}>
          Paid by {view.payerName} · {view.modeLabel}
        </p>
      </div>

      {view.people.length > 0 ? (
        <ul role="list" className={styles.people} aria-label="Who’s in">
          {view.people.map((person) => (
            <li key={person.id} className={styles.person}>
              <Avatar name={person.avatarName} color={person.color} size="sm" />
              <span className={styles.personName}>
                {person.name}
                {person.isNew && (
                  <Badge tone="accent" className={styles.newBadge}>
                    New
                  </Badge>
                )}
              </span>
              <span className={styles.personShare}>
                {person.detail && <span className={styles.personDetail}>{person.detail}</span>}
                {person.share !== null && <Money value={person.share} currency={view.currency} trimZeros strong />}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <p className={styles.cardNote}>
        {view.missing > 0
          ? `${peopleSummary(view.people, view.missing)} — pick the other ${view.missing} on the next screen.`
          : view.people.length === 0
            ? peopleSummary(view.people, 0)
            : !view.addsUp
              ? 'The amounts don’t add up to the total yet — you can fix that on the next screen.'
              : view.people.some((p) => p.isNew)
                ? 'New names are added to your people when you continue.'
                : 'Nothing is saved until you tap Save.'}
      </p>
    </article>
  )
}
