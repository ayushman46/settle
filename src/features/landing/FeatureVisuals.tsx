import type { JSX } from 'react'
import { ArrowRight, Check, CircleCheck, Link2, Lock, Repeat, ShieldCheck, Smartphone, Sparkles, WifiOff } from 'lucide-react'
import {
  Avatar,
  AvatarStack,
  CategoryIcon,
  categoryColor,
  DonutChart,
  Money,
  ProgressRing,
  Receipt,
  ReceiptDivider,
  ReceiptRow,
  Switch,
} from '../../components'
import { BRAND } from '../../domain/types'
import { cx } from '../../lib/cx'
import { formatMoney } from '../../lib/money'
import { NUDGE_TONES, nudgeText } from '../../share/nudge'
import {
  billDemo,
  BILL_DEMO,
  collectDemo,
  COLLECT_EXPENSE,
  DEMO_CURRENCY,
  describeDemo,
  DESCRIBE_TEXT,
  groupDemo,
  GROUP_DEMO,
  INSIGHTS_DEMO,
  RECURRING_DEMO,
} from './demo'
import type { FeatureId } from './featureList'
import styles from './FeatureVisuals.module.css'

const money = (minor: number) => formatMoney(minor, DEMO_CURRENCY, { trimZeros: true })
const noop = () => {}

function ScanVisual() {
  const bill = billDemo()
  return (
    <div className={styles.scan}>
      <Receipt padding="sm" className={styles.receipt}>
        <p className={styles.merchant}>{BILL_DEMO.merchant}</p>
        <div className={styles.items}>
          {bill.items.map((item) => (
            <div key={item.name} className={styles.item}>
              <span className={styles.itemName}>{item.name}</span>
              <AvatarStack people={item.people} size="xs" max={3} />
              <Money value={item.amount} currency={DEMO_CURRENCY} size="sm" trimZeros className={styles.itemAmount} />
            </div>
          ))}
        </div>
        <ReceiptDivider spacing="sm" />
        <ReceiptRow label={BILL_DEMO.taxLabel} value={<Money value={bill.tax} currency={DEMO_CURRENCY} size="sm" />} emphasis="muted" />
        <ReceiptRow label="Total" value={<Money value={bill.total} currency={DEMO_CURRENCY} trimZeros strong />} emphasis="strong" />
      </Receipt>
      <span className={styles.scanLine} />
      <span className={styles.aiChip}>
        <Sparkles strokeWidth={2.25} />
        Read by AI
      </span>
    </div>
  )
}

function DescribeVisual() {
  const split = describeDemo()
  return (
    <div className={styles.describe}>
      <div className={styles.pill}>
        <span className={styles.sparkle}>
          <Sparkles strokeWidth={2.25} />
        </span>
        <span className={styles.pillText}>{DESCRIBE_TEXT}</span>
      </div>
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <CategoryIcon category={split.category} size="sm" />
          <span className={styles.cardTitle}>{split.title}</span>
          <Money value={split.total} currency={DEMO_CURRENCY} trimZeros strong />
        </div>
        <div className={styles.people}>
          {split.rows.map((row) => (
            <div key={row.id} className={styles.person}>
              <Avatar name={row.name} color={row.color} size="xs" />
              <span className={styles.personName}>{row.name}</span>
              <span className={styles.tag}>{row.hint}</span>
              <Money value={row.amount} currency={DEMO_CURRENCY} size="sm" trimZeros strong />
            </div>
          ))}
        </div>
        <span className={styles.ready}>
          <Check strokeWidth={3} />
          Looks right
        </span>
      </div>
    </div>
  )
}

function PayLinkVisual() {
  const collect = collectDemo()
  return (
    <div className={styles.paylink}>
      <div className={styles.bubble}>
        <p>
          {COLLECT_EXPENSE.title} — {money(collect.share)} each. Tap your name to pay 👇
        </p>
        <span className={styles.linkChip}>
          <Link2 strokeWidth={2.25} />
          Pay {COLLECT_EXPENSE.payee} · {money(COLLECT_EXPENSE.total)}
        </span>
      </div>
      <div className={styles.whoList}>
        {collect.rows.map((row) => (
          <div key={row.id} className={cx(styles.who, !row.paid && styles.whoActive)}>
            <Avatar name={row.name} color={row.color} size="xs" />
            <span className={styles.personName}>{row.name}</span>
            {row.paid ? (
              <span className={styles.paid}>
                <Check strokeWidth={3} />
                Paid
              </span>
            ) : (
              <span className={styles.payPill}>Pay {money(row.amount)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function CollectVisual() {
  const collect = collectDemo()
  const owed = collect.collected + collect.outstanding
  const pending = collect.rows.find((row) => !row.paid)
  const nudge = nudgeText({
    tone: 'friendly',
    toName: pending?.name ?? 'Neha',
    amount: pending?.amount ?? collect.share,
    currency: DEMO_CURRENCY,
    title: COLLECT_EXPENSE.title,
    payeeName: COLLECT_EXPENSE.payee,
    payeeUpi: null,
    link: null,
  })
  return (
    <div className={styles.collect}>
      <div className={styles.progress}>
        <ProgressRing value={owed > 0 ? collect.collected / owed : 0} size={60} stroke={7}>
          <span className={styles.ringText}>
            {collect.paidCount}/{collect.rows.length}
          </span>
        </ProgressRing>
        <p className={styles.progressText}>
          <span className={styles.strong}>{money(collect.collected)}</span> of {money(owed)} collected
          <span className={styles.muted}>
            {collect.paidCount} of {collect.rows.length} paid
          </span>
        </p>
      </div>
      <div className={styles.tones}>
        {NUDGE_TONES.map((tone, i) => (
          <span key={tone.tone} className={cx(styles.tone, i === 0 && styles.toneOn)}>
            {tone.emoji} {tone.label}
          </span>
        ))}
      </div>
      <p className={styles.nudge}>{nudge}</p>
    </div>
  )
}

function GroupsVisual() {
  const { members, transfers } = groupDemo()
  return (
    <div className={styles.groups}>
      <div className={styles.groupHead}>
        <span className={styles.groupEmoji}>{GROUP_DEMO.emoji}</span>
        <span className={styles.groupText}>
          <span className={styles.groupName}>{GROUP_DEMO.name}</span>
          <span className={styles.muted}>
            {members.length} people · {GROUP_DEMO.expenses} expenses
          </span>
        </span>
        <AvatarStack people={members} size="xs" max={4} />
      </div>
      <div className={styles.transfers}>
        {transfers.map((t) => (
          <div key={`${t.fromId}-${t.toId}`} className={styles.transfer}>
            <Avatar name={t.from.name} color={t.from.color} size="xs" />
            <ArrowRight className={styles.arrow} strokeWidth={2.5} />
            <Avatar name={t.to.name} color={t.to.color} size="xs" />
            <span className={styles.personName}>
              {t.from.name} → {t.to.name}
            </span>
            <Money value={t.amount} currency={DEMO_CURRENCY} size="sm" trimZeros strong />
          </div>
        ))}
      </div>
      <p className={styles.footnote}>
        {transfers.length} payments square up all {GROUP_DEMO.expenses} expenses
      </p>
    </div>
  )
}

const MODE_CHIPS = ['Equally', 'Exact amounts', 'Percentages', 'Shares ×2', 'Item by item']

function ModesVisual() {
  return (
    <div className={styles.modes}>
      <div className={styles.chips}>
        {MODE_CHIPS.map((label, i) => (
          <span key={label} className={cx(styles.chip, i === 3 && styles.chipOn)}>
            {i === 3 && <Check strokeWidth={3} />}
            {label}
          </span>
        ))}
      </div>
      <div className={styles.switchCard}>
        <Switch checked onChange={noop} label="Round to whole ₹" description="The payer keeps the paise" />
      </div>
    </div>
  )
}

function CardsVisual() {
  const collect = collectDemo()
  return (
    <div className={styles.cards}>
      <div className={cx(styles.shareCard, styles.shareCardBack)} />
      <div className={styles.shareCard}>
        <div className={styles.shareHead}>
          <CategoryIcon category="food" size="sm" />
          <span className={styles.cardTitle}>{COLLECT_EXPENSE.title}</span>
        </div>
        <p className={styles.shareAmount}>
          <span className={styles.underline}>{money(COLLECT_EXPENSE.total)}</span>
        </p>
        <div className={styles.shareRows}>
          {collect.rows.map((row) => (
            <div key={row.id} className={styles.shareRow}>
              <Avatar name={row.name} color={row.color} size="xs" />
              <span className={styles.personName}>{row.name}</span>
              {row.paid && <CircleCheck className={styles.tick} strokeWidth={2.5} />}
              <Money value={row.amount} currency={DEMO_CURRENCY} size="sm" />
            </div>
          ))}
        </div>
        <p className={styles.madeWith}>Made with {BRAND.name}</p>
      </div>
    </div>
  )
}

function PrivacyVisual() {
  const points = [
    { icon: <Lock strokeWidth={2.25} />, text: 'No account to create' },
    { icon: <Smartphone strokeWidth={2.25} />, text: 'Data stays on your phone' },
    { icon: <WifiOff strokeWidth={2.25} />, text: 'Works offline' },
  ]
  return (
    <div className={styles.privacy}>
      <span className={styles.shield}>
        <ShieldCheck strokeWidth={2} />
      </span>
      <div className={styles.points}>
        {points.map((point) => (
          <div key={point.text} className={styles.point}>
            {point.icon}
            {point.text}
          </div>
        ))}
      </div>
    </div>
  )
}

function RecurringVisual() {
  return (
    <div className={styles.recurring}>
      {RECURRING_DEMO.map((bill, i) => (
        <div key={bill.title} className={styles.bill}>
          <CategoryIcon category={bill.category} size="sm" />
          <span className={styles.billText}>
            <span className={styles.billTitle}>
              {bill.title}
              <Repeat className={styles.repeat} strokeWidth={2.5} />
            </span>
            <span className={styles.muted}>{bill.due}</span>
          </span>
          {i === 0 ? (
            <span className={styles.splitNow}>Split now</span>
          ) : (
            <Money value={bill.amount} currency={DEMO_CURRENCY} size="sm" trimZeros strong />
          )}
        </div>
      ))}
    </div>
  )
}

function InsightsVisual() {
  const total = INSIGHTS_DEMO.reduce((sum, d) => sum + d.amount, 0)
  const data = INSIGHTS_DEMO.map((d) => ({ key: d.category, value: d.amount, color: categoryColor(d.category), label: d.label }))
  return (
    <div className={styles.insights}>
      <DonutChart
        data={data}
        size={148}
        thickness={18}
        centerLabel="This month"
        centerValue={<Money value={total} currency={DEMO_CURRENCY} trimZeros strong />}
        ariaLabel="Spending by category"
        className={styles.donut}
      />
      <div className={styles.legend}>
        {INSIGHTS_DEMO.slice(0, 4).map((d) => (
          <div key={d.category} className={styles.legendRow}>
            <span className={styles.dot} style={{ background: categoryColor(d.category) }} />
            <span className={styles.personName}>{d.label}</span>
            <Money value={d.amount} currency={DEMO_CURRENCY} size="sm" trimZeros />
          </div>
        ))}
      </div>
    </div>
  )
}

const VISUALS: Readonly<Record<FeatureId, () => JSX.Element>> = {
  scan: ScanVisual,
  describe: DescribeVisual,
  paylink: PayLinkVisual,
  collect: CollectVisual,
  groups: GroupsVisual,
  modes: ModesVisual,
  cards: CardsVisual,
  privacy: PrivacyVisual,
  recurring: RecurringVisual,
  insights: InsightsVisual,
}

/**
 * A feature's mini mockup, built from the real design-system components with numbers from the
 * real engine. Pure decoration (the tile's text says it all), so it's hidden from assistive tech
 * and can't take focus.
 */
export function FeatureVisual({ id }: { id: FeatureId }) {
  const Visual = VISUALS[id]
  return (
    <div className={cx(styles.visual, styles[`v-${id}`])} aria-hidden="true" inert>
      <Visual />
    </div>
  )
}
