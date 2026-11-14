import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Pause, Play, Share2, X } from 'lucide-react'
import { goBack, navigate, useRoute } from '../../app/router'
import { Button, PageTitle, Screen, TopBar, useToast } from '../../components'
import { useExpenses, useFriendsById, useGroup, useProfile } from '../../data'
import { ME_ID, type Group } from '../../domain/types'
import { t as translate, useT } from '../../i18n'
import { friendLabel } from '../../kit/friendName'
import { motionAllowed } from '../../kit/motion'
import { haptic } from '../../lib/haptics'
import { shareResult } from '../../lib/share'
import { useHasFeature } from '../../pro'
import { shareCardFilename } from '../../share/card/render'
import { outsideName } from '../../share/names'
import { shareFile } from '../../share/shareFile'
import { GroupGone } from '../groups/GroupGone'
import { siteOrigin } from '../landing/pageMeta'
import { groupPath, settleUpPath } from '../groups/paths'
import { categoryParts, SLIDE_COLORS, slideText, slideWords, storyText, type CopyContext } from './copy'
import { buildStory, type Slide } from './engine'
import { renderSlidePicture } from './image'
import styles from './Wrapped.module.css'

const ROUTES = ['/app/groups/:id/wrapped'] as const

/** How long a slide stays before the next (matches the progress bar's animation in the CSS). */
const SLIDE_MS = 5_000
/** A press longer than this is a hold (pause), not a tap. */
const HOLD_MS = 280

/**
 * `/app/groups/:id/wrapped` — the group's story: a full-screen, tap-through set of slides worked
 * out from its expenses, each one shareable as a picture, ending with what settles it.
 */
export function WrappedScreen() {
  const { params } = useRoute(ROUTES)
  const group = useGroup(params.id)
  if (!group) return <GroupGone />
  return <Story key={group.id} group={group} />
}

function Story({ group }: { group: Group }) {
  const t = useT()
  const expenses = useExpenses({ groupId: group.id })
  const friendsById = useFriendsById()
  const profile = useProfile()
  const appNames = useCallback((id: string) => friendLabel(id, friendsById[id]), [friendsById])
  const slides = useMemo(() => buildStory({ group, expenses, nameOf: appNames, me: ME_ID }), [group, expenses, appNames])
  const app = useMemo<CopyContext>(() => ({ group, nameOf: appNames, youLabel: t('wrapped.you.eyebrow') }), [group, appNames, t])
  const out = useMemo<CopyContext>(() => {
    const nameOf = (id: string): string => outsideName(id, friendsById, profile, id === ME_ID ? translate('share.card.me') : translate('share.card.friend'))
    return { group, nameOf, youLabel: nameOf(ME_ID), site: siteOrigin() }
  }, [group, friendsById, profile])

  if (slides.length === 0) {
    return (
      <Screen header={<TopBar onBack={() => goBack(groupPath(group.id))} />}>
        <PageTitle title={t('wrapped.none.title')} subtitle={t('wrapped.none.body')} />
        <Button className={styles.noneCta} onClick={() => navigate(groupPath(group.id), { replace: true })}>
          {t('wrapped.none.cta')}
        </Button>
      </Screen>
    )
  }
  return <StoryPlayer group={group} slides={slides} app={app} out={out} />
}

type Picture = { at: number; key: string; blob: Blob | null }

function StoryPlayer({ group, slides, app, out }: { group: Group; slides: Slide[]; app: CopyContext; out: CopyContext }) {
  const t = useT()
  const toast = useToast()
  const cleanCards = useHasFeature('clean_cards')
  const [animate] = useState(motionAllowed)
  const [at, setAt] = useState(0)
  const [held, setHeld] = useState(false)
  const [stopped, setStopped] = useState(false)
  const [sharing, setSharing] = useState(false)
  const pressedAt = useRef<number | null>(null)
  const longPress = useRef(false)
  const [picture, setPicture] = useState<Picture | null>(null)

  const index = Math.min(at, slides.length - 1)
  const slide = slides[index] ?? slides[0]!
  const last = index === slides.length - 1
  const words = slideWords(slide, app)
  const colors = SLIDE_COLORS[slide.kind]
  const outWords = slideWords(slide, out)
  const position = `${index + 1} / ${slides.length}`
  const pictureKey = JSON.stringify([outWords, position, cleanCards])

  const close = useCallback(() => goBack(groupPath(group.id)), [group.id])
  const next = useCallback(() => setAt((i) => Math.min(slides.length - 1, i + 1)), [slides.length])
  const prev = useCallback(() => setAt((i) => Math.max(0, i - 1)), [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
      if (event.key === 'ArrowRight') next()
      else if (event.key === 'ArrowLeft') prev()
      else if (event.key === 'Escape') close()
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, close])

  // The slide's picture is drawn as soon as it shows, not on tap: a share sheet opened too long
  // after the tap is refused by the browser.
  // A Share tapped before it's drawn waits for it (the first slide's picture also waits for the
  // fonts), so the picture is never left off.
  const current = picture?.at === index && picture.key === pictureKey ? picture : null
  const drawing = useRef<{ at: number; key: string; blob: Promise<Blob | null> } | null>(null)
  useEffect(() => {
    if (current) return
    let live = true
    const blob = renderSlidePicture({ words: outWords, colors, groupLabel: `${group.emoji} ${group.name}`, position }, { watermark: !cleanCards, theme: 'light' }).then(
      (b): Blob | null => b,
      () => null,
    )
    drawing.current = { at: index, key: pictureKey, blob }
    void blob.then((b) => {
      if (live) setPicture({ at: index, key: pictureKey, blob: b })
    })
    return () => {
      live = false
    }
    // outWords and colors follow from pictureKey and index.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, pictureKey, current])

  const report = (outcome: string): void => {
    if (outcome === 'shared') haptic('success')
    else if (outcome === 'downloaded') toast(t('wrapped.share.saved'), { tone: 'success' })
    else if (outcome === 'copied') toast(t('wrapped.share.copied'), { tone: 'success' })
    else if (outcome === 'failed') toast(t('wrapped.share.failed'), { tone: 'error' })
  }

  const shareSlide = async (): Promise<void> => {
    setSharing(true)
    try {
      const text = slideText(slide, out)
      const pending = drawing.current
      const blob = current ? current.blob : pending && pending.at === index && pending.key === pictureKey ? await pending.blob : null
      report(blob ? await shareFile(blob, shareCardFilename(`${group.name} story ${index + 1}`), text, { title: group.name }) : await shareResult(text, { title: group.name }))
    } finally {
      setSharing(false)
    }
  }

  const shareStory = async (): Promise<void> => {
    setSharing(true)
    try {
      report(await shareResult(storyText(slides, out), { title: group.name }))
    } finally {
      setSharing(false)
    }
  }

  const paused = held || stopped || sharing
  const running = animate && !last

  const press = (): void => {
    pressedAt.current = performance.now()
    longPress.current = false
    setHeld(true)
  }
  const release = (): void => {
    if (pressedAt.current !== null && performance.now() - pressedAt.current > HOLD_MS) longPress.current = true
    pressedAt.current = null
    setHeld(false)
  }
  const tap = (go: () => void) => (): void => {
    if (longPress.current) {
      longPress.current = false
      return
    }
    go()
  }

  const style = { '--story-bg': colors.bg, '--story-ink': colors.ink, '--story-glow': colors.glow, '--story-ms': `${SLIDE_MS}ms` } as CSSProperties
  const categories = slide.kind === 'categories' ? slide.shares : null

  return (
    <div className={styles.story} style={style} data-kind={slide.kind} data-animate={animate || undefined}>
      <h1 className={styles.srOnly} tabIndex={-1}>
        {t('wrapped.screen.title', { name: group.name })}
      </h1>
      <p className={styles.srOnly}>{t('wrapped.screen.aria', { name: group.name })}</p>

      <div className={styles.top}>
        <div className={styles.bars} aria-hidden="true">
          {slides.map((s, i) => (
            <span key={`${s.kind}-${i}`} className={styles.bar}>
              <span
                className={i < index || (i === index && !running) ? styles.fillDone : i === index ? styles.fillRun : styles.fill}
                style={i === index && running ? { animationPlayState: paused ? 'paused' : 'running' } : undefined}
                onAnimationEnd={i === index && running ? next : undefined}
                key={i === index ? `run-${index}` : undefined}
              />
            </span>
          ))}
        </div>
        <div className={styles.topRow}>
          <span className={styles.groupLabel}>
            <span aria-hidden="true">{group.emoji}</span> {group.name}
          </span>
          {animate && !last && (
            <button type="button" className={styles.icon} aria-label={stopped ? t('wrapped.play') : t('wrapped.pause')} onClick={() => setStopped((s) => !s)}>
              {stopped ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
            </button>
          )}
          <button type="button" className={styles.icon} aria-label={t('wrapped.close')} onClick={close}>
            <X aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className={styles.stage} onPointerDown={press} onPointerUp={release} onPointerCancel={release} onPointerLeave={() => held && release()}>
        <div key={index} className={styles.slide} aria-live="polite" aria-atomic="true">
          <span className={styles.srOnly}>{t('wrapped.slide.count', { at: index + 1, count: slides.length })}</span>
          {(slide.kind === 'headline' || slide.kind === 'closing') && (
            <span className={styles.emoji} aria-hidden="true">
              {group.emoji}
            </span>
          )}
          <p className={styles.eyebrow}>{words.eyebrow}</p>
          <p className={styles.big}>{words.big}</p>
          {categories ? (
            <ul className={styles.shares}>
              {categoryParts(categories).map((label, i) => (
                <li key={categories[i]?.id ?? 'rest'} className={styles.share}>
                  <span className={styles.shareBar} style={{ inlineSize: `${Math.max(4, categories[i]?.percent ?? 0)}%` }} aria-hidden="true" />
                  <span className={styles.shareText}>{label}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.line}>{words.line}</p>
          )}
        </div>
        <button type="button" className={styles.zonePrev} aria-label={t('wrapped.prev')} onClick={tap(prev)} disabled={index === 0} />
        <button type="button" className={styles.zoneNext} aria-label={t('wrapped.next')} onClick={tap(next)} disabled={last} />
      </div>

      <div className={styles.bottom}>
        {last && (
          <div className={styles.endActions}>
            {slide.kind === 'closing' && slide.payments > 0 && (
              <button type="button" className={styles.cta} onClick={() => navigate(settleUpPath(group.id))}>
                {t('wrapped.settle')}
              </button>
            )}
            <button type="button" className={styles.ctaGhost} onClick={shareStory} disabled={sharing}>
              {t('wrapped.share.all')}
            </button>
          </div>
        )}
        <button type="button" className={styles.sharePill} aria-label={t('wrapped.share.aria')} onClick={shareSlide} disabled={sharing}>
          <Share2 aria-hidden="true" />
          <span aria-hidden="true">{t('wrapped.share')}</span>
        </button>
      </div>
    </div>
  )
}
