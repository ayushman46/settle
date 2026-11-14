import { ChevronRight, MessagesSquare } from 'lucide-react'
import { navigate } from '../../app/router'
import { useT } from '../../i18n'
import { CHAT_PATH } from './files'
import styles from './Chat.module.css'

/** "Start from a WhatsApp chat": the way into Chat to split from the Groups screen. */
export function ChatStart() {
  const t = useT()
  return (
    <button type="button" className={styles.start} onClick={() => navigate(CHAT_PATH)}>
      <span className={styles.startIcon} aria-hidden="true">
        <MessagesSquare />
      </span>
      <span className={styles.startText}>
        <span className={styles.startTitle}>{t('chat.groups.cta')}</span>
        <span className={styles.fine}>{t('chat.groups.body')}</span>
      </span>
      <ChevronRight className={styles.startChevron} aria-hidden="true" />
    </button>
  )
}
