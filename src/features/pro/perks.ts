/**
 * What Pro adds, in plain words — the perk list on the upgrade screen and the per-feature pitch
 * the paywall leads with. Honest by rule: the free AI allowance is named (and that it resets at
 * midnight), the fair-use cap is stated, and nothing that's free is dressed up as Pro.
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
      title: 'Unlimited AI',
      text: `Scan bills and “Just say it” as often as you like — fair use, up to ${proAiPerDay} a day.`,
      href: null,
    },
    {
      key: 'recurring',
      icon: Repeat,
      title: 'Recurring splits',
      text: 'Rent, Wi-Fi, Netflix: a reminder each month and a one-tap split.',
      href: '/app/recurring',
    },
    {
      key: 'insights',
      icon: ChartPie,
      title: 'Insights',
      text: 'Where your money goes — by category, month and friend.',
      href: '/app/insights',
    },
    {
      key: 'export',
      icon: FileSpreadsheet,
      title: 'CSV export',
      text: 'Every expense, ready for Excel or Google Sheets.',
      href: '/app/you',
    },
    {
      key: 'themes',
      icon: Palette,
      title: 'Accent colours',
      text: 'Make it yours in mint, sky, violet or coral.',
      href: '/app/you',
    },
    {
      key: 'clean_cards',
      icon: ImageIcon,
      title: 'Clean share cards',
      text: `Split cards for the group chat, without the “Made with ${BRAND.name}” line.`,
      href: null,
    },
    {
      key: 'early',
      icon: Rocket,
      title: 'Early access',
      text: 'Try new features before they reach everyone.',
      href: null,
    },
  ]
}

export interface FeaturePitch {
  icon: LucideIcon
  /** The paywall's heading. */
  title: string
  /** One or two sentences under it. */
  text: string
  /** The unlock button on a locked screen ("Unlock Insights"). */
  unlock: string
}

/** The pitch for Pro in general (a "Go Pro" link rather than a locked feature). */
export const GENERAL_PITCH: FeaturePitch = {
  icon: Sparkles,
  title: `${BRAND.name} Pro`,
  text: 'Unlimited AI, recurring splits and insights. Pay once — nothing renews.',
  unlock: 'See Pro',
}

/** What the paywall leads with when a locked feature sent the person there. */
export function featurePitch(feature: ProFeature | null, proAiPerDay: number): FeaturePitch {
  switch (feature) {
    case 'unlimited_ai':
      return {
        icon: Sparkles,
        title: 'Unlimited AI with Pro',
        text: `Free includes ${FREE_AI_PER_DAY} AI scans or “Just say it” splits a day, and they reset at midnight. Pro lifts the limit — fair use, up to ${proAiPerDay} a day.`,
        unlock: 'Get unlimited AI',
      }
    case 'recurring':
      return {
        icon: Repeat,
        title: 'Recurring splits are part of Pro',
        text: 'Set up rent, Wi-Fi or Netflix once. Each month you get a reminder and split it in one tap.',
        unlock: 'Unlock recurring splits',
      }
    case 'insights':
      return {
        icon: ChartPie,
        title: 'See where your money goes',
        text: 'Your spending by category, month and friend — worked out on your phone, never uploaded.',
        unlock: 'Unlock Insights',
      }
    case 'export':
      return {
        icon: FileSpreadsheet,
        title: 'Export to a spreadsheet',
        text: 'Download every expense as a CSV for Excel or Google Sheets. Backups stay free for everyone.',
        unlock: 'Unlock CSV export',
      }
    case 'themes':
      return {
        icon: Palette,
        title: 'Make it yours',
        text: 'Pick mint, sky, violet or coral as your accent colour. Lime stays free.',
        unlock: 'Unlock accent colours',
      }
    case 'clean_cards':
      return {
        icon: ImageIcon,
        title: 'Cleaner share cards',
        text: `Share split cards in the group chat without the “Made with ${BRAND.name}” line.`,
        unlock: 'Unlock clean cards',
      }
    case null:
      return GENERAL_PITCH
  }
}

/** Free forever — said plainly on every paywall, so nobody wonders what they'd lose by staying free. */
export const FREE_FOREVER =
  'Free forever: unlimited manual splits, groups, pay links, UPI QR codes, nudges and backups.'
