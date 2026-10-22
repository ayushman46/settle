/**
 * Title and search-engine tags for the public pages (landing, pay link, legal). They live outside
 * the app shell, so each page sets its own and puts back what was there when it goes — before
 * the next page sets its own (a layout effect, so it never undoes the next page's title).
 */
import { useLayoutEffect } from 'react'

export interface PageMeta {
  /** The tab title. */
  title: string
  /** `<meta name="description">` — the snippet under the link in search results. */
  description?: string
  /** `<meta name="robots">`, e.g. `noindex` for pages that only make sense from a link. */
  robots?: string
  /** `<link rel="canonical">` — the one address search engines should list. */
  canonical?: string
}

/** Sets `<meta name>` content (creating the tag if needed); returns what puts it back. */
function setMeta(name: string, content: string): () => void {
  const existing = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (existing) {
    const previous = existing.getAttribute('content')
    existing.setAttribute('content', content)
    return () => {
      if (previous === null) existing.removeAttribute('content')
      else existing.setAttribute('content', previous)
    }
  }
  const meta = document.createElement('meta')
  meta.setAttribute('name', name)
  meta.setAttribute('content', content)
  document.head.appendChild(meta)
  return () => meta.remove()
}

function setCanonical(href: string): () => void {
  const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (existing) {
    const previous = existing.getAttribute('href')
    existing.setAttribute('href', href)
    return () => {
      if (previous === null) existing.removeAttribute('href')
      else existing.setAttribute('href', previous)
    }
  }
  const link = document.createElement('link')
  link.setAttribute('rel', 'canonical')
  link.setAttribute('href', href)
  document.head.appendChild(link)
  return () => link.remove()
}

/** Applies `meta` while the page is mounted. */
export function usePageMeta({ title, description, robots, canonical }: PageMeta): void {
  useLayoutEffect(() => {
    const previousTitle = document.title
    document.title = title
    const restore: Array<() => void> = []
    if (description !== undefined) restore.push(setMeta('description', description))
    if (robots !== undefined) restore.push(setMeta('robots', robots))
    if (canonical !== undefined) restore.push(setCanonical(canonical))
    return () => {
      for (const undo of restore.reverse()) undo()
      document.title = previousTitle
    }
  }, [title, description, robots, canonical])
}

/** This site's address (`https://settle.example`), or '' when it can't be read. */
export function siteOrigin(): string {
  try {
    const origin = window.location.origin
    return origin && origin !== 'null' ? origin : ''
  } catch {
    return ''
  }
}
