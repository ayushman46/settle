import { useId, useState } from 'react'
import { Check, Pencil, Plus } from 'lucide-react'
import { ActionBar, BottomSheet, Button, useToast } from '../../components'
import type { StuckPayment } from '../../data/stores'
import { updateStuck } from '../../data/stuck'
import { useT } from '../../i18n'
import { haptic } from '../../lib/haptics'
import styles from './Stuck.module.css'

/** As much as a note keeps (the store's limit). */
const NOTE_MAX = 500

/** Notes on a stuck payment: who you spoke to, what they said, a ticket number — kept with it, on this phone. */
export function DetailNote({ payment: s }: { payment: StuckPayment }) {
  const t = useT()
  const headingId = useId()
  const [editing, setEditing] = useState(false)
  const note = s.note?.trim() || null
  return (
    <section className={styles.details} aria-labelledby={headingId}>
      <div className={styles.detailsHead}>
        <h2 id={headingId} className={styles.cardHeading}>
          {t('stuck.note.heading')}
        </h2>
        {note && (
          <Button size="sm" variant="ghost" iconStart={<Pencil />} onClick={() => setEditing(true)} aria-label={t('stuck.note.edit.aria')}>
            {t('common.action.edit')}
          </Button>
        )}
      </div>
      {note ? (
        <p className={styles.noteText}>{note}</p>
      ) : (
        <>
          <p className={styles.noteEmpty}>{t('stuck.note.empty')}</p>
          <Button size="sm" variant="secondary" iconStart={<Plus />} className={styles.noteAdd} onClick={() => setEditing(true)}>
            {t('stuck.note.add')}
          </Button>
        </>
      )}
      <NoteSheet open={editing} onClose={() => setEditing(false)} payment={s} />
    </section>
  )
}

function NoteSheet({ open, onClose, payment }: { open: boolean; onClose: () => void; payment: StuckPayment }) {
  // A fresh form each time it opens (the sheet keeps its last content while it slides away).
  const [opened, setOpened] = useState(0)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setOpened((n) => n + 1)
  }
  return <NoteFrame key={opened} open={open} onClose={onClose} payment={payment} />
}

function NoteFrame({ open, onClose, payment }: { open: boolean; onClose: () => void; payment: StuckPayment }) {
  const t = useT()
  const toast = useToast()
  const fieldId = useId()
  const [text, setText] = useState(payment.note ?? '')

  const save = (): void => {
    const undo = updateStuck(payment.id, { note: text.trim() || null })
    haptic('success')
    toast(t('stuck.note.saved'), { tone: 'success', action: undo ? { label: t('common.action.undo'), onAction: undo } : undefined })
    onClose()
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('stuck.note.heading')}
      footer={
        <ActionBar>
          <Button block iconStart={<Check />} onClick={save}>
            {t('common.action.save')}
          </Button>
        </ActionBar>
      }
    >
      <div className={styles.paste}>
        <label htmlFor={fieldId} className={styles.pasteLabel}>
          {t('stuck.note.label')}
        </label>
        <textarea
          id={fieldId}
          className={styles.area}
          rows={5}
          value={text}
          maxLength={NOTE_MAX}
          placeholder={t('stuck.note.empty')}
          onChange={(event) => setText(event.target.value)}
        />
      </div>
    </BottomSheet>
  )
}
