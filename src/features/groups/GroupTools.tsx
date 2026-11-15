import { useState } from 'react'
import { BookOpenText, CalendarRange, Dices, House, MessagesSquare, PiggyBank, ReceiptText } from 'lucide-react'
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
import { CheckoutLink } from '../checkout/CheckoutLink'
import { UnitsCard } from '../units/UnitsCard'
import { UnitsSheet } from '../units/UnitsSheet'
import { hasStory } from '../wrapped/engine'
import { wrappedPath } from '../wrapped/paths'
import styles from './GroupTools.module.css'

type Tool = 'kitty' | 'spin' | 'dates' | 'units'

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
          <Chip size="lg" leading={<PiggyBank />} onClick={() => setOpen('kitty')}>
            {t('groups.tools.kitty')}
          </Chip>
        )}
        {live && several && (
          <Chip size="lg" leading={<Dices />} onClick={() => setOpen('spin')}>
            {t('groups.tools.spin')}
          </Chip>
        )}
        {live && several && (
          <Chip size="lg" leading={<CalendarRange />} onClick={() => setOpen('dates')}>
            {t('groups.tools.dates')}
          </Chip>
        )}
        {live && several && (
          <Chip size="lg" leading={<House />} onClick={() => setOpen('units')}>
            {t('units.sheet.title')}
          </Chip>
        )}
        {story && (
          <Chip size="lg" leading={<BookOpenText />} onClick={() => navigate(wrappedPath(group.id))}>
            {t('groups.tools.story')}
          </Chip>
        )}
        {live && (
          <Chip size="lg" leading={<MessagesSquare />} onClick={() => navigate(chatPath(group.id))}>
            {t('groups.tools.chat')}
          </Chip>
        )}
        {live && <CheckoutLink group={group} variant="chip" />}
        {expenses.length > 0 && (
          <Chip size="lg" leading={<ReceiptText />} onClick={() => navigate(reportPath(group.id))}>
            {t('groups.tools.report')}
          </Chip>
        )}
      </div>
      {live && !story && expenses.length > 0 && expenses.length < 3 && <p className={styles.note}>{t('groups.tools.story.soon', { count: 3 - expenses.length })}</p>}
      <KittyCard group={group} onOpen={() => setOpen('kitty')} />
      <UnitsCard group={group} />
      <KittySheet group={group} open={open === 'kitty'} onClose={close} />
      <UnitsSheet group={group} open={open === 'units'} onClose={close} />
      <SpinSheet group={group} open={open === 'spin'} onClose={close} />
      <PresenceSheet group={group} open={open === 'dates'} onClose={close} />
    </>
  )
}
