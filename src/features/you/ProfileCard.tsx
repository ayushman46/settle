import { useState } from 'react'
import { AtSign, Copy, Pencil } from 'lucide-react'
import { useT } from '../../i18n'
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
  const t = useT()
  const profile = useProfile()
  const toast = useToast()
  const [sheet, setSheet] = useState<{ open: boolean; focus: ProfileField }>({ open: false, focus: 'name' })
  const edit = (focus: ProfileField): void => setSheet({ open: true, focus })
  const name = profile.name.trim() || ME_LABEL

  const copy = async (upiId: string): Promise<void> => {
    const ok = await copyText(upiId)
    toast(ok ? t('you.profile.copied') : t('you.profile.copyFailed'), { tone: ok ? 'success' : 'warning' })
  }

  return (
    <section className={styles.card} aria-labelledby="you-name">
      <div className={styles.top}>
        <FriendAvatar friendId={ME_ID} size="lg" className={styles.avatar} />
        <div className={styles.who}>
          <h1 id="you-name" className={styles.name} tabIndex={-1}>
            {name}
          </h1>
          <p className={styles.caption}>{t('you.profile.caption')}</p>
        </div>
        <IconButton label={t('you.profile.edit')} variant="secondary" onClick={() => edit('name')}>
          <Pencil />
        </IconButton>
      </div>

      {profile.upiId ? (
        <div className={styles.upiRow}>
          <button type="button" className={styles.upiButton} onClick={() => edit('upi')} aria-label={t('you.profile.upi.edit', { id: profile.upiId ?? '' })}>
            <AtSign aria-hidden="true" className={styles.upiIcon} />
            <span className={styles.upiText}>
              <span className={styles.upiLabel}>{t('you.profile.upi')}</span>{' '}
              <span className={styles.upiId}>{profile.upiId}</span>
            </span>
          </button>
          <IconButton label={t('you.profile.copy')} size="sm" onClick={() => void copy(profile.upiId ?? '')}>
            <Copy />
          </IconButton>
        </div>
      ) : (
        <div className={styles.addUpi}>
          <p className={styles.addText}>{t('you.profile.add.body')}</p>
          <Button variant="accent" size="md" iconStart={<AtSign />} onClick={() => edit('upi')}>
            {t('you.profile.add')}
          </Button>
        </div>
      )}

      <EditProfileSheet open={sheet.open} focus={sheet.focus} onClose={() => setSheet((s) => ({ ...s, open: false }))} />
    </section>
  )
}
