/**
 * The bill photo currently on screen. In memory only (never persisted): it's large, and a
 * reload simply means the review screen shows no "View photo" chip.
 */
import { useSyncExternalStore } from 'react'

export interface Photo {
  /** An object URL (`blob:`) or any displayable URL. */
  previewUrl: string
}

let current: Photo | null = null
const listeners = new Set<() => void>()

function revoke(url: string): void {
  if (!url.startsWith('blob:')) return
  try {
    URL.revokeObjectURL(url)
  } catch {
    // Already revoked or unsupported.
  }
}

/** Replaces the photo, revoking the previous object URL so its memory is freed. */
export function setPhoto(photo: Photo | null): void {
  const previous = current
  if (previous?.previewUrl === photo?.previewUrl) return
  current = photo ? { previewUrl: photo.previewUrl } : null
  if (previous) revoke(previous.previewUrl)
  for (const listener of listeners) listener()
}

export function getPhoto(): Photo | null {
  return current
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The current photo; re-renders when it changes. */
export function usePhoto(): Photo | null {
  return useSyncExternalStore(subscribe, getPhoto, () => null)
}
