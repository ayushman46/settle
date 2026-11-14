import { useMemo, useState } from 'react'
import { BookHeart, Download, Plus } from 'lucide-react'
import { goBack, navigate } from '../../app/router'
import { Button, Card, EmptyState, IconButton, List, ListRow, PageTitle, Screen, SegmentedControl, TextField, TopBar, useToast } from '../../components'
import { today } from '../../engine/dates'
import { useT } from '../../i18n'
import { relativeDateLabel } from '../../kit/dateLabel'
import { shareFile } from '../../share'
import { shagunCsvBlob, shagunCsvFilename } from './csv'
import { functionTotals, searchFamilies, sortFamilies, type FamilySort, type FamilySummary } from './engine'
import { FunctionSheet } from './FunctionSheet'
import { GiveBox } from './GiveBox'
import { rupees } from './labels'
import { shagunAddPath, shagunFamilyPath, shagunFunctionPath } from './paths'
import type { ShagunFunction } from './types'
import { useShagun } from './useShagun'
import styles from './Shagun.module.css'

const PAGE = 100

/**
 * `/app/shagun` — the shagun book: what came in and went out, "What should I give?", and the book
 * itself by family or by function. Empty, it says what it's for in two lines and starts with a
 * function.
 */
export function ShagunScreen() {
  const t = useT()
  const toast = useToast()
  const { book, families, totals } = useShagun()
  const [tab, setTab] = useState<'families' | 'functions'>('families')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<FamilySort>('recent')
  const [shown, setShown] = useState(PAGE)
  const [sheet, setSheet] = useState<{ opened: number; open: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [day] = useState(() => today())
  const list = useMemo(() => sortFamilies(searchFamilies(families, query), sort), [families, query, sort])
  const fnTotals = useMemo(() => functionTotals(book.functions, book.entries), [book.functions, book.entries])

  const addFunction = () => setSheet({ opened: Date.now(), open: true })
  // A new function of yours goes straight to its envelopes; someone else's to its page.
  const onSaved = (fn: ShagunFunction) => navigate(fn.mine ? shagunAddPath(fn.id) : shagunFunctionPath(fn.id))
  const sheetEl = sheet && <FunctionSheet key={sheet.opened} open={sheet.open} onClose={() => setSheet({ ...sheet, open: false })} onSaved={onSaved} />

  const exportCsv = async () => {
    if (busy) return
    setBusy(true)
    const outcome = await shareFile(shagunCsvBlob(book.entries, book.functions), shagunCsvFilename(day), undefined, { title: t('shagun.title') })
    setBusy(false)
    if (outcome === 'shared' || outcome === 'downloaded') toast(t('shagun.export.done', { count: book.entries.length }), { tone: 'success' })
    else if (outcome === 'failed') toast(t('shagun.export.failed'), { tone: 'error' })
  }

  const empty = book.entries.length === 0 && book.functions.length === 0
  const header = (
    <TopBar
      onBack={() => goBack('/app')}
      right={
        book.entries.length > 0 ? (
          <IconButton label={t('shagun.export')} onClick={() => void exportCsv()} disabled={busy}>
            <Download />
          </IconButton>
        ) : undefined
      }
    />
  )

  if (empty) {
    return (
      <Screen header={header}>
        <PageTitle title={t('shagun.title')} />
        <EmptyState
          icon={<BookHeart />}
          title={t('shagun.empty.title')}
          text={t('shagun.empty.text')}
          action={
            <Button iconStart={<Plus />} onClick={addFunction}>
              {t('shagun.empty.cta')}
            </Button>
          }
        />
        {sheetEl}
      </Screen>
    )
  }

  // "Add envelopes" goes to your newest function (the one whose envelopes are likely in hand).
  const newestMine = fnTotals.find((row) => row.fn.mine)?.fn ?? null

  return (
    <Screen header={header} contentClassName={styles.content}>
      <PageTitle title={t('shagun.title')} subtitle={t('shagun.subtitle')} />
      <div className={styles.stats}>
        <Card className={styles.stat}>
          <p className={styles.statLabel}>{t('shagun.totals.received')}</p>
          <p className={styles.statValue}>{rupees(totals.received)}</p>
          <p className={styles.fine}>{t('shagun.totals.families', { count: families.filter((f) => f.receivedCount > 0).length })}</p>
        </Card>
        <Card className={styles.stat}>
          <p className={styles.statLabel}>{t('shagun.totals.given')}</p>
          <p className={styles.statValue}>{rupees(totals.given)}</p>
          <p className={styles.fine}>{t('shagun.totals.to', { count: families.filter((f) => f.givenCount > 0).length })}</p>
        </Card>
      </div>
      <GiveBox />
      <Button block iconStart={<Plus />} onClick={() => navigate(shagunAddPath(newestMine?.id))}>
        {t('shagun.addEnvelopes')}
      </Button>
      <SegmentedControl
        ariaLabel={t('shagun.tabs.aria')}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'families', label: t('shagun.tabs.families') },
          { value: 'functions', label: t('shagun.tabs.functions') },
        ]}
      />
      {tab === 'families' ? (
        <section className={styles.section} aria-label={t('shagun.tabs.families')}>
          {families.length > 0 && (
            <div className={styles.toolbar}>
              <TextField
                label={t('shagun.search')}
                hideLabel
                placeholder={t('shagun.search')}
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setShown(PAGE)
                }}
                autoComplete="off"
              />
              <SegmentedControl
                size="sm"
                ariaLabel={t('shagun.sort.aria')}
                value={sort}
                onChange={setSort}
                options={[
                  { value: 'recent', label: t('shagun.sort.recent') },
                  { value: 'name', label: t('shagun.sort.name') },
                  { value: 'amount', label: t('shagun.sort.amount') },
                ]}
              />
            </div>
          )}
          {list.length === 0 ? (
            <p className={styles.fine}>{query.trim() ? t('shagun.search.none', { query: query.trim() }) : t('shagun.fn.nothing')}</p>
          ) : (
            <Card padding="none">
              <List>
                {list.slice(0, shown).map((family) => (
                  <ListRow key={family.key} title={family.name} subtitle={familyLine(family, t)} onClick={() => navigate(shagunFamilyPath(family.name))} chevron />
                ))}
              </List>
            </Card>
          )}
          {list.length > shown && (
            <Button variant="ghost" block onClick={() => setShown((n) => n + PAGE)}>
              {t('shagun.more', { count: Math.min(PAGE, list.length - shown) })}
            </Button>
          )}
        </section>
      ) : (
        <section className={styles.section} aria-label={t('shagun.tabs.functions')}>
          {fnTotals.length === 0 ? (
            <p className={styles.fine}>{t('shagun.functions.none')}</p>
          ) : (
            <Card padding="none">
              <List>
                {fnTotals.map((row) => (
                  <ListRow
                    key={row.fn.id}
                    title={row.fn.name}
                    subtitle={t('shagun.function.line', { date: relativeDateLabel(row.fn.date, day), count: row.families })}
                    trailing={row.received + row.given > 0 ? rupees(row.fn.mine ? row.received : row.given || row.received) : undefined}
                    onClick={() => navigate(shagunFunctionPath(row.fn.id))}
                    chevron
                  />
                ))}
              </List>
            </Card>
          )}
          <Button variant="secondary" block iconStart={<Plus />} onClick={addFunction}>
            {t('shagun.functions.add')}
          </Button>
        </section>
      )}
      {sheetEl}
    </Screen>
  )
}

function familyLine(family: FamilySummary, t: ReturnType<typeof useT>): string {
  const received = rupees(family.received)
  const given = rupees(family.given)
  if (family.received > 0 && family.given > 0) return t('shagun.family.line.both', { received, given })
  if (family.received > 0) return t('shagun.family.line.received', { received })
  if (family.given > 0) return t('shagun.family.line.given', { given })
  return t('shagun.family.line.gifts')
}
