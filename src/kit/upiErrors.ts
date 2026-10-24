/** Copy for UPI ID mistakes, read in the UI language (`UPI_ID_ERROR` in `UpiIdForm.tsx` is the English one). */
import { t } from '../i18n'

/** "That doesn't look like a UPI ID. It's like name@bank." */
export function upiIdError(): string {
  return t('kit.upiForm.error')
}
