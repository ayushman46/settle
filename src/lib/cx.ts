/** Joins truthy class names: `cx('a', on && 'b', null)` → `'a b'`. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  let out = ''
  for (const part of parts) {
    if (!part) continue
    out = out ? `${out} ${part}` : part
  }
  return out
}
