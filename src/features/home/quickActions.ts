/**
 * Home's quick actions as a registry, so features add their tile without sharing a file: each
 * entry says when it's on (its feature flag), what it's called and what it does. The grid shows
 * the enabled ones in order, back-fills with everyday templates to seven, and ends with More (the
 * templates that didn't fit) — always two rows of four.
 */
import { ArrowLeftRight, Bike, HandCoins, LayoutGrid, MessageSquareText, ScanLine, Split, UsersRound, type LucideIcon } from 'lucide-react'
import { navigate } from '../../app/router'
import { CATEGORY_ICONS, type QuickActionTone } from '../../components'
import { poolsStore } from '../../data/stores'
import type { CategoryId } from '../../domain/types'
import { t } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { DELIVERY_ENABLED } from '../bill/delivery.enabled'
import { openBill } from '../bill/launch'
import { LEND_ENABLED } from '../lend/enabled'
import { POOLS_ENABLED } from '../pools/enabled'
import { SMS_ENABLED } from '../sharein/enabled'
import { NEW_GROUP_PATH, NEW_SPLIT_PATH, templatePath } from './homeLinks'

export type QuickActionId = 'scan' | 'split' | 'lend' | 'collect' | 'sms' | 'food' | 'group' | 'more'

export interface QuickActionDef {
  /** A `QuickActionId`, or `template:<category>` for a template tile. */
  id: string
  label: string
  icon: LucideIcon
  tone: QuickActionTone
  run: () => void
  enabled: () => boolean
}

/** Tiles in the grid: seven actions, then More. */
export const GRID_SIZE = 8

const always = () => true

/** Collections: the list when there are any, else straight to a new one. */
function openPools(): void {
  navigate(poolsStore.get().length > 0 ? '/app/pools' : '/app/pools/new')
}

/** The registry, in grid order (labels read now, in the current language). `more` is added by `homeGridActions`. */
export function quickActionDefs(): QuickActionDef[] {
  return [
    { id: 'scan', label: t('home.quick.scan'), icon: ScanLine, tone: 'ink', run: () => openBill(), enabled: always },
    { id: 'split', label: t('home.quick.split'), icon: Split, tone: 'accent', run: () => navigate(NEW_SPLIT_PATH), enabled: always },
    { id: 'lend', label: t('home.quick.lend'), icon: ArrowLeftRight, tone: 'accent', run: () => navigate('/app/lend'), enabled: () => LEND_ENABLED },
    { id: 'collect', label: t('home.quick.collect'), icon: HandCoins, tone: 'gift', run: openPools, enabled: () => POOLS_ENABLED },
    { id: 'sms', label: t('home.quick.sms'), icon: MessageSquareText, tone: 'utilities', run: () => navigate('/app/share'), enabled: () => SMS_ENABLED },
    { id: 'food', label: t('home.quick.food'), icon: Bike, tone: 'food', run: () => openBill({ kind: 'delivery' }), enabled: () => DELIVERY_ENABLED },
    { id: 'group', label: t('home.quick.group'), icon: UsersRound, tone: 'entertainment', run: () => navigate(NEW_GROUP_PATH), enabled: always },
  ]
}

/** The everyday templates (Rent, Trip, Subscription, Utilities, Cab): the More sheet's contents. */
export const TEMPLATE_CATEGORIES: readonly CategoryId[] = ['rent', 'travel', 'subscription', 'utilities', 'transport']

const TEMPLATE_LABELS: Readonly<Partial<Record<CategoryId, MessageKey>>> = {
  rent: 'home.template.rent',
  travel: 'home.template.travel',
  subscription: 'home.template.subscription',
  utilities: 'home.template.utilities',
  transport: 'home.template.transport',
}

export function templateActionDefs(): QuickActionDef[] {
  return TEMPLATE_CATEGORIES.map((category) => ({
    id: `template:${category}`,
    label: t(TEMPLATE_LABELS[category] ?? 'home.template.rent'),
    icon: CATEGORY_ICONS[category],
    tone: category,
    run: () => navigate(templatePath(category)),
    enabled: always,
  }))
}

/**
 * The grid: enabled actions in order, templates back-filling to seven, then More (which opens
 * the sheet of all templates).
 */
export function homeGridActions(openMore: () => void): QuickActionDef[] {
  const actions = quickActionDefs().filter((a) => a.enabled())
  const room = Math.max(0, GRID_SIZE - 1 - actions.length)
  const fill = templateActionDefs().slice(0, room)
  const more: QuickActionDef = { id: 'more', label: t('home.quick.more'), icon: LayoutGrid, tone: 'ink', run: openMore, enabled: always }
  return [...actions.slice(0, GRID_SIZE - 1), ...fill, more]
}
