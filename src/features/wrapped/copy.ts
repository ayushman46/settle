/**
 * What each slide says, in words: on screen, on the shared picture, and in the text recap. One
 * place, so all three always say the same thing.
 */
import type { Group } from '../../domain/types'
import { t } from '../../i18n'
import { fullDateLabel } from '../../kit/dateLabel'
import { formatMoney } from '../../lib/money'
import { categoryLabel } from '../../share/categories'
import type { CategoryShare, Slide, SlideKind } from './engine'

export interface SlideWords {
  eyebrow: string
  big: string
  line: string
}

export interface CopyContext {
  group: Pick<Group, 'name' | 'emoji' | 'currency'>
  /** How to name someone: "You" in the app, the owner's own name on things that leave it. */
  nameOf: (id: string) => string
  /** The owner's name for the "you" slide ("You" in the app). */
  youLabel: string
}

export function slideWords(slide: Slide, { group, nameOf, youLabel }: CopyContext): SlideWords {
  const money = (paise: number): string => formatMoney(paise, group.currency, { trimZeros: true })
  switch (slide.kind) {
    case 'headline':
      return {
        eyebrow: t('wrapped.headline.eyebrow', { emoji: group.emoji, name: group.name }),
        big: money(slide.total),
        line: t('wrapped.headline.line', { days: slide.days, people: slide.people, count: slide.count }),
      }
    case 'perDay':
      return {
        eyebrow: t('wrapped.perDay.eyebrow'),
        big: t('wrapped.perDay.big', { amount: money(slide.perDay) }),
        line:
          slide.perPersonPerDay === null
            ? t('wrapped.perDay.line.alone', { days: slide.days })
            : t('wrapped.perDay.line.each', { amount: money(slide.perPersonPerDay), days: slide.days }),
      }
    case 'bigDay':
      return {
        eyebrow: t('wrapped.bigDay.eyebrow', { date: fullDateLabel(slide.date) }),
        big: money(slide.total),
        line: t('wrapped.bigDay.line', { count: slide.count, titles: slide.titles.join(', ') }),
      }
    case 'bigBill':
      return {
        eyebrow: t('wrapped.bigBill.eyebrow'),
        big: money(slide.total),
        line: t('wrapped.bigBill.line', { title: slide.title, name: nameOf(slide.payerId) }),
      }
    case 'categories': {
      const [top] = slide.shares
      return {
        eyebrow: t('wrapped.categories.eyebrow'),
        big: top ? t('wrapped.categories.big', { percent: top.percent, category: shareLabel(top) }) : '',
        line: categoryParts(slide.shares).slice(1).join(' · '),
      }
    }
    case 'fronted':
      return { eyebrow: t('wrapped.fronted.eyebrow'), big: nameOf(slide.id), line: t('wrapped.fronted.line', { amount: money(slide.amount) }) }
    case 'flash':
      return { eyebrow: t('wrapped.flash.eyebrow'), big: nameOf(slide.id), line: t('wrapped.flash.line', { days: slide.days }) }
    case 'repeat':
      return {
        eyebrow: t('wrapped.repeat.eyebrow'),
        big: t('wrapped.repeat.big', { title: slide.title, count: slide.count }),
        line: t('wrapped.repeat.line', { amount: money(slide.total) }),
      }
    case 'weekday':
      return { eyebrow: t('wrapped.weekday.eyebrow'), big: t('wrapped.weekday.big', { day: slide.day }), line: t('wrapped.weekday.line', { day: slide.day, percent: slide.percent }) }
    case 'you':
      return {
        eyebrow: youLabel,
        big: money(slide.share),
        line: slide.paid > 0 ? t('wrapped.you.line.paid', { percent: slide.percent, paid: money(slide.paid) }) : t('wrapped.you.line', { percent: slide.percent }),
      }
    case 'closing':
      return slide.payments > 0
        ? { eyebrow: t('wrapped.closing.eyebrow'), big: t('wrapped.closing.big', { count: slide.payments }), line: t('wrapped.closing.line', { amount: money(slide.total) }) }
        : { eyebrow: t('wrapped.closing.eyebrow'), big: t('wrapped.closing.square'), line: t('wrapped.closing.square.line') }
  }
}

function shareLabel(share: CategoryShare): string {
  return share.id === null ? t('wrapped.categories.rest') : categoryLabel(share.id)
}

/** "Food & drinks 52%", one per share on the slide. */
export function categoryParts(shares: readonly CategoryShare[]): string[] {
  return shares.map((s) => t('wrapped.categories.part', { category: shareLabel(s), percent: s.percent }))
}

/** One slide as a line of text ("₹42,180: 5 days · 4 people · 23 bills"). */
export function slideText(slide: Slide, ctx: CopyContext): string {
  const words = slideWords(slide, ctx)
  return [words.eyebrow, t('wrapped.recap.line', { big: words.big, line: words.line })].join('\n')
}

/** The whole story as one message for the group chat. */
export function storyText(slides: readonly Slide[], ctx: CopyContext): string {
  const title = t('wrapped.recap.title', { emoji: ctx.group.emoji, name: ctx.group.name })
  const lines = slides.filter((s) => s.kind !== 'headline').map((s) => {
    const words = slideWords(s, ctx)
    return `${words.eyebrow}: ${t('wrapped.recap.line', { big: words.big, line: words.line })}`
  })
  const head = slides[0]?.kind === 'headline' ? slideWords(slides[0], ctx) : null
  return [title, head ? t('wrapped.recap.line', { big: head.big, line: head.line }) : null, '', ...lines].filter((x): x is string => x !== null).join('\n')
}

/** Each slide's colours: a background, the ink on it, and a glow. Strong contrast for large and small text. */
export const SLIDE_COLORS: Readonly<Record<SlideKind, { bg: string; ink: string; glow: string }>> = {
  headline: { bg: '#14172e', ink: '#ffffff', glow: '#cbf266' },
  perDay: { bg: '#ff7a59', ink: '#1a0b06', glow: '#ffd23f' },
  bigDay: { bg: '#ffd23f', ink: '#1d1600', glow: '#ff7a59' },
  bigBill: { bg: '#2e1a47', ink: '#ffffff', glow: '#ff4fa3' },
  categories: { bg: '#0f766e', ink: '#ffffff', glow: '#5eead4' },
  fronted: { bg: '#cbf266', ink: '#0e1013', glow: '#2dd4bf' },
  flash: { bg: '#1d4ed8', ink: '#ffffff', glow: '#7dd3fc' },
  repeat: { bg: '#f9a8d4', ink: '#2a0617', glow: '#fef08a' },
  weekday: { bg: '#fbbf24', ink: '#1c1200', glow: '#fb7185' },
  you: { bg: '#0e1013', ink: '#ffffff', glow: '#cbf266' },
  closing: { bg: '#15803d', ink: '#ffffff', glow: '#cbf266' },
}
