import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { goBack, navigate, useRoute } from '../../app/router'
import {
  ActionBar,
  AmountInput,
  BottomSheet,
  Button,
  Card,
  Chip,
  IconButton,
  ListRow,
  Money,
  PageTitle,
  Screen,
  SectionHeader,
  TopBar,
  useToast,
} from '../../components'
import { useProfile } from '../../data'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { HELP_ENTRY_KINDS, monthSheet, workingPeriod, type HelpEntryKind } from './engine'
import { addEntry, removeHelper, useHelper, type EntryInput } from './store'
import { dayLabel, equation, entryLabel, monthName, workLabel } from './text'
import { HELP_PATH, HELP_PERSON_PATTERN, helpPersonPath } from './paths'

const ROUTES = [HELP_PERSON_PATTERN] as const

type EntrySheet = { kind: HelpEntryKind; amount: string; date: string; note: string }

function emptySheet(kind: HelpEntryKind): EntrySheet {
  return { kind, amount: '', date: todayIso(), note: '' }
}

/**
 * `/app/help/:id` — one helper's page: this month's breakdown, the entry chips (advance / day off /
 * extra / bonus), pay, and a year view.
 */
export function HelpPersonScreen() {
  const t = useT()
  const toast = useToast()
  const { params } = useRoute(ROUTES)
  const id = params.id ?? ''
  const helper = useHelper(id)
  const { currency } = useProfile()
  const today = todayIso()
  const [sheet, setSheet] = useState<EntrySheet | null>(null)
  const [busy, setBusy] = useState(false)

  if (!helper) {
    return (
      <Screen header={<TopBar onBack={() => navigate(HELP_PATH)} />}>
        <PageTitle title={t('help.title')} />
      </Screen>
    )
  }

  const period = workingPeriod(helper, today)
  const ms = monthSheet(helper, period, today) ?? { toPay: 0, gross: 0, leaveCut: 0, extra: 0, bonus: 0, advanceCut: 0, advanceBefore: 0, advanceTaken: 0, advanceAfter: 0, daysOff: 0, paidLeave: 0, extraDaysOff: 0, entries: [], salary: 0, due: today, paid: null, period }
  const month = monthName(period, today)
  const eq = equation(ms, helper.currency)

  const saveEntry = () => {
    if (!sheet || busy) return
    const amount = Math.round((parseFloat(sheet.amount.replace(/,/g, '')) || 0) * 100)
    const input: EntryInput = { kind: sheet.kind, date: sheet.date, amount: sheet.kind === 'dayOff' ? 0 : amount, note: sheet.note || null }
    setBusy(true)
    const entry = addEntry(helper.id, input)
    setBusy(false)
    if (!entry) { toast(t('help.entry.saved'), { tone: 'error' }); return }
    toast(t('help.entry.saved'), { tone: 'success' })
    setSheet(null)
  }

  const remove = () => {
    removeHelper(helper.id)
    toast(t('help.person.removed', { name: helper.name }), { tone: 'success' })
    navigate(HELP_PATH)
  }

  const entryChips = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
      {HELP_ENTRY_KINDS.map((k) => (
        <Chip key={k} onClick={() => setSheet(emptySheet(k))}>
          {t(`help.entry.${k}.cta` as never) || k}
        </Chip>
      ))}
    </div>
  )

  return (
    <Screen
      header={
        <TopBar
          onBack={() => navigate(HELP_PATH)}
          right={
            <IconButton label={t('help.person.remove.cta')} onClick={remove} tone="destructive">
              <Trash2 />
            </IconButton>
          }
        />
      }
    >
      <PageTitle title={helper.name} subtitle={workLabel(helper.work)} />

      <SectionHeader title={t('help.person.month', { month })} />
      <Card>
        <ListRow title={t('help.person.salary', { amount: '' })} trailing={<Money value={ms.salary} currency={helper.currency} />} />
        {ms.leaveCut > 0 && <ListRow title={`Days off: ${ms.daysOff} (${ms.paidLeave} paid)`} trailing={<Money value={-ms.leaveCut} currency={helper.currency} />} />}
        {ms.extra > 0 && <ListRow title="Extra work" trailing={<Money value={ms.extra} currency={helper.currency} />} />}
        {ms.bonus > 0 && <ListRow title="Bonus" trailing={<Money value={ms.bonus} currency={helper.currency} />} />}
        {ms.advanceCut > 0 && <ListRow title="Advance cut" trailing={<Money value={-ms.advanceCut} currency={helper.currency} />} />}
        <ListRow title="To pay" trailing={<Money value={ms.toPay} currency={helper.currency} strong />} />
      </Card>

      {entryChips}

      {ms.entries.length > 0 && (
        <>
          <SectionHeader title={t('help.person.entries.heading')} />
          <Card>
            <ul>
              {ms.entries.map((entry) => (
                <li key={entry.id}>
                  <ListRow
                    title={entryLabel(entry)}
                    subtitle={dayLabel(entry.date, today)}
                    trailing={entry.amount > 0 ? <Money value={entry.amount} currency={helper.currency} /> : undefined}
                  />
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      {sheet && (
        <BottomSheet open title={entryLabel({ kind: sheet.kind, note: null })} onClose={() => setSheet(null)}>
          {sheet.kind !== 'dayOff' && (
            <AmountInput label={t('help.entry.amount.label')} value={sheet.amount} onChange={(v) => setSheet({ ...sheet, amount: v })} currency={helper.currency} />
          )}
          <ActionBar>
            <Button variant="primary" onClick={saveEntry} disabled={busy || (sheet.kind !== 'dayOff' && !sheet.amount)}>
              {t('help.entry.save')}
            </Button>
          </ActionBar>
        </BottomSheet>
      )}
    </Screen>
  )
}
