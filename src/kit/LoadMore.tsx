import { useEffect, useRef } from 'react'
import { Button } from '../components'
import { useT } from '../i18n'
import styles from './LoadMore.module.css'

export interface LoadMoreProps {
  /** Rows not shown yet. */
  remaining: number
  /** Rows one more page adds ("Show 40 more"; fewer when fewer are left). */
  page: number
  /** Shows the next page. */
  onMore: () => void
}

/**
 * The rest of a long list, a page at a time: loads by itself as you near the end (where the
 * browser can tell), with a button for everyone else. Render it under the list only while
 * `remaining > 0`.
 */
export function LoadMore({ remaining, page, onMore }: LoadMoreProps) {
  const t = useT()
  const sentinel = useRef<HTMLDivElement>(null)
  const more = useRef(onMore)
  useEffect(() => {
    more.current = onMore
  })

  useEffect(() => {
    const node = sentinel.current
    if (!node || typeof IntersectionObserver !== 'function') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) more.current()
      },
      { rootMargin: '0px 0px 600px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [remaining])

  return (
    <div ref={sentinel} className={styles.more}>
      <Button variant="tonal" size="md" onClick={onMore}>
        {t('kit.loadMore.cta', { count: Math.min(remaining, page) })}
      </Button>
    </div>
  )
}
