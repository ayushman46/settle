import { useState } from 'react'
import { ActionBar, AmountInput, BottomSheet, Button, Chip, TextField } from '../../components'
import { useProfile } from '../../data'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { DEFAULT_PAY_DAY, DEFAULT_PAID_LEAVE, HELP_WORKS, type HelpWork } from './engine'
import { addHelper, cleanUpi, MAX_HELP_NAME, type HelperInput } from './store'
import { workLabel } from './text'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: (id: string) => void
}

export function HelpSetupSheet({ open, onClose, onSaved }: Props) {
  const t = useT()
  const { currency } = useProfile()
  const [name, setName] = useState('')
  const [work, setWork] = useState<HelpWork>('maid')
  const [salaryRaw, setSalaryRaw] = useState('')
  const [upi, setUpi] = useState('')
  const [busy, setBusy] = useState(false)

  const salaryPaise = Math.round((parseFloat(salaryRaw.replace(/,/g, '')) || 0) * 100)
  const canSave = name.trim().length > 0 && salaryPaise > 0

  const save = () => {
    if (!canSave || busy) return
    setBusy(true)
    const today = todayIso()
    const input: HelperInput = {
      name: name.trim(),
      work,
      salary: salaryPaise,
      currency,
      payDay: DEFAULT_PAY_DAY,
      paidLeave: DEFAULT_PAID_LEAVE,
      upi: cleanUpi(upi) ?? undefined,
    }
    const helper = addHelper(input, today)
    setBusy(false)
    if (!helper) return
    setName('')
    setSalaryRaw('')
    setUpi('')
    onSaved(helper.id)
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={t('help.setup.title')}>
      <TextField
        label={t('help.setup.name.label')}
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        placeholder={t('help.setup.name.placeholder')}
        maxLength={MAX_HELP_NAME}
        autoFocus
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        {HELP_WORKS.map((w) => (
          <Chip key={w} selected={work === w} onClick={() => setWork(w)}>
            {workLabel(w)}
          </Chip>
        ))}
      </div>
      <AmountInput
        label={t('help.setup.salary.label')}
        value={salaryRaw}
        onChange={setSalaryRaw}
        currency={currency}
      />
      <TextField
        label={t('help.setup.upi.label')}
        value={upi}
        onChange={(e) => setUpi(e.currentTarget.value)}
        placeholder={t('help.setup.upi.placeholder')}
        hint={t('help.setup.upi.hint')}
        type="text"
        inputMode="text"
        autoComplete="off"
      />
      <ActionBar>
        <Button variant="primary" onClick={save} disabled={!canSave || busy}>
          {t('help.setup.cta')}
        </Button>
      </ActionBar>
    </BottomSheet>
  )
}
