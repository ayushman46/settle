/** The build plugin that bundles each English namespace with the code that uses it. */
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { englishNamespaces, namespacesIn, settleI18n, wantsEnglish } from './vite-plugin'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..', '..')

describe('englishNamespaces', () => {
  it('lists one namespace per catalog file, not the index or the eager list', () => {
    const list = englishNamespaces(resolve(here, 'en'))
    expect(list).toContain('common')
    expect(list).toContain('home')
    expect(list).toContain('onboarding')
    expect(list).not.toContain('index')
    expect(list).not.toContain('eager')
  })
})

describe('namespacesIn', () => {
  const ns = ['bill', 'common', 'home', 'ui']
  it('finds key literals in any quote style, once each, sorted', () => {
    const code = `t('home.quick.scan'); t("common.action.save"); const k = \`bill.review.\${x}\`; t('home.more.title')`
    expect(namespacesIn(code, ns)).toEqual(['bill', 'common', 'home'])
  })

  it('ignores words that only look alike', () => {
    expect(namespacesIn(`import './ui.css'; const homepage = 'homepage.x'; obj.home.x; 'billing.total'`, ns)).toEqual([])
  })

  it('finds nothing without namespaces', () => {
    expect(namespacesIn(`t('home.x')`, [])).toEqual([])
  })
})

describe('wantsEnglish', () => {
  it('looks at app source only — not catalogs, not the runtime, not other folders', () => {
    expect(wantsEnglish(`${root}/src/features/home/HomeScreen.tsx`, root)).toBe(true)
    expect(wantsEnglish(`${root}\\src\\features\\bill\\feeView.ts?v=1`, root)).toBe(true)
    expect(wantsEnglish(`${root}/src/i18n/en/home.ts`, root)).toBe(false)
    expect(wantsEnglish(`${root}/src/i18n/hi/home.ts`, root)).toBe(false)
    expect(wantsEnglish(`${root}/src/i18n/runtime.ts`, root)).toBe(false)
    expect(wantsEnglish(`${root}/server/app.ts`, root)).toBe(false)
    expect(wantsEnglish(`${root}/src/styles/global.css`, root)).toBe(false)
  })
})

describe('settleI18n', () => {
  type Hook = (this: unknown, ...args: unknown[]) => unknown
  const call = (hook: unknown, ...args: unknown[]): unknown => {
    const fn = (typeof hook === 'function' ? hook : (hook as { handler: Hook }).handler) as Hook
    return fn.call({}, ...args)
  }
  const plugin = settleI18n()
  call(plugin.configResolved, { root })

  it('prepends one import per namespace a module uses, on its first line', () => {
    const out = call(plugin.transform, `import { t } from '../../i18n'\nt('home.quick.scan')\n`, `${root}/src/features/home/X.tsx`) as { code: string }
    expect(out.code).toBe(`import "virtual:settle-en/home";import { t } from '../../i18n'\nt('home.quick.scan')\n`)
    expect(call(plugin.transform, `const a = 1`, `${root}/src/features/home/Y.ts`)).toBeNull()
  })

  it('serves a registering module per namespace, and empties the eager list', () => {
    expect(call(plugin.resolveId, 'virtual:settle-en/home')).toBe('\0virtual:settle-en/home')
    const mod = call(plugin.load, '\0virtual:settle-en/home') as string
    expect(mod).toContain('/src/i18n/en/home.ts')
    expect(mod).toContain('registerEnglish')
    expect(call(plugin.load, `${root}/src/i18n/en/eager.ts`)).toBe('export const EAGER = {}\n')
    expect(call(plugin.load, `${root}/src/i18n/en/home.ts`)).toBeNull()
  })
})
