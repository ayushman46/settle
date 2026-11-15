import { useMemo, useState } from 'react'
import { BookOpenText, FileSpreadsheet, Printer, Share2 } from 'lucide-react'
import { goBack, navigate, useRoute } from '../../app/router'
import { Button, Card, EmptyState, PageTitle, Screen, SegmentedControl, TopBar, useToast } from '../../components'
import { useExpenses, useFriend, useFriendsById, useGroups, useProfile } from '../../data'
import { ME_ID } from '../../domain/types'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { friendLabel } from '../../kit/friendName'
import { cx } from '../../lib/cx'
import { printPage } from '../../lib/nativeApp'
import { shareResult } from '../../lib/share'
import { outsideName } from '../../share/names'
import { shareFile } from '../../share/shareFile'
import { firstName } from '../../share/text'
import { FRIENDS_PATH, friendPath, newSplitPath } from '../groups/paths'
import { passbook, type PassbookEntry, type PassbookLedger, type PassbookRange } from './engine'
import { PassbookDoc } from './PassbookDoc'
import { balanceLabel, dayLabel, entryKind, entryWhat, groupNote, passbookCsvBlob, passbookCsvFilename, passbookText, periodLabel, runLabel, signedMoney, type Names } from './passbookText'
import { PASSBOOK_FRIENDS_PATTERN, PASSBOOK_PATTERN } from './paths'
import { setPassbookRange, usePassbookRange } from './store'
import styles from './Passbook.module.css'

const ROUTES = [PASSBOOK_PATTERN, PASSBOOK_FRIENDS_PATTERN] as const

/** A history longer than this opens on the last three months (everything is one tap away). */
const LONG_HISTORY = 40

/**
 * `/app/people/:id/statement`: a bank-style passbook between you and one person, across every
 * group and every split outside groups: each bill, loan and payment with the balance after it, an
 * opening and a closing balance, for this month, three months or everything. The closing balance
 * is the number on the person's page. Share it as text, print it, or download a spreadsheet.
 */
export function PassbookScreen() {
  const t = useT()
  const toast = useToast()
  const { params } = useRoute(ROUTES)
  const id = params.id ?? ''
  const friend = useFriend(id)
  const friendsById = useFriendsById()
  const profile = useProfile()
  const expenses = useExpenses()
  const groups = useGroups()
  const saved = usePassbookRange()
  const [today] = useState(() => todayIso())
  const [busy, setBusy] = useState(false)

  const everything = useMemo(() => passbook({ friendId: id, expenses, groups, currency: profile.currency, today, range: 'all' }), [id, expenses, groups, profile.currency, today])
  const range: PassbookRange = saved ?? (everything.count > LONG_HISTORY ? 'three' : 'all')
  const book = useMemo(
    () => (range === 'all' ? everything : passbook({ friendId: id, expenses, groups, currency: profile.currency, today, range })),
    [range, everything, id, expenses, groups, profile.currency, today],
  )

  const fullName = friendLabel(id, friend)
  const name = firstName(fullName)
  const names: Names = useMemo(() => {
    const me = outsideName(ME_ID, friendsById, profile, '')
    return { name, me: me === '' ? null : firstName(me) }
  }, [name, friendsById, profile])
  const back = () => goBack(friend ? friendPath(id) : FRIENDS_PATH)
  const header = <TopBar onBack={back} />

  if (id === ME_ID || id === '' || (!friend && everything.count === 0)) {
    return (
      <Screen header={header} contentClassName={styles.content}>
        <PageTitle title={t('passbook.title')} />
        <EmptyState
          icon={<BookOpenText />}
          title={t('passbook.gone.title')}
          text={t('passbook.gone.text')}
          action={<Button onClick={() => navigate(FRIENDS_PATH, { replace: true })}>{t('passbook.gone.cta')}</Button>}
        />
      </Screen>
    )
  }

  if (everything.count === 0) {
    return (
      <Screen header={header} contentClassName={styles.content}>
        <PageTitle title={t('passbook.title')} subtitle={t('passbook.subtitle', { name })} />
        <EmptyState
          icon={<BookOpenText />}
          title={t('passbook.empty.title', { name })}
          text={t('passbook.empty.text', { name })}
          action={<Button onClick={() => navigate(newSplitPath({ friend: id }))}>{t('passbook.empty.cta', { name })}</Button>}
        />
      </Screen>
    )
  }

  const share = async (): Promise<void> => {
    const outcome = await shareResult(passbookText(book, names), { title: t('passbook.title') })
    if (outcome === 'copied') toast(t('passbook.share.copied'), { tone: 'success' })
    else if (outcome === 'failed') toast(t('passbook.share.failed'), { tone: 'error' })
  }

  const downloadCsv = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    const outcome = await shareFile(passbookCsvBlob(book, names), passbookCsvFilename(name, today), undefined, { title: t('passbook.title') })
    setBusy(false)
    if (outcome === 'shared' || outcome === 'downloaded') toast(outcome === 'shared' ? t('passbook.csv.shared') : t('passbook.csv.saved'), { tone: 'success' })
    else if (outcome === 'failed') toast(t('passbook.csv.failed'), { tone: 'error' })
  }

  const several = book.ledgers.length > 1

  return (
    <Screen header={header} contentClassName={styles.content}>
      <PageTitle title={t('passbook.title')} subtitle={t('passbook.subtitle', { name })} />

      <div className={styles.block}>
        <SegmentedControl
          ariaLabel={t('passbook.range.aria')}
          value={range}
          onChange={setPassbookRange}
          options={[
            { value: 'month', label: t('passbook.range.month') },
            { value: 'three', label: t('passbook.range.three') },
            { value: 'all', label: t('passbook.range.all') },
          ]}
        />
        <p className={styles.fine}>{periodLabel(book)}</p>
      </div>

      {book.ledgers.map((ledger) => (
        <Ledger key={ledger.currency} ledger={ledger} names={names} heading={several} />
      ))}

      <div className={styles.actions}>
        <Button block iconStart={<Share2 />} onClick={() => void share()}>
          {t('passbook.share')}
        </Button>
        <Button block variant="secondary" iconStart={<Printer />} onClick={() => printPage(t('passbook.title'))}>
          {t('passbook.print')}
        </Button>
        <Button block variant="secondary" iconStart={<FileSpreadsheet />} disabled={busy} onClick={() => void downloadCsv()}>
          {busy ? t('passbook.csv.busy') : t('passbook.csv')}
        </Button>
      </div>

      {/* Only on paper: the same statement as a table, by name. Hidden on screen (and from screen readers, who have the list above). */}
      <div className={styles.printArea} aria-hidden="true">
        <PassbookDoc book={book} names={names} />
      </div>
    </Screen>
  )
}

function Ledger({ ledger, names, heading }: { ledger: PassbookLedger; names: Names; heading: boolean }) {
  const t = useT()
  const tone = (amount: number): string | undefined => (amount > 0 ? styles.plus : amount < 0 ? styles.minus : undefined)
  return (
    <section className={styles.block} aria-label={t('passbook.ledger.aria', { currency: ledger.currency })}>
      {heading && <h2 className={styles.heading}>{t('passbook.currency.heading', { currency: ledger.currency })}</h2>}
      <Card padding="none">
        <div className={styles.edge}>
          <span className={styles.edgeText}>
            <span className={styles.edgeLabel}>{t('passbook.opening')}</span>
            {ledger.earlier > 0 && <span className={styles.fine}>{t('passbook.opening.earlier', { count: ledger.earlier })}</span>}
          </span>
          <span className={styles.edgeAmount}>{balanceLabel(ledger.opening, ledger.currency, names)}</span>
        </div>
        {ledger.entries.length === 0 ? (
          <p className={styles.none}>{t('passbook.none.inDates')}</p>
        ) : (
          <ol className={styles.rows} aria-label={t('passbook.entries.aria')}>
            {ledger.entries.map((entry) => (
              <Row key={entry.id} entry={entry} currency={ledger.currency} names={names} />
            ))}
          </ol>
        )}
        <div className={styles.edge} data-closing role="status">
          <span className={styles.edgeText}>
            <span className={styles.edgeLabel}>{t('passbook.closing')}</span>
            {ledger.matches && <span className={styles.fine}>{t('passbook.closing.matches', { name: names.name })}</span>}
          </span>
          <span className={cx(styles.edgeAmount, tone(ledger.closing))}>{balanceLabel(ledger.closing, ledger.currency, names)}</span>
        </div>
      </Card>
      {ledger.adjusted.map((g) => (
        <p key={g.groupId} className={styles.fine}>
          {groupNote(g.groupName, names)}
        </p>
      ))}
    </section>
  )
}

function Row({ entry, currency, names }: { entry: PassbookEntry; currency: string; names: Names }) {
  const t = useT()
  const kind = entryKind(entry, names)
  return (
    <li className={styles.row}>
      <span className={styles.what}>
        <span className={styles.date}>{dayLabel(entry.date)}</span>
        <span className={styles.title}>{entryWhat(entry)}</span>
        <span className={styles.fine}>{entry.kind !== 'group' && entry.groupName ? t('passbook.row.in', { kind, group: entry.groupName }) : kind}</span>
      </span>
      <span className={styles.figures}>
        <span className={styles.amount}>{signedMoney(entry.amount, currency)}</span>
        <span className={styles.fine}>{runLabel(entry.balance, currency)}</span>
      </span>
    </li>
  )
}
