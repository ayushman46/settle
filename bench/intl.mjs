#!/usr/bin/env node
/**
 * First-use cost of the Intl objects the app builds, in a fresh browser (each sample launches
 * its own headless Edge, so ICU data is loaded cold, as on a phone's app start) under a profile's
 * CPU throttling. Shows what building one at import time costs every start.
 *
 *   node bench/intl.mjs [--profile low] [--runs 7] [--port 4115]
 */
import { parseArgs } from 'node:util'
import { evaluate, launchBrowser, newIsolatedPage } from './lib/cdp.mjs'
import { emulate, PROFILES } from './lib/page.mjs'
import { fmtMs, summarize } from './lib/stats.mjs'

const { values: args } = parseArgs({
  options: {
    profile: { type: 'string', default: 'low' },
    runs: { type: 'string', default: '7' },
    port: { type: 'string', default: '4115' },
  },
})

/** What the app builds at every start anyway (money and dates, grapheme segmenting). */
const APP_ANYWAY = `new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(1); new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date()); [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment('ab')]`

/** name → an expression that builds and first uses the object (`[setup, expression]`: timed after setup). */
const CASES = {
  'Intl.DisplayNames, after what the app builds anyway': [APP_ANYWAY, `new Intl.DisplayNames(undefined, { type: 'currency' }).of('INR')`],
  'Intl.DisplayNames (currency) + of()': `new Intl.DisplayNames(undefined, { type: 'currency' }).of('INR')`,
  'Intl.supportedValuesOf("currency")': `Intl.supportedValuesOf('currency').length`,
  'Intl.Segmenter (grapheme) + segment()': `[...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment('Riya 👩‍💻')].length`,
  'Intl.Locale("en-IN").maximize()': `new Intl.Locale('en-IN').maximize().region`,
  'Intl.NumberFormat (en-IN, INR) + format()': `new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(123456.78)`,
}

const profile = PROFILES[args.profile]
const runs = Math.max(1, Number(args.runs))
const results = {}
for (const [name, expression] of Object.entries(CASES)) {
  results[name] = []
  for (let i = 0; i < runs; i++) {
    const { cdp, close } = await launchBrowser({ port: Number(args.port) })
    try {
      const page = await newIsolatedPage(cdp)
      await emulate(page.session, profile)
      const [setup, timed] = Array.isArray(expression) ? expression : ['', expression]
      const ms = await evaluate(page.session, `(() => { ${setup}; const t = performance.now(); ${timed}; return performance.now() - t })()`)
      results[name].push(ms)
      await page.dispose()
    } finally {
      await close()
    }
  }
  const s = summarize(results[name])
  console.log(`${name.padEnd(44)} ${fmtMs(s.p50).padStart(8)} (${fmtMs(s.min)}–${fmtMs(s.max)})`)
}
