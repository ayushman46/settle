import { useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { ActionBar, BottomSheet, Button, useToast } from '../../components'
import { useT } from '../../i18n'
import { haptic } from '../../lib/haptics'
import { clearFees } from './actions'
import styles from './Fees.module.css'

/** At the bottom of Bank charges: forget every charge and claim kept on this phone (asked first, with Undo). */
export function FeesClear() {
  const t = useT()
  const toast = useToast()
  const [asking, setAsking] = useState(false)
  // Opens on Cancel: the destructive button is never where focus lands.
  const cancel = useRef<HTMLButtonElement>(null)
  const clear = (): void => {
    const undo = clearFees()
    haptic('tap')
    setAsking(false)
    toast(t('fees.cleared'), { action: { label: t('common.action.undo'), onAction: undo } })
  }
  return (
    <>
      <Button size="sm" variant="ghost" iconStart={<Trash2 />} className={styles.clear} onClick={() => setAsking(true)}>
        {t('fees.clear')}
      </Button>
      <BottomSheet
        open={asking}
        onClose={() => setAsking(false)}
        initialFocus={cancel}
        title={t('fees.clear')}
        description={t('fees.clear.confirm')}
        footer={
          <ActionBar>
            <Button block variant="danger" iconStart={<Trash2 />} onClick={clear}>
              {t('fees.clear')}
            </Button>
            <Button ref={cancel} block variant="secondary" onClick={() => setAsking(false)}>
              {t('common.action.cancel')}
            </Button>
          </ActionBar>
        }
      />
    </>
  )
}
