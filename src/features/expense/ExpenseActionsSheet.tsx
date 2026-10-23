import type { ReactNode } from 'react'
import { CheckCheck, CopyPlus, Pencil, Trash2 } from 'lucide-react'
import { BottomSheet } from '../../components'
import { useT } from '../../i18n'
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
  const t = useT()
  const actions: ExpenseActionDef[] = [
    {
      key: 'edit',
      icon: <Pencil />,
      label: t(itemized ? 'expense.actions.editBill' : 'expense.actions.edit'),
      detail: t(itemized ? 'expense.actions.editBill.detail' : 'expense.actions.edit.detail'),
      onSelect: onEdit,
    },
    { key: 'duplicate', icon: <CopyPlus />, label: t('expense.actions.duplicate'), detail: t('expense.actions.duplicate.detail'), onSelect: onDuplicate },
  ]
  if (onMarkAllPaid) {
    actions.push({ key: 'paid', icon: <CheckCheck />, label: t('expense.actions.markAll'), detail: t('expense.actions.markAll.detail'), onSelect: onMarkAllPaid })
  }
  actions.push(...extra)
  actions.push({ key: 'delete', icon: <Trash2 />, label: t('expense.actions.delete'), detail: t('expense.actions.delete.detail'), onSelect: onDelete, danger: true })

  return (
    <BottomSheet open={open} onClose={onClose} title={title} eyebrow={t('expense.actions.eyebrow')}>
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
