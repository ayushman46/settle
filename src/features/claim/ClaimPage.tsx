import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, Check, Copy, MessageCircle, Send, Share2, UserRoundPlus } from 'lucide-react'
import { useLocation } from '../../app/router'
import { Avatar, Banner, Button, Skeleton, SuccessCheck, TextField } from '../../components'
import { BRAND } from '../../domain/types'
import { claimShare } from '../../engine/claims'
import { useT } from '../../i18n'
import { formatBillDate } from '../../lib/format'
import { haptic } from '../../lib/haptics'
import { graphemes } from '../../lib/people'
import { copyText, shareResult } from '../../lib/share'
import { isValidUpiId } from '../../lib/upi'
import { decodeClaimLink, encodeClaimReply, picksForLink, signReply, type ClaimLinkPayload } from '../../share/claim'
import { whatsappUrl } from '../../share/links'
import { cleanText } from '../../share/text'
import { usePageMeta } from '../landing/pageMeta'
import { PublicProblem, PublicShell } from '../pay/PublicShell'
import { UpiPayBlock } from '../pay/UpiPayBlock'
import { money, replyMessage } from './claimView'
import { ItemPicker, type PickerItem } from './ItemPicker'
import { choicesToPicks, type ItemChoice } from './picks'
import { ShareTotal } from './ShareTotal'
import { boardPortion } from './claimView'
import styles from './ClaimPage.module.css'

type LinkState = { status: 'empty' } | { status: 'loading' } | { status: 'invalid' } | { status: 'ok'; payload: ClaimLinkPayload }

/** What this device remembers for a round (`settle.claim.<roundId>`). */
interface Remembered {
  who: number | null
  name: string
  choices: Record<number, ItemChoice>
  nothing: boolean
  paid: boolean
}

const MEMORY_PREFIX = 'settle.claim.'

function recall(roundId: string): Remembered | null {
  try {
    const raw = window.localStorage.getItem(MEMORY_PREFIX + roundId)
    if (!raw) return null
    const data = JSON.parse(raw) as Partial<Remembered>
    if (typeof data !== 'object' || data === null) return null
    return {
      who: typeof data.who === 'number' && Number.isInteger(data.who) ? data.who : null,
      name: typeof data.name === 'string' ? data.name : '',
      choices: typeof data.choices === 'object' && data.choices !== null ? (data.choices as Record<number, ItemChoice>) : {},
      nothing: data.nothing === true,
      paid: data.paid === true,
    }
  } catch {
    return null
  }
}

function remember(roundId: string, value: Remembered): void {
  try {
    window.localStorage.setItem(MEMORY_PREFIX + roundId, JSON.stringify(value))
  } catch {
    // Storage blocked: picks just aren't remembered.
  }
}

function useClaimLink(hash: string): LinkState {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash
  const [decoded, setDecoded] = useState<{ fragment: string; payload: ClaimLinkPayload | null } | null>(null)
  useEffect(() => {
    if (!fragment) return
    let live = true
    void decodeClaimLink(fragment).then((payload) => {
      if (live) setDecoded({ fragment, payload })
    })
    return () => {
      live = false
    }
  }, [fragment])
  if (!fragment) return { status: 'empty' }
  if (!decoded || decoded.fragment !== fragment) return { status: 'loading' }
  return decoded.payload ? { status: 'ok', payload: decoded.payload } : { status: 'invalid' }
}

const NAME_MAX = 24

/** "Which one are you?" — the names on the link (not the organiser) and "I'm not on the list". */
function WhoPicker({ payload, onPick }: { payload: ClaimLinkPayload; onPick: (who: number | null, name: string) => void }) {
  const t = useT()
  const [typing, setTyping] = useState(false)
  const [name, setName] = useState('')
  const clean = cleanText(name, NAME_MAX)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!clean) return
    const match = payload.p.findIndex((p, i) => i > 0 && p.toLocaleLowerCase() === clean.toLocaleLowerCase())
    onPick(match > 0 ? match : null, match > 0 ? (payload.p[match] ?? clean) : clean)
  }
  return (
    <section className={styles.section} aria-labelledby="claim-who-title">
      <h2 id="claim-who-title" className={styles.h2}>
        {t('claim.page.whoTitle')}
      </h2>
      <ul className={styles.names} role="list">
        {payload.p.map((person, index) =>
          index === 0 ? null : (
            <li key={index}>
              <button
                type="button"
                className={styles.name}
                aria-pressed={false}
                onClick={() => {
                  haptic('tap')
                  onPick(index, person)
                }}
              >
                <Avatar name={person} color={index} size="md" />
                <span className={styles.nameText}>{person}</span>
                <ArrowRight aria-hidden="true" className={styles.chevron} strokeWidth={2.25} />
              </button>
            </li>
          ),
        )}
        <li>
          <button type="button" className={styles.name} aria-pressed={typing} aria-expanded={typing} onClick={() => setTyping((v) => !v)}>
            <span className={styles.addIcon} aria-hidden="true">
              <UserRoundPlus strokeWidth={2.25} />
            </span>
            <span className={styles.nameText}>{t('claim.page.notListed')}</span>
          </button>
        </li>
      </ul>
      {typing && (
        <form className={styles.typed} onSubmit={submit} noValidate>
          <TextField
            label={t('claim.page.yourName')}
            value={name}
            autoFocus
            autoComplete="given-name"
            onChange={(event) => {
              const next = event.target.value
              if (graphemes(next).length <= NAME_MAX) setName(next)
            }}
          />
          <Button type="submit" disabled={!clean} iconEnd={<ArrowRight />}>
            {t('claim.page.continue')}
          </Button>
        </form>
      )}
    </section>
  )
}

function ClaimRequest({ payload }: { payload: ClaimLinkPayload }) {
  const t = useT()
  const organiser = payload.to.n
  const [state, setState] = useState<Remembered>(() => recall(payload.r) ?? { who: null, name: '', choices: {}, nothing: false, paid: false })
  const [chosen, setChosen] = useState(() => state.name !== '')
  const [askPaid, setAskPaid] = useState(false)
  const [sent, setSent] = useState(false)
  const [replyUrl, setReplyUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const whatRef = useRef<HTMLHeadingElement>(null)
  const sentRef = useRef<HTMLHeadingElement>(null)
  const tappedUpi = useRef(false)
  const focusWhat = useRef(false)

  useEffect(() => {
    if (chosen) remember(payload.r, state)
  }, [payload.r, state, chosen])

  const quantities = useMemo(() => payload.it.map((it) => it.q), [payload.it])
  const fixedIdx = useMemo(() => new Set((payload.fix ?? []).map(([i]) => i)), [payload.fix])
  const picks = useMemo(
    () => (state.nothing ? [] : choicesToPicks(state.choices, quantities).filter((p) => !fixedIdx.has(p.item))),
    [state.nothing, state.choices, quantities, fixedIdx],
  )
  const items = useMemo(() => payload.it.map((it) => ({ name: it.n, amount: it.a, quantity: it.q ?? 1 })), [payload.it])
  const itemsTotal = items.reduce((s, it) => s + it.amount, 0)
  const fixed = useMemo(() => (payload.fix ?? []).map(([i, w]) => [i, w] as const), [payload.fix])
  const { share, itemsPart } = claimShare({ items, total: payload.tot, picks: state.nothing ? [] : picks, fixed, personIndex: state.who })
  const amount = money(share, payload.c)
  const upi = payload.c === 'INR' && payload.to.u && isValidUpiId(payload.to.u) ? payload.to.u : null
  const canSend = chosen && (state.nothing || picks.length > 0 || share > 0)

  const pickerItems: PickerItem[] = payload.it.map((it, index) => {
    const fix = payload.fix?.find(([i]) => i === index)
    if (!fix) return { name: it.n, amount: it.a, q: it.q }
    const own = state.who === null ? undefined : fix[1].find(([p]) => p === state.who)
    const sum = fix[1].reduce((s, [, w]) => s + w, 0)
    const yours = own && sum > 0 ? boardPortion({ n: BigInt(own[1]), d: BigInt(sum) }, 1) : null
    return { name: it.n, amount: it.a, q: it.q, fixed: { by: organiser, yours: yours === '1' ? t('claim.page.portionAll', { amount: money(it.a, payload.c) }) : yours } }
  })

  // The reply link follows every change (signing is synchronous; compressing isn't).
  const lines = picks.map((p) => ({ name: payload.it[p.item]?.n ?? '', quantity: payload.it[p.item]?.q ?? 1, pick: p }))
  const replyBody = useMemo(
    () => ({
      v: 1 as const,
      k: 'reply' as const,
      r: payload.r,
      h: payload.h,
      w: state.who,
      n: state.name,
      x: picksForLink(
        payload,
        picks.map((p) => [p.item, p.num, p.den] as [number, number, number]),
      ),
      ...(state.nothing ? { z: 1 as const } : {}),
      ...(state.paid && !state.nothing ? { pd: share } : {}),
    }),
    [payload, state.who, state.name, state.nothing, state.paid, picks, share],
  )
  useEffect(() => {
    if (!chosen) return
    let live = true
    const signed = signReply(payload.s, { ...replyBody, at: Math.floor(Date.now() / 1000) })
    void encodeClaimReply(signed).then((url) => {
      if (live) setReplyUrl(url)
    })
    return () => {
      live = false
    }
  }, [chosen, payload.s, replyBody])

  const message = replyUrl
    ? replyMessage({ name: state.name, title: payload.t, lines, nothing: state.nothing, share, currency: payload.c, paid: state.paid, link: replyUrl })
    : ''

  // Back from the UPI app: ask whether it went through.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && tappedUpi.current) {
        tappedUpi.current = false
        setAskPaid(true)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  useEffect(() => {
    if (chosen && focusWhat.current) {
      focusWhat.current = false
      whatRef.current?.focus()
    }
  }, [chosen])

  useEffect(() => {
    if (sent) sentRef.current?.focus()
  }, [sent])

  const update = (patch: Partial<Remembered>) => setState((s) => ({ ...s, ...patch }))
  const setChoice = (index: number, choice: ItemChoice) => setState((s) => ({ ...s, choices: { ...s.choices, [index]: choice } }))

  const meta = [money(payload.tot, payload.c), formatBillDate(payload.d), t('claim.page.itemCount', { n: payload.it.length })].filter(Boolean).join(' · ')

  if (sent) {
    return (
      <section className={styles.sent} aria-labelledby="claim-sent-title">
        <SuccessCheck size="lg" />
        <h1 id="claim-sent-title" ref={sentRef} tabIndex={-1} className={styles.sentTitle}>
          {t('claim.page.sentTitle')}
        </h1>
        <p className={styles.sentText}>{t('claim.page.sentText', { name: organiser })}</p>
        <Button variant="secondary" onClick={() => setSent(false)}>
          {t('claim.page.changePicks')}
        </Button>
      </section>
    )
  }

  return (
    <>
      <section className={styles.request} aria-labelledby="claim-title">
        <Avatar name={organiser} color={0} size="lg" />
        <p className={styles.by}>{t('claim.page.splitting', { name: organiser })}</p>
        <h1 id="claim-title" className={styles.title}>
          {payload.t}
        </h1>
        <p className={styles.meta}>{meta}</p>
        <p className={styles.lead}>{t('claim.page.lead')}</p>
      </section>

      {!chosen ? (
        <WhoPicker
          payload={payload}
          onPick={(who, name) => {
            focusWhat.current = true
            update({ who, name })
            setChosen(true)
          }}
        />
      ) : (
        <>
          <p className={styles.notYou}>
            {t('claim.page.notYou', { name: state.name })}{' '}
            <button type="button" className={styles.inlineLink} onClick={() => setChosen(false)}>
              {t('claim.page.change')}
            </button>
          </p>

          <section className={styles.section} aria-labelledby="claim-what-title">
            <h2 id="claim-what-title" ref={whatRef} tabIndex={-1} className={styles.h2}>
              {t('claim.page.whatTitle')}
            </h2>
            {state.nothing && <p className={styles.nothingNote}>{t('claim.page.hadNothingOn')}</p>}
            <ItemPicker items={pickerItems} currency={payload.c} choices={state.choices} onChange={setChoice} disabled={state.nothing} />
            <button type="button" className={styles.inlineLink} aria-pressed={state.nothing} onClick={() => update({ nothing: !state.nothing })}>
              {state.nothing ? t('claim.page.undoNothing') : t('claim.page.hadNothing')}
            </button>
          </section>

          {!state.nothing && (
            <ShareTotal share={share} itemsPart={itemsPart} currency={payload.c} unknown={itemsTotal === 0} organiser={organiser} />
          )}

          {!state.nothing && share > 0 && (
            <section className={styles.section} aria-labelledby="claim-pay-title">
              <h2 id="claim-pay-title" className={styles.h2}>
                {t('claim.page.payTitle', { name: organiser })}
              </h2>
              {payload.c !== 'INR' ? (
                <Banner tone="info" title={t('claim.page.usualWay')}>
                  {t('claim.page.usualWayText', { name: organiser, amount })}
                </Banner>
              ) : !upi ? (
                <Banner tone="info" title={t('claim.page.noUpi', { name: organiser })}>
                  {t('claim.page.noUpiText', { amount })}
                </Banner>
              ) : (
                <div
                  onClickCapture={(event) => {
                    const target = event.target as HTMLElement
                    if (target.closest('a[href^="upi:"]')) tappedUpi.current = true
                  }}
                >
                  <UpiPayBlock payeeName={organiser} vpa={upi} amount={share} note={payload.t} currency={payload.c} color={0} />
                </div>
              )}
              {askPaid && !state.paid && (
                <Banner
                  tone="info"
                  title={t('claim.page.paidAsk', { amount })}
                  actions={
                    <div className={styles.bannerActions}>
                      <Button
                        size="sm"
                        onClick={() => {
                          haptic('success')
                          update({ paid: true })
                          setAskPaid(false)
                        }}
                      >
                        {t('claim.page.paidYes')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setAskPaid(false)}>
                        {t('claim.page.paidNo')}
                      </Button>
                    </div>
                  }
                />
              )}
              <label className={styles.check}>
                <input type="checkbox" checked={state.paid} onChange={(event) => update({ paid: event.target.checked })} />
                <span>{t('claim.page.paidCheck', { amount })}</span>
              </label>
            </section>
          )}

          <section className={styles.send} aria-label={t('claim.page.send', { name: organiser })}>
            {canSend && replyUrl ? (
              <a
                className={styles.sendLink}
                href={whatsappUrl(message, payload.to.ph)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  haptic('success')
                  setTimeout(() => setSent(true), 400)
                }}
              >
                <MessageCircle aria-hidden="true" strokeWidth={2.25} />
                <span>{t('claim.page.send', { name: organiser })}</span>
              </a>
            ) : (
              <Button block iconStart={<Send />} disabled aria-describedby="claim-send-hint">
                {t('claim.page.send', { name: organiser })}
              </Button>
            )}
            {!canSend && (
              <p id="claim-send-hint" className={styles.hint}>
                {t('claim.page.sendHint')}
              </p>
            )}
            {canSend && replyUrl && (
              <div className={styles.sendMore}>
                <Button
                  variant="secondary"
                  size="md"
                  iconStart={<Share2 />}
                  onClick={async () => {
                    const outcome = await shareResult(message, { mode: 'share', title: payload.t })
                    if (outcome === 'shared' || outcome === 'copied') setSent(true)
                  }}
                >
                  {t('claim.page.sendOther')}
                </Button>
                <Button
                  variant="ghost"
                  size="md"
                  iconStart={copied ? <Check /> : <Copy />}
                  onClick={async () => {
                    const ok = await copyText(message)
                    haptic(ok ? 'success' : 'error')
                    setCopied(ok)
                  }}
                >
                  {copied ? t('claim.page.copied') : t('claim.page.copy')}
                </Button>
              </div>
            )}
          </section>
        </>
      )}
    </>
  )
}

function Loading() {
  const t = useT()
  return (
    <div className={styles.loading}>
      <p role="status" className="visually-hidden">
        {t('claim.page.loading')}
      </p>
      <Skeleton shape="md" width={56} height={56} />
      <Skeleton width="50%" height={16} />
      <Skeleton width="70%" height={28} />
    </div>
  )
}

/**
 * `/claim#…` — a friend opens the organiser's claim link: picks their name, taps what they had,
 * sees their exact share (tax and service in proportion), pays by UPI and sends their picks back
 * as a signed reply link. Nothing is read from or written to the app's data; only this round's
 * picks are remembered on the device.
 */
export function ClaimPage() {
  const t = useT()
  const { hash } = useLocation()
  const link = useClaimLink(hash)
  usePageMeta({
    title: link.status === 'ok' ? `${t('claim.page.metaTitle', { who: link.payload.to.n, title: link.payload.t })} · ${BRAND.name}` : `${t('claim.page.emptyTitle')} · ${BRAND.name}`,
    description: t('claim.page.metaDescription'),
    robots: 'noindex',
  })
  return (
    <PublicShell>
      {link.status === 'loading' && <Loading />}
      {link.status === 'empty' && <PublicProblem title={t('claim.page.emptyTitle')} text={t('claim.page.emptyText')} />}
      {link.status === 'invalid' && <PublicProblem title={t('claim.page.invalidTitle')} text={t('claim.page.invalidText')} />}
      {link.status === 'ok' && <ClaimRequest key={link.payload.r} payload={link.payload} />}
    </PublicShell>
  )
}
