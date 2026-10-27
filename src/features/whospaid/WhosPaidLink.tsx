import { ListChecks } from 'lucide-react'
import { navigate } from '../../app/router'
import { Card, ListRow } from '../../components'
import { useT } from '../../i18n'
import { WHOS_PAID_PATH } from './paths'
import styles from './WhosPaid.module.css'

/** "Who's paid?" as a row to tap, for the screens where people owe you (To collect, an expense). */
export function WhosPaidLink() {
  const t = useT()
  return (
    <Card padding="none">
      <ListRow
        leading={
          <span className={styles.linkIcon} aria-hidden="true">
            <ListChecks />
          </span>
        }
        title={t('whospaid.title')}
        subtitle={t('whospaid.link.text')}
        onClick={() => navigate(WHOS_PAID_PATH)}
        chevron
      />
    </Card>
  )
}
