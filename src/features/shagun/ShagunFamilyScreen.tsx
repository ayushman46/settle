import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { goBack, useRoute } from '../../app/router'
import { Button, Card, EmptyState, IconButton, PageTitle, Screen, TopBar, useToast } from '../../components'
import { today } from '../../engine/dates'
import { useT } from '../../i18n'
import { EntrySheet } from './EntrySheet'
import { findFamily, tidyName } from './engine'
import { GiveBox } from './GiveBox'
import { entryWhat, entryWhen, rupees } from './labels'
import { SHAGUN_FAMILY_PATTERN, SHAGUN_PATH } from './paths'
import { deleteEntry, restoreEntries } from './store'
import type { ShagunEntry } from './types'
import { useShagun } from './useShagun'
import styles from './Shagun.module.css'

const ROUTES = [SHAGUN_FAMILY_PATTERN] as const

/**
 * `/app/shagun/family/:name` — one family: everything both ways as a timeline (newest first), the
 * net, what to give them next time, and adding, changing or deleting an entry (with Undo).
 */
export function ShagunFamilyScreen() {
  const t = useT()
  const toast = useToast()
  const { params } = useRoute(ROUTES)
  const { book, families, functionsById } = useShagun()
  const asked = tidyName(params.name ?? '')
  const family = findFamily(families, asked)
  const [day] = useState(() => today())
  // Keyed per opening, so the sheet starts fresh.
  const [sheet, setSheet] = useState<{ entry: ShagunEntry | null; opened: number; open: boolean } | null>(null)
  const name = family?.name ?? asked

  const remove = (entry: ShagunEntry) => {
    const removed = deleteEntry(entry.id)
    if (!removed) return
    toast(t('shagun.family.deleted', { what: entryWhat(removed) }), {
      action: { label: t('common.action.undo'), onAction: () => restoreEntries([removed]) },
    })
  }

  const header = <TopBar onBack={() => goBack(SHAGUN_PATH)} />
  const sheetEl = sheet && (
    <EntrySheet
      key={sheet.opened}
      open={sheet.open}
      onClose={() => setSheet({ ...sheet, open: false })}
      entry={sheet.entry}
      name={name}
      functions={book.functions}
    />
  )
  const add = () => setSheet({ entry: null, opened: Date.now(), open: true })

  if (!family) {
    return (
      <Screen header={header}>
        <PageTitle title={name || t('shagun.title')} />
        <EmptyState
          title={t('shagun.family.none.title')}
          text={t('shagun.family.none.body', { name: name || '…' })}
          action={
            <Button iconStart={<Plus />} onClick={add}>
              {t('shagun.family.add')}
            </Button>
          }
        />
        {sheetEl}
      </Screen>
    )
  }

  const net =
    family.net > 0
      ? t('shagun.family.net.ahead', { amount: rupees(family.net) })
      : family.net < 0
        ? t('shagun.family.net.behind', { amount: rupees(-family.net) })
        : t('shagun.family.net.even')
  const timeline = [...family.entries].reverse()

  return (
    <Screen header={header} contentClassName={styles.content}>
      <PageTitle title={family.name} subtitle={net} />
      <GiveBox key={family.key} name={family.name} fixed />
      <section className={styles.section} aria-labelledby="shagun-history">
        <h2 id="shagun-history" className={styles.heading}>
          {t('shagun.family.history')}
        </h2>
        <Card padding="none">
          <ul className={styles.list}>
            {timeline.map((entry) => {
              const what = entryWhat(entry)
              const fn = entry.functionId ? (functionsById[entry.functionId] ?? null) : null
              return (
                <li key={entry.id} className={styles.row}>
                  <span className={styles.rowText}>
                    <span className={`${styles.rowTitle} ${entry.direction === 'received' ? styles.received : styles.given}`}>{what}</span>
                    <span className={styles.fine}>{entryWhen(entry, fn, day)}</span>
                    {entry.note && <span className={styles.fine}>{entry.note}</span>}
                  </span>
                  <span className={styles.rowActions}>
                    <IconButton label={t('shagun.family.edit.aria', { what })} onClick={() => setSheet({ entry, opened: Date.now(), open: true })}>
                      <Pencil />
                    </IconButton>
                    <IconButton label={t('shagun.family.delete.aria', { what })} onClick={() => remove(entry)}>
                      <Trash2 />
                    </IconButton>
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>
      </section>
      <Button variant="secondary" block iconStart={<Plus />} onClick={add}>
        {t('shagun.family.add')}
      </Button>
      {sheetEl}
    </Screen>
  )
}
