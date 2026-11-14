import { useMemo, useState } from 'react'
import { Check, Share2 } from 'lucide-react'
import { AmountInput, Banner, BottomSheet, Button, Card, Chip, useToast } from '../../components'
import { DataError, deleteSettlement, recordSettlement, useExpenses, useFriendsById, useGroup, useProfile } from '../../data'
import { ME_ID, type Group, type Settlement } from '../../domain/types'
import { today as todayIso } from '../../engine/dates'
import { isValidTotal } from '../../engine/split'
import { useT } from '../../i18n'
import { FriendAvatar, friendLabel } from '../../kit/index-a'
import { UpiPaySheet, upiPaymentForTransfer } from '../../kit/index-b'
import { haptic } from '../../lib/haptics'
import { currencyDigits, formatMoney, parseMoneyInput, toInputString } from '../../lib/money'
import { shareResult } from '../../lib/share'
import { isValidUpiId, normalizeUpiId } from '../../lib/upi'
import { kittyView, suggestedHolder, type KittyConfig, type KittyView } from './engine'
import { lastsLabel, sinceLabel } from './kittyText'
import { endKitty, setKitty, useKittyConfig } from './store'
import styles from './Kitty.module.css'

export interface KittySheetProps {
  group: Group
  open: boolean
  onClose: () => void
}

/** Quick picks for the amount each, in whole currency units. */
const AMOUNT_CHIPS = [500, 1000, 2000, 5000] as const
const DEFAULT_AMOUNT = 2000

/**
 * The trip kitty: start one (who holds it, how much each), then see what's been put in, spent and
 * left, tick people off as they hand money over, pay your own part by UPI, ask the group in one
 * message, top it up when it runs low, and end it. Null for a group of one or an archived group.
 */
export function KittySheet({ group: given, open, onClose }: KittySheetProps) {
  const t = useT()
  // The live group, so payments recorded here show at once (the prop may be a snapshot).
  const group = useGroup(given.id) ?? given
  const config = useKittyConfig(group.id)
  const expenses = useExpenses({ groupId: group.id })
  const day = todayIso()
  const view = useMemo(() => (config ? kittyView(group, expenses, config, day) : null), [config, group, expenses, day])
  // The kitty just ended here: say so on the start form until the sheet closes or a new one starts.
  const [ended, setEnded] = useState<Ended | null>(null)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (!open) setEnded(null)
  }
  if (group.archived || group.memberIds.length < 2) return null

  return (
    <BottomSheet open={open} onClose={onClose} eyebrow={`${group.emoji} ${group.name}`} title={t('kitty.sheet.title')} size="tall">
      {config && view ? (
        <Running group={group} config={config} view={view} today={day} onEnded={setEnded} />
      ) : (
        <Setup group={group} open={open} ended={ended} onStarted={() => setEnded(null)} />
      )}
    </BottomSheet>
  )
}

/** What a kitty that just ended left behind: who held it and how much of the others' money. */
interface Ended {
  holderId: string
  left: number
}

/* ------------------------------------------------------------------ starting one */

function Setup({ group, open, ended, onStarted }: { group: Group; open: boolean; ended: Ended | null; onStarted: () => void }) {
  const t = useT()
  const toast = useToast()
  const friendsById = useFriendsById()
  const expenses = useExpenses({ groupId: group.id })
  const nameOf = (id: string): string => friendLabel(id, friendsById[id] ?? null)
  const unit = 10 ** currencyDigits(group.currency)
  const suggested = suggestedHolder(group, expenses, nameOf)
  const [holder, setHolder] = useState(suggested)
  const [text, setText] = useState(() => toInputString(DEFAULT_AMOUNT * unit, group.currency, { trimZeros: true }))
  // Fresh choices each time the sheet opens.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setHolder(suggested)
      setText(toInputString(DEFAULT_AMOUNT * unit, group.currency, { trimZeros: true }))
    }
  }
  const holderId = group.memberIds.includes(holder) ? holder : suggested
  const amount = parseMoneyInput(text, group.currency)
  const valid = amount !== null && isValidTotal(amount)
  const money = (paise: number): string => formatMoney(paise, group.currency, { trimZeros: true })

  const start = (): void => {
    if (!valid) return
    setKitty(group.id, { holderId, perHead: amount, startedOn: todayIso(), startedAt: Date.now() })
    onStarted()
    haptic('success')
    toast(holderId === ME_ID ? t('kitty.setup.started.you') : t('kitty.setup.started', { name: nameOf(holderId) }), {
      tone: 'success',
      action: { label: t('common.action.undo'), onAction: () => endKitty(group.id) },
    })
  }

  return (
    <div className={styles.sheet}>
      {ended && (
        <Banner tone="success" title={t('kitty.ended.title')}>
          {ended.left === 0
            ? t('kitty.ended.body.empty')
            : ended.holderId === ME_ID
              ? t('kitty.ended.body.you', { amount: money(ended.left) })
              : t('kitty.ended.body', { name: nameOf(ended.holderId), amount: money(ended.left) })}
        </Banner>
      )}
      <p className={styles.body}>{t('kitty.setup.body')}</p>
      <section className={styles.block} aria-labelledby="kitty-holder">
        <h3 id="kitty-holder" className={styles.label}>
          {t('kitty.setup.holder')}
        </h3>
        <div className={styles.chips} role="group" aria-labelledby="kitty-holder">
          {group.memberIds.map((id) => (
            <Chip key={id} size="lg" selected={id === holderId} onClick={() => setHolder(id)} leading={<FriendAvatar friendId={id} size="xs" />}>
              <span className={styles.chipName}>{nameOf(id)}</span>
            </Chip>
          ))}
        </div>
      </section>
      <section className={styles.block} aria-labelledby="kitty-amount">
        <h3 id="kitty-amount" className={styles.label}>
          {t('kitty.setup.amount')}
        </h3>
        <div className={styles.chips}>
          {AMOUNT_CHIPS.map((units) => (
            <Chip key={units} size="lg" selected={amount === units * unit} onClick={() => setText(toInputString(units * unit, group.currency, { trimZeros: true }))}>
              {money(units * unit)}
            </Chip>
          ))}
        </div>
        <AmountInput
          size="field"
          label={t('kitty.setup.amount.label')}
          currency={group.currency}
          value={text}
          onChange={setText}
          enterKeyHint="done"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) start()
          }}
          error={valid || text.trim() === '' ? undefined : t('kitty.setup.amount.error')}
        />
      </section>
      <Button block disabled={!valid} onClick={start}>
        {valid ? t('kitty.setup.start', { amount: money(amount) }) : t('kitty.setup.amount.error')}
      </Button>
    </div>
  )
}

/* ------------------------------------------------------------------ a running kitty */

interface RunningProps {
  group: Group
  config: KittyConfig
  view: KittyView
  today: string
  onEnded: (ended: Ended) => void
}

function Running({ group, config, view, today, onEnded }: RunningProps) {
  const t = useT()
  const toast = useToast()
  const friendsById = useFriendsById()
  const profile = useProfile()
  const [paying, setPaying] = useState<{ amount: number; open: boolean } | null>(null)
  const nameOf = (id: string): string => friendLabel(id, friendsById[id] ?? null)
  // In a message others read, "You" would mean the reader: name the sender instead.
  const sharedName = (id: string): string => (id === ME_ID ? profile.name.trim() || t('kitty.ask.me') : nameOf(id))
  const money = (paise: number): string => formatMoney(paise, group.currency, { trimZeros: true })
  const holderId = view.holderId
  const holderName = nameOf(holderId)
  const youHold = holderId === ME_ID
  const upi = group.currency === 'INR'

  const holderUpi = ((): string | null => {
    const raw = youHold ? (profile.upiId ?? friendsById[ME_ID]?.upiId ?? null) : (friendsById[holderId]?.upiId ?? null)
    return raw && isValidUpiId(raw) ? normalizeUpiId(raw) : null
  })()

  const record = (fromId: string, amount: number, method: Settlement['method']): void => {
    let saved: Settlement
    try {
      saved = recordSettlement(group.id, { fromId, toId: holderId, amount, date: todayIso(), method })
    } catch (error) {
      if (!(error instanceof DataError)) throw error
      haptic('error')
      toast(t('kitty.got.failed'), { tone: 'error' })
      return
    }
    haptic('success')
    toast(fromId === ME_ID ? t('kitty.got.done.you', { amount: money(amount) }) : t('kitty.got.done', { name: nameOf(fromId), amount: money(amount) }), {
      tone: 'success',
      action: { label: t('common.action.undo'), onAction: () => deleteSettlement(group.id, saved.id) },
    })
  }

  const share = async (text: string): Promise<void> => {
    const outcome = await shareResult(text, { title: t('kitty.sheet.title') })
    if (outcome === 'copied') toast(t('kitty.ask.copied'), { tone: 'success' })
    else if (outcome === 'failed') toast(t('kitty.ask.failed'), { tone: 'error' })
  }

  const askEveryone = (): void => {
    const lines = [
      youHold
        ? t('kitty.ask.message.you', { group: group.name, amount: money(config.perHead) })
        : t('kitty.ask.message', { group: group.name, amount: money(config.perHead), name: holderName }),
    ]
    if (holderUpi) lines.push(t('kitty.ask.upi', { upi: holderUpi }))
    const waiting = view.members.filter((m) => !m.done).map((m) => `${sharedName(m.id)} (${money(m.toPutIn)})`)
    if (waiting.length > 0) lines.push(t('kitty.ask.waiting', { names: waiting.join(', ') }))
    void share(lines.join('\n'))
  }

  const topUp = (extra: number): void => {
    const before = config
    const total = config.perHead + extra
    setKitty(group.id, { ...config, perHead: total })
    haptic('success')
    toast(t('kitty.topUp.done', { amount: money(total) }), {
      tone: 'success',
      action: { label: t('common.action.undo'), onAction: () => setKitty(group.id, before) },
    })
    const lines = [youHold ? t('kitty.topUp.message.you', { group: group.name, total: money(total) }) : t('kitty.topUp.message', { group: group.name, total: money(total), name: holderName })]
    if (holderUpi) lines.push(t('kitty.ask.upi', { upi: holderUpi }))
    // Each person's own amount: someone who put in less before owes more than the extra.
    const owing = view.members.filter((m) => !m.holder && total > m.putIn).map((m) => `${sharedName(m.id)} (${money(total - m.putIn)})`)
    if (owing.length > 0) lines.push(t('kitty.ask.waiting', { names: owing.join(', ') }))
    void share(lines.join('\n'))
  }

  const end = (): void => {
    const before = config
    const left = view.left
    endKitty(group.id)
    onEnded({ holderId, left })
    haptic('tap')
    toast(left > 0 ? t('kitty.end.done', { amount: money(left) }) : t('kitty.end.done.empty'), {
      action: { label: t('common.action.undo'), onAction: () => setKitty(group.id, before) },
    })
  }

  const lastsInWords = view.runsOutOn === null || (view.daysLeft === 0 && view.left === 0)
  const lasts =
    view.runsOutOn === null ? t('kitty.summary.lasts.none') : lastsInWords ? t('kitty.summary.lasts.out') : lastsLabel(view.runsOutOn, today)
  const since = sinceLabel(view.startedOn, today, view.startedOn === config.startedOn ? config.startedAt : undefined)
  const payment = paying ? upiPaymentForTransfer({ fromId: ME_ID, toId: holderId, amount: paying.amount }, group.currency, friendsById, group.name) : null

  return (
    <div className={styles.sheet}>
      <Card tone="sunken">
        <dl className={styles.stats} aria-label={t('kitty.summary.aria')}>
          <div className={styles.stat}>
            <dt>{t('kitty.summary.collected')}</dt>
            <dd>{money(view.fromOthers)}</dd>
          </div>
          <div className={styles.stat}>
            <dt>{t('kitty.summary.spent')}</dt>
            <dd>{money(view.othersSpent)}</dd>
          </div>
          <div className={styles.stat}>
            <dt>{t('kitty.summary.left')}</dt>
            <dd>{money(view.left)}</dd>
          </div>
          <div className={styles.stat}>
            <dt>{t('kitty.summary.lasts')}</dt>
            <dd className={lastsInWords ? styles.statText : undefined}>{lasts}</dd>
          </div>
        </dl>
      </Card>
      <p className={styles.fine}>
        {view.othersPerDay > 0
          ? `${t('kitty.pace', { perDay: money(view.othersPerDay) })} `
          : view.spent === 0
            ? `${youHold ? t('kitty.pace.none.you') : t('kitty.pace.none', { name: holderName })} `
            : ''}
        {youHold ? t('kitty.left.explain.you', { date: since }) : t('kitty.left.explain', { name: holderName, date: since })}
      </p>
      {view.over > 0 && (
        <p className={styles.fine}>{youHold ? t('kitty.over.you', { amount: money(view.over) }) : t('kitty.over', { name: holderName, amount: money(view.over) })}</p>
      )}
      {view.holderSpent > 0 && (
        <p className={styles.fine}>
          {youHold ? t('kitty.holder.line.you', { amount: money(view.holderSpent) }) : t('kitty.holder.line', { name: holderName, amount: money(view.holderSpent) })}
        </p>
      )}

      {view.topUp !== null && (
        <Banner
          tone="warning"
          title={t('kitty.topUp.title')}
          actions={
            <Button size="md" onClick={() => topUp(view.topUp ?? 0)}>
              {t('kitty.topUp.cta', { amount: money(view.topUp) })}
            </Button>
          }
        >
          {t('kitty.topUp.body', { amount: money(view.topUp) })}
        </Banner>
      )}

      <p className={styles.fine}>{t('kitty.perHead', { amount: money(view.perHead) })}</p>
      <Card padding="none">
        <ul className={styles.rows} aria-label={t('kitty.people.aria')}>
          {view.members.map((m) => {
            const name = nameOf(m.id)
            const mine = m.id === ME_ID
            let detail: string | null = null
            // Only once something has been put in or spent on them: a ₹0 part says nothing.
            if (!m.holder && m.part > 0 && m.spentOn > 0) detail = mine ? t('kitty.row.part.you', { amount: money(m.part) }) : t('kitty.row.part', { amount: money(m.part) })
            else if (!m.holder && m.part < 0) detail = mine ? t('kitty.row.short.you', { amount: money(-m.part) }) : t('kitty.row.short', { amount: money(-m.part) })
            return (
              <li key={m.id} className={styles.row} data-done={m.done || undefined}>
                <FriendAvatar friendId={m.id} size="md" />
                <span className={styles.who}>
                  <span className={styles.name}>{name}</span>
                  <span className={m.done ? styles.good : styles.sub}>
                    {m.holder
                      ? t('kitty.row.holds')
                      : m.done
                        ? t('kitty.row.putIn', { amount: money(m.putIn) })
                        : m.putIn > 0
                          ? t('kitty.row.partly', { putIn: money(m.putIn), amount: money(m.toPutIn) })
                          : t('kitty.row.toPutIn', { amount: money(m.toPutIn) })}
                    {m.done && !m.holder && <Check aria-hidden="true" className={styles.tick} />}
                  </span>
                  {detail && <span className={styles.sub}>{detail}</span>}
                </span>
                {!m.done && youHold && (
                  <Button size="md" variant="secondary" onClick={() => record(m.id, m.toPutIn, 'upi')} aria-label={t('kitty.row.got.aria', { name, amount: money(m.toPutIn) })}>
                    {t('kitty.row.got')}
                  </Button>
                )}
                {!m.done && mine && !youHold && upi && (
                  <Button size="md" onClick={() => setPaying({ amount: m.toPutIn, open: true })}>
                    {t('kitty.row.pay', { amount: money(m.toPutIn), name: holderName })}
                  </Button>
                )}
                {!m.done && mine && !youHold && !upi && (
                  <Button size="md" variant="secondary" onClick={() => record(ME_ID, m.toPutIn, 'other')}>
                    {t('kitty.row.paid', { amount: money(m.toPutIn) })}
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      </Card>

      <Button block variant="secondary" iconStart={<Share2 />} onClick={askEveryone}>
        {t('kitty.ask.cta')}
      </Button>

      <div className={styles.end}>
        <Button variant="ghost" size="md" onClick={end}>
          {t('kitty.end.cta')}
        </Button>
        <p className={styles.fine}>{t('kitty.end.note')}</p>
      </div>

      {payment && paying && (
        <UpiPaySheet
          open={paying.open}
          onClose={() => setPaying((p) => p && { ...p, open: false })}
          {...payment}
          onMarkPaid={() => {
            setPaying((p) => p && { ...p, open: false })
            record(ME_ID, paying.amount, 'upi')
          }}
        />
      )}
    </div>
  )
}
