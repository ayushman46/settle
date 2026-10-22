import { ScanLine, Split, UsersRound } from 'lucide-react'
import { navigate } from '../../app/router'
import { CATEGORY_ICONS, QuickAction, QuickActionGrid } from '../../components'
import { openBill } from '../bill/launch'
import { NEW_GROUP_PATH, NEW_SPLIT_PATH, SPLIT_TEMPLATES, templatePath } from './homeLinks'

/** Home's grid of colourful quick actions: scan, split, a group, then the everyday templates. */
export function HomeQuickActions() {
  return (
    <QuickActionGrid label="Quick actions">
      <QuickAction icon={<ScanLine />} label="Scan bill" tone="ink" onClick={() => openBill()} />
      <QuickAction icon={<Split />} label="Split amount" tone="accent" onClick={() => navigate(NEW_SPLIT_PATH)} />
      <QuickAction icon={<UsersRound />} label="New group" tone="entertainment" onClick={() => navigate(NEW_GROUP_PATH)} />
      {SPLIT_TEMPLATES.map(({ category, label }) => {
        const Icon = CATEGORY_ICONS[category]
        return <QuickAction key={category} icon={<Icon />} label={label} tone={category} onClick={() => navigate(templatePath(category))} />
      })}
    </QuickActionGrid>
  )
}
