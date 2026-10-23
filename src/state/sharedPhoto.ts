/**
 * A photo handed to the bill flow from outside it — a bill photo or screenshot shared into Settle
 * from another app (Android share sheet) — waiting for the scan step to pick it up. One-shot and
 * in memory only (a photo is large; a reload just means sharing it again).
 */

let pending: File | null = null

/** Leaves `file` for the scan step (replacing any photo still waiting); null clears it. */
export function setSharedPhoto(file: File | null): void {
  pending = file
}

/** Takes the waiting photo (once) — null when there's none. */
export function takeSharedPhoto(): File | null {
  const file = pending
  pending = null
  return file
}

/** True while a photo is waiting (without taking it). */
export function hasSharedPhoto(): boolean {
  return pending !== null
}
