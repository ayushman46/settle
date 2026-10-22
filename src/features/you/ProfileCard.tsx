import { useState } from 'react'
import { AtSign, Copy, Pencil } from 'lucide-react'
import { Button, IconButton, useToast } from '../../components'
import { useProfile } from '../../data'
import { ME_ID } from '../../domain/types'
import { FriendAvatar, ME_LABEL } from '../../kit/index-a'
import { copyText } from '../../lib/share'
import { EditProfileSheet, type ProfileField } from './EditProfileSheet'
import styles from './ProfileCard.module.css'

/**
 * The top of the You tab: your avatar, your name (the page's heading) and your UPI ID — what
 * friends pay into — with copy and edit close at hand. Without a UPI ID it asks for one, since
 * pay links and QR codes need it.
 */
export function ProfileCard() {
  const profile = useProfile()
  const toast = useToast()
  const [sheet, setSheet] = useState<{ open: boolean; focus: ProfileField }>({ open: false, focus: 'name' })
  const edit = (focus: ProfileField): void => setSheet({ open: true, focus })
  const name = profile.name.trim() || ME_LABEL

  const copy = async (upiId: string): Promise<void> => {
    const ok = await copyText(upiId)
    toast(ok ? 'UPI ID copied' : "Couldn't copy. Long-press your UPI ID to copy it instead.", { tone: ok ? 'success' : 'warning' })
  }

  return (
    <section className={styles.card} aria-labelledby="you-name">
      <div className={styles.top}>
        <FriendAvatar friendId={ME_ID} size="lg" className={styles.avatar} />
        <div className={styles.who}>
          <h1 id="you-name" className={styles.name} tabIndex={-1}>
            {name}
          </h1>
          <p className={styles.caption}>Your profile stays on this phone</p>
        </div>
        <IconButton label="Edit profile" variant="secondary" onClick={() => edit('name')}>
          <Pencil />
        </IconButton>
      </div>

      {profile.upiId ? (
        <div className={styles.upiRow}>
          <button type="button" className={styles.upiButton} onClick={() => edit('upi')} aria-label={`UPI ID ${profile.upiId}. Edit`}>
            <AtSign aria-hidden="true" className={styles.upiIcon} />
            <span className={styles.upiText}>
              <span className={styles.upiLabel}>UPI ID</span>{' '}
              <span className={styles.upiId}>{profile.upiId}</span>
            </span>
          </button>
          <IconButton label="Copy UPI ID" size="sm" onClick={() => void copy(profile.upiId ?? '')}>
            <Copy />
          </IconButton>
        </div>
      ) : (
        <div className={styles.addUpi}>
          <p className={styles.addText}>Add your UPI ID so friends can pay you back in one tap.</p>
          <Button variant="accent" size="md" iconStart={<AtSign />} onClick={() => edit('upi')}>
            Add UPI ID
          </Button>
        </div>
      )}

      <EditProfileSheet open={sheet.open} focus={sheet.focus} onClose={() => setSheet((s) => ({ ...s, open: false }))} />
    </section>
  )
}
