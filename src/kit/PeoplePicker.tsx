import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Check, Search, UserPlus, X } from 'lucide-react'
import { IconButton, lastInputModality, TextField } from '../components'
import { addFriend, DataError, MAX_PARTICIPANTS, useFriends, useFriendsById } from '../data'
import { BRAND, ME_ID, type Friend } from '../domain/types'
import { useT } from '../i18n'
import { cx } from '../lib/cx'
import { haptic } from '../lib/haptics'
import { nameKey } from '../lib/people'
import { FriendAvatar } from './FriendAvatar'
import { FriendChip } from './FriendChip'
import { friendLabel } from './friendName'
import { alphabetical, exactPerson, newPersonName, searchPeople, soleMatch } from './peopleSearch'
import styles from './PeoplePicker.module.css'

export interface PeoplePickerProps {
  /** friendIds currently in the split, in the order they were picked. */
  selectedIds: readonly string[]
  /** Receives the new selection (unique ids, picking order kept). */
  onChange: (ids: string[]) => void
  /** Offer "Add “Name”" for a name that isn't one of your people yet (saves them). Default true. */
  allowAdd?: boolean
  /** List yourself ("You") too. Default true. */
  includeMe?: boolean
  /** Most people that can be picked. Default 100 (the most one expense can hold). */
  max?: number
  /** The group this split belongs to: its members get their own row with a "Select all". */
  groupMemberIds?: readonly string[]
  /** Accessible name of the search field. Default "Search or add people". */
  label?: string
  /** Put the cursor in the search field straight away. */
  autoFocus?: boolean
  className?: string
}

/** Most avatars in the "Frequent" row. */
const FREQUENT_COUNT = 8
/** Below this many people the full list is short enough on its own — no "Frequent" row. */
const FREQUENT_MIN_PEOPLE = 6

function unique(ids: readonly string[]): string[] {
  return Array.from(new Set(ids))
}

/**
 * Who's in? GPay-style people picking: the picked people as removable chips, a search field
 * that can also add someone new ("Add “Riya”"), a row of frequent people (or the group's
 * members) and everyone A–Z with checkmarks. Enter picks the match or adds the name, so a whole
 * table can be typed in one go: "Riya ⏎ Sam ⏎ Neha ⏎".
 */
export function PeoplePicker({
  selectedIds,
  onChange,
  allowAdd = true,
  includeMe = true,
  max,
  groupMemberIds,
  label,
  autoFocus = false,
  className,
}: PeoplePickerProps) {
  const t = useT()
  const friends = useFriends()
  const everyoneById = useFriendsById()
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  /** Element id to focus after the next render (a neighbouring chip's ✕ after a removal). */
  const focusAfter = useRef<string | null>(null)
  const baseId = useId()
  const chipRemoveId = (id: string) => `${baseId}-remove-${id}`
  const quickLabelId = `${baseId}-quick`
  const listLabelId = `${baseId}-list`

  const limit = Math.max(1, Math.floor(max ?? MAX_PARTICIPANTS))
  const picked = useMemo(() => unique(selectedIds), [selectedIds])
  const selected = useMemo(() => new Set(picked), [picked])
  const full = picked.length >= limit

  const pool = useMemo(() => (includeMe ? friends : friends.filter((f) => f.id !== ME_ID)), [friends, includeMe])
  const byId = useMemo(() => new Map(pool.map((f) => [f.id, f])), [pool])
  const memberSet = useMemo(() => (groupMemberIds ? new Set(groupMemberIds) : null), [groupMemberIds])

  const searching = nameKey(query) !== ''
  const results = useMemo(() => searchPeople(pool, query), [pool, query])
  const exact = searching ? exactPerson(pool, query) : null
  const addName = allowAdd && searching && !exact ? newPersonName(query) : null
  // What Enter picks: the person with exactly this name, else the only one it clearly means
  // ("riya" → Riya Sharma, rather than a second "Riya"), else the only result when adding is off.
  const enterPick = searching
    ? (exact ?? soleMatch(pool, query) ?? (results.length === 1 && !addName ? (results[0] ?? null) : null))
    : null

  // The quick row: the group's members, or the people you split with most (only once the list is long).
  const quick = useMemo<Friend[]>(() => {
    if (groupMemberIds) {
      return unique(groupMemberIds)
        .map((id) => byId.get(id))
        .filter((f): f is Friend => f !== undefined)
    }
    const others = pool.filter((f) => f.id !== ME_ID)
    return others.length >= FREQUENT_MIN_PEOPLE ? others.slice(0, FREQUENT_COUNT) : []
  }, [groupMemberIds, byId, pool])
  const allMembersIn = quick.length > 0 && quick.every((f) => selected.has(f.id))

  // Keyboard users keep their place after the control they used disappears.
  useEffect(() => {
    const target = focusAfter.current
    if (target === null) return
    focusAfter.current = null
    const el = target ? document.getElementById(target) : null
    ;(el ?? inputRef.current)?.focus({ preventScroll: el === null })
  })

  const announce = (text: string): void => {
    // A trailing zero-width space makes a repeated message ("Riya added" twice) speak again.
    setAnnouncement((prev) => (prev === text ? `${text}\u200b` : text))
  }

  const nameOf = (id: string): string => friendLabel(id, everyoneById[id] ?? null)

  const limitMessage = t('kit.people.limit', { count: limit })

  const select = (id: string): boolean => {
    if (selected.has(id)) return true
    if (full) {
      setError(limitMessage)
      haptic('warning')
      return false
    }
    setError(null)
    onChange([...picked, id])
    announce(t('kit.people.added', { name: nameOf(id) }))
    return true
  }

  const deselect = (id: string): void => {
    onChange(picked.filter((x) => x !== id))
    setError(null)
    announce(t('kit.people.removed', { name: nameOf(id) }))
  }

  const toggle = (id: string): void => {
    if (selected.has(id)) {
      haptic('select')
      deselect(id)
    } else if (select(id)) {
      haptic('select')
    }
  }

  const addPerson = (name: string): void => {
    if (full) {
      setError(limitMessage)
      haptic('warning')
      return
    }
    try {
      const friend = addFriend({ name })
      haptic('tap')
      setQuery('')
      setError(null)
      if (!selected.has(friend.id)) onChange([...picked, friend.id])
      announce(t('kit.people.addedNew', { name: friend.name }))
    } catch (caught) {
      if (!(caught instanceof DataError)) throw caught
      setError(caught.message)
      haptic('warning')
    }
  }

  const removeChip = (id: string): void => {
    if (lastInputModality() === 'keyboard') {
      const index = picked.indexOf(id)
      const neighbour = picked[index + 1] ?? picked[index - 1]
      focusAfter.current = neighbour ? chipRemoveId(neighbour) : ''
    }
    deselect(id)
  }

  const toggleMembers = (): void => {
    haptic('select')
    if (allMembersIn) {
      const members = new Set(quick.map((f) => f.id))
      onChange(picked.filter((id) => !members.has(id)))
      announce(t('kit.people.members.removed'))
      return
    }
    const missing = quick.map((f) => f.id).filter((id) => !selected.has(id))
    const room = limit - picked.length
    onChange([...picked, ...missing.slice(0, Math.max(0, room))])
    if (missing.length > room) setError(limitMessage)
    announce(t('kit.people.members.added'))
  }

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Enter') {
      event.preventDefault()
      if (!searching) return
      if (enterPick) {
        if (select(enterPick.id)) {
          haptic('tap')
          setQuery('')
        }
      } else if (addName) {
        addPerson(addName)
      }
    } else if (event.key === 'Escape' && query) {
      // Clear the search first; a second Escape can close a surrounding sheet.
      event.preventDefault()
      event.stopPropagation()
      setQuery('')
      setError(null)
    } else if (event.key === 'ArrowDown') {
      const first = listRef.current?.querySelector<HTMLButtonElement>('button')
      if (first) {
        event.preventDefault()
        first.focus()
      }
    }
  }

  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>): void => {
    const buttons = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])
    const index = buttons.findIndex((b) => b === document.activeElement)
    if (index === -1) return
    let target: HTMLElement | undefined
    switch (event.key) {
      case 'ArrowDown':
        target = buttons[index + 1]
        break
      case 'ArrowUp':
        target = index === 0 ? (inputRef.current ?? undefined) : buttons[index - 1]
        break
      case 'Home':
        target = buttons[0]
        break
      case 'End':
        target = buttons[buttons.length - 1]
        break
      default:
        return
    }
    event.preventDefault()
    target?.focus()
  }

  const listed = searching ? results : alphabetical(pool)
  // Offered first, unless Enter would pick someone already here — then it waits below them.
  const addRow = addName ? (
    <li>
      <button type="button" className={cx(styles.row, styles.addRow)} onClick={() => addPerson(addName)}>
        <span className={styles.addIcon} aria-hidden="true">
          <UserPlus strokeWidth={2.25} />
        </span>{' '}
        <span className={styles.rowText}>
          <span className={styles.rowName}>{t('kit.people.add.name', { name: addName })}</span>{' '}
          <span className={styles.rowSub}>{t('kit.people.add.hint', { brand: BRAND.name })}</span>
        </span>
      </button>
    </li>
  ) : null
  const onlyMe = pool.every((f) => f.id === ME_ID)

  return (
    <div className={cx(styles.picker, className)}>
      {picked.length > 0 && (
        <ul className={styles.chips} aria-label={t('kit.people.picked.aria', { count: picked.length })}>
          {picked.map((id) => (
            <li key={id} className={styles.chipItem}>
              <FriendChip friendId={id} removeId={chipRemoveId(id)} onRemove={() => removeChip(id)} />
            </li>
          ))}
        </ul>
      )}

      <TextField
        ref={inputRef}
        label={label ?? t('kit.people.label')}
        hideLabel
        type="text"
        value={query}
        placeholder={allowAdd ? t('kit.people.placeholder.add') : t('kit.people.placeholder')}
        autoFocus={autoFocus}
        autoComplete="off"
        autoCapitalize="words"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        maxLength={60}
        error={error}
        startAdornment={<Search aria-hidden="true" />}
        endAdornment={
          query ? (
            <IconButton
              label={t('kit.people.clear.aria')}
              size="sm"
              onClick={() => {
                setQuery('')
                setError(null)
                inputRef.current?.focus()
              }}
            >
              <X />
            </IconButton>
          ) : undefined
        }
        onChange={(event) => {
          setQuery(event.currentTarget.value)
          setError(null)
        }}
        onKeyDown={onSearchKeyDown}
      />

      {!searching && quick.length > 0 && (
        <section className={styles.quick} aria-labelledby={quickLabelId}>
          <div className={styles.quickHead}>
            <p id={quickLabelId} className={styles.overline}>
              {groupMemberIds ? t('kit.people.quick.group') : t('kit.people.quick.frequent')}
            </p>
            {groupMemberIds && (
              <button type="button" className={styles.textAction} onClick={toggleMembers}>
                {allMembersIn ? t('kit.people.quick.clearAll') : t('kit.people.quick.selectAll')}
              </button>
            )}
          </div>
          <div className={styles.strip}>
            {quick.map((friend) => {
              const on = selected.has(friend.id)
              return (
                <button
                  key={friend.id}
                  type="button"
                  className={styles.quickPerson}
                  aria-pressed={on}
                  aria-disabled={(!on && full) || undefined}
                  onClick={() => toggle(friend.id)}
                >
                  <FriendAvatar friend={friend} size="lg" showName selected={on} />
                </button>
              )
            })}
          </div>
        </section>
      )}

      <section className={styles.all} aria-labelledby={listLabelId}>
        <p id={listLabelId} className={cx(styles.overline, searching && 'visually-hidden')}>
          {searching ? t('kit.people.list.results') : t('kit.people.list.all')}
        </p>
        <ul ref={listRef} className={styles.list} role="list" onKeyDown={onListKeyDown}>
          {!enterPick && addRow}
          {listed.map((friend) => {
            const on = selected.has(friend.id)
            const member = memberSet?.has(friend.id) === true
            return (
              <li key={friend.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  aria-disabled={(!on && full) || undefined}
                  className={cx(styles.row, on && styles.on)}
                  onClick={() => toggle(friend.id)}
                >
                  <FriendAvatar friend={friend} size="md" />{' '}
                  <span className={styles.rowText}>
                    <span className={styles.rowName}>{friendLabel(friend.id, friend)}</span>
                    {member && (
                      <>
                        {' '}
                        <span className={styles.rowSub}>{t('kit.people.list.member')}</span>
                      </>
                    )}
                  </span>
                  <span className={styles.check} aria-hidden="true">
                    <Check strokeWidth={3} />
                  </span>
                </button>
              </li>
            )
          })}
          {enterPick && addRow}
        </ul>
        {searching && listed.length === 0 && !addName && (
          <p className={styles.empty}>{t('kit.people.noMatch', { query: query.trim() })}</p>
        )}
        {!searching && onlyMe && (
          <p className={styles.empty}>
            {allowAdd ? t('kit.people.empty.add', { brand: BRAND.name }) : t('kit.people.empty')}
          </p>
        )}
      </section>

      <p className="visually-hidden" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </div>
  )
}
