import { useMemo, useState, type FormEvent } from 'react'
import { ArrowRight, ChevronRight, MessageCircleQuestion, ShieldCheck, X } from 'lucide-react'
import { navigate } from '../../app/router'
import { Card, Chip, IconButton, TextField } from '../../components'
import { useExpenses, useFriends, useGroups, useProfile } from '../../data'
import { ME_ID } from '../../domain/types'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { relativeDateLabel } from '../../kit/dateLabel'
import { friendLabel } from '../../kit/friendName'
import { formatMoney } from '../../lib/money'
import { askExamples, headline, understoodParts } from './askText'
import { ask, type AskAnswer, type AskData } from './engine'
import styles from './Ask.module.css'

interface Shown {
  answer: AskAnswer
  head: string
  parts: string[]
  examples: string[]
  today: string
}

/**
 * Ask Settle on Home: one line to ask about your own money in plain words ("Who owes me?", "How
 * much did we spend in Goa?"), three questions to tap built from your own people and groups, and
 * the answer straight underneath with what it was read as. Worked out on this phone when you ask,
 * not as you type. Nothing at all before the first expense.
 */
export function AskBox() {
  const t = useT()
  const expenses = useExpenses()
  const groups = useGroups()
  const friends = useFriends()
  const profile = useProfile()
  const [text, setText] = useState('')
  const [shown, setShown] = useState<Shown | null>(null)

  const friendsById = useMemo(() => new Map(friends.map((f) => [f.id, f])), [friends])
  const nameOf = useMemo(() => (id: string): string => friendLabel(id, friendsById.get(id)), [friendsById])
  const data = useMemo<AskData>(() => ({ expenses, groups, friends, currency: profile.currency, today: todayIso(), me: ME_ID, nameOf }), [expenses, groups, friends, profile.currency, nameOf])
  const chips = useMemo(() => askExamples(data, 3), [data])

  if (expenses.length === 0) return null

  const run = (question: string): void => {
    const trimmed = question.trim()
    if (!trimmed) return
    const today = todayIso()
    const now = { ...data, today }
    const answer = ask(trimmed, now)
    setShown({ answer, head: headline(answer, today, nameOf), parts: understoodParts(answer, now, nameOf), examples: answer.intent === 'unknown' ? askExamples(now, 4) : [], today })
  }

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    run(text)
  }

  const pick = (question: string): void => {
    setText(question)
    run(question)
  }

  const clear = (): void => {
    setText('')
    setShown(null)
  }

  const money = (amount: number, currency: string): string => formatMoney(Math.abs(amount), currency, { trimZeros: true })

  return (
    <section className={styles.box} aria-labelledby="ask-title">
      <form className={styles.form} onSubmit={submit} role="search">
        <TextField
          id="ask-input"
          label={
            <span id="ask-title" className={styles.title}>
              <MessageCircleQuestion aria-hidden="true" /> {t('ask.label')}
            </span>
          }
          placeholder={t('ask.placeholder')}
          value={text}
          onChange={(event) => setText(event.target.value)}
          autoComplete="off"
          enterKeyHint="search"
          maxLength={200}
          endAdornment={
            <IconButton type="submit" label={t('ask.submit')} variant="primary" size="sm" disabled={!text.trim()}>
              <ArrowRight />
            </IconButton>
          }
        />
      </form>

      {!shown && (
        <div className={styles.chips} role="group" aria-label={t('ask.examples.aria')}>
          {chips.map((q) => (
            <Chip key={q} onClick={() => pick(q)}>
              {q}
            </Chip>
          ))}
        </div>
      )}

      <div role="status" aria-label={t('ask.answer.aria')} className={styles.live}>
        {shown && (
          <Card className={styles.answer}>
            <div className={styles.answerHead}>
              <p className={styles.headline}>{shown.head}</p>
              <IconButton label={t('ask.clear')} size="sm" onClick={clear}>
                <X />
              </IconButton>
            </div>
            {shown.parts.length > 0 && <p className={styles.fine}>{t('ask.understood', { parts: shown.parts.join(' · ') })}</p>}
            {shown.answer.rows.length > 0 && (
              <ul className={styles.rows} aria-label={t('ask.rows.aria')}>
                {shown.answer.rows.map((row) => {
                  const inner = (
                    <>
                      <span className={styles.rowText}>
                        <span className={styles.rowTitle}>{row.title}</span>
                        {row.date && <span className={styles.fine}>{relativeDateLabel(row.date, shown.today)}</span>}
                      </span>
                      <span className={styles.rowAmount}>{money(row.amount, row.currency)}</span>
                      {row.path && <ChevronRight aria-hidden="true" className={styles.chevron} />}
                    </>
                  )
                  const path = row.path
                  return (
                    <li key={row.key}>
                      {path ? (
                        <button type="button" className={styles.row} onClick={() => navigate(path)}>
                          {inner}
                        </button>
                      ) : (
                        <div className={styles.row}>{inner}</div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            {shown.answer.leftOut.length > 0 && <p className={styles.fine}>{t('ask.leftOut', { currency: shown.answer.currency, codes: shown.answer.leftOut.join(', ') })}</p>}
            {shown.examples.length > 0 && (
              <div className={styles.chips} role="group" aria-label={t('ask.examples.aria')}>
                {shown.examples.map((q) => (
                  <Chip key={q} onClick={() => pick(q)}>
                    {q}
                  </Chip>
                ))}
              </div>
            )}
            <p className={styles.private}>
              <ShieldCheck aria-hidden="true" />
              {t('ask.private')}
            </p>
          </Card>
        )}
      </div>
    </section>
  )
}
