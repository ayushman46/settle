import { lazy, Suspense, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, AudioLines, Check, Mic, PenLine, RotateCcw, Sparkles } from 'lucide-react'
import { fold } from '../../../shared/nameMatch'
import { DESCRIBE_LIMITS } from '../../../shared/api'
import { DescribeError, describeSplit, type DescribeErrorCode } from '../../ai'
import { describedToPrefill, spreadToGroup } from '../../ai/prefill'
import { navigate } from '../../app/router'
import { Avatar, Badge, Banner, BottomSheet, Button, CategoryIcon, Chip, Money, SearchPill, Skeleton, useToast } from '../../components'
import { addFriend, deleteExpense, expenseDraftIssue, friendsStore, groupsStore, saveExpense, setSplitPrefill, useFriends, useGroup, useProfile, type SplitPrefill } from '../../data'
import { FREE_AI_PER_DAY, ME_ID, type DescribedSplit } from '../../domain/types'
import { today } from '../../engine/dates'
import { t, useT } from '../../i18n'
import { relativeDateLabel } from '../../kit/dateLabel'
import { cx } from '../../lib/cx'
import { haptic } from '../../lib/haptics'
import { isSpeechSupported, type SpeechErrorCode } from '../../lib/speech'
import { aiUsedToday, quotaFor, useAiQuota } from '../../pro/quota'
import { hasFeature } from '../../pro/store'
import { useHealth } from '../../state/health'
import { openPaywall } from '../pro/paywall'
import { useOnSettle } from '../account/onSettle'
import { forgetNickname, rememberNickname, useNicknames } from './nicknames'
import { WhoPicker, type WhoRow } from './WhoPicker'
import { describeView, heardChips, peopleSummary, sayExamples, type DescribeView } from './describeView'
import { blankForm, formToDraft, isConverting, settleCurrency, withGroup, withPrefill } from '../split/splitForm'
import { TRIP_ENABLED } from '../trip/enabled'
import { expensePath, NEW_SPLIT_PATH } from './homeLinks'
import { MicButton } from './MicButton'
import { VOICE_ENABLED } from './voice.enabled'
import type { VoiceHeard } from './VoiceInput'
import { defaultVoiceLang, saveVoiceLang, voiceLanguage, type VoiceLang } from './voiceLanguages'
import styles from './AiDescribeSheet.module.css'

export interface AiDescribeSheetProps {
  open: boolean
  onClose: () => void
  /** `voice`: start listening as the sheet opens (Home's mic). */
  startWith?: 'voice'
  /** The split is for this group (opened from the group's page). */
  groupId?: string
}

/** The listening panel and the language picker load on the first tap of a mic. */
const VoiceInput = lazy(() => import('./VoiceInput'))
const VoiceLanguageSheet = lazy(() => import('./VoiceLanguageSheet'))

type Phase =
  | { kind: 'idle' }
  | { kind: 'reading'; text: string }
  | { kind: 'draft'; text: string; draft: DescribedSplit }
  | { kind: 'error'; text: string; error: DescribeError }

/** Failures worth simply trying again (the text itself was fine). */
const RETRYABLE: ReadonlySet<DescribeErrorCode> = new Set(['timeout', 'upstream_error', 'network', 'rate_limited'])


/** How many examples are offered as one-tap chips (the field's placeholder cycles through all of them). */
const CHIP_COUNT = 3

function quotaLine(remaining: number): string {
  if (remaining <= 0) return t('home.describe.quota.used', { limit: FREE_AI_PER_DAY })
  return t('home.describe.quota.left', { count: remaining, limit: FREE_AI_PER_DAY })
}

interface VoiceState {
  lang: VoiceLang
  /** The listening panel is up. */
  listening: boolean
  /** The "Speak in" sheet is open. */
  picking: boolean
  /** "Heard “ढाई हज़ार” → ₹2,500" chips for the field's text. */
  heard: string[]
  /** The field holds what was said (it's sent as spoken, in `lang`). */
  spoken: boolean
  /** What was said was cut to the AI's limit. */
  tooLong: boolean
  /** Other ways the recogniser heard it. */
  alternatives: string[]
  error: SpeechErrorCode | null
}

/**
 * "Just say it": type an expense the way you'd text a friend ("Cab 840 with Riya and Sam, Sam
 * pays double") — or say it, in any of eight Indian languages — the AI turns it into a draft,
 * and a confirm card shows exactly how it would split — title, amount, who paid, everyone's share.
 * "Save split" saves it as read, with an Undo; "Edit details" opens the split screen filled in (new names become people then, not before). Free
 * users get `FREE_AI_PER_DAY` a day; at zero the Pro paywall offers unlimited, and carries on
 * reading once unlocked. Spoken numbers ("dhai hazaar") become digits on the phone before
 * anything is sent, and nothing is sent until "Read it".
 */
export function AiDescribeSheet({ open, onClose, startWith, groupId }: AiDescribeSheetProps) {
  const t = useT()
  const examples = sayExamples()
  const profile = useProfile()
  const friends = useFriends()
  const group = useGroup(groupId)
  const quota = useAiQuota()
  const health = useHealth()
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const micRef = useRef<HTMLButtonElement>(null)
  const request = useRef<AbortController | null>(null)
  const [text, setText] = useState('')
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [wasOpen, setWasOpen] = useState(open)
  const nicknames = useNicknames()
  /** Who each name in this draft is, as picked in "Who's who" (folded name → friend id; "" someone new). */
  const [picks, setPicks] = useState<Record<string, string>>({})
  const pins = useMemo(() => ({ ...nicknames, ...picks }), [nicknames, picks])
  const people = useMemo(() => friends.filter((f) => f.id !== ME_ID), [friends])

  const aiOff = health !== 'loading' && health !== null && !health.configured
  // Speak to split: only where the browser can turn speech into text, and while the AI is on.
  const voiceOn = VOICE_ENABLED && !aiOff && isSpeechSupported()
  const [voice, setVoice] = useState<VoiceState>(() => ({
    lang: defaultVoiceLang(profile.language),
    listening: open && startWith === 'voice' && voiceOn,
    picking: false,
    heard: [],
    spoken: false,
    tooLong: false,
    alternatives: [],
    error: null,
  }))
  /** After speaking, focus moves to "Read it" once the text is in the field. */
  const focusRead = useRef(false)

  // Closing cancels a read in flight and stops listening; reopening keeps the text and any draft
  // for that text (Home's mic reopens it listening).
  if (open !== wasOpen) {
    setWasOpen(open)
    if (!open && phase.kind === 'reading') setPhase({ kind: 'idle' })
    if (!open && (voice.listening || voice.picking)) setVoice((v) => ({ ...v, listening: false, picking: false }))
    if (open && startWith === 'voice' && voiceOn) setVoice((v) => ({ ...v, listening: true, error: null, tooLong: false }))
  }

  // Leaving (or closing the sheet) cancels a read in flight.
  useEffect(() => {
    if (!open) return
    return () => {
      request.current?.abort()
      request.current = null
    }
  }, [open])

  // After speaking: the cursor at the end of the field, and focus on "Read it".
  useLayoutEffect(() => {
    if (!focusRead.current) return
    focusRead.current = false
    const input = inputRef.current
    if (!input) return
    const end = input.value.length
    try {
      input.setSelectionRange(end, end)
    } catch {
      // A field without a selection.
    }
    const submit = input.form?.querySelector<HTMLButtonElement>('button[type="submit"]')
    if (submit && !submit.disabled) submit.focus()
    else input.focus()
  })

  const busy = phase.kind === 'reading'
  const view = useMemo<DescribeView | null>(
    () => (phase.kind === 'draft' ? describeView(phase.draft, { friends, meId: ME_ID, currency: profile.currency, pins }) : null),
    [phase, friends, profile.currency, pins],
  )

  const close = (): void => {
    request.current?.abort()
    request.current = null
    onClose()
  }

  /** `saidIn`: the language it was just spoken in (this render's state doesn't know yet). */
  const read = async (value: string, saidIn?: VoiceLang): Promise<void> => {
    const clean = value.trim()
    if (!clean || aiOff) return
    const lang = saidIn ?? (voice.spoken ? voice.lang : null)
    // Speaking is free and unlimited; the daily allowance is for typed splits only.
    // Read fresh, not from this render: after unlocking Pro from the paywall this runs again.
    if (!lang && !quotaFor(aiUsedToday(), hasFeature('unlimited_ai')).canUse) {
      haptic('warning')
      openPaywall('unlimited_ai', { onUnlock: () => void read(clean, saidIn) })
      return
    }
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setPhase({ kind: 'reading', text: clean })
    setPicks({})
    try {
      // From a group's page, its members come first: their names are the ones most likely said.
      const groupNames = group ? group.memberIds.map((id) => (id === ME_ID ? 'Me' : (friends.find((f) => f.id === id)?.name ?? ''))).filter(Boolean) : []
      const people = [...new Set([...groupNames.filter((n) => n !== 'Me'), ...friends.filter((f) => f.id !== ME_ID).map((f) => f.name)])]
      // Spoken: the server hears which language, and that it came from speech recognition.
      const spoken = lang ? { lang, source: 'voice' as const } : {}
      const read = await describeSplit(clean, { currency: group?.currency ?? profile.currency, people, today: today(), ...spoken }, controller.signal)
      const draft = group ? spreadToGroup(read, clean, groupNames) : read
      if (controller.signal.aborted) return
      if (!lang) quota.consume()
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
    // Cleared: whatever comes next is typed.
    if (value.trim() === '' && (voice.spoken || voice.heard.length > 0 || voice.tooLong)) {
      setVoice((v) => ({ ...v, spoken: false, heard: [], tooLong: false, alternatives: [] }))
    }
    // A changed sentence is a new request: the old answer no longer applies.
    if (phase.kind === 'draft' || phase.kind === 'error') setPhase({ kind: 'idle' })
  }

  /** What was read, as a hand-off to the split screen (new names become people now). */
  const handOff = (): SplitPrefill | null => {
    if (phase.kind !== 'draft') return null
    const prefill = describedToPrefill(phase.draft, {
      friends,
      meId: ME_ID,
      currency: profile.currency,
      pins,
      addFriend: (name) => addFriend({ name }),
    })
    return voice.spoken
      ? { ...prefill, source: 'voice', banner: { icon: 'mic', title: t('voice.banner.title'), body: t('voice.banner.body') } }
      : prefill
  }

  const openForm = (prefill: SplitPrefill): void => {
    setSplitPrefill(prefill)
    haptic('tap')
    close()
    navigate(`${NEW_SPLIT_PATH}?from=${voice.spoken ? 'voice' : 'describe'}${groupId ? `&group=${encodeURIComponent(groupId)}` : ''}`)
  }

  /** "Edit details": the full split screen, filled in. */
  const useDraft = (): void => {
    const prefill = handOff()
    if (prefill) openForm(prefill)
  }

  /**
   * "Save split": saved as read, in one tap, with an Undo. Anything the split screen would still
   * need a decision on (a currency to convert, a split that doesn't add up) opens it instead.
   */
  const saveNow = (): void => {
    const prefill = handOff()
    if (!prefill) return
    const day = today()
    const groups = groupsStore.get()
    const inGroup = groupId ? (groups.find((g) => g.id === groupId) ?? null) : null
    const ctx = { currency: profile.currency, today: day, friendIds: new Set([ME_ID, ...friendsStore.get().map((f) => f.id)]), groups }
    let form = blankForm(profile.currency, day)
    if (inGroup) form = withGroup(form, inGroup, TRIP_ENABLED ? { settle: profile.currency, profileCurrency: profile.currency } : undefined)
    form = withPrefill(form, { ...prefill, groupId: groupId ?? prefill.groupId ?? null }, ctx)
    const settle = TRIP_ENABLED ? settleCurrency(form, inGroup, profile.currency) : form.currency
    const draft = formToDraft(form)
    if (form.currency !== settle || isConverting(form, settle) || expenseDraftIssue(draft) !== null) {
      openForm(prefill)
      return
    }
    const saved = saveExpense(draft)
    haptic('success')
    close()
    toast(t('home.describe.saved', { title: saved.title || t('home.describe.savedUntitled') }), {
      tone: 'success',
      action: { label: t('split.undo.cta'), onAction: () => void deleteExpense(saved.id) },
    })
    navigate(expensePath(saved.id))
  }

  const byHand = (): void => {
    close()
    navigate(NEW_SPLIT_PATH)
  }

  const rewrite = (): void => {
    setPhase({ kind: 'idle' })
    inputRef.current?.focus()
  }

  /* ---------- Speak to split ---------- */

  /** The mic in the field: listen (again), or stop listening. */
  const listen = (): void => {
    if (!voiceOn) return
    request.current?.abort()
    request.current = null
    if (phase.kind !== 'idle') setPhase({ kind: 'idle' })
    haptic('tap')
    setVoice((v) => ({ ...v, listening: !v.listening, error: null, tooLong: false }))
  }

  const heardIt = ({ text: said, heard, alternatives }: VoiceHeard): void => {
    const max = DESCRIBE_LIMITS.maxTextChars
    const chars = Array.from(said.trim())
    const tooLong = chars.length > max
    setText(tooLong ? chars.slice(0, max).join('') : said.trim())
    setPhase({ kind: 'idle' })
    haptic('success')
    setVoice((v) => ({
      ...v,
      listening: false,
      spoken: true,
      heard: heardChips(heard, profile.currency),
      tooLong,
      alternatives: alternatives.map((a) => Array.from(a).slice(0, max).join('')),
      error: null,
    }))
    focusRead.current = true
    // Read straight away: speaking is the whole step. Cut short (too long), it waits for a look first.
    if (!tooLong && said.trim()) void read(said.trim(), voice.lang)
  }

  /** "Not what you said?": another of the recogniser's guesses, read instead. */
  const pickAlternative = (alt: string): void => {
    haptic('tap')
    const was = text
    setText(alt)
    setVoice((v) => ({ ...v, alternatives: [was, ...v.alternatives.filter((a) => a !== alt && a !== was)].filter(Boolean).slice(0, 3) }))
    void read(alt, voice.lang)
  }

  /** "Who's who": the people in the draft, by the names they were called. */
  const whoRows = useMemo<WhoRow[]>(() => {
    if (!view) return []
    const rows: WhoRow[] = view.people.filter((p) => !p.isMe && p.said).map((p) => ({ said: p.said, friendId: p.isNew ? null : p.id, role: 'in' as const }))
    const payerSaid = view.payerSaidAs
    if (payerSaid && view.payerId !== ME_ID && !rows.some((r) => fold(r.said) === fold(payerSaid))) {
      rows.unshift({ said: payerSaid, friendId: view.payerId.startsWith('new-person:') ? null : view.payerId, role: 'paid' })
    }
    return rows
  }, [view])
  const onSettle = useOnSettle(friends, whoRows.length > 0)
  const picked = useMemo(() => new Set(Object.keys(picks)), [picks])

  const pickWho = (said: string, friendId: string | null): void => {
    haptic('tap')
    setPicks((p) => ({ ...p, [fold(said)]: friendId ?? '' }))
    const friend = friendId ? friends.find((f) => f.id === friendId) : null
    if (friend) {
      rememberNickname(said, friend.id, friend.name)
      if (fold(said) !== fold(friend.name)) {
        toast(t('voice.who.remembered', { said, name: friend.name }), { tone: 'success' })
      }
    } else {
      forgetNickname(said)
    }
  }

  const voiceFailed = (code: SpeechErrorCode): void => {
    haptic(code === 'no_speech' ? 'warning' : 'error')
    setVoice((v) => ({ ...v, listening: false, error: code }))
    inputRef.current?.focus()
  }

  const voiceDone = (): void => {
    setVoice((v) => ({ ...v, listening: false }))
    inputRef.current?.focus()
  }

  const pickLanguage = (code: VoiceLang): void => {
    saveVoiceLang(code)
    setVoice((v) => ({ ...v, lang: code, picking: false, listening: true, error: null }))
  }

  const limited = Number.isFinite(quota.limit)
  const voiceError = voice.error ? voiceErrorCopy(voice.error, voiceLanguage(voice.lang).name, t) : null

  return (
    <BottomSheet
      open={open}
      onClose={close}
      title={t('home.say.title')}
      description={t('home.describe.body')}
      initialFocus={startWith === 'voice' && voiceOn ? micRef : inputRef}
      footer={
        view ? (
          <div className={styles.actions}>
            <Button block onClick={saveNow} iconStart={<Check strokeWidth={2.5} />}>
              {t('home.describe.saveNow')}
            </Button>
            <Button block variant="tonal" onClick={useDraft} iconEnd={<ArrowRight strokeWidth={2.5} />}>
              {t('home.describe.looksRight')}
            </Button>
            <Button block variant="ghost" onClick={rewrite} iconStart={<PenLine />}>
              {t('home.describe.changeWords')}
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className={styles.body}>
        <SearchPill
          placeholder={t('home.describe.placeholder')}
          label={t('home.describe.label')}
          submitLabel={t('home.describe.submit')}
          examples={examples}
          value={text}
          onChange={edit}
          onSubmit={(value) => void read(value)}
          busy={busy}
          disabled={aiOff}
          inputRef={inputRef}
          className={styles.pill}
          trailing={
            voiceOn ? (
              <MicButton
                variant="inline"
                label={t('voice.mic.sheet.aria')}
                listening={voice.listening}
                onClick={listen}
                buttonRef={micRef}
              />
            ) : undefined
          }
        />

        {voice.heard.length > 0 && text !== '' && (
          <ul role="list" className={styles.heard} aria-label={t('voice.heard.label')}>
            {voice.heard.map((chip) => (
              <li key={chip} className={styles.heardChip}>
                <AudioLines aria-hidden="true" />
                <span>{chip}</span>
              </li>
            ))}
          </ul>
        )}

        {voice.spoken && voice.alternatives.length > 0 && text !== '' && !voice.listening && (
          <div className={styles.alts}>
            <p className={styles.altsLabel}>{t('voice.alt.title')}</p>
            <ul role="list" className={styles.exampleList}>
              {voice.alternatives.map((alt) => (
                <li key={alt}>
                  <Chip leading={<AudioLines />} onClick={() => pickAlternative(alt)} aria-label={t('voice.alt.aria', { text: alt })}>
                    {alt}
                  </Chip>
                </li>
              ))}
            </ul>
          </div>
        )}

        {voiceOn && (
          <p className="visually-hidden" role="status">
            {voice.spoken && text !== '' && !voice.listening ? t('voice.listen.heard.aria', { text }) : ''}
          </p>
        )}

        {voice.tooLong && (
          <Banner tone="warning" title={t('voice.long.title')}>
            {t('voice.long.body', { max: DESCRIBE_LIMITS.maxTextChars })}
          </Banner>
        )}

        {voiceError && (
          <Banner tone={voiceError.tone} title={voiceError.title} onDismiss={() => setVoice((v) => ({ ...v, error: null }))}>
            {voiceError.body}
          </Banner>
        )}

        {open && voice.listening && voiceOn && (
          <Suspense fallback={null}>
            <VoiceInput
              key={voice.lang}
              lang={voice.lang}
              onLanguage={() => setVoice((v) => ({ ...v, listening: false, picking: true }))}
              onResult={heardIt}
              onError={voiceFailed}
              onDone={voiceDone}
              people={people}
              nicknames={nicknames}
              currency={group?.currency ?? profile.currency}
            />
          </Suspense>
        )}

        {aiOff ? (
          <Banner tone="info" title={t('home.describe.off.title')} action={{ label: t('home.describe.off.cta'), onAction: byHand }}>
            {t('home.describe.off.body')}
          </Banner>
        ) : (
          <QuotaLine limited={limited} remaining={quota.remaining} voice={voiceOn} onUpgrade={() => openPaywall('unlimited_ai')} />
        )}

        <p className="visually-hidden" aria-live="polite">
          {view ? announce(view) : ''}
        </p>

        <div className={styles.status}>
          {phase.kind === 'reading' && <Reading />}
          {phase.kind === 'error' && (
            <Banner
              tone={phase.error.code === 'not_a_split' || phase.error.code === 'bad_request' ? 'warning' : 'error'}
              title={RETRYABLE.has(phase.error.code) ? t('home.describe.error.retryTitle') : t('home.describe.error.againTitle')}
              actions={
                <div className={styles.errorActions}>
                  {RETRYABLE.has(phase.error.code) && (
                    <Button size="sm" variant="secondary" iconStart={<RotateCcw />} onClick={() => void read(phase.text)}>
                      {t('home.describe.retry')}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={byHand}>
                    {t('home.describe.off.cta')}
                  </Button>
                </div>
              }
            >
              {phase.error.message}
            </Banner>
          )}
          {view && <DraftCard view={view} />}
          {view && whoRows.length > 0 && (
            <WhoPicker rows={whoRows} people={people} nicknames={nicknames} onSettle={onSettle} picked={picked} onPick={pickWho} />
          )}
        </div>

        {phase.kind === 'idle' && text.trim() === '' && !aiOff && !voice.listening && (
          <div className={styles.examples}>
            <p className={styles.examplesLabel}>{t('home.describe.tryOne')}</p>
            <ul role="list" className={styles.exampleList}>
              {examples.slice(0, CHIP_COUNT).map((example) => (
                <li key={example}>
                  <Chip
                    leading={<Sparkles />}
                    onClick={() => {
                      edit(example)
                      setVoice((v) => ({ ...v, spoken: false, heard: [], tooLong: false, error: null }))
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

      {voice.picking && (
        <Suspense fallback={null}>
          <VoiceLanguageSheet
            open={open && voice.picking}
            value={voice.lang}
            onClose={() => setVoice((v) => ({ ...v, picking: false }))}
            onSelect={pickLanguage}
          />
        </Suspense>
      )}
    </BottomSheet>
  )
}

/** A speech error's banner (spec 03 §2.5): "Didn't catch that" is information; the rest are warnings. */
function voiceErrorCopy(
  code: SpeechErrorCode,
  language: string,
  t: ReturnType<typeof useT>,
): { tone: 'info' | 'warning'; title: string; body: string } {
  switch (code) {
    case 'blocked':
      return { tone: 'warning', title: t('voice.error.blocked.title'), body: t('voice.error.blocked.body') }
    case 'no_speech':
      return { tone: 'info', title: t('voice.error.noSpeech.title'), body: t('voice.error.noSpeech.body') }
    case 'no_mic':
      return { tone: 'warning', title: t('voice.error.noMic.title'), body: t('voice.error.noMic.body') }
    case 'network':
      return { tone: 'warning', title: t('voice.error.network.title'), body: t('voice.error.network.body') }
    case 'language':
      return { tone: 'warning', title: t('voice.error.language.title', { language }), body: t('voice.error.language.body') }
    default:
      return { tone: 'warning', title: t('voice.error.other.title'), body: t('voice.error.other.body') }
  }
}

/** What a screen reader hears when the draft appears. */
function announce(view: DescribeView): string {
  const vars = { title: view.title, mode: view.modeLabel, name: view.payerName }
  return view.people.length > 0 || view.missing > 0
    ? t('home.describe.announce', { ...vars, people: peopleSummary(view.people, view.missing) })
    : t('home.describe.announce.nobody', vars)
}

function QuotaLine({ limited, remaining, voice, onUpgrade }: { limited: boolean; remaining: number; voice: boolean; onUpgrade: () => void }) {
  const t = useT()
  if (limited && voice) {
    // Speaking never runs out: that comes first; the typed allowance is the small print.
    return (
      <p className={styles.quota}>
        <Mic aria-hidden="true" className={styles.quotaMic} />
        <span>
          <strong className={styles.quotaFree}>{t('voice.free.line')}</strong>
          {' · '}
          {remaining <= 0 ? t('voice.free.typedUsed') : t('voice.free.typed', { count: remaining })}
        </span>
        <button type="button" className={styles.quotaLink} onClick={onUpgrade}>
          {t('home.describe.goUnlimited')}
        </button>
      </p>
    )
  }
  if (!limited) {
    return (
      <p className={styles.quota}>
        <Badge tone="pro">Pro</Badge>
        <span>{t('home.describe.unlimited')}</span>
      </p>
    )
  }
  return (
    <p className={cx(styles.quota, remaining <= 0 && !voice && styles.quotaOut)}>
      <span>
        {quotaLine(remaining)}
        {voice ? ` · ${t('home.describe.quota.voiceFree')}` : ''}
      </span>
      <button type="button" className={styles.quotaLink} onClick={onUpgrade}>
        {remaining <= 0 ? t('home.describe.getUnlimited') : t('home.describe.goUnlimited')}
      </button>
    </p>
  )
}

function Reading() {
  const t = useT()
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
        {t('home.describe.reading')}
      </p>
    </div>
  )
}

function DraftCard({ view }: { view: DescribeView }) {
  const t = useT()
  const titleId = useId()
  const date = view.date ? relativeDateLabel(view.date) : t('home.describe.today')
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
          <p className={styles.noAmount}>{t('home.describe.noAmount')}</p>
        )}
        <p className={styles.howLine}>
          {t('home.describe.paidBy', { name: view.payerName, mode: view.modeLabel })}
        </p>
      </div>

      {view.people.length > 0 ? (
        <ul role="list" className={styles.people} aria-label={t('home.describe.whosIn')}>
          {view.people.map((person) => (
            <li key={person.id} className={styles.person}>
              <Avatar name={person.avatarName} color={person.color} size="sm" />
              <span className={styles.personName}>
                {person.name}
                {person.isNew && (
                  <Badge tone="accent" className={styles.newBadge}>
                    {t('home.describe.new')}
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
          ? t('home.describe.note.pick', { summary: peopleSummary(view.people, view.missing), count: view.missing })
          : view.people.length === 0
            ? peopleSummary(view.people, 0)
            : !view.addsUp
              ? t('home.describe.note.addsUp')
              : view.people.some((p) => p.isNew)
                ? t('home.describe.note.newNames')
                : t('home.describe.note.nothingSaved')}
      </p>
    </article>
  )
}
