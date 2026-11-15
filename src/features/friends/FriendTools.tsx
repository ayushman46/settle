import { useState } from 'react'
import { BookText, CalendarClock, Gift, Globe, Layers } from 'lucide-react'
import { navigate } from '../../app/router'
import { Chip } from '../../components'
import { useT } from '../../i18n'
import { AbroadSheet } from '../abroad/AbroadSheet'
import { CallEvenButton } from '../chhutta/CallEvenButton'
import { KindSheet } from '../kind/KindSheet'
import { KistStartSheet } from '../kist/KistStartSheet'
import { passbookPath } from '../passbook/paths'
import { PromiseChip } from '../promise/PromiseChip'
import { PromiseSheet } from '../promise/PromiseSheet'
import styles from './FriendTools.module.css'

type Tool = 'kist' | 'promise' | 'kind' | 'abroad'

/**
 * What you can do about the money between you and one friend, beyond Pay and Remind: a row of
 * chips under the balance (each opens its own sheet or page), the promise in force if there is
 * one, and "call it even" when only small change is left.
 */
export function FriendTools({ friendId }: { friendId: string }) {
  const t = useT()
  const [open, setOpen] = useState<Tool | null>(null)
  const close = (): void => setOpen(null)
  return (
    <>
      <PromiseChip friendId={friendId} />
      <CallEvenButton friendId={friendId} />
      <div className={styles.tools} role="group" aria-label={t('friends.tools.aria')}>
        <Chip size="lg" leading={<Layers />} onClick={() => setOpen('kist')}>
          {t('kist.tool.title')}
        </Chip>
        <Chip size="lg" leading={<CalendarClock />} onClick={() => setOpen('promise')}>
          {t('promise.tool.title')}
        </Chip>
        <Chip size="lg" leading={<Gift />} onClick={() => setOpen('kind')}>
          {t('kind.tool.title')}
        </Chip>
        <Chip size="lg" leading={<BookText />} onClick={() => navigate(passbookPath(friendId))}>
          {t('passbook.tool.title')}
        </Chip>
        <Chip size="lg" leading={<Globe />} onClick={() => setOpen('abroad')}>
          {t('abroad.tool.title')}
        </Chip>
      </div>
      <KistStartSheet friendId={friendId} open={open === 'kist'} onClose={close} />
      <PromiseSheet friendId={friendId} open={open === 'promise'} onClose={close} />
      <KindSheet friendId={friendId} open={open === 'kind'} onClose={close} />
      <AbroadSheet friendId={friendId} open={open === 'abroad'} onClose={close} />
    </>
  )
}
