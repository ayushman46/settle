#!/usr/bin/env node
/**
 * What's in the DOM once a screen has painted: element and text-node counts, the biggest
 * subtrees and the longest texts — to find hidden or off-screen content that still costs style,
 * layout and text shaping on a budget phone.
 *
 *   node bench/dom.mjs [--dist dist] [--data heavy|empty] [--url /app] [--port 4130]
 */
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { evaluate, launchBrowser, newIsolatedPage } from './lib/cdp.mjs'
import { closeAppModules } from './lib/appModules.mjs'
import { emulate, installProbe, PROFILES, seedStorage, waitInteractive } from './lib/page.mjs'
import { DEFAULT_DIST } from './lib/paths.mjs'
import { READY } from './lib/screens.mjs'
import { startServer } from './lib/server.mjs'
import { heavyStorage, payLinkFragment } from './seed.mjs'

const { values: args } = parseArgs({
  options: {
    dist: { type: 'string', default: DEFAULT_DIST },
    data: { type: 'string', default: 'heavy' },
    url: { type: 'string', default: '/app' },
    port: { type: 'string', default: '4130' },
  },
})
const port = Number(args.port)
const server = await startServer({ dist: resolve(args.dist), port })
const { cdp, close } = await launchBrowser({ port: port + 1 })
try {
  const heavy = args.data === 'heavy' ? await heavyStorage() : null
  const payFragment = await payLinkFragment()
  await closeAppModules()
  const page = await newIsolatedPage(cdp)
  const s = page.session
  await emulate(s, PROFILES.mid)
  const watch = args.url.startsWith('/pay') ? 'pay' : heavy ? 'home' : 'welcome'
  await installProbe(s, { [watch]: READY[watch] })
  if (heavy) await seedStorage(s, server.origin, heavy)
  await s.send('Page.navigate', { url: `${server.origin}${args.url === '/pay' ? `/pay#${payFragment}` : args.url}` })
  await waitInteractive(s, watch)
  const report = await evaluate(
    s,
    `(() => {
      const all = document.getElementsByTagName('*')
      let texts = 0, chars = 0
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      while (walker.nextNode()) { texts++; chars += walker.currentNode.nodeValue.length }
      const name = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '') + (el.getAttribute('aria-label') ? '[' + el.getAttribute('aria-label').slice(0, 40) + ']' : '')
      const big = [...all].map((el) => ({ el, n: el.getElementsByTagName('*').length })).filter((x) => x.n > 40 && x.n < all.length * 0.9).sort((a, b) => b.n - a.n).slice(0, 25)
      const hidden = [...all].filter((el) => { const r = el.getBoundingClientRect(); return el.getElementsByTagName('*').length > 30 && (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') }).slice(0, 10)
      return {
        elements: all.length, texts, chars,
        biggest: big.map((x) => x.n + '  ' + name(x.el)),
        hidden: hidden.map((el) => el.getElementsByTagName('*').length + '  ' + name(el)),
        fonts: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family + ' ' + f.weight + ' ' + f.unicodeRange.slice(0, 20)),
      }
    })()`,
  )
  console.log(JSON.stringify(report, null, 1))
  await page.dispose()
} finally {
  await close()
  await server.stop()
}
