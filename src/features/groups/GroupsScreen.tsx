import { useMemo, useState } from 'react'
import { Archive, ChevronDown, Plus, Users } from 'lucide-react'
import { navigate, useSearchParams } from '../../app/router'
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Fab,
  IconButton,
  Illustration,
  List,
  ListRow,
  Money,
  PageTitle,
  Screen,
  SectionHeader,
  TopBar,
} from '../../components'
import { useExpenses, useGroups, useProfile } from '../../data'
import type { Group, GroupKind } from '../../domain/types'
import { formatMoney } from '../../lib/money'
import { cx } from '../../lib/cx'
import { GroupEmoji } from './GroupEmoji'
import { CreateGroupSheet } from './GroupSheets'
import { acrossGroups, groupStanding, kindMeta, membersLabel, standingLabel, type GroupStanding } from './groupView'
import { FRIENDS_PATH, groupPath, GROUPS_PATH } from './paths'
import styles from './GroupsScreen.module.css'

const QUICK_KINDS: readonly GroupKind[] = ['trip', 'home', 'couple', 'event']

interface Row {
  group: Group
  standing: GroupStanding
}

/**
 * `/app/groups` (tab) — trips, flats, couples: each group with where you stand in it and what it
 * spent, active ones first; archived ones fold away underneath. "New group" (or `?new=1`, e.g.
 * from Home) opens the create sheet; the new group opens straight after.
 */
export function GroupsScreen() {
  const query = useSearchParams()
  const fromQuery = query.get('new') === '1'
  const groups = useGroups()
  const expenses = useExpenses()
  const [creating, setCreating] = useState<{ kind: GroupKind } | null>(() => (fromQuery ? { kind: 'trip' } : null))
  const [showArchived, setShowArchived] = useState(false)

  const rows = useMemo(() => groups.map((group) => ({ group, standing: groupStanding(group, expenses) })), [groups, expenses])
  const active = rows.filter((r) => !r.group.archived)
  const archived = rows.filter((r) => r.group.archived)

  const startCreate = (kind: GroupKind = 'trip'): void => setCreating({ kind })

  const created = (group: Group): void => {
    setCreating(null)
    // `?new=1` opened the sheet: leave a plain groups page beneath the new group, so Back
    // returns to the list rather than to a fresh "New group" sheet.
    if (fromQuery) navigate(GROUPS_PATH, { replace: true })
    navigate(groupPath(group.id))
  }

  return (
    <Screen
      header={
        <TopBar
          right={
            <IconButton label="Your people" onClick={() => navigate(FRIENDS_PATH)}>
              <Users />
            </IconButton>
          }
        />
      }
      contentClassName={styles.content}
    >
      <PageTitle title="Groups" subtitle="Trips, flats, couples — Settle works out who pays whom." />

      {groups.length === 0 ? (
        <EmptyGroups onCreate={startCreate} />
      ) : (
        <>
          <AcrossGroups rows={active} />
          {active.length > 0 ? (
            <section className={styles.section} aria-labelledby="groups-active">
              <h2 id="groups-active" className="visually-hidden">
                Your groups
              </h2>
              <Card padding="none">
                <List>
                  {active.map((row) => (
                    <GroupRow key={row.group.id} row={row} />
                  ))}
                </List>
              </Card>
            </section>
          ) : (
            <p className={styles.allArchived}>Every group is archived. Start a new one any time.</p>
          )}
          {archived.length > 0 && (
            <section className={styles.section} aria-labelledby="groups-archived">
              <SectionHeader id="groups-archived" title={`Archived (${archived.length})`} />
              <button
                type="button"
                className={styles.fold}
                aria-expanded={showArchived}
                aria-controls="groups-archived-list"
                onClick={() => setShowArchived((v) => !v)}
              >
                <Archive aria-hidden="true" strokeWidth={2.25} />
                <span>{showArchived ? 'Hide archived groups' : 'Show archived groups'}</span>
                <ChevronDown aria-hidden="true" strokeWidth={2.5} className={cx(styles.foldChevron, showArchived && styles.open)} />
              </button>
              {showArchived && (
                <Card padding="none" id="groups-archived-list" className={styles.archived}>
                  <List>
                    {archived.map((row) => (
                      <GroupRow key={row.group.id} row={row} />
                    ))}
                  </List>
                </Card>
              )}
            </section>
          )}
          <Fab extended icon={<Plus strokeWidth={2.5} />} label="New group" onClick={() => startCreate()} />
        </>
      )}

      <CreateGroupSheet
        open={creating !== null}
        initialKind={creating?.kind ?? 'trip'}
        onClose={() => setCreating(null)}
        onCreated={created}
        onExited={() => {
          // Closed without creating: drop `?new=1`, so a reload doesn't reopen it.
          if (fromQuery) navigate(GROUPS_PATH, { replace: true })
        }}
      />
    </Screen>
  )
}

function GroupRow({ row }: { row: Row }) {
  const { group, standing } = row
  const meta = kindMeta(group.kind)
  const label = standingLabel(standing.mine, group.currency, standing.expenseCount > 0)
  const spent = standing.expenseCount > 0 ? `${formatMoney(standing.spent, group.currency, { trimZeros: true })} spent` : null
  const subtitle = [meta.label, membersLabel(group.memberIds.length), spent].filter(Boolean).join(' · ')
  return (
    <ListRow
      className={styles.row}
      onClick={() => navigate(groupPath(group.id))}
      aria-label={`${group.name}, ${subtitle}, ${label.spoken}`}
      leading={<GroupEmoji emoji={group.emoji} kind={group.kind} />}
      title={group.name}
      subtitle={subtitle}
      trailing={
        <span className={styles.side}>
          <span className={cx(styles.caption, styles[label.tone])}>{label.caption}</span>
          {label.amount !== null && (
            <Money value={label.amount} currency={group.currency} trimZeros strong tone={label.tone === 'positive' ? 'positive' : 'negative'} />
          )}
        </span>
      }
    />
  )
}

/** "Across your groups: you're owed ₹1,240 · you owe ₹300" — only when something's open. */
function AcrossGroups({ rows }: { rows: Row[] }) {
  const profile = useProfile()
  const totals = acrossGroups(rows)
  const codes = Object.keys(totals).sort((a, b) => (a === profile.currency ? -1 : b === profile.currency ? 1 : a < b ? -1 : 1))
  const main = codes[0]
  if (main === undefined) return null
  const lead = totals[main] ?? { owedToMe: 0, iOwe: 0 }
  const rest = codes.slice(1).map((code) => {
    const t = totals[code] ?? { owedToMe: 0, iOwe: 0 }
    const parts = [
      t.owedToMe > 0 ? `owed ${formatMoney(t.owedToMe, code, { trimZeros: true })}` : null,
      t.iOwe > 0 ? `owe ${formatMoney(t.iOwe, code, { trimZeros: true })}` : null,
    ].filter(Boolean)
    return `${code}: ${parts.join(', ')}`
  })
  return (
    <section className={styles.across} aria-labelledby="groups-across">
      <h2 id="groups-across" className={styles.acrossTitle}>
        Across your groups
      </h2>
      <dl className={styles.totals}>
        <div className={styles.total}>
          <dt>You’re owed</dt>
          <dd>
            <Money value={lead.owedToMe} currency={main} size="lg" trimZeros strong tone={lead.owedToMe > 0 ? 'positive' : 'default'} />
          </dd>
        </div>
        <div className={styles.total}>
          <dt>You owe</dt>
          <dd>
            <Money value={lead.iOwe} currency={main} size="lg" trimZeros strong tone={lead.iOwe > 0 ? 'negative' : 'default'} />
          </dd>
        </div>
      </dl>
      {rest.length > 0 && <p className={styles.acrossMore}>Also {rest.join(' · ')}</p>}
    </section>
  )
}

function EmptyGroups({ onCreate }: { onCreate: (kind?: GroupKind) => void }) {
  return (
    <div className={styles.empty}>
      <EmptyState
        illustration={<Illustration name="empty-groups" />}
        title="Split as a group"
        text="Add expenses as you go — Settle works out the fewest payments to square everyone up."
        action={
          <Button size="md" iconStart={<Plus />} onClick={() => onCreate()}>
            Create a group
          </Button>
        }
      />
      <div className={styles.quick} role="group" aria-label="Quick start">
        {QUICK_KINDS.map((kind) => {
          const meta = kindMeta(kind)
          return (
            <Chip key={kind} leading={<span className={styles.quickEmoji}>{meta.emoji}</span>} onClick={() => onCreate(kind)}>
              {meta.label}
            </Chip>
          )
        })}
      </div>
    </div>
  )
}

