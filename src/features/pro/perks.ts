/**
 * What Pro adds, in plain words — the perk list on the upgrade screen and the per-feature pitch
 * the paywall leads with. Honest by rule: the free AI allowance is named (and that it resets at
 * midnight), the fair-use cap is stated, and nothing that's free is dressed up as Pro. Words come
 * from the `pro` catalog, in the current language, when these are called.
 */
import {
  ChartPie,
  FileSpreadsheet,
  ImageIcon,
  Palette,
  Repeat,
  Rocket,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { BRAND, FREE_AI_PER_DAY, type ProFeature } from '../../domain/types'
import { t } from '../../i18n'

export interface Perk {
  key: ProFeature | 'early'
  icon: LucideIcon
  title: string
  text: string
  /** Where it lives in the app once unlocked (perks without a screen of their own have none). */
  href: string | null
}

/** Pro's perks in the order they sell; `proAiPerDay` is the server's fair-use allowance. */
export function proPerks(proAiPerDay: number): Perk[] {
  return [
    {
      key: 'unlimited_ai',
      icon: Sparkles,
      title: t('pro.perk.ai.title'),
      text: t('pro.perk.ai.body', { count: proAiPerDay }),
      href: null,
    },
    {
      key: 'recurring',
      icon: Repeat,
      title: t('pro.perk.recurring.title'),
      text: t('pro.perk.recurring.body'),
      href: '/app/recurring',
    },
    {
      key: 'insights',
      icon: ChartPie,
      title: t('pro.perk.insights.title'),
      text: t('pro.perk.insights.body'),
      href: '/app/insights',
    },
    {
      key: 'export',
      icon: FileSpreadsheet,
      title: t('pro.perk.export.title'),
      text: t('pro.perk.export.body'),
      href: '/app/you',
    },
    {
      key: 'themes',
      icon: Palette,
      title: t('pro.perk.themes.title'),
      text: t('pro.perk.themes.body'),
      href: '/app/you',
    },
    {
      key: 'clean_cards',
      icon: ImageIcon,
      title: t('pro.perk.cleanCards.title'),
      text: t('pro.perk.cleanCards.body', { brand: BRAND.name }),
      href: null,
    },
    {
      key: 'early',
      icon: Rocket,
      title: t('pro.perk.early.title'),
      text: t('pro.perk.early.body'),
      href: null,
    },
  ]
}

export interface FeaturePitch {
  icon: LucideIcon
  /** The paywall's heading. */
  readonly title: string
  /** One or two sentences under it. */
  readonly text: string
  /** The unlock button on a locked screen ("Unlock Insights"). */
  readonly unlock: string
}

/** The pitch for Pro in general (a "Go Pro" link rather than a locked feature), in the current language when read. */
export const GENERAL_PITCH: FeaturePitch = {
  icon: Sparkles,
  get title() {
    return t('pro.pitch.general.title', { brand: BRAND.name })
  },
  get text() {
    return t('pro.pitch.general.body')
  },
  get unlock() {
    return t('pro.pitch.general.cta')
  },
}

/** What the paywall leads with when a locked feature sent the person there. */
export function featurePitch(feature: ProFeature | null, proAiPerDay: number): FeaturePitch {
  switch (feature) {
    case 'unlimited_ai':
      return {
        icon: Sparkles,
        title: t('pro.pitch.ai.title'),
        text: t('pro.pitch.ai.body', { free: FREE_AI_PER_DAY, count: proAiPerDay }),
        unlock: t('pro.pitch.ai.cta'),
      }
    case 'recurring':
      return {
        icon: Repeat,
        title: t('pro.pitch.recurring.title'),
        text: t('pro.pitch.recurring.body'),
        unlock: t('pro.pitch.recurring.cta'),
      }
    case 'insights':
      return {
        icon: ChartPie,
        title: t('pro.pitch.insights.title'),
        text: t('pro.pitch.insights.body'),
        unlock: t('pro.pitch.insights.cta'),
      }
    case 'export':
      return {
        icon: FileSpreadsheet,
        title: t('pro.pitch.export.title'),
        text: t('pro.pitch.export.body'),
        unlock: t('pro.pitch.export.cta'),
      }
    case 'themes':
      return {
        icon: Palette,
        title: t('pro.pitch.themes.title'),
        text: t('pro.pitch.themes.body'),
        unlock: t('pro.pitch.themes.cta'),
      }
    case 'clean_cards':
      return {
        icon: ImageIcon,
        title: t('pro.pitch.cleanCards.title'),
        text: t('pro.pitch.cleanCards.body', { brand: BRAND.name }),
        unlock: t('pro.pitch.cleanCards.cta'),
      }
    case null:
      return GENERAL_PITCH
  }
}

/** Free forever — said plainly on every paywall, so nobody wonders what they'd lose by staying free. */
export function freeForever(): string {
  return t('pro.freeForever')
}
