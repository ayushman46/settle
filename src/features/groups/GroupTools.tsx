import { useState } from 'react'
import { BookOpenText, CalendarRange, Dices, MessagesSquare, PiggyBank, ReceiptText } from 'lucide-react'
import { navigate } from '../../app/router'
import { Chip } from '../../components'
import { useExpenses } from '../../data'
import type { Group } from '../../domain/types'
import { useT } from '../../i18n'
import { chatPath } from '../chat/files'
import { KittyCard } from '../kitty/KittyCard'
import { KittySheet } from '../kitty/KittySheet'
import { PresenceSheet } from '../presence/PresenceSheet'
import { reportPath } from '../report/paths'
import { SpinSheet } from '../spin/SpinSheet'
import { hasStory } from '../wrapped/engine'
import { wrappedPath } from '../wrapped/paths'
import styles from './GroupTools.module.css'

type Tool = 'kitty' | 'spin' | 'dates'

/**
 * A group's tools, all in view: the kitty, the "who pays?" wheel, who was there when,
 * the group's story, an expense claim, and adding what the group chat says. Each opens its own
 * sheet or screen; a running kitty shows its card right under the row.
 */
export function GroupTools({ group }: { group: Group }) {
  const t = useT()
  const expenses = useExpenses({ groupId: group.id })
  const [open, setOpen] = useState<Tool | null>(null)
  const several = group.memberIds.length >= 2
  const live = !group.archived
  const story = hasStory(group, expenses)
  const close = (): void => setOpen(null)

  return (
    <>
      <div className={styles.tools} role="group" aria-label={t('groups.tools.aria')}>
        {live && several && (
          <Chip leading={<PiggyBank />} onClick={() => setOpen('kitty')}>
            {t('groups.tools.kitty')}
          </Chip>
        )}
        {live && several && (
          <Chip leading={<Dices />} onClick={() => setOpen('spin')}>
            {t('groups.tools.spin')}
          </Chip>
        )}
        {live && several && (
          <Chip leading={<CalendarRange />} onClick={() => setOpen('dates')}>
            {t('groups.tools.dates')}
          </Chip>
        )}
        {story && (
          <Chip leading={<BookOpenText />} onClick={() => navigate(wrappedPath(group.id))}>
            {t('groups.tools.story')}
          </Chip>
        )}
        {live && (
          <Chip leading={<MessagesSquare />} onClick={() => navigate(chatPath(group.id))}>
            {t('groups.tools.chat')}
          </Chip>
        )}
        {expenses.length > 0 && (
          <Chip leading={<ReceiptText />} onClick={() => navigate(reportPath(group.id))}>
            {t('groups.tools.report')}
          </Chip>
        )}
      </div>
      <KittyCard group={group} onOpen={() => setOpen('kitty')} />
      <KittySheet group={group} open={open === 'kitty'} onClose={close} />
      <SpinSheet group={group} open={open === 'spin'} onClose={close} />
      <PresenceSheet group={group} open={open === 'dates'} onClose={close} />
    </>
  )
}
