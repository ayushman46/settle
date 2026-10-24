import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { goBack, useSearchParams } from '../../app/router'
import { Button, PageTitle, Screen, TopBar, useToast } from '../../components'
import { expensesStore, groupsStore } from '../../data/stores'
import { useExpenses, useFriends, useGroups, useProfile } from '../../data'
import { friendBalance, netIn, settleWithFriend } from '../friends/friendBalance'
import { today } from '../../engine/dates'
import { useT, type MessageKey } from '../../i18n'
import { prepareImage, ImageError, isImageFile, type PreparedImage } from '../../lib/image'
import { formatMoney } from '../../lib/money'
import { readSharedPayload } from '../../lib/sharedPayload'
import { CURRENCY, owedList } from './owed'
import { forgetReference, proofLedgerStore, rememberReference } from './proofLedger'
import { matchProof, AMOUNT_TOLERANCE, type Owed, type ProofVerdict } from './proofMatch'
import { readPaymentScreenshot } from './readScreenshot'
import type { ProofResponse } from '../../../shared/api'
import type { Friend } from '../../domain/types'
import styles from './ProofScreen.module.css'

type Phase =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'error'; code: string }
  | { kind: 'verdict'; proof: Omit<ProofResponse, 'model'>; verdict: ProofVerdict }
  | { kind: 'marked'; name: string; amount: number }

/** The friendly copy for each way reading a screenshot can fail. */
const FAILURE_KEYS: Readonly<Record<string, MessageKey>> = {
  not_a_payment: 'proof.error.not_a_payment',
  unsupported_image: 'proof.error.unsupported_image',
  image_too_large: 'proof.error.image_too_large',
  rate_limited: 'proof.error.rate_limited',
  timeout: 'proof.error.timeout',
  unreadable: 'proof.error.unreadable',
  not_configured: 'proof.error.not_configured',
  upstream_auth: 'proof.error.not_configured',
  network: 'proof.error.network',
}

/**
 * `/app/proof`: "Paid? Drop the screenshot". Reads a UPI payment screenshot, says whether it is a
 * finished payment to me, and offers to mark the one person who owes exactly that as paid.
 * Refusals say why; an ambiguous match is for the person to pick, never a guess.
 */
export function ProofScreen() {
  const t = useT()
  const toast = useToast()
  const params = useSearchParams()
  const profile = useProfile()
  const friends = useFriends()
  const expenses = useExpenses()
  const groups = useGroups()
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [shared, setShared] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const controller = useRef<AbortController | null>(null)
  const owed: Owed[] = useMemo(() => owedList(friends, expenses, groups), [friends, expenses, groups])

  useEffect(() => () => controller.current?.abort(), [])

  /** Reads a screenshot file and says what it means for Settle. */
  const read = useCallback(
    async (file: File) => {
      controller.current?.abort()
      const next = new AbortController()
      controller.current = next
      if (!isImageFile(file)) return setPhase({ kind: 'error', code: 'unsupported_image' })
      setPhase({ kind: 'reading' })
      let prepared: PreparedImage
      try {
        prepared = await prepareImage(file)
      } catch (error) {
        const code = error instanceof ImageError && error.code === 'too_large' ? 'image_too_large' : 'unsupported_image'
        return setPhase({ kind: 'error', code })
      }
      try {
        const result = await readPaymentScreenshot(prepared.dataUrl, next.signal)
        if (next.signal.aborted) return
        if (!result.ok) {
          if (result.code === 'aborted') return
          return setPhase({ kind: 'error', code: result.code })
        }
        const verdict = matchProof(result.proof, { owed, me: { name: profile.name, upiId: profile.upiId }, ledger: proofLedgerStore.get() })
        setPhase({ kind: 'verdict', proof: result.proof, verdict })
      } finally {
        URL.revokeObjectURL(prepared.previewUrl)
      }
    },
    [owed, profile.name, profile.upiId],
  )

  // Opened from a screenshot shared into Settle (the service worker keeps it under ?k=<id>).
  const latestRead = useRef(read)
  useEffect(() => {
    latestRead.current = read
  })
  const shareId = params.get('k')
  useEffect(() => {
    if (!shareId) return
    let alive = true
    void (async () => {
      const payload = await readSharedPayload(shareId)
      if (!alive) return
      const image = payload?.files.find((file) => file.type.startsWith('image/'))
      if (!image) return setPhase({ kind: 'error', code: 'unsupported_image' })
      setShared(true)
      void latestRead.current(image)
    })()
    return () => {
      alive = false
    }
  }, [shareId])

  /** Marks what the verdict (or the person picked) says: settles the balance and remembers the reference. */
  const markPaid = (target: { friendId: string; name: string; utr: string | null }, proof: Omit<ProofResponse, 'model'>) => {
    const balance = friendBalance(target.friendId, expensesStore.get(), groupsStore.get(), CURRENCY)
    const amount = netIn(balance, CURRENCY)
    if (amount <= 0) return setPhase({ kind: 'error', code: 'nothing_owed' })
    const undo = settleWithFriend(target.friendId, balance.sources, { method: 'upi', date: proof.date ?? today() })
    if (target.utr) rememberReference({ utr: target.utr, friendId: target.friendId, amount, at: Date.now() })
    const money = formatMoney(amount, CURRENCY, { trimZeros: true })
    toast(t('proof.match.done', { name: target.name, amount: money }), {
      tone: 'success',
      action: {
        label: t('common.action.undo'),
        onAction: () => {
          undo()
          if (target.utr) forgetReference(target.utr)
        },
      },
    })
    setPhase({ kind: 'marked', name: target.name, amount })
  }

  const again = () => {
    setPhase({ kind: 'idle' })
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <Screen header={<TopBar onBack={() => goBack('/app')} />} contentClassName={styles.content}>
      <PageTitle title={t('proof.screen.title')} subtitle={t('proof.screen.subtitle')} />

      {shared && <p className={styles.note}>{t('proof.shared.note')}</p>}

      {(phase.kind === 'idle' || phase.kind === 'error') && (
        <section className={styles.drop} aria-live="polite">
          {phase.kind === 'error' && <p className={styles.error}>{t(FAILURE_KEYS[phase.code] ?? 'proof.error.generic')}</p>}
          <Button block onClick={() => inputRef.current?.click()}>
            {t('proof.drop.choose')}
          </Button>
          <p className={styles.hint}>{t('proof.drop.hint')}</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            aria-label={t('proof.drop.aria')}
            onChange={(e) => {
              const file = e.currentTarget.files?.[0]
              if (file) void read(file)
            }}
          />
        </section>
      )}

      {phase.kind === 'reading' && (
        <section className={styles.card} role="status" aria-live="polite">
          <p className={styles.cardTitle}>{t('proof.reading.title')}</p>
          <Button variant="ghost" onClick={() => controller.current?.abort()}>
            {t('proof.reading.cancel')}
          </Button>
        </section>
      )}

      {phase.kind === 'verdict' && (
        <Verdict
          proof={phase.proof}
          verdict={phase.verdict}
          names={friends}
          onMark={(target) => markPaid(target, phase.proof)}
          onAgain={again}
        />
      )}

      {phase.kind === 'marked' && (
        <section className={styles.card} aria-live="polite">
          <p className={styles.cardTitle}>{t('proof.match.done', { name: phase.name, amount: formatMoney(phase.amount, CURRENCY, { trimZeros: true }) })}</p>
          <Button variant="secondary" block onClick={again}>
            {t('proof.again')}
          </Button>
        </section>
      )}
    </Screen>
  )
}

function Verdict({
  proof,
  verdict,
  names,
  onMark,
  onAgain,
}: {
  proof: Omit<ProofResponse, 'model'>
  verdict: ProofVerdict
  /** Everyone in the friends list: a duplicate names its person even once they're square. */
  names: readonly Friend[]
  onMark: (target: { friendId: string; name: string; utr: string | null }) => void
  onAgain: () => void
}) {
  const t = useT()
  const refLine = (utr: string | null) => (utr ? t('proof.match.ref', { utr }) : t('proof.match.noRef'))

  switch (verdict.kind) {
    case 'match': {
      const money = formatMoney(verdict.amount, CURRENCY, { trimZeros: true })
      return (
        <section className={styles.card} aria-live="polite">
          <p className={styles.cardTitle}>{t('proof.match.title', { name: verdict.name, amount: money })}</p>
          <p className={styles.cardText}>{refLine(verdict.utr)}</p>
          <div className={styles.actions}>
            <Button block onClick={() => onMark({ friendId: verdict.friendId, name: verdict.name, utr: verdict.utr })}>
              {t('proof.match.confirm')}
            </Button>
            <Button variant="ghost" block onClick={onAgain}>
              {t('proof.match.notThis')}
            </Button>
          </div>
        </section>
      )
    }
    case 'no_match': {
      // Only people who owe exactly this amount (within ₹1) can be picked; with no amount on the screen, anyone who owes.
      const pickable =
        verdict.amount === null ? verdict.candidates : verdict.candidates.filter((o) => verdict.amount !== null && Math.abs(o.amount - verdict.amount) <= AMOUNT_TOLERANCE)
      const hint =
        verdict.amount === null
          ? t('proof.nomatch.noAmount')
          : pickable.length > 0
            ? t('proof.nomatch.amount', { amount: formatMoney(verdict.amount, CURRENCY, { trimZeros: true }) })
            : t('proof.nomatch.none', { amount: formatMoney(verdict.amount, CURRENCY, { trimZeros: true }) })
      return (
        <section className={styles.card} aria-live="polite">
          <p className={styles.cardTitle}>{t('proof.nomatch.title')}</p>
          <p className={styles.cardText}>{hint}</p>
          <div className={styles.actions}>
            {pickable.map((o) => (
              <Button key={o.friendId} variant="secondary" block onClick={() => onMark({ friendId: o.friendId, name: o.name, utr: proof.utr })}>
                {t('proof.nomatch.pick', { name: o.name, amount: formatMoney(o.amount, CURRENCY, { trimZeros: true }) })}
              </Button>
            ))}
            <Button variant="ghost" block onClick={onAgain}>
              {t('proof.again')}
            </Button>
          </div>
        </section>
      )
    }
    case 'duplicate':
      return (
        <Refusal title={t('proof.verdict.duplicate.title')} body={t('proof.verdict.duplicate.body', { utr: verdict.utr, name: duplicateName(verdict.friendId) })} onAgain={onAgain} t={t} />
      )
    case 'wrong_payee':
      return (
        <Refusal
          title={t('proof.verdict.wrongPayee.title')}
          body={t('proof.verdict.wrongPayee.body', { payee: verdict.payeeName ?? verdict.payeeUpi ?? '' })}
          onAgain={onAgain}
          t={t}
        />
      )
    case 'pending':
      return <Refusal title={t('proof.verdict.pending.title')} body={t('proof.verdict.pending.body')} onAgain={onAgain} t={t} />
    case 'failed':
      return <Refusal title={t('proof.verdict.failed.title')} body={t('proof.verdict.failed.body')} onAgain={onAgain} t={t} />
    case 'payee_unknown':
      return <Refusal title={t('proof.verdict.payeeUnknown.title')} body={t('proof.verdict.payeeUnknown.body')} onAgain={onAgain} t={t} />
    case 'unreadable':
      return <Refusal title={t('proof.verdict.unreadable.title')} body={t('proof.verdict.unreadable.body')} onAgain={onAgain} t={t} />
  }

  function duplicateName(friendId: string | null): string {
    const name = friendId === null ? null : names.find((f) => f.id === friendId)?.name
    return name ?? t('proof.verdict.duplicate.someone')
  }
}

function Refusal({ title, body, onAgain, t }: { title: string; body: string; onAgain: () => void; t: (key: MessageKey) => string }) {
  return (
    <section className={styles.card} aria-live="polite">
      <p className={styles.cardTitle}>{title}</p>
      <p className={styles.cardText}>{body}</p>
      <Button variant="secondary" block onClick={onAgain}>
        {t('proof.again')}
      </Button>
    </section>
  )
}
