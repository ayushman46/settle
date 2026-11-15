import { useMemo, useState } from 'react'
import { Handshake } from 'lucide-react'
import { Button, type ButtonProps } from '../../components'
import { useExpenses, useFriend, useGroups, useProfile } from '../../data'
import { ME_ID } from '../../domain/types'
import { useT } from '../../i18n'
import { friendLabel } from '../../kit/index-a'
import { cx } from '../../lib/cx'
import { firstName } from '../../share/text'
import { friendBalance } from '../friends/friendBalance'
import { kindOpen } from './engine'
import { KindSheet } from './KindSheet'
import styles from './Kind.module.css'

export interface KindButtonProps {
  friendId: string
  variant?: ButtonProps['variant']
  block?: boolean
  className?: string
}

/**
 * "Settle without money", for a friend's page: opens the sheet. Nothing when nothing is open
 * between you (or for yourself).
 */
export function KindButton({ friendId, variant = 'ghost', block = false, className }: KindButtonProps) {
  const t = useT()
  const profile = useProfile()
  const friend = useFriend(friendId)
  const expenses = useExpenses()
  const groups = useGroups()
  const [open, setOpen] = useState(false)
  // Once opened, the sheet stays mounted so it can slide away after everything is settled.
  const [used, setUsed] = useState(false)
  const anything = useMemo(
    () => friendId !== ME_ID && kindOpen(friendBalance(friendId, expenses, groups, profile.currency)).length > 0,
    [friendId, expenses, groups, profile.currency],
  )
  if (!anything && !used) return null
  return (
    <>
      {anything && (
        <Button
          variant={variant}
          size="md"
          block={block}
          iconStart={<Handshake />}
          className={cx(styles.button, className)}
          aria-label={t('kind.button.aria', { name: firstName(friendLabel(friendId, friend)) })}
          onClick={() => {
            setUsed(true)
            setOpen(true)
          }}
        >
          {t('kind.button')}
        </Button>
      )}
      <KindSheet friendId={friendId} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
