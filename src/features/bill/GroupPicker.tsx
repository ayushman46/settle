import { useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronDown, UsersRound } from 'lucide-react'
import { BottomSheet } from '../../components'
import { useGroup, useGroups } from '../../data'
import type { Group } from '../../domain/types'
import { useT } from '../../i18n'
import { cx } from '../../lib/cx'
import { haptic } from '../../lib/haptics'
import styles from './GroupPicker.module.css'

export interface GroupPickerProps {
  /** The group the bill is filed under, or null. */
  value: string | null
  onChange: (groupId: string | null) => void
  className?: string
}

/**
 * "Group: Goa trip ▾" — files the bill under one of your groups, so its balances include it.
 * Renders nothing when you have no groups (and the bill isn't in one).
 */
export function GroupPicker({ value, onChange, className }: GroupPickerProps) {
  const t = useT()
  const groups = useGroups({ archived: false })
  const current = useGroup(value)
  const [open, setOpen] = useState(false)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const selectedRef = useRef<HTMLButtonElement | null>(null)

  // An archived group the bill was already in stays listed, so it can be seen and changed.
  const options: Array<Group | null> = [null, ...groups]
  if (current && !groups.some((g) => g.id === current.id)) options.push(current)
  if (options.length === 1) return null

  const choose = (groupId: string | null): void => {
    if (groupId !== value) {
      haptic('select')
      onChange(groupId)
    }
    setOpen(false)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const index = optionRefs.current.findIndex((el) => el === document.activeElement)
    const last = options.length - 1
    let target: number
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        target = index >= last ? 0 : index + 1
        break
      case 'ArrowUp':
      case 'ArrowLeft':
        target = index <= 0 ? last : index - 1
        break
      case 'Home':
        target = 0
        break
      case 'End':
        target = last
        break
      default:
        return
    }
    event.preventDefault()
    optionRefs.current[target]?.focus()
  }

  const selectedIndex = Math.max(
    0,
    options.findIndex((g) => (g?.id ?? null) === (current ? current.id : null)),
  )

  return (
    <>
      <button
        type="button"
        className={cx(styles.chip, className)}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          haptic('tap')
          setOpen(true)
        }}
      >
        <span className={styles.lead}>{t('bill.group.lead')}</span>{' '}
        {current ? (
          <>
            <span className={styles.emoji} aria-hidden="true">
              {current.emoji}
            </span>
            <span className={styles.name}>{current.name}</span>
          </>
        ) : (
          <span className={styles.name}>{t('bill.group.none')}</span>
        )}
        <ChevronDown className={styles.chevron} aria-hidden="true" strokeWidth={2.5} />
      </button>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('bill.group.sheet.title')}
        description={t('bill.group.sheet.description')}
        initialFocus={selectedRef}
      >
        <div role="radiogroup" aria-label={t('bill.group.list.aria')} className={styles.list} onKeyDown={onKeyDown}>
          {options.map((group, i) => {
            const checked = i === selectedIndex
            return (
              <button
                key={group?.id ?? 'none'}
                ref={(el) => {
                  optionRefs.current[i] = el
                  if (checked) selectedRef.current = el
                }}
                type="button"
                role="radio"
                aria-checked={checked}
                tabIndex={checked ? 0 : -1}
                className={cx(styles.option, checked && styles.checked)}
                onClick={() => choose(group?.id ?? null)}
              >
                <span className={styles.tile} aria-hidden="true">
                  {group ? group.emoji : <UsersRound />}
                </span>
                <span className={styles.text}>
                  <span className={styles.optionName}>{group ? group.name : t('bill.group.noGroup')}</span>{' '}
                  <span className={styles.optionSub}>
                    {group ? t('bill.group.members', { count: group.memberIds.length }) : t('bill.group.noGroup.detail')}
                  </span>
                </span>
                <span className={styles.check} aria-hidden="true">
                  <Check strokeWidth={3} />
                </span>
              </button>
            )
          })}
        </div>
      </BottomSheet>
    </>
  )
}
