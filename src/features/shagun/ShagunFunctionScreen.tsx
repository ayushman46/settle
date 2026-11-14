import { useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { goBack, navigate, useRoute } from '../../app/router'
import { Button, Card, IconButton, PageTitle, Screen, TextField, TopBar, useToast } from '../../components'
import { today } from '../../engine/dates'
import { useT } from '../../i18n'
import { relativeDateLabel } from '../../kit/dateLabel'
import { byTime, functionTotal, nameKey } from './engine'
import { FunctionSheet } from './FunctionSheet'
import { entryWhat, kindLabel, rupees } from './labels'
import { SHAGUN_FUNCTION_PATTERN, SHAGUN_PATH, shagunAddPath, shagunFamilyPath } from './paths'
import { deleteEntry, deleteFunction, restoreEntries, restoreFunction } from './store'
import { useShagun } from './useShagun'
import styles from './Shagun.module.css'

const ROUTES = [SHAGUN_FUNCTION_PATTERN] as const
const PAGE = 100

/**
 * `/app/shagun/function/:id` — one function: what came in (and went out) at it, from how many
 * families, every envelope (newest first, searchable), adding more, changing it and deleting it
 * (with Undo).
 */
export function ShagunFunctionScreen() {
  const t = useT()
  const toast = useToast()
  const { params } = useRoute(ROUTES)
  const { book } = useShagun()
  const fn = book.functions.find((f) => f.id === params.id) ?? null
  const [day] = useState(() => today())
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE)
  const [editing, setEditing] = useState<{ opened: number; open: boolean } | null>(null)
  const entries = useMemo(() => (fn ? book.entries.filter((e) => e.functionId === fn.id).sort((a, b) => byTime(b, a)) : []), [book.entries, fn])
  const header = <TopBar onBack={() => goBack(SHAGUN_PATH)} />

  if (!fn) {
    return (
      <Screen header={header}>
        <PageTitle title={t('shagun.fn.gone.title')} subtitle={t('shagun.fn.gone.body')} />
      </Screen>
    )
  }

  const totals = functionTotal(fn, entries)
  const q = nameKey(query)
  const matching = q ? entries.filter((e) => nameKey(e.name).includes(q)) : entries
  const page = matching.slice(0, shown)

  const removeFunction = () => {
    const removed = deleteFunction(fn.id)
    if (!removed) return
    navigate(SHAGUN_PATH, { replace: true })
    const message =
      removed.entries.length > 0
        ? t('shagun.fn.deleted.entries', { name: removed.fn.name, count: removed.entries.length })
        : t('shagun.fn.deleted', { name: removed.fn.name })
    toast(message, { action: { label: t('common.action.undo'), onAction: () => restoreFunction(removed) } })
  }

  const removeEntry = (id: string) => {
    const removed = deleteEntry(id)
    if (!removed) return
    toast(t('shagun.family.deleted', { what: `${removed.name}: ${entryWhat(removed)}` }), {
      action: { label: t('common.action.undo'), onAction: () => restoreEntries([removed]) },
    })
  }

  const summary = [
    totals.received > 0 || fn.mine ? t('shagun.fn.collected', { amount: rupees(totals.received), count: totals.families }) : null,
    totals.given > 0 ? t('shagun.fn.gave', { amount: rupees(totals.given) }) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Screen header={header} contentClassName={styles.content}>
      <PageTitle
        eyebrow={`${kindLabel(fn.kind)} · ${fn.mine ? t('shagun.function.yours') : t('shagun.function.theirs')}`}
        title={fn.name}
        subtitle={relativeDateLabel(fn.date, day)}
      />
      <p className={styles.body} role="status">
        {summary || t('shagun.fn.nothing')}
      </p>
      <div className={styles.actions}>
        <Button iconStart={<Plus />} onClick={() => navigate(shagunAddPath(fn.id))}>
          {t('shagun.addEnvelopes')}
        </Button>
        <Button variant="secondary" iconStart={<Pencil />} onClick={() => setEditing({ opened: Date.now(), open: true })}>
          {t('shagun.fn.rename')}
        </Button>
        <Button variant="ghost" iconStart={<Trash2 />} onClick={removeFunction}>
          {t('shagun.fn.delete')}
        </Button>
      </div>
      {entries.length > 0 && (
        <section className={styles.section} aria-labelledby="shagun-fn-entries">
          <h2 id="shagun-fn-entries" className={styles.heading}>
            {t('shagun.fn.entries')}
          </h2>
          {entries.length > 8 && (
            <TextField
              label={t('shagun.fn.search')}
              hideLabel
              placeholder={t('shagun.fn.search')}
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setShown(PAGE)
              }}
              autoComplete="off"
            />
          )}
          {matching.length === 0 ? (
            <p className={styles.fine}>{t('shagun.search.none', { query: query.trim() })}</p>
          ) : (
            <Card padding="none">
              <ul className={styles.list}>
                {page.map((entry) => {
                  const what = entryWhat(entry)
                  return (
                    <li key={entry.id} className={styles.row}>
                      <span className={styles.rowText}>
                        <button type="button" className={styles.rowLink} onClick={() => navigate(shagunFamilyPath(entry.name))}>
                          {entry.name}
                        </button>
                        <span className={styles.fine}>{what}</span>
                      </span>
                      <IconButton label={t('shagun.family.delete.aria', { what: `${entry.name}: ${what}` })} onClick={() => removeEntry(entry.id)}>
                        <Trash2 />
                      </IconButton>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}
          {matching.length > shown && (
            <Button variant="ghost" block onClick={() => setShown((n) => n + PAGE)}>
              {t('shagun.more', { count: Math.min(PAGE, matching.length - shown) })}
            </Button>
          )}
        </section>
      )}
      {editing && <FunctionSheet key={editing.opened} open={editing.open} onClose={() => setEditing({ ...editing, open: false })} fn={fn} />}
    </Screen>
  )
}
