/**
 * Every tool in Settle, in one list: what the Tools hub shows. A tool with a page of its own
 * opens it; one that lives inside a group, a person or an expense says where, and opens the
 * place to pick one. Titles and one-line descriptions of the v10 tools come from each tool's own
 * copy (`<ns>.tool.title`, `<ns>.tool.body`); the older ones are in `src/i18n/en/tools.ts`.
 */
import {
  BadgeIndianRupee,
  Banknote,
  BanknoteArrowDown,
  BookHeart,
  BookText,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarHeart,
  ChartPie,
  CircleCheck,
  CircleHelp,
  CirclePause,
  Coins,
  Gauge,
  Gift,
  Globe,
  HandCoins,
  House,
  Landmark,
  Layers,
  ListChecks,
  LogOut,
  MessagesSquare,
  Milk,
  Percent,
  ReceiptText,
  Repeat,
  Shuffle,
  ShieldAlert,
  Undo2,
  User,
  WalletCards,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { MessageKey } from '../../i18n'

export type ToolSection = 'settle' | 'collect' | 'home' | 'family' | 'out' | 'you'

/** Where a tool lives when it has no page of its own. */
export type ToolPlace = 'group' | 'person' | 'expense' | 'cash'

export interface ToolEntry {
  id: string
  section: ToolSection
  icon: LucideIcon
  title: MessageKey
  body: MessageKey
  /** Where a tap goes. */
  path: string
  /** Set when the tool is used from inside something: the hub says so and opens the list to pick from. */
  place?: ToolPlace
}

export const TOOL_SECTIONS: readonly ToolSection[] = ['settle', 'collect', 'home', 'family', 'out', 'you']

export const TOOLS: readonly ToolEntry[] = [
  // Paying what you owe, and settling a group.
  { id: 'pay-all', section: 'settle', icon: WalletCards, title: 'tools.item.payAll.title', body: 'tools.item.payAll.body', path: '/app/pay-all' },
  { id: 'kist', section: 'settle', icon: Layers, title: 'kist.tool.title', body: 'kist.tool.body', path: '/app/kist' },
  { id: 'promise', section: 'settle', icon: CalendarClock, title: 'promise.tool.title', body: 'promise.tool.body', path: '/app/promises' },
  { id: 'settleday', section: 'settle', icon: CalendarCheck, title: 'settleday.tool.title', body: 'settleday.tool.body', path: '/app/groups', place: 'group' },
  { id: 'checkout', section: 'settle', icon: LogOut, title: 'checkout.tool.title', body: 'checkout.tool.body', path: '/app/groups', place: 'group' },
  { id: 'why', section: 'settle', icon: CircleHelp, title: 'why.tool.title', body: 'why.tool.body', path: '/app/groups', place: 'group' },
  { id: 'units', section: 'settle', icon: House, title: 'units.tool.title', body: 'units.tool.body', path: '/app/groups', place: 'group' },
  { id: 'chhutta', section: 'settle', icon: Coins, title: 'chhutta.tool.title', body: 'chhutta.tool.body', path: '/app/groups', place: 'group' },
  { id: 'kind', section: 'settle', icon: Gift, title: 'kind.tool.title', body: 'kind.tool.body', path: '/app/friends', place: 'person' },
  { id: 'abroad', section: 'settle', icon: Globe, title: 'abroad.tool.title', body: 'abroad.tool.body', path: '/app/friends', place: 'person' },
  { id: 'notes', section: 'settle', icon: Banknote, title: 'notes.tool.title', body: 'notes.tool.body', path: '', place: 'cash' },
  { id: 'refund', section: 'settle', icon: Undo2, title: 'refund.tool.title', body: 'refund.tool.body', path: '/app/activity', place: 'expense' },
  { id: 'hold', section: 'settle', icon: CirclePause, title: 'hold.tool.title', body: 'hold.tool.body', path: '/app/activity', place: 'expense' },

  // Getting money back.
  { id: 'collect', section: 'collect', icon: BadgeIndianRupee, title: 'tools.item.collect.title', body: 'tools.item.collect.body', path: '/app/collect' },
  { id: 'payday', section: 'collect', icon: CalendarHeart, title: 'payday.tool.title', body: 'payday.tool.body', path: '/app/payday' },
  { id: 'whos-paid', section: 'collect', icon: ListChecks, title: 'tools.item.whosPaid.title', body: 'tools.item.whosPaid.body', path: '/app/whos-paid' },
  { id: 'proof', section: 'collect', icon: CircleCheck, title: 'tools.item.proof.title', body: 'tools.item.proof.body', path: '/app/proof' },
  { id: 'passbook', section: 'collect', icon: BookText, title: 'passbook.tool.title', body: 'passbook.tool.body', path: '/app/friends', place: 'person' },
  { id: 'limit', section: 'collect', icon: ShieldAlert, title: 'limit.tool.title', body: 'limit.tool.body', path: '/app/limit' },
  { id: 'byaaj', section: 'collect', icon: Percent, title: 'byaaj.tool.title', body: 'byaaj.tool.body', path: '/app/byaaj' },
  { id: 'lend', section: 'collect', icon: HandCoins, title: 'tools.item.lend.title', body: 'tools.item.lend.body', path: '/app/lend' },

  // The home and the flat.
  { id: 'rent', section: 'home', icon: Building2, title: 'tools.item.rent.title', body: 'tools.item.rent.body', path: '/app/rent' },
  { id: 'bijli', section: 'home', icon: Zap, title: 'tools.item.bijli.title', body: 'tools.item.bijli.body', path: '/app/bijli' },
  { id: 'recurring', section: 'home', icon: Repeat, title: 'tools.item.recurring.title', body: 'tools.item.recurring.body', path: '/app/recurring' },
  { id: 'tally', section: 'home', icon: Milk, title: 'tally.tool.title', body: 'tally.tool.body', path: '/app/tally' },
  { id: 'help', section: 'home', icon: User, title: 'help.tool.title', body: 'help.tool.body', path: '/app/help' },
  { id: 'fairrent', section: 'home', icon: House, title: 'fairrent.tool.title', body: 'fairrent.tool.body', path: '/app/fair-rent' },
  { id: 'committee', section: 'family', icon: Shuffle, title: 'committee.tool.title', body: 'committee.tool.body', path: '/app/committee' },

  // The family.
  { id: 'shagun', section: 'family', icon: BookHeart, title: 'tools.item.shagun.title', body: 'tools.item.shagun.body', path: '/app/shagun' },
  { id: 'pools', section: 'family', icon: HandCoins, title: 'tools.item.pools.title', body: 'tools.item.pools.body', path: '/app/pools' },

  // Going out, trips and work.
  { id: 'chat', section: 'out', icon: MessagesSquare, title: 'tools.item.chat.title', body: 'tools.item.chat.body', path: '/app/chat' },
  { id: 'report', section: 'out', icon: ReceiptText, title: 'tools.item.report.title', body: 'tools.item.report.body', path: '/app/report' },

  // You.
  { id: 'score', section: 'you', icon: Gauge, title: 'tools.item.score.title', body: 'tools.item.score.body', path: '/app/score' },
  { id: 'insights', section: 'you', icon: ChartPie, title: 'tools.item.insights.title', body: 'tools.item.insights.body', path: '/app/insights' },
  { id: 'stuck', section: 'you', icon: BanknoteArrowDown, title: 'tools.item.stuck.title', body: 'tools.item.stuck.body', path: '/app/stuck' },
  { id: 'fees', section: 'you', icon: Landmark, title: 'tools.item.fees.title', body: 'tools.item.fees.body', path: '/app/fees' },
]
