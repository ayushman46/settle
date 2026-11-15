import { useT } from '../../i18n'
import { PaydayPickSheet } from './PaydayPickSheet'
import { useMyPayday } from './store'
import { useSetMyPayday } from './usePaydayActions'

export interface PaydaySheetProps {
  open: boolean
  onClose: () => void
}

/** "When do you get paid?": sets your own payday in one tap (a toast with Undo says what was saved). */
export function PaydaySheet({ open, onClose }: PaydaySheetProps) {
  const t = useT()
  const mine = useMyPayday()
  const setMine = useSetMyPayday()
  return (
    <PaydayPickSheet
      open={open}
      onClose={onClose}
      title={t('payday.sheet.mine.title')}
      description={t('payday.sheet.mine.description')}
      value={mine}
      onPick={setMine}
    />
  )
}
