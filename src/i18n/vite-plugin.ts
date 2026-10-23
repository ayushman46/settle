/**
 * settle-i18n (build plugin): English loads with the screens that show it.
 *
 * `MessageKey` stays one compile-time union of every key (`en/index.ts`), but at runtime each
 * English namespace is bundled with the code that uses its keys: any module under `src/` that
 * mentions a key literal `'<ns>.…'` gets `import 'virtual:settle-en/<ns>'` prepended, a tiny
 * module that registers `src/i18n/en/<ns>.ts` with the runtime. So Home's strings ride in the
 * main chunk, the bill flow's in the bill chunk, and thousands of strings tonight add nothing
 * to a first paint that doesn't show them. `en/eager.ts` (which would bundle everything) becomes
 * empty. Without this plugin everything still works — English is simply all bundled up front.
 *
 * Contributors change nothing: fill `en/<ns>.ts`, call `t('<ns>.…')`.
 */
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

const VIRTUAL = 'virtual:settle-en/'
const RESOLVED = `\0${VIRTUAL}`
const CATALOG_DIR = /\/src\/i18n\/(?:en|hi|bn|mr|ta|te|kn|gu)\//
const SOURCE = /\.(?:ts|tsx)$/

const posix = (path: string): string => path.replace(/\\/g, '/')

/** The English namespaces: one file each in `src/i18n/en/` (not the index or the eager list). */
export function englishNamespaces(enDir: string): string[] {
  return readdirSync(enDir)
    .filter((f) => /^[a-z][a-zA-Z0-9]*\.ts$/.test(f) && f !== 'index.ts' && f !== 'eager.ts')
    .map((f) => f.slice(0, -3))
    .sort()
}

/** The namespaces whose keys `code` mentions as string literals (`'bill.…'`, `"bill.…"`, `` `bill.… ``). */
export function namespacesIn(code: string, namespaces: readonly string[]): string[] {
  if (namespaces.length === 0) return []
  const pattern = new RegExp(`['"\`](${namespaces.join('|')})\\.[A-Za-z0-9]`, 'g')
  const found = new Set<string>()
  for (const match of code.matchAll(pattern)) found.add(match[1] as string)
  return [...found].sort()
}

/** True for app source the plugin should look at: `src/**.ts(x)`, not the catalogs themselves. */
export function wantsEnglish(id: string, root: string): boolean {
  const path = posix(id).split('?')[0] as string
  const src = `${posix(root).replace(/\/$/, '')}/src/`
  return path.startsWith(src) && SOURCE.test(path) && !CATALOG_DIR.test(path) && !path.endsWith('/src/i18n/runtime.ts')
}

export function settleI18n(): Plugin {
  let root = ''
  let enDir = ''
  let namespaces: string[] = []
  return {
    name: 'settle-i18n',
    enforce: 'pre',
    configResolved(config) {
      root = config.root
      enDir = posix(resolve(root, 'src/i18n/en'))
      namespaces = englishNamespaces(enDir)
    },
    resolveId(id) {
      return id.startsWith(VIRTUAL) ? `\0${id}` : null
    },
    load(id) {
      if (id.startsWith(RESOLVED)) {
        const ns = id.slice(RESOLVED.length)
        return [
          `import * as messages from ${JSON.stringify(`${enDir}/${ns}.ts`)}`,
          `import { registerEnglish } from ${JSON.stringify(`${posix(resolve(root, 'src/i18n/runtime.ts'))}`)}`,
          'for (const m of Object.values(messages)) registerEnglish(m)',
          '',
        ].join('\n')
      }
      if (posix(id).split('?')[0] === `${enDir}/eager.ts`) return 'export const EAGER = {}\n'
      return null
    },
    transform(code, id) {
      if (!wantsEnglish(id, root)) return null
      const used = namespacesIn(code, namespaces)
      if (used.length === 0) return null
      // Prepended on the first line, so line numbers (and source maps) stay as they were.
      return { code: used.map((ns) => `import ${JSON.stringify(VIRTUAL + ns)};`).join('') + code, map: null }
    },
  }
}
