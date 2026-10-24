import { useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Check, Phone } from 'lucide-react'
import { Avatar, BottomSheet, Button, TextField, useToast } from '../../components'
import { addFriend, cleanPhone, DataError, findFriendByName, updateFriend, useFriends } from '../../data'
import { ME_ID, type Friend } from '../../domain/types'
import { useT, type MessageKey } from '../../i18n'
import { cx } from '../../lib/cx'
import { haptic } from '../../lib/haptics'
import { MAX_NAME_LENGTH, nextColor, normalizeName } from '../../lib/people'
import { isValidUpiId } from '../../lib/upi'
import { AVATAR_COLORS } from '../../types'
import styles from './FriendSheet.module.css'

/** The avatar palette's names, in palette order (see `--avatar-N-bg`). */
const COLOR_NAMES: readonly MessageKey[] = [
  'friends.color.peach',
  'friends.color.mint',
  'friends.color.sky',
  'friends.color.lilac',
  'friends.color.lemon',
  'friends.color.rose',
  'friends.color.teal',
  'friends.color.sand',
]

/** The phone-number error in English, as `friends.form.phone.error` has it (the sheet shows it in the current language). */
export const PHONE_ERROR = 'That doesn’t look like a phone number. Use 7 to 15 digits, like 98765 43210.'

export interface FriendSheetProps {
  open: boolean
  onClose: () => void
  /** Who to edit; leave out to add someone new. */
  friend?: Friend | null
  /** Name to start with when adding (e.g. what was just searched for). */
  initialName?: string
  /** After saving: the saved person, and whether they're new. */
  onSaved?: (friend: Friend, created: boolean) => void
  /** After the sheet has left the screen. */
  onExited?: () => void
}

interface Form {
  name: string
  upiId: string
  phone: string
  /** Picked by hand (null = keep theirs / the next free colour). */
  color: number | null
  /** Show field errors (after the first try to save, or leaving a field). */
  touched: { upiId: boolean; phone: boolean }
}

function formFor(friend: Friend | null | undefined, initialName: string): Form {
  return {
    name: friend?.name ?? initialName,
    upiId: friend?.upiId ?? '',
    phone: friend?.phone ?? '',
    color: null,
    touched: { upiId: false, phone: false },
  }
}

/**
 * Add someone to your people, or edit them: their name, the UPI ID they get paid on (so friends
 * can pay them in a tap) and a phone number for WhatsApp and SMS reminders — both optional — and
 * the colour of their avatar. Names stay unique; a clash says who it clashes with.
 */
export function FriendSheet({ open, onClose, friend, initialName = '', onSaved, onExited }: FriendSheetProps) {
  const t = useT()
  const toast = useToast()
  const friends = useFriends()
  const upiRef = useRef<HTMLInputElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const editing = friend != null
  const [form, setForm] = useState<Form>(() => formFor(friend, initialName))
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setForm(formFor(friend, initialName))
  }
  const patch = (next: Partial<Form>) => setForm((f) => ({ ...f, ...next }))

  const others = friends.filter((f) => f.id !== ME_ID)
  const name = normalizeName(form.name)
  const clash = name ? findFriendByName(name, friends) : null
  const nameError = clash && clash.id !== friend?.id ? t('friends.form.name.taken', { name: clash.name }) : null
  const upiOk = form.upiId.trim() === '' || isValidUpiId(form.upiId)
  const phoneOk = form.phone.trim() === '' || cleanPhone(form.phone) !== null
  const color = form.color ?? friend?.color ?? nextColor(others)
  const ready = name !== '' && nameError === null && upiOk && phoneOk

  const save = (): void => {
    if (!ready) {
      patch({ touched: { upiId: true, phone: true } })
      haptic('warning')
      return
    }
    const fields = { upiId: form.upiId.trim() || null, phone: form.phone.trim() || null }
    try {
      let saved: Friend
      if (friend) {
        saved = updateFriend(friend.id, { name, ...fields, color })
      } else {
        saved = addFriend({ name, ...fields })
        if (saved.color !== color) saved = updateFriend(saved.id, { color })
      }
      haptic('success')
      toast(editing ? t('friends.form.saved.toast') : t('friends.form.added.toast', { name: saved.name }), { tone: 'success' })
      onSaved?.(saved, !editing)
      onClose()
    } catch (error) {
      if (!(error instanceof DataError)) throw error
      haptic('error')
      toast(error.message, { tone: 'error' })
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      onExited={onExited}
      title={editing ? t('friends.form.edit.title', { name: friend.name }) : t('friends.form.add.title')}
      description={editing ? undefined : t('friends.form.add.description')}
      footer={
        <Button block disabled={name === '' || nameError !== null} onClick={save}>
          {editing ? t('common.action.save') : t('friends.form.add.cta')}
        </Button>
      }
    >
      <form
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
      >
        <div className={styles.preview} aria-hidden="true">
          <Avatar name={name || '?'} color={color} size="lg" className={styles.previewAvatar} />
        </div>
        <TextField
          label={t('friends.form.name.label')}
          value={form.name}
          placeholder={t('friends.form.name.placeholder')}
          maxLength={MAX_NAME_LENGTH}
          autoFocus={!editing}
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="next"
          error={nameError}
          onChange={(event) => patch({ name: event.currentTarget.value })}
          onKeyDown={(event) => {
            if (enterPressed(event)) upiRef.current?.focus()
          }}
        />
        <TextField
          ref={upiRef}
          label={t('friends.form.upi.label')}
          value={form.upiId}
          placeholder="name@okaxis" // i18n-ignore: a UPI ID's shape
          inputMode="email"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          className={styles.mono}
          hint={t('friends.form.upi.hint')}
          error={form.touched.upiId && !upiOk ? t('friends.form.upi.error') : undefined}
          onChange={(event) => patch({ upiId: event.currentTarget.value.replace(/\s+/g, '') })}
          onKeyDown={(event) => {
            if (enterPressed(event)) phoneRef.current?.focus()
          }}
          onBlur={() => patch({ touched: { ...form.touched, upiId: form.upiId !== '' } })}
        />
        <TextField
          ref={phoneRef}
          label={t('friends.form.phone.label')}
          type="tel"
          value={form.phone}
          placeholder="98765 43210"
          inputMode="tel"
          autoComplete="off"
          enterKeyHint="done"
          hint={t('friends.form.phone.hint')}
          error={form.touched.phone && !phoneOk ? t('friends.form.phone.error') : undefined}
          startAdornment={<Phone aria-hidden="true" className={styles.icon} />}
          onChange={(event) => patch({ phone: event.currentTarget.value })}
          onKeyDown={(event) => {
            if (enterPressed(event)) save()
          }}
          onBlur={() => patch({ touched: { ...form.touched, phone: form.phone !== '' } })}
        />
        <ColorPicker value={color} onChange={(next) => patch({ color: next })} />
      </form>
    </BottomSheet>
  )
}

/**
 * True for Enter (not mid-composition), with its default stopped — the form has several fields,
 * so Enter moves on (or saves from the last) instead of submitting by itself.
 */
function enterPressed(event: KeyboardEvent<HTMLInputElement>): boolean {
  if (event.key !== 'Enter' || event.nativeEvent.isComposing) return false
  event.preventDefault()
  return true
}

function ColorPicker({ value, onChange }: { value: number; onChange: (color: number) => void }) {
  const t = useT()
  const labelId = useId()
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const pick = (i: number, focus: boolean): void => {
    const next = ((i % AVATAR_COLORS) + AVATAR_COLORS) % AVATAR_COLORS
    if (focus) refs.current[next]?.focus()
    if (next === value) return
    haptic('select')
    onChange(next)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const moves: Record<string, number> = {
      ArrowRight: value + 1,
      ArrowDown: value + 1,
      ArrowLeft: value - 1,
      ArrowUp: value - 1,
      Home: 0,
      End: AVATAR_COLORS - 1,
    }
    const target = moves[event.key]
    if (target === undefined) return
    event.preventDefault()
    pick(target, true)
  }
  return (
    <div className={styles.colors}>
      <p id={labelId} className={styles.colorsLabel}>
        {t('friends.form.color.label')}
      </p>
      <div role="radiogroup" aria-labelledby={labelId} className={styles.swatches} onKeyDown={onKeyDown}>
        {COLOR_NAMES.map((label, i) => (
          <button
            key={label}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={i === value}
            aria-label={t(label)}
            tabIndex={i === value ? 0 : -1}
            className={cx(styles.swatch, i === value && styles.picked)}
            style={{ '--swatch': `var(--avatar-${i}-bg)`, '--swatch-ink': `var(--avatar-${i}-ink)` } as CSSProperties}
            onClick={() => pick(i, false)}
          >
            {i === value && <Check aria-hidden="true" strokeWidth={3} />}
          </button>
        ))}
      </div>
    </div>
  )
}
