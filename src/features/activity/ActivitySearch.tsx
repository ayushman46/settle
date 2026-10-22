import { useId, useRef, type KeyboardEvent } from 'react'
import { Search, X } from 'lucide-react'
import { IconButton } from '../../components'
import styles from './ActivitySearch.module.css'

export interface ActivitySearchProps {
  value: string
  onChange: (value: string) => void
}

/**
 * The Activity search pill: filters as you type (names, places, notes, amounts). Escape or the ✕
 * clears it; Enter just puts the keyboard away.
 */
export function ActivitySearch({ value, onChange }: ActivitySearchProps) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape' && value !== '') {
      event.preventDefault()
      event.stopPropagation()
      onChange('')
    } else if (event.key === 'Enter') {
      event.preventDefault()
      event.currentTarget.blur()
    }
  }

  return (
    <div role="search" className={styles.search}>
      <label htmlFor={id} className="visually-hidden">
        Search activity
      </label>
      <Search aria-hidden="true" className={styles.icon} strokeWidth={2.25} />
      <input
        ref={inputRef}
        id={id}
        type="search"
        className={styles.input}
        placeholder="Search names, places or amounts"
        value={value}
        maxLength={80}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
      {value !== '' && (
        <IconButton
          label="Clear search"
          size="sm"
          className={styles.clear}
          onClick={() => {
            onChange('')
            inputRef.current?.focus()
          }}
        >
          <X />
        </IconButton>
      )}
    </div>
  )
}
