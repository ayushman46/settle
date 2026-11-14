import { BookHeart } from 'lucide-react'
import { navigate } from '../../app/router'
import { ListRow } from '../../components'
import { useT } from '../../i18n'
import { SettingIcon } from '../you/SettingIcon'
import { rupees } from './labels'
import { SHAGUN_PATH } from './paths'
import { useShagun } from './useShagun'

/**
 * The You screen's row into the shagun book: "Shagun book · 213 families · ₹4,82,301 received", or
 * what it's for while the book is empty. Goes inside a `List`.
 */
export function ShagunHomeRow() {
  const t = useT()
  const { totals } = useShagun()
  const parts = [t('shagun.row.families', { count: totals.families })]
  if (totals.received > 0) parts.push(`${rupees(totals.received)} ${t('shagun.totals.received').toLowerCase()}`)
  return (
    <ListRow
      leading={
        <SettingIcon>
          <BookHeart />
        </SettingIcon>
      }
      title={t('shagun.row.title')}
      subtitle={totals.families > 0 ? parts.join(' · ') : t('shagun.row.empty')}
      onClick={() => navigate(SHAGUN_PATH)}
      chevron
    />
  )
}
