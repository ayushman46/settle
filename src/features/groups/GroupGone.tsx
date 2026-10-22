import { goBack, navigate } from '../../app/router'
import { Button, PageTitle, Screen, TopBar } from '../../components'
import { GROUPS_PATH } from './paths'
import styles from './GroupGone.module.css'

/** What a group's pages show once the group no longer exists (deleted here or in another tab). */
export function GroupGone() {
  return (
    <Screen header={<TopBar onBack={() => goBack(GROUPS_PATH)} />}>
      <PageTitle title="This group is gone" subtitle="It may have been deleted — on this phone or in another tab." />
      <Button className={styles.action} onClick={() => navigate(GROUPS_PATH, { replace: true })}>
        See your groups
      </Button>
    </Screen>
  )
}
