import { useState } from 'react'
import { Check, Clock, Crown, Flag, Flame, Hourglass, Landmark, Repeat, Share2, Target, Trophy, UtensilsCrossed, Zap, type LucideIcon } from 'lucide-react'
import { navigate } from '../../app/router'
import { Avatar, Badge, Button, Card, SuccessCheck, TextField, useToast } from '../../components'
import { useFriendsById, useProfile } from '../../data'
import { ME_ID, type Group } from '../../domain/types'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { relativeDateLabel } from '../../kit/dateLabel'
import { friendLabel } from '../../kit/friendName'
import { haptic } from '../../lib/haptics'
import { formatMoney, parseMoneyInput, toInputString } from '../../lib/money'
import { shareResult } from '../../lib/share'
import { categoryLabel } from '../../share/categories'
import { friendFallback } from '../../share/fallbacks'
import { outsideName } from '../../share/names'
import { settleUpPath } from '../groups/paths'
import { BILL_MIN, BILLS_A_DAY, POINTS_BILL, POINTS_FAST, POINTS_PAYMENT, POINTS_SQUARE, POINTS_STREAK, STREAK_CAP, type TitleId } from './engine'
import { setBudget } from './store'
import { useBoard } from './useBoard'
import styles from './Play.module.css'

const TITLE_ICONS: Record<TitleId, LucideIcon> = { banker: Landmark, flash: Zap, regular: Repeat, appetite: UtensilsCrossed, patient: Hourglass, clock: Clock }
const LEVEL_KEYS = { starter: 'play.level.starter', regular: 'play.level.regular', pro: 'play.level.pro', legend: 'play.level.legend' } as const
const TITLE_KEYS = {
  banker: ['play.title.banker', 'play.title.banker.body', 'play.title.banker.you'],
  flash: ['play.title.flash', 'play.title.flash.body', 'play.title.flash.you'],
  regular: ['play.title.regular', 'play.title.regular.body', 'play.title.regular.you'],
  appetite: ['play.title.appetite', 'play.title.appetite.body', 'play.title.appetite.you'],
  patient: ['play.title.patient', 'play.title.patient.body', 'play.title.patient.you'],
  clock: ['play.title.clock', 'play.title.clock.body', 'play.title.clock.you'],
} as const
const MILE_KEYS = {
  first: 'play.miles.first',
  ten: 'play.miles.ten',
  spent10k: 'play.miles.spent10k',
  spent50k: 'play.miles.spent50k',
  everyonePaid: 'play.miles.everyonePaid',
  fast3: 'play.miles.fast3',
  square: 'play.miles.square',
  trophy: 'play.miles.trophy',
} as const
const NEXT_LEVEL = { starter: 'regular', regular: 'pro', pro: 'legend', legend: 'legend' } as const

/**
 * The group's Board tab: your next move, the leaderboard and titles, this week's challenge, who
 * should get the next bill, today's spending, the budget's forecast and the story so far.
 */
export function BoardTab({ group }: { group: Group }) {
  const t = useT()
  const toast = useToast()
  const friendsById = useFriendsById()
  const board = useBoard(group)
  const money = (paise: number): string => formatMoney(Math.abs(paise), group.currency, { trimZeros: true })
  const colorOf = (id: string): number => friendsById[id]?.color ?? 0
  const profile = useProfile()
  /** A name as the group's chat should read it (never "You"). */
  const outside = (id: string): string => outsideName(id, friendsById, profile, friendFallback())
  const { quest, challenge, budget, recap } = board

  const share = async (): Promise<void> => {
    if (!recap) return
    const lines = [
      t('play.recap.message.title', { emoji: group.emoji, group: group.name }),
      t('play.recap.total', { total: money(recap.total), count: recap.count, days: recap.days }),
      t('play.recap.pace', { perDay: money(recap.perDay), perPerson: money(recap.perPerson) }),
      ...(recap.biggest ? [t('play.recap.biggest', { title: recap.biggest.title, total: money(recap.biggest.total), name: outside(recap.biggest.payerId) })] : []),
      ...(recap.topCategory ? [t('play.recap.category', { category: categoryLabel(recap.topCategory.id), total: money(recap.topCategory.total) })] : []),
      ...(recap.bankerId ? [t('play.recap.banker', { name: outside(recap.bankerId) })] : []),
      ...(recap.flashId ? [t('play.recap.flash', { name: outside(recap.flashId) })] : []),
      t('play.recap.message.board', {
        rows: board.rows
          .slice(0, 5)
          .map((row) => t('play.recap.message.row', { rank: row.rank, name: outside(row.id), points: row.points }))
          .join(' · '),
      }),
    ]
    const outcome = await shareResult(lines.join('\n'), { title: group.name })
    if (outcome === 'copied') toast(t('play.recap.shared'), { tone: 'success' })
  }

  return (
    <div className={styles.board}>
      {/* ---- your move ---- */}
      <Card role="group" className={styles.quest} aria-labelledby="play-quest">
        <p id="play-quest" className={styles.eyebrow}>
          <Target aria-hidden="true" /> {t('play.quest.title')}
        </p>
        {quest.kind === 'pay' && (
          <>
            <p className={styles.big}>{t('play.quest.pay', { name: quest.to, amount: money(quest.amount) })}</p>
            <p className={styles.fine}>{quest.fast ? t('play.quest.pay.points.fast', { points: quest.points, bonus: POINTS_FAST, square: POINTS_SQUARE }) : t('play.quest.pay.points', { points: quest.points, square: POINTS_SQUARE })}</p>
            <Button block onClick={() => navigate(settleUpPath(group.id))}>
              {t('play.quest.pay.cta')}
            </Button>
          </>
        )}
        {quest.kind === 'collect' && (
          <>
            <p className={styles.big}>{t('play.quest.collect', { name: quest.from, amount: money(quest.amount) })}</p>
            <p className={styles.fine}>{t('play.quest.collect.days', { count: quest.days })}</p>
            <Button block variant="secondary" onClick={() => navigate(settleUpPath(group.id))}>
              {t('play.quest.collect.cta')}
            </Button>
          </>
        )}
        {quest.kind === 'square' && (
          <div className={styles.square}>
            <SuccessCheck size="md" />
            <div>
              <p className={styles.big}>{t('play.quest.square')}</p>
              <p className={styles.fine}>{board.squareDays !== null ? t('play.square.days', { count: board.squareDays }) : t('play.quest.square.body', { points: POINTS_SQUARE })}</p>
            </div>
          </div>
        )}
        {quest.kind === 'start' && (
          <>
            <p className={styles.big}>{t('play.quest.start')}</p>
            <p className={styles.fine}>{t('play.quest.start.body')}</p>
          </>
        )}
      </Card>

      {/* ---- leaderboard ---- */}
      <section aria-labelledby="play-board">
        <h3 id="play-board" className={styles.heading}>
          <Crown aria-hidden="true" /> {t('play.board.title')}
        </h3>
        <Card padding="none">
          <ol className={styles.rows}>
            {board.rows.map((row) => (
              <li key={row.id} className={styles.row} data-me={row.id === ME_ID ? '' : undefined} data-top={row.rank === 1 && row.points > 0 ? '' : undefined}>
                <span className={styles.rank} aria-label={t('play.board.rank.aria', { rank: row.rank })}>
                  {row.rank}
                </span>
                <Avatar name={row.name} color={colorOf(row.id)} size="sm" />
                <span className={styles.who}>
                  <span className={styles.name}>
                    {row.name}
                    <Badge tone={row.level === 'legend' ? 'pro' : row.level === 'pro' ? 'accent' : 'neutral'}>{t(LEVEL_KEYS[row.level])}</Badge>
                  </span>
                  <span className={styles.fine}>
                    {t('play.board.detail', { bills: row.bills, payments: row.payments })}
                    {row.streak > 1 && (
                      <>
                        {' · '}
                        <Flame aria-hidden="true" className={styles.flame} />
                        {t('play.board.streak', { count: row.streak })}
                      </>
                    )}
                  </span>
                  {row.id === ME_ID && row.toNext !== null && <span className={styles.fine}>{t('play.board.toNext', { points: row.toNext, level: t(LEVEL_KEYS[NEXT_LEVEL[row.level]]) })}</span>}
                </span>
                <span className={styles.points}>{t('play.board.points', { points: row.points })}</span>
              </li>
            ))}
          </ol>
        </Card>
        <details className={styles.rules}>
          <summary>{t('play.rules.title')}</summary>
          <ul>
            <li>{t('play.rules.bill', { points: POINTS_BILL, min: money(BILL_MIN), cap: BILLS_A_DAY })}</li>
            <li>{t('play.rules.payment', { points: POINTS_PAYMENT })}</li>
            <li>{t('play.rules.fast', { points: POINTS_FAST })}</li>
            <li>{t('play.rules.square', { points: POINTS_SQUARE })}</li>
            <li>{t('play.rules.streak', { points: POINTS_STREAK, cap: STREAK_CAP })}</li>
          </ul>
          <p className={styles.fine}>{t('play.rules.note')}</p>
        </details>
      </section>

      {/* ---- titles ---- */}
      {board.titles.length > 0 && (
        <section aria-labelledby="play-titles">
          <h3 id="play-titles" className={styles.heading}>
            {t('play.titles.title')}
          </h3>
          <ul className={styles.titles}>
            {board.titles.map((title) => {
              const Icon = TITLE_ICONS[title.id]
              const [name, theirs, yours] = TITLE_KEYS[title.id]
              const body = title.memberId === ME_ID ? yours : theirs
              const value = title.id === 'banker' || title.id === 'appetite' || title.id === 'patient' ? money(title.value) : title.id === 'flash' ? Math.round(title.value) : title.value
              return (
                <li key={title.id} className={styles.title} data-title={title.id}>
                  <span className={styles.titleIcon} aria-hidden="true">
                    <Icon />
                  </span>
                  <span className={styles.who}>
                    <span className={styles.name}>{t(name)}</span>
                    <span className={styles.fine}>{t(body, { name: title.name, value })}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* ---- this week ---- */}
      {board.started && (
        <Card role="group" className={styles.block} aria-labelledby="play-week">
          <h3 id="play-week" className={styles.cardTitle}>
            <Trophy aria-hidden="true" /> {t('play.week.title')}
          </h3>
          <div className={styles.meter} role="img" aria-label={t('play.week.progress', { square: challenge.square, people: challenge.people })}>
            <span style={{ width: `${challenge.people > 0 ? Math.round((challenge.square / challenge.people) * 100) : 0}%` }} />
          </div>
          <p className={styles.fine}>
            {t('play.week.progress', { square: challenge.square, people: challenge.people })} · {t('play.week.left', { count: challenge.daysLeft })}
          </p>
          {challenge.done && <p className={styles.good}>{t('play.week.done')}</p>}
          <p className={styles.fine}>{challenge.trophies > 0 ? t('play.week.trophies', { count: challenge.trophies }) : t('play.week.trophies.none')}</p>
        </Card>
      )}

      {/* ---- milestones ---- */}
      {board.started && (
        <Card role="group" className={styles.block} aria-labelledby="play-miles">
          <h3 id="play-miles" className={styles.cardTitle}>
            <Flag aria-hidden="true" /> {t('play.miles.title')}
          </h3>
          <p className={styles.fine}>{t('play.miles.count', { done: board.milestones.filter((m) => m.done).length, count: board.milestones.length })}</p>
          <ul className={styles.miles}>
            {board.milestones.map((mile) => (
              <li key={mile.id} className={styles.mile} data-done={mile.done ? '' : undefined}>
                <span className={styles.mileMark} aria-hidden={mile.done ? undefined : 'true'} aria-label={mile.done ? t('play.miles.done.aria') : undefined} role={mile.done ? 'img' : undefined}>
                  {mile.done && <Check />}
                </span>
                <span className={styles.mileName}>{t(MILE_KEYS[mile.id])}</span>
                {!mile.done && (
                  <span className={styles.fine}>
                    {mile.id === 'spent10k' || mile.id === 'spent50k' ? t('play.miles.progress', { have: money(mile.have), need: money(mile.need) }) : t('play.miles.progress', { have: mile.have, need: mile.need })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ---- today ---- */}
      {board.started && (
        <Card role="group" className={styles.block} aria-labelledby="play-today">
          <h3 id="play-today" className={styles.cardTitle}>
            {t('play.today.title')}
          </h3>
          {board.today.count === 0 ? (
            <p className={styles.body}>{t('play.today.none')}</p>
          ) : (
            <p className={styles.body}>{t('play.today.spent', { count: board.today.count, total: money(board.today.total), share: money(board.today.myShare) })}</p>
          )}
          {board.today.myChange > 0 && <p className={styles.good}>{t('play.today.up', { amount: money(board.today.myChange) })}</p>}
          {board.today.myChange < 0 && <p className={styles.fine}>{t('play.today.down', { amount: money(board.today.myChange) })}</p>}
        </Card>
      )}

      {/* ---- budget ---- */}
      {board.started && (
        <Card role="group" className={styles.block} aria-labelledby="play-budget">
          <h3 id="play-budget" className={styles.cardTitle}>
            {t('play.budget.title')}
          </h3>
          <p className={styles.body}>{t('play.budget.spent', { spent: money(budget.spent), days: budget.days, perDay: money(budget.perDay) })}</p>
          {budget.budget !== null && budget.left !== null && (
            <>
              <div className={styles.meter} data-over={budget.over ? '' : undefined} role="img" aria-label={budget.over ? t('play.budget.over', { over: money(budget.left), budget: money(budget.budget) }) : t('play.budget.left', { left: money(budget.left), budget: money(budget.budget) })}>
                <span style={{ width: `${Math.min(100, Math.round((budget.spent / budget.budget) * 100))}%` }} />
              </div>
              <p className={budget.over ? styles.bad : styles.fine}>
                {budget.over ? t('play.budget.over', { over: money(budget.left), budget: money(budget.budget) }) : t('play.budget.left', { left: money(budget.left), budget: money(budget.budget) })}
                {budget.reachesOn && <> · {budget.reachesOn === todayIso() ? t('play.budget.reaches.today') : t('play.budget.reaches', { date: relativeDateLabel(budget.reachesOn).toLowerCase() })}</>}
                {!budget.over && !budget.reachesOn && budget.days < 2 && <> · {t('play.budget.early')}</>}
              </p>
            </>
          )}
          <BudgetField key={`${group.id}:${budget.budget ?? ''}`} groupId={group.id} currency={group.currency} budget={budget.budget} />
        </Card>
      )}

      {/* ---- the story so far ---- */}
      {recap && (
        <Card role="group" className={styles.block} aria-labelledby="play-recap">
          <h3 id="play-recap" className={styles.cardTitle}>
            {t('play.recap.title')}
          </h3>
          <p className={styles.big}>{money(recap.total)}</p>
          <ul className={styles.facts}>
            <li>{t('play.recap.total', { total: money(recap.total), count: recap.count, days: recap.days })}</li>
            <li>{t('play.recap.pace', { perDay: money(recap.perDay), perPerson: money(recap.perPerson) })}</li>
            {recap.biggest && (
              <li>
                {recap.biggest.payerId === ME_ID
                  ? t('play.recap.biggest.you', { title: recap.biggest.title, total: money(recap.biggest.total) })
                  : t('play.recap.biggest', { title: recap.biggest.title, total: money(recap.biggest.total), name: friendLabel(recap.biggest.payerId, friendsById[recap.biggest.payerId]) })}
              </li>
            )}
            {recap.topCategory && <li>{t('play.recap.category', { category: categoryLabel(recap.topCategory.id), total: money(recap.topCategory.total) })}</li>}
            {recap.bankerId && <li>{recap.bankerId === ME_ID ? t('play.recap.banker.you') : t('play.recap.banker', { name: friendLabel(recap.bankerId, friendsById[recap.bankerId]) })}</li>}
            {recap.flashId && <li>{recap.flashId === ME_ID ? t('play.recap.flash.you') : t('play.recap.flash', { name: friendLabel(recap.flashId, friendsById[recap.flashId]) })}</li>}
          </ul>
          <Button block variant="secondary" iconStart={<Share2 />} onClick={() => void share()}>
            {t('play.recap.share')}
          </Button>
        </Card>
      )}
    </div>
  )
}

function BudgetField({ groupId, currency, budget }: { groupId: string; currency: string; budget: number | null }) {
  const t = useT()
  const toast = useToast()
  const [text, setText] = useState(budget !== null ? toInputString(budget, currency, { trimZeros: true }) : '')
  // Digits (with commas or a ₹) only: "12abc" is a slip of the thumb, not a ₹12 budget.
  const clean = text.trim().replace(/^₹\s*/, '')
  const wellFormed = clean === '' || /^\d[\d,]*(\.\d{1,2})?$/.test(clean)
  const parsed = clean === '' || !wellFormed ? null : parseMoneyInput(clean, currency)
  const bad = clean !== '' && (parsed === null || parsed <= 0)
  const changed = !bad && (parsed ?? null) !== (budget ?? null)
  return (
    <form
      className={styles.budgetForm}
      onSubmit={(event) => {
        event.preventDefault()
        setBudget(groupId, parsed)
        haptic('success')
        toast(t('play.budget.saved'), { tone: 'success' })
      }}
    >
      <TextField label={t('play.budget.label')} hint={t('play.budget.hint')} error={bad ? t('play.budget.error') : undefined} placeholder={t('play.budget.placeholder')} inputMode="decimal" autoComplete="off" enterKeyHint="done" value={text} onChange={(event) => setText(event.target.value)} />
      <Button type="submit" size="md" variant="secondary" disabled={!changed}>
        {t('play.budget.save')}
      </Button>
    </form>
  )
}
