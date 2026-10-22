import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
} from 'react'
import { ArrowRight, Camera, Crown, ImageUp, Keyboard, ReceiptText, Sparkles, WifiOff, X } from 'lucide-react'
import { OFFLINE_MESSAGE, SCANS_BUSY_MESSAGE, ScanError, scanBill } from '../../api/client'
import { scanToBill } from '../../api/mapScan'
import { SAMPLE_SCAN } from '../../api/sample'
import {
  ActionBar,
  Avatar,
  AvatarStack,
  Banner,
  BottomSheet,
  Button,
  Card,
  IconButton,
  lastInputModality,
  PageTitle,
  Receipt,
  Screen,
  Skeleton,
  SkeletonRows,
  TopBar,
  useToast,
} from '../../components'
import { navigate } from '../../app/router'
import { setSplitPrefill } from '../../data'
import { FREE_AI_PER_DAY } from '../../domain/types'
import { today } from '../../engine/dates'
import { consumeAiQuota, useAiQuota, usePro } from '../../pro'
import { openPaywall } from '../pro/paywall'
import { cx } from '../../lib/cx'
import { haptic } from '../../lib/haptics'
import { ImageError, isImageFile, prepareImage, type PreparedImage } from '../../lib/image'
import { formatMoney } from '../../lib/money'
import { useBackClose } from '../../state/backStack'
import { markScanningUnavailable, useHealth } from '../../state/health'
import { setPhoto } from '../../state/photo'
import { effectivePaid, hasProgress } from '../../state/selectors'
import { useFlow, useSession } from '../../state/store'
import { EMPTY_META } from '../../types'
import { useOwnerAvatarName, withOwnerAvatar } from './ownerAvatar'
import { QUICK_SPLIT_PATH, scanPrefill } from './scanPrefill'
import { focusScreenHeading, plural, revokeUrl } from './screenUtils'
import styles from './ScanScreen.module.css'

/* ---------- Connectivity ---------- */

function subscribeOnline(onChange: () => void): () => void {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/** `navigator.onLine` is only trustworthy when it says false, so anything else counts as online. */
function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false
}

function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, isOnline, () => true)
}

/* ---------- Scan problems ---------- */

/** What to offer after a failed scan. */
type Recovery = 'retry' | 'photo' | 'manual'

/** Why there are no photo buttons when the service can't scan (no key, or the key was rejected). */
const SCANNING_OFF = 'Photo scanning is off right now — typing a bill in takes about a minute.'

interface Problem {
  title: string
  message: string
  recovery: Recovery
}

/** Friendly copy + next step for a failed scan; null when the person cancelled. */
function describeProblem(error: unknown): Problem | null {
  if (error instanceof ImageError) {
    return { title: "That photo didn't work", message: error.message, recovery: 'photo' }
  }
  if (error instanceof ScanError) {
    const { message } = error
    switch (error.code) {
      case 'aborted':
        return null
      case 'network':
        return isOnline()
          ? { title: 'Connection problem', message, recovery: 'retry' }
          : { title: "You're offline", message: OFFLINE_MESSAGE, recovery: 'manual' }
      case 'not_configured':
      case 'upstream_auth':
        // The same words as the home screen's "scanning is off" note, which this visit now shows.
        return { title: "Scanning isn't available", message: SCANNING_OFF, recovery: 'manual' }
      case 'not_a_bill':
        return { title: 'Is that a bill?', message, recovery: 'photo' }
      case 'unreadable':
        return { title: "Couldn't read that bill", message, recovery: 'photo' }
      case 'bad_request':
      case 'unsupported_image':
      case 'image_too_large':
        return { title: "That photo didn't work", message, recovery: 'photo' }
      case 'timeout':
        return { title: 'That took too long', message, recovery: 'retry' }
      case 'rate_limited':
        // A short "busy" wait isn't the diner's doing; only our per-device limit is "too many scans".
        return { title: message === SCANS_BUSY_MESSAGE ? 'Busy right now' : 'Too many scans', message, recovery: 'retry' }
      case 'upstream_error':
        return { title: 'Something went wrong', message, recovery: 'retry' }
    }
  }
  return {
    title: 'Something went wrong',
    message: "We couldn't read that photo. Please try again — or type the items in.",
    recovery: 'retry',
  }
}

/* ---------- Screen ---------- */

type Phase =
  | { kind: 'idle'; problem: Problem | null }
  /** `previewUrl` is null while the photo is still being prepared. */
  | { kind: 'busy'; previewUrl: string | null }

type PhotoSource = 'camera' | 'gallery'

/** Every way to start a new bill from home (each one replaces the bill in progress). */
type NewBill =
  | { kind: 'photo'; source: PhotoSource }
  | { kind: 'file'; file: File }
  | { kind: 'retry' }
  | { kind: 'manual' }
  | { kind: 'sample' }

interface ScanJob {
  controller: AbortController | null
  /** The last prepared photo, kept so "Try again" doesn't need a new one. Owned (revoked) here. */
  retry: PreparedImage | null
}

/**
 * The bill flow's first step: snap or upload a bill (the AI reads it), type it in, or try a
 * sample. Restaurant bills go on item by item; a bill with just a total (a cab, the electricity)
 * becomes a prefilled quick split.
 */
export function ScanScreen() {
  const { session, dispatch } = useSession()
  const flow = useFlow()
  const toast = useToast()
  const health = useHealth()
  const online = useOnline()
  const pro = usePro()
  const quota = useAiQuota()
  const ownerName = useOwnerAvatarName()
  const [phase, setPhase] = useState<Phase>({ kind: 'idle', problem: null })
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  /** A new bill waiting for "Start new bill" (it would replace the one in progress). */
  const [pendingNew, setPendingNew] = useState<NewBill | null>(null)
  const [dragging, setDragging] = useState(false)

  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const typeInRef = useRef<HTMLButtonElement>(null)
  const lastSource = useRef<PhotoSource>('gallery')
  const jobRef = useRef<ScanJob>({ controller: null, retry: null })
  /** The bill (session id) the person already agreed to replace — asked once, not on every retry. */
  const replaceOk = useRef<string | null>(null)
  const latest = useRef(session)
  useLayoutEffect(() => {
    latest.current = session
  })

  const scanningDown = health !== 'loading' && health !== null && !health.configured
  // Free AI reads are counted per day; Pro is unlimited. (While Pro is still loading, don't block.)
  const quotaKnown = pro.status !== 'loading'
  const outOfScans = quotaKnown && !quota.canUse
  const canScan = !scanningDown && online && !outOfScans
  const busy = phase.kind === 'busy'

  // Scanning just went away (no service, or offline): the photo buttons vanish. A keyboard
  // user who was on one lands on the new primary action instead of the page body.
  const couldScan = useRef(canScan)
  useLayoutEffect(() => {
    const lost = couldScan.current && !canScan
    couldScan.current = canScan
    if (!lost) return
    const active = document.activeElement
    if ((active === null || active === document.body) && lastInputModality() === 'keyboard') typeInRef.current?.focus()
  }, [canScan])

  const dropRetry = useCallback(() => {
    const job = jobRef.current
    if (job.retry) revokeUrl(job.retry.previewUrl)
    job.retry = null
  }, [])

  // Leaving the screen mid-scan cancels it and frees the kept photo.
  useEffect(() => {
    const job = jobRef.current
    return () => {
      job.controller?.abort()
      job.controller = null
      if (job.retry) revokeUrl(job.retry.previewUrl)
      job.retry = null
    }
  }, [])

  const run = useCallback(
    async (getImage: () => Promise<PreparedImage>, knownPreview: string | null) => {
      const job = jobRef.current
      job.controller?.abort()
      const controller = new AbortController()
      job.controller = controller
      const { signal } = controller
      setPhase({ kind: 'busy', previewUrl: knownPreview })

      let image: PreparedImage | null = null
      try {
        if (!isOnline()) throw new ScanError('network', OFFLINE_MESSAGE)
        image = await getImage()
        if (signal.aborted) throw new ScanError('aborted')
        // A new photo replaces the one kept for "Try again".
        if (job.retry && job.retry !== image) revokeUrl(job.retry.previewUrl)
        job.retry = image
        setPhase({ kind: 'busy', previewUrl: image.previewUrl })

        const response = await scanBill(image.dataUrl, signal)
        if (signal.aborted) throw new ScanError('aborted')
        const bill = scanToBill(response, latest.current.currency)

        // A bill with just a total (a cab, the electricity): a quick split, prefilled. The bill in
        // progress (if any) stays as it was.
        const prefill = scanPrefill(bill, today())
        if (prefill) {
          job.retry = null
          job.controller = null
          revokeUrl(image.previewUrl)
          consumeAiQuota()
          haptic('success')
          setPhase({ kind: 'idle', problem: null })
          setSplitPrefill(prefill)
          navigate(QUICK_SPLIT_PATH, { replace: true })
          return
        }
        if (bill.items.length === 0) throw new ScanError('unreadable')

        // Success: the photo now belongs to the review screen ("View photo").
        job.retry = null
        job.controller = null
        setPhoto({ previewUrl: image.previewUrl })
        consumeAiQuota()
        haptic('success')
        dispatch({ type: 'loadBill', source: 'scan', ...bill })
      } catch (error) {
        if (image && job.retry !== image) revokeUrl(image.previewUrl)
        // Cancelled, or replaced by a newer scan: that one owns the screen now.
        if (job.controller !== controller) return
        job.controller = null
        // The service can't scan at all (no key, or the key was rejected): the rest of this visit
        // leads with typing the bill in, instead of offering photo buttons that can't work.
        if (error instanceof ScanError && (error.code === 'not_configured' || error.code === 'upstream_auth')) {
          markScanningUnavailable()
        }
        const problem = describeProblem(error)
        if (!problem) {
          setPhase({ kind: 'idle', problem: null })
          return
        }
        if (problem.recovery !== 'retry') {
          if (job.retry) revokeUrl(job.retry.previewUrl)
          job.retry = null
        }
        haptic('error')
        setPhase({ kind: 'idle', problem })
      }
    },
    [dispatch],
  )

  const scanFile = useCallback((file: File) => void run(() => prepareImage(file), null), [run])

  /** A pasted or dropped photo: held until confirmed when it would replace a bill in progress. */
  const onPhotoFile = useCallback(
    (file: File) => {
      const current = latest.current
      if (hasProgress(current) && replaceOk.current !== current.id) setPendingNew({ kind: 'file', file })
      else scanFile(file)
    },
    [scanFile],
  )

  /** Must run inside the click itself (no await before it), or browsers block the file picker. */
  const openPicker = (source: PhotoSource): void => {
    lastSource.current = source
    const input = source === 'camera' ? cameraRef.current : galleryRef.current
    input?.click()
  }

  const retry = (): void => {
    const kept = jobRef.current.retry
    if (kept) void run(() => Promise.resolve(kept), kept.previewUrl)
    else openPicker(lastSource.current)
  }

  const cancel = useCallback(() => {
    const job = jobRef.current
    job.controller?.abort()
    job.controller = null
    if (job.retry) revokeUrl(job.retry.previewUrl)
    job.retry = null
    setPhase({ kind: 'idle', problem: null })
  }, [])

  // The system Back button cancels a scan instead of leaving the app.
  useBackClose(busy, cancel)

  const onFileChosen = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    // Clear it so choosing the same photo again still counts as a change.
    event.target.value = ''
    if (file) scanFile(file)
  }

  const typeItIn = (): void => {
    dropRetry()
    setPhoto(null)
    dispatch({
      type: 'loadBill',
      source: 'manual',
      currency: latest.current.currency,
      meta: { ...EMPTY_META },
      items: [],
      warnings: [],
    })
  }

  const trySample = (): void => {
    dropRetry()
    setPhoto(null)
    dispatch({ type: 'loadBill', source: 'sample', ...scanToBill(SAMPLE_SCAN, latest.current.currency) })
  }

  const runNewBill = (action: NewBill): void => {
    switch (action.kind) {
      case 'photo':
        openPicker(action.source)
        break
      case 'file':
        scanFile(action.file)
        break
      case 'retry':
        retry()
        break
      case 'manual':
        typeItIn()
        break
      case 'sample':
        trySample()
        break
    }
  }

  /**
   * Every new-bill entry point goes through here: with a bill in progress it asks first (a new
   * bill replaces it, and there's no undo), unless the person already said yes for this bill.
   */
  const startNewBill = (action: NewBill): void => {
    if (hasProgress(session) && replaceOk.current !== session.id) setPendingNew(action)
    else runNewBill(action)
  }

  const confirmNewBill = (): void => {
    const action = pendingNew
    setPendingNew(null)
    if (!action) return
    replaceOk.current = session.id
    // Synchronously, still inside this click: the camera / photo picker needs the user's tap.
    runNewBill(action)
  }

  const discard = (): void => {
    setConfirmDiscard(false)
    dropRetry()
    setPhase({ kind: 'idle', problem: null })
    const changes = latest.current.expenseId !== null
    flow.startOver()
    haptic('warning')
    toast(changes ? 'Changes discarded' : 'Bill discarded')
    // The resume card (and its ✕) is gone: keep focus on the page's heading, not the body.
    focusScreenHeading()
  }

  // Desktop niceties: paste a screenshot, or drop a photo anywhere on the page.
  const acceptsPhotos = canScan && !busy
  useEffect(() => {
    if (!acceptsPhotos) return
    const hasFiles = (event: DragEvent): boolean => Array.from(event.dataTransfer?.types ?? []).includes('Files')
    let depth = 0
    const onPaste = (event: ClipboardEvent): void => {
      const file = Array.from(event.clipboardData?.files ?? []).find(isImageFile)
      if (!file) return
      event.preventDefault()
      onPhotoFile(file)
    }
    const onDragEnter = (event: DragEvent): void => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth += 1
      setDragging(true)
    }
    const onDragOver = (event: DragEvent): void => {
      if (!hasFiles(event)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    }
    const onDragLeave = (event: DragEvent): void => {
      if (!hasFiles(event)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const onDrop = (event: DragEvent): void => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth = 0
      setDragging(false)
      const files = Array.from(event.dataTransfer?.files ?? [])
      const file = files.find(isImageFile) ?? files[0]
      if (file) onPhotoFile(file)
    }
    window.addEventListener('paste', onPaste)
    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('paste', onPaste)
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [acceptsPhotos, onPhotoFile])
  const showDropHint = dragging && acceptsPhotos

  const fileInputs = (
    <>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        tabIndex={-1}
        aria-label="Take a photo of the bill"
        onChange={onFileChosen}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        hidden
        tabIndex={-1}
        aria-label="Choose a photo of the bill"
        onChange={onFileChosen}
      />
    </>
  )

  if (phase.kind === 'busy') {
    return (
      <>
        <ScanningView key="busy" previewUrl={phase.previewUrl} onCancel={cancel} />
        {fileInputs}
      </>
    )
  }

  const { problem } = phase
  const showResume = hasProgress(session)
  const billName = session.meta.merchant ?? 'Your last bill'
  // Changes to a bill that is already saved: discarding them leaves the saved bill as it was.
  const changingSaved = session.expenseId !== null

  const resumeCard = (
    <Card padding="none" className={styles.resume}>
      <div className={styles.resumeTop}>
        <span className={styles.resumeIcon} aria-hidden="true">
          <ReceiptText />
        </span>
        <div className={styles.resumeText}>
          <p className={styles.resumeEyebrow}>{changingSaved ? 'Finish changing a saved bill' : 'Pick up where you left off'}</p>
          <p className={styles.resumeTitle}>{billName}</p>
          <p className={styles.resumeMeta}>
            {plural(session.items.length, 'item')} · {formatMoney(effectivePaid(session), session.currency)}
          </p>
        </div>
        <IconButton
          label={changingSaved ? 'Discard your changes' : 'Discard this bill'}
          size="sm"
          onClick={() => setConfirmDiscard(true)}
        >
          <X />
        </IconButton>
      </div>
      <div className={styles.resumeBottom}>
        {session.people.length > 0 ? (
          <AvatarStack people={withOwnerAvatar(session.people, ownerName)} size="sm" max={4} />
        ) : (
          <span className={styles.resumeHint}>No one added yet</span>
        )}
        <Button size="md" variant="accent" iconEnd={<ArrowRight />} onClick={flow.resume}>
          Continue
        </Button>
      </div>
    </Card>
  )

  // "2 of 3 free AI splits left today" while there are some; Pro needs no counting.
  const quotaHint =
    canScan && quotaKnown && !pro.isPro ? `${quota.remaining} of ${quota.limit} free AI splits left today` : undefined

  return (
    <>
      <Screen
        key="idle"
        header={<TopBar onBack={flow.exit} />}
        contentClassName={styles.content}
        footer={
          <ActionBar hint={quotaHint}>
            {canScan ? (
              <>
                <Button block iconStart={<Camera />} onClick={() => startNewBill({ kind: 'photo', source: 'camera' })}>
                  Scan a bill
                </Button>
                <Button
                  block
                  variant="secondary"
                  iconStart={<ImageUp />}
                  onClick={() => startNewBill({ kind: 'photo', source: 'gallery' })}
                >
                  Upload a photo
                </Button>
                <div className={styles.altActions}>
                  <Button variant="ghost" size="md" iconStart={<Keyboard />} onClick={() => startNewBill({ kind: 'manual' })}>
                    Type it in
                  </Button>
                  <Button variant="ghost" size="md" iconStart={<Sparkles />} onClick={() => startNewBill({ kind: 'sample' })}>
                    Try a sample
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Button ref={typeInRef} block iconStart={<Keyboard />} onClick={() => startNewBill({ kind: 'manual' })}>
                  Type the items in
                </Button>
                <Button block variant="secondary" iconStart={<Sparkles />} onClick={() => startNewBill({ kind: 'sample' })}>
                  Try a sample bill
                </Button>
              </>
            )}
          </ActionBar>
        }
      >
        {/* A bill in progress comes first (above the fold, clear of the actions); no illustration then. */}
        {showResume ? resumeCard : !problem && <BillArt scanning={canScan} />}

        <PageTitle
          title="Scan a bill"
          subtitle={
            canScan
              ? 'Snap it, tap who had what — tax, tips and discounts are shared fairly. A cab or power bill becomes a quick split.'
              : 'Type the items in, tap who had what — tax, tips and discounts are shared fairly.'
          }
        />

        {problem && (
          <Banner
            tone="error"
            title={problem.title}
            actions={
              <div className={styles.problemActions}>
                {problem.recovery === 'retry' && canScan && (
                  <Button size="sm" onClick={() => startNewBill({ kind: 'retry' })}>
                    Try again
                  </Button>
                )}
                {problem.recovery === 'photo' && canScan && (
                  <Button size="sm" onClick={() => startNewBill({ kind: 'photo', source: lastSource.current })}>
                    Try another photo
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={problem.recovery === 'manual' || !canScan ? 'primary' : 'secondary'}
                  onClick={() => startNewBill({ kind: 'manual' })}
                >
                  Type it in
                </Button>
              </div>
            }
          >
            {problem.message}
          </Banner>
        )}

        {!online && !problem && (
          <Banner tone="warning" icon={<WifiOff />} title="You're offline">
            You can still type the items in or try the sample — scanning comes back with your connection.
          </Banner>
        )}

        {online && scanningDown && !problem && (
          <Banner tone="info">{SCANNING_OFF}</Banner>
        )}

        {online && !scanningDown && outOfScans && !problem && (
          <Banner
            tone="info"
            icon={<Crown />}
            title="That's today's free AI splits"
            actions={
              <div className={styles.problemActions}>
                <Button size="sm" variant="accent" onClick={() => openPaywall('unlimited_ai')}>
                  Get unlimited with Pro
                </Button>
              </div>
            }
          >
            {`You get ${FREE_AI_PER_DAY} a day, and they're back tomorrow. Typing this one in takes about a minute.`}
          </Banner>
        )}
      </Screen>

      {fileInputs}

      {showDropHint && (
        <div className={styles.dropOverlay} aria-hidden="true">
          <span className={styles.dropIcon}>
            <ImageUp />
          </span>
          Drop the photo to scan it
        </div>
      )}

      <BottomSheet
        open={pendingNew !== null}
        onClose={() => setPendingNew(null)}
        title="Start a new bill?"
        description={
          changingSaved
            ? `Your changes to ${billName} will be dropped — the saved bill stays as it was.`
            : `${billName} (${plural(session.items.length, 'item')}) will be replaced.${
                session.people.length > 0 ? ' The people you added stay.' : ''
              }`
        }
        footer={
          <ActionBar>
            <Button block onClick={confirmNewBill}>
              Start new bill
            </Button>
            <Button block variant="ghost" onClick={() => setPendingNew(null)}>
              Keep it
            </Button>
          </ActionBar>
        }
      />

      <BottomSheet
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title={changingSaved ? 'Discard your changes?' : 'Discard this bill?'}
        description={
          changingSaved
            ? 'The saved bill stays as it was.'
            : 'Its items and split will be cleared. The people stay in your people list.'
        }
        footer={
          <ActionBar>
            <Button block variant="primary" onClick={discard}>
              {changingSaved ? 'Discard changes' : 'Discard bill'}
            </Button>
            <Button block variant="ghost" onClick={() => setConfirmDiscard(false)}>
              Keep it
            </Button>
          </ActionBar>
        }
      />
    </>
  )
}

/* ---------- Scanning ---------- */

const STATUS = ['Reading the bill…', 'Finding the items…', 'Checking the totals…', 'Almost there…'] as const
const SLOW_STATUS = 'Still working — longer bills take a little more time…'
const STATUS_MS = 1800
/** Ticks after which the "still working" reassurance replaces "Almost there…". */
const SLOW_AFTER_TICKS = 9

function statusText(previewUrl: string | null, tick: number): string {
  if (previewUrl === null) return 'Getting your photo ready…'
  if (tick >= SLOW_AFTER_TICKS) return SLOW_STATUS
  return STATUS[Math.min(tick, STATUS.length - 1)] ?? STATUS[0]
}

function ScanningView({ previewUrl, onCancel }: { previewUrl: string | null; onCancel: () => void }) {
  const [tick, setTick] = useState(0)
  const [prevPreview, setPrevPreview] = useState(previewUrl)
  if (prevPreview !== previewUrl) {
    setPrevPreview(previewUrl)
    setTick(0)
  }

  useEffect(() => {
    if (previewUrl === null) return
    const timer = setInterval(() => setTick((t) => t + 1), STATUS_MS)
    return () => clearInterval(timer)
  }, [previewUrl])

  // Escape cancels on desktop, like closing a dialog.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return
      event.preventDefault()
      onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <Screen
      contentClassName={styles.scanningContent}
      footer={
        <ActionBar>
          <Button block variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </ActionBar>
      }
    >
      <PageTitle title="Reading your bill" subtitle="Picking out every item and total." align="center" />
      <div className={cx(styles.photoFrame, previewUrl === null && styles.photoFramePending)}>
        {previewUrl === null ? (
          <Skeleton shape="md" className={styles.photoPlaceholder} />
        ) : (
          <img className={styles.photo} src={previewUrl} alt="The bill being read" />
        )}
        <span className={styles.beam} aria-hidden="true" />
      </div>
      <p className={styles.status} role="status" aria-live="polite">
        {statusText(previewUrl, tick)}
      </p>
      <SkeletonRows count={4} className={styles.skeleton} />
    </Screen>
  )
}

/* ---------- Hero illustration ---------- */

const ART_ROWS: ReadonlyArray<readonly [string, string]> = [
  ['62%', '18%'],
  ['48%', '14%'],
  ['70%', '20%'],
  ['40%', '16%'],
]

/**
 * A tilted paper receipt with a highlighter swipe on the total — being "scanned" (a sweeping
 * line) unless `scanning` is false, when photo scanning is off. Decorative.
 */
function BillArt({ scanning = true }: { scanning?: boolean }) {
  return (
    <div className={styles.art} aria-hidden="true">
      <div className={styles.artStage}>
        <Receipt padding="sm" className={styles.artReceipt} paperClassName={styles.artPaper}>
          <span className={cx(styles.artBar, styles.artTitle)} />
          <span className={cx(styles.artBar, styles.artSub)} />
          <div className={styles.artRows}>
            {ART_ROWS.map(([name, amount], i) => (
              <div key={i} className={styles.artRow}>
                <span className={styles.artBar} style={{ width: name }} />
                <span className={styles.artBar} style={{ width: amount }} />
              </div>
            ))}
          </div>
          <Receipt.Divider spacing="sm" />
          <div className={cx(styles.artRow, styles.artTotal)}>
            <span className={styles.artHighlight} />
            <span className={cx(styles.artBar, styles.artInk)} style={{ width: '32%' }} />
            <span className={cx(styles.artBar, styles.artInk)} style={{ width: '24%' }} />
          </div>
          {scanning && <span className={styles.artBeam} />}
        </Receipt>
        <div className={styles.artPeople}>
          {(['Aisha', 'Ben', 'Chen'] as const).map((name, i) => (
            <span key={name} className={styles.artPerson} style={{ animationDelay: `${300 + i * 120}ms` }}>
              <Avatar name={name} color={i} size="sm" />
              <span className={styles.artPill} />
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
