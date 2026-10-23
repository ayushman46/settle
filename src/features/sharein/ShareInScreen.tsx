import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ClipboardPaste, LockKeyhole, ScanText, Smartphone } from 'lucide-react'
import { goBack, navigate, Redirect, useSearchParams } from '../../app/router'
import { Banner, Button, PageTitle, Screen, Skeleton, TopBar, useToast } from '../../components'
import { setSplitPrefill } from '../../data'
import { ME_ID } from '../../domain/types'
import { today as todayIso } from '../../engine/dates'
import { t as tOption, useT } from '../../i18n'
import { relativeDateLabel as dateLabel } from '../../kit/dateLabel'
import { useMediaQuery } from '../../kit/media'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { readSharedPayload, type SharedPayload } from '../../lib/sharedPayload'
import { setSharedPhoto } from '../../state/sharedPhoto'
import { openBill } from '../bill/launch'
import { SMS_ENABLED } from './enabled'
import { IgnoredNotice, UnknownNotice } from './IgnoredNotice'
import type { SmsTxn } from './sms/parseSms'
import { hasReadableText, readPaste, skippedLine, txnPrefill, txnTitle, type PasteView, type ReadMessage } from './sms/smsView'
import { TxnCard } from './TxnCard'
import { SMS_SPLIT_PATH, useSmsAi } from './useSmsAi'
import styles from './ShareInScreen.module.css'

/** The most text taken from a shared `text/plain` file. */
const MAX_TEXT_FILE_BYTES = 64 * 1024
/** Settle's own link pages: a shared link to one of these opens it. */
const SETTLE_LINK_PATHS: readonly string[] = ['/pay', '/claim', '/pool']

type Load =
  /** Paste mode. */
  | { kind: 'paste' }
  /** Reading what another app shared (`?k=`). */
  | { kind: 'loading' }
  /** The share couldn't be picked up (`?missed=1`, or the stored share is gone). */
  | { kind: 'missed' }

/** `/app/share` — split from a bank SMS or UPI alert: pasted here, or shared in from another app. */
export function ShareInScreen() {
  if (!SMS_ENABLED) return <Redirect to="/app" />
  return <ShareIn />
}

function ShareIn() {
  const t = useT()
  const toast = useToast()
  const params = useSearchParams()
  const key = params.get('k')
  const missed = params.get('missed') === '1'
  const ai = useSmsAi()
  const today = todayIso()

  const [text, setText] = useState('')
  const [view, setView] = useState<PasteView | null>(null)
  const [picked, setPicked] = useState(0)
  const [shared, setShared] = useState(false)
  const [load, setLoad] = useState<Load>(() => (key ? { kind: 'loading' } : missed ? { kind: 'missed' } : { kind: 'paste' }))
  const [focusToken, setFocusToken] = useState(0)
  const firstAction = useRef<HTMLButtonElement>(null)
  const pickRef = useRef<HTMLDivElement>(null)
  const fieldId = useId()
  const pickTitleId = useId()
  const android = useMemo(() => typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent), [])
  const installed = useMediaQuery('(display-mode: standalone)')
  const canPaste = typeof navigator !== 'undefined' && typeof navigator.clipboard?.readText === 'function'

  const read = (value: string, opts: { fromShare?: boolean } = {}): void => {
    const next = readPaste(value, today)
    ai.reset()
    setPicked(0)
    setShared(opts.fromShare === true)
    // An OTP is never kept on screen.
    const primary = next.primary?.parse
    if (primary?.kind === 'ignored' && primary.reason === 'otp') setText('')
    else setText(value)
    setView(next)
    setFocusToken((n) => n + 1)
    haptic(next.txns.length > 0 ? 'success' : 'tap')
  }

  // A share from another app: read it once (the service worker keeps it until then).
  useEffect(() => {
    if (!key) return
    let live = true
    void (async () => {
      const payload = await readSharedPayload(key)
      if (!live) return
      if (!payload) {
        setLoad({ kind: 'missed' })
        return
      }
      const handled = await takeShare(payload, () => toast(t('sharein.shared.firstPhoto.toast')))
      if (!live || handled === 'left') return
      setLoad({ kind: 'paste' })
      if (handled.kind === 'text') read(handled.text, { fromShare: true })
    })()
    return () => {
      live = false
    }
    // Once per share id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // After a read, the result's first control takes focus (and comes into view if it's below the fold).
  useLayoutEffect(() => {
    if (focusToken === 0) return
    const target = pickRef.current?.querySelector<HTMLInputElement>('input:checked') ?? firstAction.current
    if (!target) return
    target.focus({ preventScroll: true })
    const box = target.getBoundingClientRect()
    if (box.bottom > window.innerHeight || box.top < 0) target.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  }, [focusToken])

  const paste = async (): Promise<void> => {
    try {
      const clip = await navigator.clipboard.readText()
      if (!hasReadableText(clip)) {
        toast(t('sharein.paste.empty.toast'))
        return
      }
      read(clip)
    } catch {
      toast(t('sharein.paste.denied.toast'), { tone: 'warning' })
    }
  }

  const splitTxn = (txn: SmsTxn, opts: { focusAmount: boolean; title?: string }): void => {
    setSplitPrefill(txnPrefill(txn, { today, meId: ME_ID, title: opts.title }))
    haptic('tap')
    navigate(SMS_SPLIT_PATH)
    if (opts.focusAmount) focusAmountSoon()
  }

  const byHand = (): void => navigate('/app/split/new')

  if (load.kind === 'loading') {
    return (
      <Screen header={<TopBar onBack={() => goBack('/app')} />} contentClassName={styles.content}>
        <PageTitle title={t('sharein.paste.title')} />
        <div className={styles.loading} role="status" aria-label={t('sharein.shared.loading.aria')}>
          <Skeleton shape="md" width={44} height={44} />
          <div className={styles.loadingLines}>
            <Skeleton width="60%" />
            <Skeleton width="40%" />
          </div>
        </div>
      </Screen>
    )
  }

  const current: ReadMessage | null = view ? (view.txns.length > 1 ? (view.txns[picked] ?? view.txns[0] ?? null) : view.primary) : null
  const skipped = view ? skippedLine(view.skipped) : null
  const field = (
    <div className={styles.field}>
      <label htmlFor={fieldId} className={styles.label}>
        {t('sharein.paste.label')}
      </label>
      <textarea
        id={fieldId}
        className={styles.area}
        rows={5}
        value={text}
        placeholder={t('sharein.paste.placeholder')}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        onChange={(event) => {
          setText(event.target.value)
          if (view) setView(null)
        }}
      />
    </div>
  )

  return (
    <Screen header={<TopBar onBack={() => goBack('/app')} />} contentClassName={styles.content}>
      <PageTitle title={t('sharein.paste.title')} subtitle={t('sharein.paste.subtitle')} />

      {load.kind === 'missed' && (
        <Banner tone="warning" title={t('sharein.missed.title')}>
          {t('sharein.missed.body')}
        </Banner>
      )}

      <section className={styles.pasteBox} aria-label={t('sharein.paste.label')}>
        {shared && view ? (
          <details className={styles.disclosure}>
            <summary className={styles.summary}>
              <ScanText aria-hidden="true" />
              {t('sharein.shared.show')}
            </summary>
            {field}
          </details>
        ) : (
          field
        )}
        {!(shared && view) && (
          <div className={styles.pasteActions}>
            {canPaste && (
              <Button variant="ghost" size="md" iconStart={<ClipboardPaste />} onClick={() => void paste()}>
                {t('sharein.paste.cta')}
              </Button>
            )}
            <Button size="md" className={styles.readButton} disabled={!hasReadableText(text)} onClick={() => read(text)}>
              {t('sharein.paste.read.cta')}
            </Button>
          </div>
        )}
      </section>

      {view && view.txns.length > 1 && (
        <div className={styles.pick} ref={pickRef}>
          <h2 id={pickTitleId} className={styles.pickTitle}>
            {t('sharein.pick.title')}
          </h2>
          <div role="radiogroup" aria-labelledby={pickTitleId} className={styles.pickList}>
            {view.txns.map((m, i) => (
              <label key={i} className={styles.pickOption}>
                <input
                  type="radio"
                  name="sms-pick"
                  className={styles.pickRadio}
                  checked={picked === i}
                  onChange={() => {
                    setPicked(i)
                    ai.reset()
                  }}
                />
                <span className={styles.pickLabel}>{optionLabel(m.parse, today)}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {current && (
        <div className={styles.results} key={`${focusToken}:${picked}`}>
          {current.parse.kind === 'txn' ? (
            <TxnCard
              ref={firstAction}
              txn={current.parse}
              today={today}
              onSplit={(opts) => (current.parse.kind === 'txn' ? splitTxn(current.parse, opts) : undefined)}
              onDone={() => goBack('/app')}
            />
          ) : current.parse.kind === 'ignored' ? (
            <IgnoredNotice ref={firstAction} reason={current.parse.reason} ai={ai} text={current.text} onByHand={byHand} />
          ) : (
            <UnknownNotice ref={firstAction} ai={ai} text={current.text} onByHand={byHand} />
          )}
          {skipped && (
            <p className={styles.skipped} role="status">
              {skipped}
            </p>
          )}
        </div>
      )}

      <div className={styles.footnotes}>
        <p className={styles.note}>
          <LockKeyhole aria-hidden="true" className={styles.noteIcon} />
          <span>{t('sharein.paste.privacy')}</span>
        </p>
        {android && installed && (
          <p className={styles.note}>
            <Smartphone aria-hidden="true" className={styles.noteIcon} />
            <span>{t('sharein.paste.android')}</span>
          </p>
        )}
      </div>
    </Screen>
  )
}

/** Photos go to the bill scan; a Settle link opens; text comes back to be read here. */
async function takeShare(payload: SharedPayload, onManyPhotos: () => void): Promise<'left' | { kind: 'text'; text: string }> {
  const images = payload.files.filter((f) => f.type.startsWith('image/'))
  const first = images[0]
  if (first) {
    setSharedPhoto(first)
    if (images.length > 1) onManyPhotos()
    // Back from the scan returns Home, not to this in-between page.
    navigate('/app', { replace: true })
    openBill({ kind: 'photo' })
    return 'left'
  }
  let fileText = ''
  const textFile = payload.files.find((f) => f.type === 'text/plain' || /\.txt$/i.test(f.name))
  if (textFile && textFile.size <= MAX_TEXT_FILE_BYTES) {
    try {
      fileText = await textFile.text()
    } catch {
      fileText = ''
    }
  }
  const body = [payload.title, payload.text, fileText].map((s) => s.trim()).filter(Boolean).join('\n')
  const link = settleLink(payload.url) ?? (body && !/\s/.test(body) ? settleLink(body) : null)
  if (link) {
    navigate(link, { replace: true })
    return 'left'
  }
  return { kind: 'text', text: body || payload.url }
}

/** "Swiggy · ₹250 · 21 Oct" for the "Which one?" list. */
function optionLabel(parse: ReadMessage['parse'], today: string): string {
  if (parse.kind !== 'txn') return ''
  const name = txnTitle(parse)
  const amount = formatMoney(parse.amount, 'INR', { trimZeros: true })
  const date = parse.date ? dateLabel(parse.date, today) : null
  if (parse.dir === 'credit') {
    return date ? tOption('sharein.pick.option.in', { name, amount, date }) : tOption('sharein.pick.option.in.noDate', { name, amount })
  }
  return date ? tOption('sharein.pick.option', { name, amount, date }) : tOption('sharein.pick.option.noDate', { name, amount })
}

/** A Settle pay/claim/pool link on this site → its path; anything else → null. */
function settleLink(value: string): string | null {
  if (!value) return null
  try {
    const url = new URL(value.trim(), window.location.origin)
    if (url.origin !== window.location.origin) return null
    const path = url.pathname.length > 1 && url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname
    return SETTLE_LINK_PATHS.includes(path) ? `${path}${url.search}${url.hash}` : null
  } catch {
    return null
  }
}

/**
 * "Edit first": once the split screen is up, put the cursor in its amount (it only focuses an
 * empty amount by itself). Gives up after two seconds.
 */
function focusAmountSoon(): void {
  const started = Date.now()
  const attempt = (): void => {
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('main input'))
    const amount = inputs.find((input) => Array.from(input.labels ?? []).some((label) => label.textContent?.trim() === 'Amount'))
    if (amount) {
      amount.focus({ preventScroll: true })
      amount.select()
      return
    }
    if (Date.now() - started < 2000) window.setTimeout(attempt, 50)
  }
  window.setTimeout(attempt, 0)
}
