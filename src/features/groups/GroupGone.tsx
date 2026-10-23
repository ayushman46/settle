import { goBack, navigate } from '../../app/router'
import { Button, PageTitle, Screen, TopBar } from '../../components'
import { useT } from '../../i18n'
import { GROUPS_PATH } from './paths'
import styles from './GroupGone.module.css'

/** What a group's pages show once the group no longer exists (deleted here or in another tab). */
export function GroupGone() {
  const t = useT()
  return (
    <Screen header={<TopBar onBack={() => goBack(GROUPS_PATH)} />}>
      <PageTitle title={t('groups.gone.title')} subtitle={t('groups.gone.subtitle')} />
      <Button className={styles.action} onClick={() => navigate(GROUPS_PATH, { replace: true })}>
        {t('groups.gone.cta')}
      </Button>
    </Screen>
  )
}
