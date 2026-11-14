import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { ArrowRight, Check, FileText, Lock, MessagesSquare, TriangleAlert } from 'lucide-react'
import { goBack, navigate, useSearchParams } from '../../app/router'
import { ActionBar, Banner, Button, Chip, PageTitle, Screen, TextField, TopBar, useToast } from '../../components'
import { useGroups, useProfile } from '../../data'
import { MAX_GROUP_NAME_LENGTH } from '../../data/schemas'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { relativeDateLabel } from '../../kit/dateLabel'
import { cx } from '../../lib/cx'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { groupPath } from '../groups/paths'
import { applyChat, guessMe, undoChat } from './build'
import { readChatFile, takeSharedChat, type ChatSource } from './files'
import { parseChat } from './parse'
import { readChat, type ChatReading, type ChatRow, type Doubt } from './read'
import { groupForChat, seenIn } from './store'
import styles from './Chat.module.css'

const DOUBT_KEYS: Record<Doubt, MessageKey> = {
  short: 'chat.doubt.short',
  price: 'chat.doubt.price',
  amounts: 'chat.doubt.amounts',
  each: 'chat.doubt.each',
  people: 'chat.doubt.people',
  untitled: 'chat.doubt.untitled',
}

type Stage = { kind: 'start'; problem: string | null } | { kind: 'reading' } | { kind: 'review'; reading: ChatReading; chatName: string | null }

/** "Not in the chat": you're in the group, you just never wrote in it. */
const NOBODY = '\u0000nobody'

/**
 * `/app/chat` — Chat to split. Pick the chat WhatsApp exported (or paste messages): Settle reads
 * who paid for what, on this phone, and shows it to be checked; one tap makes the group with its
 * people, every expense split and every payment recorded. `?group=<id>` adds to that group. The
 * same chat again later adds only what is new.
 */
export function ChatScreen() {
  const t = useT()
  const toast = useToast()
  const profile = useProfile()
  const groups = useGroups()
  const query = useSearchParams()
  const forcedGroup = groups.find((g) => g.id === query.get('group') && !g.archived) ?? null
  const input = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<Stage>({ kind: 'start', problem: null })
  const [pasting, setPasting] = useState(false)
  const [pasted, setPasted] = useState('')
  const [me, setMe] = useState<string | null>(null)
  const [groupId, setGroupId] = useState<string | null>(null)
  const [groupName, setGroupName] = useState('')
  const [off, setOff] = useState<ReadonlySet<string>>(new Set())
  const [on, setOn] = useState<ReadonlySet<string>>(new Set())
  const money = (paise: number): string => formatMoney(paise, profile.currency, { trimZeros: true })

  const open = (source: ChatSource): void => {
    const file = parseChat(source.text, source.name)
    const reading = readChat(file)
    const chatName = file.name
    if (reading.messages === 0) {
      haptic('error')
      setStage({ kind: 'start', problem: t('chat.problem.notChat') })
      return
    }
    if (reading.rows.length === 0) {
      haptic('error')
      setStage({ kind: 'start', problem: t('chat.problem.noMoney', { count: reading.messages }) })
      return
    }
    const remembered = forcedGroup?.id ?? groupForChat(chatName)
    const target = groups.find((g) => g.id === remembered && !g.archived) ?? null
    setGroupId(target?.id ?? null)
    setGroupName((chatName ?? '').slice(0, MAX_GROUP_NAME_LENGTH))
    setMe(guessMe(reading.members, profile.name))
    setOff(new Set())
    setOn(new Set())
    haptic('success')
    setStage({ kind: 'review', reading, chatName })
  }

  // A chat shared into Settle from WhatsApp arrives already read: opened once, as the screen appears.
  const opened = useRef(false)
  useEffect(() => {
    if (opened.current) return
    opened.current = true
    const shared = takeSharedChat()
    if (shared) queueMicrotask(() => open(shared))
    // Once, when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pick = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setStage({ kind: 'reading' })
    const source = await readChatFile(file)
    if (!source) {
      haptic('error')
      setStage({ kind: 'start', problem: t('chat.problem.file') })
      return
    }
    open(source)
  }

  if (stage.kind !== 'review') {
    return (
      <Screen header={<TopBar onBack={() => goBack('/app')} />} contentClassName={styles.content}>
        <PageTitle title={t('chat.title')} subtitle={t('chat.subtitle')} />
        <div className={styles.hero}>
          <span className={styles.heroIcon} aria-hidden="true">
            <MessagesSquare />
          </span>
          <ol className={styles.steps}>
            <li>{t('chat.how.1')}</li>
            <li>{t('chat.how.2')}</li>
            <li>{t('chat.how.3')}</li>
          </ol>
          <input ref={input} type="file" accept=".txt,.zip,text/plain,application/zip" hidden onChange={(e) => void pick(e)} aria-label={t('chat.pick')} />
          <Button block iconStart={<FileText />} loading={stage.kind === 'reading'} onClick={() => input.current?.click()}>
            {t('chat.pick')}
          </Button>
          <p className={styles.private}>
            <Lock aria-hidden="true" />
            {t('chat.private')}
          </p>
        </div>
        {stage.kind === 'start' && stage.problem && (
          <Banner tone="warning" icon={<TriangleAlert />}>
            <span role="alert">{stage.problem}</span>
          </Banner>
        )}
        {pasting ? (
          <form
            className={styles.paste}
            onSubmit={(e) => {
              e.preventDefault()
              if (pasted.trim()) open({ text: pasted, name: null })
            }}
          >
            <label className={styles.label} htmlFor="chat-paste">
              {t('chat.paste.label')}
            </label>
            <textarea id="chat-paste" className={styles.area} rows={6} value={pasted} onChange={(e) => setPasted(e.currentTarget.value)} placeholder={t('chat.paste.placeholder')} />
            <Button type="submit" variant="secondary" block disabled={pasted.trim() === ''}>
              {t('chat.paste.read')}
            </Button>
          </form>
        ) : (
          <Button variant="ghost" block onClick={() => setPasting(true)}>
            {t('chat.paste.open')}
          </Button>
        )}
        <p className={styles.fine}>{t('chat.understands')}</p>
      </Screen>
    )
  }

  const { reading, chatName } = stage
  return (
    <Review
      reading={reading}
      chatName={chatName}
      me={me}
      setMe={setMe}
      groupId={groupId}
      setGroupId={forcedGroup ? null : setGroupId}
      groupName={groupName}
      setGroupName={setGroupName}
      off={off}
      on={on}
      toggle={(row, ticked) => {
        const from = new Set(row.sure ? off : on)
        if (row.sure === ticked) from.delete(row.key)
        else from.add(row.key)
        if (row.sure) setOff(from)
        else setOn(from)
      }}
      tickAll={(rows) => setOn(new Set([...on, ...rows.map((r) => r.key)]))}
      money={money}
      onBack={() => setStage({ kind: 'start', problem: null })}
      onDone={(rows, shown) => {
        const target = groups.find((g) => g.id === groupId) ?? null
        try {
          const result = applyChat({ chatName, groupId: target?.id ?? null, groupName: groupName.trim() || t('chat.group.fallback'), members: reading.members, me: me === NOBODY ? null : me, rows, shown })
          haptic('success')
          const name = target?.name ?? (groupName.trim() || t('chat.group.fallback'))
          toast(t('chat.done.toast', { count: rows.length, group: name }), { tone: 'success', action: { label: t('common.action.undo'), onAction: () => undoneBack(result) } })
          navigate(groupPath(result.groupId), { replace: true })
        } catch {
          haptic('error')
          toast(t('chat.problem.save'), { tone: 'error' })
        }
      }}
    />
  )

  function undoneBack(result: ReturnType<typeof applyChat>): void {
    undoChat(result)
    if (result.madeGroup) navigate('/app/groups', { replace: true })
  }
}

interface ReviewProps {
  reading: ChatReading
  chatName: string | null
  me: string | null
  setMe: (name: string) => void
  groupId: string | null
  /** Null when the group was chosen before the chat was (it can't be changed here). */
  setGroupId: ((id: string | null) => void) | null
  groupName: string
  setGroupName: (name: string) => void
  off: ReadonlySet<string>
  on: ReadonlySet<string>
  toggle: (row: ChatRow, ticked: boolean) => void
  tickAll: (rows: readonly ChatRow[]) => void
  money: (paise: number) => string
  onBack: () => void
  onDone: (rows: ChatRow[], shown: string[]) => void
}

function Review({ reading, chatName, me, setMe, groupId, setGroupId, groupName, setGroupName, off, on, toggle, tickAll, money, onBack, onDone }: ReviewProps) {
  const t = useT()
  const groups = useGroups()
  const today = todayIso()
  const target = groups.find((g) => g.id === groupId) ?? null
  const fresh = useMemo(() => {
    const seen = seenIn(groupId)
    return reading.rows.filter((row) => !seen.has(row.key))
  }, [reading, groupId])
  const sure = fresh.filter((r) => r.sure)
  const unsure = fresh.filter((r) => !r.sure)
  const ticked = (row: ChatRow): boolean => (row.sure ? !off.has(row.key) : on.has(row.key))
  const chosen = fresh.filter(ticked)
  const total = chosen.filter((r) => r.kind === 'expense').reduce((sum, r) => sum + r.amount, 0)
  const everyone = reading.members.length
  const known = reading.rows.length - fresh.length

  const who = (name: string): string => (name === me ? t('chat.row.you') : name)
  const split = (row: ChatRow): string => {
    if (row.everyone) return t('chat.row.everyone', { count: everyone + (me === NOBODY ? 1 : 0) })
    return t('chat.row.among', { names: row.among.map(who).join(', ') })
  }

  const rowOf = (row: ChatRow) => {
    const isOn = ticked(row)
    return (
      <li key={row.key}>
        <button type="button" role="checkbox" aria-checked={isOn} className={cx(styles.row, isOn && styles.rowOn)} onClick={() => toggle(row, !isOn)}>
          <span className={styles.box} aria-hidden="true">
            {isOn && <Check />}
          </span>
          <span className={styles.rowText}>
            <span className={styles.rowTop}>
              <span className={styles.rowTitle}>
                {row.kind === 'payment' ? (
                  <>
                    {who(row.payer)} <ArrowRight className={styles.arrow} aria-label={t('chat.row.paid.aria')} /> {who(row.to ?? '')}
                  </>
                ) : (
                  row.title || t('chat.row.untitled')
                )}
              </span>
              <span className={styles.rowAmount}>{money(row.amount)}</span>
            </span>
            <span className={styles.rowMeta}>
              {row.kind === 'payment' ? t('chat.row.payment', { date: relativeDateLabel(row.date, today) }) : t('chat.row.expense', { name: who(row.payer), date: relativeDateLabel(row.date, today), split: split(row) })}
            </span>
            <span className={styles.quote}>{`“${row.quote}”`}</span>
            {row.doubt && <span className={styles.doubt}>{t(DOUBT_KEYS[row.doubt], { count: row.among.length, amount: money(row.amount) })}</span>}
          </span>
        </button>
      </li>
    )
  }

  const meChosen = me !== null
  const nameOk = target !== null || groupName.trim() !== ''
  return (
    <Screen
      header={<TopBar onBack={onBack} />}
      contentClassName={styles.content}
      footer={
        fresh.length > 0 ? (
          <ActionBar hint={!meChosen ? t('chat.hint.me') : !nameOk ? t('chat.hint.name') : chosen.length === 0 ? t('chat.hint.none') : t('chat.hint.total', { amount: money(total) })}>
            <Button block disabled={!meChosen || !nameOk || chosen.length === 0} onClick={() => onDone(chosen, fresh.map((r) => r.key))}>
              {target ? t('chat.add.existing', { count: chosen.length, group: target.name }) : t('chat.add.new', { count: chosen.length })}
            </Button>
          </ActionBar>
        ) : undefined
      }
    >
      <PageTitle title={chatName ?? t('chat.review.title')} subtitle={t('chat.review.subtitle', { messages: reading.messages, count: reading.rows.length })} />

      <section className={styles.card} aria-labelledby="chat-me">
        <h2 id="chat-me" className={styles.heading}>
          {t('chat.me.title')}
        </h2>
        <div className={styles.chips} role="radiogroup" aria-labelledby="chat-me">
          {reading.members.map((name) => (
            <Chip key={name} role="radio" aria-checked={me === name} selected={me === name} onClick={() => setMe(name)}>
              {name}
            </Chip>
          ))}
          <Chip role="radio" aria-checked={me === NOBODY} selected={me === NOBODY} onClick={() => setMe(NOBODY)}>
            {t('chat.me.none')}
          </Chip>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="chat-group">
        <h2 id="chat-group" className={styles.heading}>
          {t('chat.group.title')}
        </h2>
        {target ? (
          <>
            <p className={styles.body}>{t('chat.group.existing', { emoji: target.emoji, group: target.name })}</p>
            {known > 0 && <p className={styles.fine}>{t('chat.group.known', { known, fresh: fresh.length })}</p>}
            {setGroupId && (
              <Button variant="ghost" size="sm" onClick={() => setGroupId(null)}>
                {t('chat.group.new')}
              </Button>
            )}
          </>
        ) : (
          <TextField label={t('chat.group.name')} value={groupName} maxLength={MAX_GROUP_NAME_LENGTH} onChange={(e) => setGroupName(e.currentTarget.value)} placeholder={t('chat.group.placeholder')} hint={t('chat.group.people', { count: everyone + (me === NOBODY ? 1 : 0) })} />
        )}
      </section>

      {fresh.length === 0 ? (
        <Banner tone="info" icon={<Check />}>
          <span role="status">{t('chat.nothingNew')}</span>
        </Banner>
      ) : (
        <>
          {sure.length > 0 && (
            <section aria-labelledby="chat-sure">
              <h2 id="chat-sure" className={styles.heading}>
                {t('chat.sure.title', { count: sure.length })}
              </h2>
              <ul className={styles.rows}>{sure.map(rowOf)}</ul>
            </section>
          )}
          {unsure.length > 0 && (
            <section aria-labelledby="chat-unsure">
              <div className={styles.headRow}>
                <h2 id="chat-unsure" className={styles.heading}>
                  {t('chat.unsure.title', { count: unsure.length })}
                </h2>
                {unsure.some((r) => !on.has(r.key)) && (
                  <Button variant="ghost" size="sm" onClick={() => tickAll(unsure)}>
                    {t('chat.unsure.all')}
                  </Button>
                )}
              </div>
              <p className={styles.fine}>{t('chat.unsure.body')}</p>
              <ul className={styles.rows}>{unsure.map(rowOf)}</ul>
            </section>
          )}
          <p className={styles.fine}>{t('chat.after')}</p>
        </>
      )}
    </Screen>
  )
}
