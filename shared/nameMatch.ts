/**
 * Matching a name as it was said (or typed) to the people someone already has. Used by the server
 * (a misheard name in "Just say it" maps to a saved friend) and by the phone (the "Who's that?"
 * picker under a voice split, and the live preview while speaking). Pure; no regex lookbehind
 * (this runs in older Safari too).
 */

/** Lower-case, accents and punctuation off, single spaces: "Zoë's  CAFÉ!" → "zoes cafe". */
export function fold(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/**
 * How a name sounds, roughly: its consonants, with Indian spellings and what speech recognition
 * writes folded together ("Nikhil", "Nickel" → "nkl"; "Ishaan", "Ishan" → "sn").
 */
export function nameSound(name: string): string {
  return fold(name)
    .replace(/\s+/g, '')
    .replace(/ph/g, 'f')
    .replace(/ck/g, 'k')
    .replace(/([bkgtdcjsp])h/g, '$1')
    .replace(/c(?=[eiy])/g, 's')
    .replace(/[cq]/g, 'k')
    .replace(/z/g, 'j')
    .replace(/w/g, 'v')
    .replace(/x/g, 'ks')
    .replace(/[aeiouyh]/g, '')
    .replace(/(.)\1+/g, '$1')
}

/** One spelling for the ways Indian names are written in English ("Pooja"/"Puja", "Ishaan"/"Ishan"). */
export function spelling(word: string): string {
  return word
    .replace(/oo/g, 'u')
    .replace(/ee/g, 'i')
    .replace(/ph/g, 'f')
    .replace(/ck/g, 'k')
    .replace(/w/g, 'v')
    .replace(/z/g, 'j')
    .replace(/(.)\1+/g, '$1')
}

/** Whether `a` becomes `b` with at most one letter added, removed or changed ("ria" ↔ "riya"). */
export function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else {
      i++
      j++
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

/** Letters to change, add or remove to turn `a` into `b` (stops counting past `cap`). */
export function editDistance(a: string, b: string, cap = 3): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1
  let prev = Array.from({ length: b.length + 1 }, (_, k) => k)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const value = Math.min((prev[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost)
      row.push(value)
      if (value < best) best = value
    }
    if (best > cap) return cap + 1
    prev = row
  }
  return prev[b.length] ?? cap + 1
}

/* ------------------------------------------------------------------ ranking people */

/** How sure a candidate is, best first. */
export type MatchKind = 'nickname' | 'exact' | 'first' | 'word' | 'short' | 'spelling' | 'sound' | 'close'

export const MATCH_SCORES: Readonly<Record<MatchKind, number>> = {
  nickname: 100,
  exact: 100,
  first: 90,
  word: 72,
  short: 66,
  spelling: 62,
  sound: 56,
  close: 40,
}

/** A score at or above this means "that's them" when nobody else comes close. */
export const SURE_SCORE = 90

export interface NamePerson {
  id: string
  name: string
}

export interface NameCandidate<P extends NamePerson = NamePerson> {
  person: P
  score: number
  kind: MatchKind
}

/** How well one word that was said matches one word of a saved name. */
function wordMatch(said: string, word: string): MatchKind | null {
  if (!said || !word) return null
  if (said === word) return 'exact'
  // "Adi" for "Aditya", "Sid" for "Siddharth": a short form at least three letters long.
  if (said.length >= 3 && word.length > said.length && word.startsWith(said)) return 'short'
  const a = spelling(said)
  const b = spelling(word)
  if (a === b) return 'spelling'
  if (a.length >= 4 && withinOneEdit(a, b)) return 'spelling'
  const sa = nameSound(said)
  const sb = nameSound(word)
  if (sa.length >= 3 && sa === sb) return 'sound'
  if (a.length >= 5 && editDistance(a, b, 2) <= 2) return 'close'
  if (sa.length >= 3 && sb.length >= 3 && withinOneEdit(sa, sb) && Math.abs(a.length - b.length) <= 2) return 'close'
  return null
}

/**
 * Everyone `said` could mean, best first: the nickname you taught Settle, the same name, the
 * first name, a surname, a short form ("Adi" → Aditya), the same name spelt another way
 * ("Puja" → Pooja), one that sounds the same ("Nickel" → Nikhil), or one close to it.
 * `nicknames` maps a folded spoken name to a person's id.
 */
export function rankNameCandidates<P extends NamePerson>(
  said: string,
  people: readonly P[],
  nicknames: Readonly<Record<string, string>> = {},
  limit = 8,
): NameCandidate<P>[] {
  const key = fold(said)
  if (!key) return []
  const saidWords = key.split(' ')
  const out: NameCandidate<P>[] = []
  for (const person of people) {
    const full = fold(person.name)
    if (!full) continue
    let kind: MatchKind | null = null
    if (nicknames[key] === person.id) kind = 'nickname'
    else if (full === key) kind = 'exact'
    else {
      const words = full.split(' ')
      if (saidWords.length === 1) {
        const first = wordMatch(key, words[0] ?? '')
        if (first === 'exact') kind = 'first'
        else {
          const kinds = [first, ...words.slice(1).map((w) => (w === key ? ('word' as const) : wordMatch(key, w)))]
          kind = best(kinds)
        }
      } else {
        // Two or more words said: every word has to match a word of the name, in order.
        const kinds = saidWords.map((w, i) => wordMatch(w, words[i] ?? ''))
        if (kinds.every((k) => k !== null)) kind = worst(kinds as MatchKind[])
        if (kind === 'exact') kind = 'first'
      }
    }
    if (kind) out.push({ person, kind, score: MATCH_SCORES[kind] })
  }
  out.sort((a, b) => b.score - a.score || a.person.name.localeCompare(b.person.name))
  return out.slice(0, limit)
}

function best(kinds: ReadonlyArray<MatchKind | null>): MatchKind | null {
  let top: MatchKind | null = null
  for (const k of kinds) if (k && (top === null || MATCH_SCORES[k] > MATCH_SCORES[top])) top = k
  return top
}

function worst(kinds: readonly MatchKind[]): MatchKind | null {
  let low: MatchKind | null = null
  for (const k of kinds) if (low === null || MATCH_SCORES[k] < MATCH_SCORES[low]) low = k
  return low
}

/**
 * The one person `said` surely means, or null: a top candidate at `SURE_SCORE` or above with no
 * other candidate as good.
 */
export function sureMatch<P extends NamePerson>(candidates: readonly NameCandidate<P>[]): P | null {
  const [first, second] = candidates
  if (!first || first.score < SURE_SCORE) return null
  if (second && second.score >= first.score) return null
  return first.person
}
