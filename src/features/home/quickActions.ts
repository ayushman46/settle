/**
 * Home's quick actions as a registry, so features add their tile without sharing a file: each
 * entry says when it's on (its feature flag), what it's called and what it does. The grid shows
 * the enabled ones in order, back-fills with everyday templates to seven, and ends with More (the
 * actions and templates that didn't fit) — always two rows of four. When there are more than
 * seven, the spare ones make room first.
 */
import { ArrowLeftRight, BanknoteArrowDown, Bike, Droplets, HandCoins, Landmark, LayoutGrid, MessageSquareText, ScanLine, Split, UsersRound, type LucideIcon } from 'lucide-react'
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
import { FEES_PATH } from '../fees/paths'
import { STUCK_PATH } from '../stuck/paths'
import { NEW_GROUP_PATH, NEW_SPLIT_PATH, templatePath } from './homeLinks'

export type QuickActionId = 'scan' | 'split' | 'lend' | 'collect' | 'sms' | 'food' | 'stuck' | 'fees' | 'group' | 'more'

export interface QuickActionDef {
  /** A `QuickActionId`, or `template:<category>` for a template tile. */
  id: string
  label: string
  icon: LucideIcon
  tone: QuickActionTone
  run: () => void
  enabled: () => boolean
  /** Makes room first when there are more actions than tiles (it's in More then). */
  spare?: boolean
}

export interface GridOptions {
  /** Home shows Stuck money's card (something's still owed), so its tile isn't needed on the grid. */
  stuckCard?: boolean
}

/** Tiles in the grid: seven actions, then More. */
export const GRID_SIZE = 8

const always = () => true

/** Collections: the list when there are any, else straight to a new one. */
function openPools(): void {
  navigate(poolsStore.get().length > 0 ? '/app/pools' : '/app/pools/new')
}

/** The registry, in grid order (labels read now, in the current language). `more` is added by `homeGridActions`. */
export function quickActionDefs({ stuckCard = false }: GridOptions = {}): QuickActionDef[] {
  return [
    { id: 'scan', label: t('home.quick.scan'), icon: ScanLine, tone: 'ink', run: () => openBill(), enabled: always },
    { id: 'split', label: t('home.quick.split'), icon: Split, tone: 'accent', run: () => navigate(NEW_SPLIT_PATH), enabled: always },
    { id: 'lend', label: t('home.quick.lend'), icon: ArrowLeftRight, tone: 'accent', run: () => navigate('/app/lend'), enabled: () => LEND_ENABLED },
    // Group collections (gifts, parties): the first to move to More when the grid is full.
    { id: 'collect', label: t('home.quick.collect'), icon: HandCoins, tone: 'gift', run: openPools, enabled: () => POOLS_ENABLED, spare: true },
    // Money a bank or shop owes you: on the grid while nothing's owed, so it's found before it's
    // needed. While something is, Home's card leads there (and More still has it), and the tile
    // makes way — for Group collection, back in its place.
    { id: 'stuck', label: t('home.quick.stuck'), icon: BanknoteArrowDown, tone: 'accent', run: () => navigate(STUCK_PATH), enabled: () => !stuckCard },
    // Charges your bank shouldn't have taken: always on the grid, next to Stuck money.
    { id: 'fees', label: t('fees.tile'), icon: Landmark, tone: 'accent', run: () => navigate(FEES_PATH), enabled: always },
    // Pasting an SMS to split it: the second to move to More when the grid is full (sharing an SMS in still works).
    { id: 'sms', label: t('home.quick.sms'), icon: MessageSquareText, tone: 'utilities', run: () => navigate('/app/share'), enabled: () => SMS_ENABLED, spare: true },
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

/** Tiles whose category icon would repeat a feature's (Utilities' bolt beside Electricity's). */
const TEMPLATE_ICONS: Readonly<Partial<Record<CategoryId, LucideIcon>>> = {
  utilities: Droplets,
}

export function templateActionDefs(): QuickActionDef[] {
  return TEMPLATE_CATEGORIES.map((category) => ({
    id: `template:${category}`,
    label: t(TEMPLATE_LABELS[category] ?? 'home.template.rent'),
    icon: TEMPLATE_ICONS[category] ?? CATEGORY_ICONS[category],
    tone: category,
    run: () => navigate(templatePath(category)),
    enabled: always,
  }))
}

/**
 * The enabled actions, split into those on the grid (in order) and those that don't fit: with
 * more than seven, spare ones step aside first (the last spare first), then the last ones.
 */
function placeActions(options: GridOptions): { shown: QuickActionDef[]; rest: QuickActionDef[] } {
  const actions = quickActionDefs(options).filter((a) => a.enabled())
  let extra = actions.length - (GRID_SIZE - 1)
  const aside = new Set<QuickActionDef>()
  for (let i = actions.length - 1; i >= 0 && extra > 0; i--) {
    const action = actions[i]
    if (action?.spare) {
      aside.add(action)
      extra -= 1
    }
  }
  const shown = actions.filter((a) => !aside.has(a)).slice(0, GRID_SIZE - 1)
  return { shown, rest: actions.filter((a) => !shown.includes(a)) }
}

/** Enabled actions that don't fit the grid (Group collection, with everything on and nothing stuck yet): the More sheet offers them. */
export function overflowActions(options: GridOptions = {}): QuickActionDef[] {
  return placeActions(options).rest
}

/**
 * The grid: enabled actions in order, templates back-filling to seven, then More (which opens
 * the sheet of the rest and all templates).
 */
export function homeGridActions(openMore: () => void, options: GridOptions = {}): QuickActionDef[] {
  const { shown } = placeActions(options)
  const fill = templateActionDefs().slice(0, Math.max(0, GRID_SIZE - 1 - shown.length))
  const more: QuickActionDef = { id: 'more', label: t('home.quick.more'), icon: LayoutGrid, tone: 'ink', run: openMore, enabled: always }
  return [...shown, ...fill, more]
}
