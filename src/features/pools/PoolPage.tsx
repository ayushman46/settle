import { useEffect, useId, useRef, useState } from 'react'
import { Check, Copy, MessageCircle, Share2 } from 'lucide-react'
import { useLocation } from '../../app/router'
import { AmountInput, Button, Chip, Skeleton, TextField } from '../../components'
import { BRAND } from '../../domain/types'
import { suggestedContribution } from '../../engine/pools'
import { today } from '../../engine/dates'
import { useT } from '../../i18n'
import { avatarColorIndex } from '../../components/helpers'
import { haptic } from '../../lib/haptics'
import { formatMoney, parseMoneyInput, toInputString } from '../../lib/money'
import { copyText, shareResult } from '../../lib/share'
import { usePageMeta } from '../landing/pageMeta'
import { PublicProblem, PublicShell } from '../pay/PublicShell'
import { UpiPayBlock } from '../pay/UpiPayBlock'
import { whatsappUrl } from '../../share/links'
import { decodePoolLink, encodePoolReply, poolLinkGoal, poolLinkPeopleLeft, signPoolReply, type PoolLinkPayload } from '../../share/pool'
import { poolTellText, shortDay } from '../../share/poolNudge'
import { cleanText, hashString } from '../../share/text'
import { POOLS_ENABLED } from './enabled'
import { occasionChips } from './poolTemplates'
import styles from './PoolPage.module.css'

type LinkState = { status: 'empty' } | { status: 'loading' } | { status: 'invalid' } | { status: 'ok'; fragment: string; payload: PoolLinkPayload }

function usePoolLinkPayload(hash: string): LinkState {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash
  const [decoded, setDecoded] = useState<{ fragment: string; payload: PoolLinkPayload | null } | null>(null)
  useEffect(() => {
    if (!fragment) return
    let live = true
    void decodePoolLink(fragment).then((payload) => {
      if (live) setDecoded({ fragment, payload })
    })
    return () => {
      live = false
    }
  }, [fragment])
  if (!fragment) return { status: 'empty' }
  if (!decoded || decoded.fragment !== fragment) return { status: 'loading' }
  return decoded.payload ? { status: 'ok', fragment, payload: decoded.payload } : { status: 'invalid' }
}

/**
 * `/pool#…` — what a friend sees when they open a collection link: who's collecting and for what,
 * the goal as of the link, "Which one are you?", their part (or a suggestion), UPI pay-in, and
 * "Tell Ayush" — a signed reply that ticks them off in one tap. Nothing is read from or written to
 * this device's app data.
 */
export function PoolPage() {
  const t = useT()
  const { hash } = useLocation()
  const link = usePoolLinkPayload(POOLS_ENABLED ? hash : '')
  usePageMeta({
    title: link.status === 'ok' ? `${t('pools.page.meta.title', { title: link.payload.t })} · ${BRAND.name}` : `${t('pools.page.meta.fallback')} · ${BRAND.name}`,
    description: t('pools.page.meta.description'),
    robots: 'noindex',
  })
  return (
    <PublicShell>
      {link.status === 'loading' && (
        <div className={styles.loading}>
          <p role="status" className="visually-hidden">
            {t('pools.page.loading')}
          </p>
          <Skeleton shape="md" width={64} height={64} />
          <Skeleton width="50%" height={16} />
          <Skeleton width="70%" height={28} />
        </div>
      )}
      {link.status === 'empty' && <PublicProblem title={t('pools.page.empty.title')} text={t('pools.page.empty.text')} />}
      {link.status === 'invalid' && <PublicProblem title={t('pools.page.invalid.title')} text={t('pools.page.invalid.text')} />}
      {link.status === 'ok' && <Collection key={link.fragment} payload={link.payload} />}
    </PublicShell>
  )
}

function updatedLabel(at: number): string {
  if (!at) return ''
  try {
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(at * 1000))
  } catch {
    return ''
  }
}

/** The person picked: an index into `p`, or a typed name ("I'm not on the list"). */
type Who = { kind: 'listed'; index: number } | { kind: 'typed' } | null

function Collection({ payload }: { payload: PoolLinkPayload }) {
  const t = useT()
  const ids = { who: useId(), amount: useId() }
  const money = (minor: number) => formatMoney(minor, payload.c, { trimZeros: true })
  const goal = poolLinkGoal(payload)
  const day = today()
  const ended = payload.dl !== undefined && payload.dl < day
  const fraction = goal ? Math.min(1, payload.col / goal) : 0
  const organiser = payload.to.n
  const inr = payload.c === 'INR'

  const [who, setWho] = useState<Who>(payload.p.length === 0 ? { kind: 'typed' } : null)
  const [typedName, setTypedName] = useState('')
  const picked = who?.kind === 'listed' ? payload.p[who.index] : null
  const name = who?.kind === 'listed' ? (picked?.n ?? '') : cleanText(typedName, 24)

  // Amount: fixed → your part (or a different amount); target → a chip or "Other".
  const suggestion = payload.m === 'target' ? suggestedContribution(goal, payload.col, poolLinkPeopleLeft(payload), payload.c) : null
  const chips = [...new Set([...(suggestion !== null ? [suggestion] : []), ...occasionChips(payload.o, payload.c)])]
  const [chip, setChip] = useState<number | 'other' | null>(payload.m === 'target' ? (chips[0] ?? 'other') : null)
  const [different, setDifferent] = useState(false)
  const [otherText, setOtherText] = useState('')
  const typed = parseMoneyInput(otherText, payload.c)
  // Any amount from ₹1 (shagun and puja amounts are never rounded).
  const minimum = payload.c === 'INR' ? 100 : 1
  const typedOk = typed !== null && typed >= minimum ? typed : null
  const amount: number | null =
    payload.m === 'fixed' && !different ? (payload.pp ?? null) : payload.m === 'target' && typeof chip === 'number' ? chip : typedOk

  // After paying in a UPI app and coming back, ask whether it went through.
  const [paying, setPaying] = useState(false)
  const [asked, setAsked] = useState<'ask' | 'yes' | 'no' | null>(null)
  const [paidCheck, setPaidCheck] = useState(false)
  useEffect(() => {
    if (!paying) return
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') setAsked((current) => current ?? 'ask')
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [paying])

  // The signed reply link, re-made when the name or amount changes.
  const [reply, setReply] = useState<{ key: string; url: string } | null>(null)
  const replyKey = `${who?.kind === 'listed' ? who.index : ''}|${name}|${amount ?? ''}`
  useEffect(() => {
    if (!name || amount === null || amount <= 0) return
    let live = true
    const signed = signPoolReply(payload.s, {
      v: 1,
      k: 'chip',
      id: payload.id,
      w: who?.kind === 'listed' ? who.index : null,
      n: name,
      a: amount,
      at: Math.floor(Date.now() / 1000),
    })
    void encodePoolReply(signed).then((url) => {
      if (live) setReply({ key: replyKey, url })
    })
    return () => {
      live = false
    }
    // replyKey covers who, name and amount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replyKey])
  const replyUrl = reply?.key === replyKey ? reply.url : null
  const tellText = replyUrl && amount !== null ? poolTellText({ amount, currency: payload.c, title: payload.t, emoji: payload.e, name, link: replyUrl }) : ''
  const [told, setTold] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  const already = picked?.ok === 1
  const [payAgain, setPayAgain] = useState(false)
  const showPay = name !== '' && (!already || payAgain)

  const pickListed = (index: number): void => {
    haptic('select')
    setWho({ kind: 'listed', index })
    setTold(false)
    setAsked(null)
    setPayAgain(false)
  }

  const tellDone = (): void => {
    haptic('success')
    setTold(true)
  }

  return (
    <>
      <section className={styles.card} aria-labelledby="pool-title">
        <span className={styles.emoji} aria-hidden="true">
          {payload.e}
        </span>
        <h1 id="pool-title" className={styles.title}>
          <span className={styles.by}>{t('pools.page.collecting', { name: organiser })}</span> <span className={styles.what}>{payload.t}</span>
        </h1>
        {payload.no && <p className={styles.note}>“{payload.no}”</p>}
        {payload.dl && (
          <p className={ended ? styles.ended : styles.deadline}>
            {ended ? t('pools.page.ended', { date: shortDay(payload.dl) }) : t('pools.page.by', { date: shortDay(payload.dl) })}
          </p>
        )}
        <div className={styles.progress}>
          {goal !== null && (
            <div className={styles.bar} role="progressbar" aria-label={t('pools.progress.label')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction * 100)}>
              <span className={styles.fill} style={{ width: `${fraction * 100}%` }} />
            </div>
          )}
          <p className={styles.progressText}>
            {payload.col <= 0
              ? t('pools.page.progress.none')
              : goal !== null
                ? t('pools.page.progress.goal', { collected: money(payload.col), goal: money(goal), count: payload.cnt })
                : t('pools.page.progress.some', { collected: money(payload.col), count: payload.cnt })}
          </p>
          {payload.at > 0 && <p className={styles.updated}>{t('pools.page.updated', { when: updatedLabel(payload.at) })}</p>}
        </div>
      </section>

      {who === null ? (
        <section className={styles.section} aria-labelledby={ids.who}>
          <h2 id={ids.who} className={styles.heading}>
            {t('pools.page.who')}
          </h2>
          <ul role="list" className={styles.names}>
            {payload.p.map((person, index) => (
              <li key={index}>
                <button type="button" className={styles.name} onClick={() => pickListed(index)}>
                  <span className={styles.nameText}>{person.n}</span>
                  {person.ok === 1 && (
                    <span className={styles.chipped}>
                      <Check aria-hidden="true" />
                      {person.a !== undefined ? t('pools.page.chippedInAmount', { amount: money(person.a) }) : t('pools.page.chippedIn')}
                    </span>
                  )}
                </button>
              </li>
            ))}
            {payload.more !== undefined && <li className={styles.more}>{t('pools.page.more', { count: payload.more })}</li>}
            <li>
              <button
                type="button"
                className={styles.name}
                onClick={() => {
                  setWho({ kind: 'typed' })
                  requestAnimationFrame(() => nameRef.current?.focus())
                }}
              >
                <span className={styles.nameText}>{t('pools.page.notOnList')}</span>
              </button>
            </li>
          </ul>
        </section>
      ) : (
        <section className={styles.section} aria-labelledby={ids.amount}>
          {who.kind === 'listed' ? (
            <div className={styles.picked}>
              <h2 id={ids.amount} className={styles.heading}>
                {picked?.n}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setWho(null)}>
                {t('pools.page.notYou')}
              </Button>
            </div>
          ) : (
            <>
              <h2 id={ids.amount} className="visually-hidden">
                {t('pools.page.yourName')}
              </h2>
              <TextField
                ref={nameRef}
                label={t('pools.page.yourName')}
                value={typedName}
                maxLength={40}
                autoCapitalize="words"
                autoComplete="name"
                onChange={(event) => setTypedName(event.target.value)}
              />
              {payload.p.length > 0 && (
                <Button variant="ghost" size="sm" className={styles.back} onClick={() => setWho(null)}>
                  {t('pools.page.who')}
                </Button>
              )}
            </>
          )}

          {already && !payAgain ? (
            <div className={styles.done}>
              <p className={styles.doneTitle}>{t('pools.page.already')}</p>
              <Button variant="ghost" size="sm" aria-expanded={false} onClick={() => setPayAgain(true)}>
                {t('pools.page.payAgain')}
              </Button>
            </div>
          ) : (
            <AmountPicker
              payload={payload}
              chips={chips}
              suggestion={suggestion}
              chip={chip}
              onChip={setChip}
              different={different}
              onDifferent={setDifferent}
              otherText={otherText}
              onOtherText={setOtherText}
              typed={typed}
            />
          )}
        </section>
      )}

      {showPay && amount !== null && amount > 0 && (
        <section className={styles.section} aria-label={t('pools.page.tell', { name: organiser })}>
          <div onClickCapture={(event) => {
            const target = event.target as HTMLElement | null
            if (target?.closest('a[href^="upi:"]')) setPaying(true)
          }}>
            {!inr ? (
              <div className={styles.usual}>
                <p className={styles.usualTitle}>{t('pools.page.payUsual')}</p>
                <p className={styles.usualText}>{t('pools.page.payUsual.text', { name: organiser })}</p>
              </div>
            ) : !payload.to.u ? (
              <div className={styles.usual}>
                <p className={styles.usualTitle}>{t('pools.page.noUpi', { name: organiser })}</p>
                <p className={styles.usualText}>{t('pools.page.noUpi.text')}</p>
              </div>
            ) : (
              <UpiPayBlock
                payeeName={organiser}
                vpa={payload.to.u}
                amount={amount}
                note={t('pools.page.upiNote', { title: payload.t })}
                currency={payload.c}
                color={avatarColorIndex(hashString(organiser))}
              />
            )}
          </div>

          {asked === 'ask' && (
            <div className={styles.ask} role="group" aria-labelledby={`${ids.amount}-asked`}>
              <p id={`${ids.amount}-asked`} className={styles.askTitle}>
                {t('pools.page.asked', { amount: money(amount) })}
              </p>
              <div className={styles.askActions}>
                <Button
                  size="md"
                  onClick={() => {
                    setAsked('yes')
                    setPaidCheck(true)
                  }}
                >
                  {t('pools.page.askedYes')}
                </Button>
                <Button size="md" variant="secondary" onClick={() => setAsked('no')}>
                  {t('pools.page.askedNo')}
                </Button>
              </div>
            </div>
          )}
          <label className={styles.check}>
            <input type="checkbox" checked={paidCheck} onChange={(event) => setPaidCheck(event.target.checked)} />
            <span>{t('pools.page.paidCheck', { amount: money(amount) })}</span>
          </label>

          <div className={styles.tell}>
            <a
              className={styles.tellPrimary}
              href={tellText ? whatsappUrl(tellText, payload.to.ph) : undefined}
              aria-disabled={!tellText}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => {
                if (!tellText) {
                  event.preventDefault()
                  return
                }
                tellDone()
              }}
            >
              <MessageCircle aria-hidden="true" strokeWidth={2.25} />
              {t('pools.page.tell', { name: organiser })}
            </a>
            <div className={styles.tellMore}>
              <Button
                variant="secondary"
                size="md"
                iconStart={<Share2 />}
                disabled={!tellText}
                onClick={async () => {
                  const outcome = await shareResult(tellText)
                  if (outcome === 'shared' || outcome === 'copied') tellDone()
                }}
              >
                {t('pools.page.tellAnother')}
              </Button>
              <Button
                variant="secondary"
                size="md"
                iconStart={<Copy />}
                disabled={!tellText}
                onClick={async () => {
                  if (await copyText(tellText)) tellDone()
                }}
              >
                {t('pools.page.copy')}
              </Button>
            </div>
          </div>
          <p role="status" className={told ? styles.thanks : 'visually-hidden'}>
            {told ? t('pools.page.thanks', { name, organiser }) : ''}
          </p>
        </section>
      )}
    </>
  )
}

interface AmountPickerProps {
  payload: PoolLinkPayload
  chips: number[]
  suggestion: number | null
  chip: number | 'other' | null
  onChip: (chip: number | 'other') => void
  different: boolean
  onDifferent: (different: boolean) => void
  otherText: string
  onOtherText: (text: string) => void
  typed: number | null
}

function AmountPicker({ payload, chips, suggestion, chip, onChip, different, onDifferent, otherText, onOtherText, typed }: AmountPickerProps) {
  const t = useT()
  const money = (minor: number) => formatMoney(minor, payload.c, { trimZeros: true })
  const minimum = payload.c === 'INR' ? 100 : 1
  const tooSmall = typed !== null && typed < minimum
  const field = (
    <AmountInput
      size="field"
      label={t('pools.page.otherAmount')}
      currency={payload.c}
      value={otherText}
      onChange={onOtherText}
      error={tooSmall ? t('pools.page.minimum', { amount: money(minimum) }) : undefined}
      autoFocus
    />
  )
  if (payload.m === 'fixed' && payload.pp !== undefined) {
    return (
      <div className={styles.amount}>
        {!different ? (
          <>
            <p className={styles.partLabel}>{t('pools.page.yourPart')}</p>
            <p className={styles.part}>{money(payload.pp)}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onOtherText(toInputString(payload.pp ?? null, payload.c))
                onDifferent(true)
              }}
            >
              {t('pools.page.different')}
            </Button>
          </>
        ) : (
          <>
            {field}
            <Button variant="ghost" size="sm" onClick={() => onDifferent(false)}>
              {t('pools.page.useYourPart')}
            </Button>
          </>
        )}
      </div>
    )
  }
  return (
    <div className={styles.amount}>
      <div role="radiogroup" aria-label={t('pools.page.amount')} className={styles.chips}>
        {chips.map((value) => (
          <Chip key={value} role="radio" aria-checked={chip === value} selected={chip === value} onClick={() => onChip(value)}>
            {value === suggestion ? t('pools.page.suggested', { amount: money(value) }) : money(value)}
          </Chip>
        ))}
        <Chip role="radio" aria-checked={chip === 'other'} selected={chip === 'other'} onClick={() => onChip('other')}>
          {t('pools.page.other')}
        </Chip>
      </div>
      {chip === 'other' && field}
    </div>
  )
}
