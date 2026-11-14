/** "Doesn't drink" and "Vegetarian" for one person, on their page: what the Assign step remembers. */
import { Switch } from '../../components'
import { useT } from '../../i18n'
import { setDiet, useFriendDiet } from './store'
import styles from './Diet.module.css'

export interface DietTogglesProps {
  friendId: string
}

export function DietToggles({ friendId }: DietTogglesProps) {
  const t = useT()
  const prefs = useFriendDiet(friendId)
  if (!friendId) return null
  return (
    <div role="group" aria-label={t('diet.toggles.aria')} className={styles.toggles}>
      <Switch
        checked={prefs?.noAlcohol === true}
        onChange={(on) => setDiet(friendId, 'alcohol', on)}
        label={t('diet.toggles.alcohol')}
        description={t('diet.toggles.alcohol.body')}
      />
      <Switch
        checked={prefs?.veg === true}
        onChange={(on) => setDiet(friendId, 'nonveg', on)}
        label={t('diet.toggles.nonveg')}
        description={t('diet.toggles.nonveg.body')}
      />
    </div>
  )
}
