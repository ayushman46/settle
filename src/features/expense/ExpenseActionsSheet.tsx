import type { ReactNode } from 'react'
import { CheckCheck, CopyPlus, Pencil, Trash2 } from 'lucide-react'
import { BottomSheet } from '../../components'
import { cx } from '../../lib/cx'
import styles from './ExpenseActionsSheet.module.css'

export interface ExpenseActionsSheetProps {
  open: boolean
  onClose: () => void
  title: string
  /** True for an itemized bill (editing opens the bill again). */
  itemized: boolean
  onEdit: () => void
  onDuplicate: () => void
  /** Ticks everyone who still owes you; omit when nobody does. */
  onMarkAllPaid?: () => void
  onDelete: () => void
  /** Actions features add (e.g. "Let friends claim items"), listed just above Delete. */
  extra?: readonly ExpenseActionDef[]
}

/** One entry in the ⋮ menu. */
export interface ExpenseActionDef {
  key: string
  icon: ReactNode
  label: string
  detail: string
  onSelect: () => void
  danger?: boolean
}

/** What an added action can do to the menu itself. */
export interface ExpenseActionContext {
  /** Closes the ⋮ menu (call before navigating away). */
  close: () => void
}

/** The ⋮ menu of an expense: edit, duplicate, mark everyone as paid, what features add, delete (with undo). */
export function ExpenseActionsSheet({ open, onClose, title, itemized, onEdit, onDuplicate, onMarkAllPaid, onDelete, extra = [] }: ExpenseActionsSheetProps) {
  const actions: ExpenseActionDef[] = [
    {
      key: 'edit',
      icon: <Pencil />,
      label: itemized ? 'Edit the bill' : 'Edit',
      detail: itemized ? 'Items, who had what, who paid' : 'Amount, people, how it’s split',
      onSelect: onEdit,
    },
    { key: 'duplicate', icon: <CopyPlus />, label: 'Duplicate', detail: 'A copy dated today, to change and save', onSelect: onDuplicate },
  ]
  if (onMarkAllPaid) {
    actions.push({ key: 'paid', icon: <CheckCheck />, label: 'Mark everyone as paid', detail: 'When it’s all come back', onSelect: onMarkAllPaid })
  }
  actions.push(...extra)
  actions.push({ key: 'delete', icon: <Trash2 />, label: 'Delete', detail: 'You can undo it straight after', onSelect: onDelete, danger: true })

  return (
    <BottomSheet open={open} onClose={onClose} title={title} eyebrow="Expense">
      <ul role="list" className={styles.list}>
        {actions.map((action) => (
          <li key={action.key}>
            <button type="button" className={cx(styles.action, action.danger && styles.danger)} onClick={action.onSelect}>
              <span className={styles.icon} aria-hidden="true">
                {action.icon}
              </span>
              <span className={styles.text}>
                <span className={styles.label}>{action.label}</span>
                <span className={styles.detail}>{action.detail}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </BottomSheet>
  )
}
