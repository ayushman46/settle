/** The dice for draws and shuffles: a random 32-bit number from the phone's own secure source. */
export function next32(): number {
  try {
    const box = new Uint32Array(1)
    globalThis.crypto.getRandomValues(box)
    return box[0] ?? 0
  } catch {
    return Math.floor(Math.random() * 2 ** 32)
  }
}
