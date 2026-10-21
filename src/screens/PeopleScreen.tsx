import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import { ArrowRight, Pencil, Plus, UserRoundX, UsersRound, X } from 'lucide-react'
import {
  ActionBar,
  Avatar,
  BottomSheet,
  Button,
  Card,
  Chip,
  EmptyState,
  IconButton,
  PageTitle,
  Screen,
  TextField,
  TopBar,
  useToast,
} from '../components'
import { haptic } from '../lib/haptics'
import { newId } from '../lib/ids'
import { graphemes, isDuplicateName, MAX_NAME_LENGTH, MAX_PEOPLE, nameKey, nextColor, normalizeName } from '../lib/people'
import { getRecentNames, rememberNames } from '../lib/recent'
import { stepProgress } from '../state/selectors'
import { useFlow, useSession } from '../state/store'
import type { Person } from '../types'
import { plural, revealElement } from './screenUtils'
import { PERSON_KEYS, restorePerson } from './undoMerge'
import styles from './PeopleScreen.module.css'

/** Most "Recent" quick-add chips shown at once. */
const MAX_SUGGESTIONS = 8

/** Keeps a typed name within the length limit (no leading spaces, whole characters). */
function limitName(text: string): string {
  const trimmed = text.replace(/^\s+/, '')
  const chars = graphemes(trimmed)
  return chars.length > MAX_NAME_LENGTH ? chars.slice(0, MAX_NAME_LENGTH).join('') : trimmed
}

/** A name as it's already written on the list ("aisha" → "Aisha"), else as given. */
function listedName(name: string, people: readonly Person[], exceptId?: string): string {
  const key = nameKey(name)
  return people.find((p) => p.id !== exceptId && nameKey(p.name) === key)?.name ?? name
}

/** "Aisha is already here" — using the name as it's already written on the list. */
function duplicateMessage(name: string, people: readonly Person[], exceptId?: string): string {
  return `${listedName(name, people, exceptId)} is already here`
}

/** Where focus goes after a keyboard user removes a row or uses a chip (the control is gone). */
type FocusTarget = { kind: 'remove'; personId: string } | { kind: 'chip'; index: number } | { kind: 'input' }

/** "Who's splitting?" — add the people at the table (at least two). */
export function PeopleScreen() {
  const { session, dispatch } = useSession()
  const flow = useFlow()
  const toast = useToast()
  const { people } = session

  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [recent] = useState(getRecentNames)
  const [autoFocusName] = useState(people.length === 0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [draftError, setDraftError] = useState<string | null>(null)
  /** Spoken (politely) after each add: the field just clears, so say what happened. */
  const [announcement, setAnnouncement] = useState('')

  const inputRef = useRef<HTMLInputElement>(null)
  const chipsRef = useRef<HTMLDivElement>(null)
  const focusAfter = useRef<FocusTarget | null>(null)
  /** A just-added person whose row should be scrolled into view (it may be under the keyboard). */
  const revealAfter = useRef<string | null>(null)
  const sessionRef = useRef(session)
  useLayoutEffect(() => {
    sessionRef.current = session
  })

  const baseId = useId()
  const removeId = (personId: string) => `${baseId}-remove-${personId}`
  const rowId = (personId: string) => `${baseId}-person-${personId}`
  const renameFormId = `${baseId}-rename`

  const full = people.length >= MAX_PEOPLE
  const pending = normalizeName(name)
  const pendingValid = pending !== '' && !full && !isDuplicateName(pending, people)
  const canNext = people.length + (pendingValid ? 1 : 0) >= 2
  const suggestions = full ? [] : recent.filter((n) => !isDuplicateName(n, people)).slice(0, MAX_SUGGESTIONS)
  const editing = editingId === null ? null : (people.find((p) => p.id === editingId) ?? null)

  // Keyboard users keep their place after the control they used disappears.
  useEffect(() => {
    const target = focusAfter.current
    if (!target) return
    focusAfter.current = null
    let el: HTMLElement | null = null
    if (target.kind === 'remove') el = document.getElementById(removeId(target.personId))
    else if (target.kind === 'chip') {
      const chips = chipsRef.current?.querySelectorAll<HTMLElement>('button')
      el = chips?.[Math.min(target.index, chips.length - 1)] ?? null
    }
    ;(el ?? inputRef.current)?.focus({ preventScroll: target.kind === 'input' })
  })

  // A new row lands at the end of the list: bring it into view above the action bar.
  useEffect(() => {
    const id = revealAfter.current
    if (id === null) return
    revealAfter.current = null
    revealElement(document.getElementById(rowId(id)))
  })

  /** Adds a person; returns false (with an inline error) when the name can't be used. */
  const add = (raw: string, via: 'field' | 'chip'): boolean => {
    const clean = normalizeName(raw)
    if (!clean) return false
    if (people.length >= MAX_PEOPLE) {
      setError(`That's the most one bill can take (${MAX_PEOPLE}).`)
      haptic('warning')
      return false
    }
    if (isDuplicateName(clean, people)) {
      setError(duplicateMessage(clean, people))
      haptic('warning')
      return false
    }
    const id = newId()
    dispatch({ type: 'addPerson', person: { id, name: clean, color: nextColor(people) } })
    if (via === 'field') haptic('tap') // chips already tick
    setError(null)
    revealAfter.current = id
    setAnnouncement(`Added ${clean} · ${plural(people.length + 1, 'person', 'people')}`)
    return true
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!pending) return
    if (add(name, 'field')) setName('')
    inputRef.current?.focus({ preventScroll: true })
  }

  const onNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Enter on an empty field once the table is set: done typing — let the keyboard go.
    if (event.key === 'Enter' && !pending && !event.nativeEvent.isComposing) {
      event.preventDefault()
      if (people.length >= 2) event.currentTarget.blur()
    }
  }

  const remove = (person: Person, byKeyboard: boolean) => {
    const before = sessionRef.current
    const index = before.people.findIndex((p) => p.id === person.id)
    if (index === -1) return
    if (byKeyboard) {
      const neighbour = before.people[index + 1] ?? before.people[index - 1]
      focusAfter.current = neighbour ? { kind: 'remove', personId: neighbour.id } : { kind: 'input' }
    }
    dispatch({ type: 'removePerson', personId: person.id })
    haptic('tap')
    toast(`Removed ${person.name}`, {
      action: {
        label: 'Undo',
        onAction: () => {
          const current = sessionRef.current
          const restored = restorePerson(current, before, person.id)
          if (restored) dispatch({ type: 'restore', session: restored, keys: PERSON_KEYS })
          // Never a silent no-op: say why it couldn't be undone.
          else if (current.people.length >= MAX_PEOPLE) toast("Couldn't undo — the table is full", { tone: 'info' })
          else if (isDuplicateName(person.name, current.people)) {
            toast(`Couldn't undo — ${listedName(person.name, current.people)} is already at the table`, { tone: 'info' })
          }
        },
      },
    })
  }

  const openRename = (person: Person) => {
    setDraft(person.name)
    setDraftError(null)
    setEditingId(person.id)
  }

  const saveRename = (event?: FormEvent) => {
    event?.preventDefault()
    if (!editing) return
    const clean = normalizeName(draft)
    if (!clean) {
      setDraftError('Enter a name')
      haptic('warning')
      return
    }
    if (isDuplicateName(clean, people, editing.id)) {
      setDraftError(duplicateMessage(clean, people, editing.id))
      haptic('warning')
      return
    }
    if (clean !== editing.name) {
      dispatch({ type: 'renamePerson', personId: editing.id, name: clean })
      haptic('tap')
    }
    setEditingId(null)
  }

  const goNext = () => {
    const names = people.map((p) => p.name)
    if (pendingValid && add(name, 'field')) {
      names.push(pending)
      setName('')
    }
    if (names.length < 2) return
    rememberNames(names)
    flow.next()
  }

  const hint = canNext ? undefined : people.length === 0 ? 'Add at least 2 people' : 'Add one more person'
  const fieldHint = full
    ? `That's everyone — ${MAX_PEOPLE} people max.`
    : people.length === 0
      ? 'Start with yourself, then your friends.'
      : undefined

  return (
    <Screen
      header={<TopBar onBack={flow.back} progress={stepProgress('people') ?? undefined} />}
      footer={
        <ActionBar hint={hint}>
          <Button block iconEnd={<ArrowRight />} disabled={!canNext} onClick={goNext}>
            Next: who had what
          </Button>
        </ActionBar>
      }
    >
      <PageTitle title="Who's splitting?" subtitle="Add everyone at the table." />

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <TextField
          ref={inputRef}
          label="Add a person"
          placeholder="Name"
          value={name}
          onChange={(event) => {
            setName(limitName(event.target.value))
            if (error) setError(null)
          }}
          onKeyDown={onNameKeyDown}
          error={error ?? undefined}
          hint={fieldHint}
          disabled={full}
          autoFocus={autoFocusName}
          autoComplete="off"
          autoCapitalize="words"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="enter"
          endAdornment={
            <IconButton
              type="submit"
              label="Add person"
              variant={pending && !full ? 'primary' : 'ghost'}
              disabled={!pending || full}
            >
              <Plus strokeWidth={2.5} />
            </IconButton>
          }
        />
      </form>

      {/* Who's at the table sits right under the field, so each add shows up where you're looking. */}
      {people.length > 0 ? (
        <section className={styles.section} aria-labelledby={`${baseId}-table`}>
          <div className={styles.sectionHead}>
            <h2 id={`${baseId}-table`} className={styles.sectionTitle}>
              At the table
            </h2>
            <span className={styles.count}>{plural(people.length, 'person', 'people')}</span>
          </div>
          <Card padding="none">
            <ul role="list" className={styles.list}>
              {people.map((person) => (
                <li key={person.id} id={rowId(person.id)} className={styles.person}>
                  <button
                    type="button"
                    className={styles.personMain}
                    aria-label={`${person.name}, edit name`}
                    onClick={() => openRename(person)}
                  >
                    <Avatar name={person.name} color={person.color} size="md" />
                    <span className={styles.personName}>{person.name}</span>
                    <Pencil aria-hidden="true" className={styles.editIcon} strokeWidth={2.25} />
                  </button>
                  <IconButton
                    id={removeId(person.id)}
                    label={`Remove ${person.name}`}
                    onClick={(event) => remove(person, event.detail === 0)}
                  >
                    <X strokeWidth={2.25} />
                  </IconButton>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : (
        <div className={styles.empty}>
          <EmptyState
            size="sm"
            icon={<UsersRound />}
            title="No one yet"
            text="Add at least two people — and don't forget yourself."
          />
        </div>
      )}

      {suggestions.length > 0 && (
        <section className={styles.section} aria-labelledby={`${baseId}-recent`}>
          <h2 id={`${baseId}-recent`} className={styles.sectionTitle}>
            Recent
          </h2>
          <div ref={chipsRef} className={styles.chips}>
            {suggestions.map((suggestion, index) => (
              <Chip
                key={suggestion}
                leading={<Plus strokeWidth={2.5} />}
                aria-label={`Add ${suggestion}`}
                onClick={(event: MouseEvent<HTMLButtonElement>) => {
                  if (event.detail === 0) focusAfter.current = { kind: 'chip', index }
                  add(suggestion, 'chip')
                }}
              >
                {suggestion}
              </Chip>
            ))}
          </div>
        </section>
      )}

      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>

      <BottomSheet
        open={editing !== null}
        onClose={() => setEditingId(null)}
        title="Edit name"
        footer={
          <ActionBar direction="row">
            <Button
              variant="secondary"
              iconStart={<UserRoundX />}
              onClick={(event) => {
                if (!editing) return
                const person = editing
                setEditingId(null)
                remove(person, event.detail === 0)
              }}
            >
              Remove
            </Button>
            <Button type="submit" form={renameFormId}>
              Save
            </Button>
          </ActionBar>
        }
      >
        <form id={renameFormId} onSubmit={saveRename} noValidate>
          <TextField
            label="Name"
            value={draft}
            onChange={(event) => {
              setDraft(limitName(event.target.value))
              if (draftError) setDraftError(null)
            }}
            error={draftError ?? undefined}
            autoFocus
            autoComplete="off"
            autoCapitalize="words"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
          />
        </form>
      </BottomSheet>
    </Screen>
  )
}
