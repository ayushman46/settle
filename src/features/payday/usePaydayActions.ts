/** Saving a payday from a tap: it is saved at once, and a toast with Undo says what was saved. */
import { useCallback } from 'react'
import { useToast } from '../../components'
import { useT } from '../../i18n'
import type { Payday } from './engine'
import { paydayLabel } from './labels'
import { friendPaydayOf, paydayStore, setFriendPayday, setMyPayday } from './store'

/** Sets (or, with null, forgets) your payday. Nothing happens, and nothing is said, when it is already that. */
export function useSetMyPayday(): (payday: Payday | null) => void {
  const t = useT()
  const toast = useToast()
  return useCallback(
    (payday) => {
      if (payday === paydayStore.get().mine) return
      const undo = setMyPayday(payday)
      toast(payday === null ? t('payday.mine.toast.cleared') : t('payday.mine.toast.set', { payday: paydayLabel(payday) }), {
        tone: payday === null ? undefined : 'success',
        action: { label: t('common.action.undo'), onAction: undo },
      })
    },
    [t, toast],
  )
}

/** Sets (or, with null, forgets) a friend's payday; `name` is how the toast names them. */
export function useSetFriendPayday(): (friendId: string, name: string, payday: Payday | null) => void {
  const t = useT()
  const toast = useToast()
  return useCallback(
    (friendId, name, payday) => {
      if (payday === friendPaydayOf(friendId)) return
      const undo = setFriendPayday(friendId, payday)
      toast(payday === null ? t('payday.friend.toast.cleared', { name }) : t('payday.friend.toast.set', { name, payday: paydayLabel(payday) }), {
        tone: payday === null ? undefined : 'success',
        action: { label: t('common.action.undo'), onAction: undo },
      })
    },
    [t, toast],
  )
}
