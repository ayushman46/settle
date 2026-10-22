#!/usr/bin/env node
/**
 * Micro-benchmarks of the data layer in Node (same V8 as the browser), on the heavy data set:
 * reading every collection from its stored JSON (parse + schema validation) and the first
 * derived summaries. Quick to iterate on; the browser harness (run.mjs) is the judge.
 *
 *   node bench/micro.mjs [--runs 30] [--cpu-prof]
 */
import { parseArgs } from 'node:util'
import { closeAppModules, loadAppModule } from './lib/appModules.mjs'
import { summarize } from './lib/stats.mjs'
import { heavyStorage } from './seed.mjs'

const { values: args } = parseArgs({ options: { runs: { type: 'string', default: '30' } } })
const runs = Number(args.runs)

const entries = await heavyStorage()
const z = await loadAppModule('zod/mini')
const schemas = await loadAppModule('/src/data/schemas.ts')
const { overallSummary } = await loadAppModule('/src/engine/balances.ts')
const { compareExpensesNewestFirst } = await loadAppModule('/src/data/hooks.ts')

const cases = {
  'parse expenses JSON': () => JSON.parse(entries['settle.v3.expenses']),
  'validate expenses': (() => {
    const data = JSON.parse(entries['settle.v3.expenses']).data
    return () => z.safeParse(schemas.expensesSchema, data)
  })(),
  'validate friends': (() => {
    const data = JSON.parse(entries['settle.v3.friends']).data
    return () => z.safeParse(schemas.friendsSchema, data)
  })(),
  'validate groups': (() => {
    const data = JSON.parse(entries['settle.v3.groups']).data
    return () => z.safeParse(schemas.groupsSchema, data)
  })(),
  'overall summary': (() => {
    const expenses = JSON.parse(entries['settle.v3.expenses']).data
    const groups = JSON.parse(entries['settle.v3.groups']).data
    return () => overallSummary(expenses, groups, 'me', 'INR')
  })(),
  'sort expenses': (() => {
    const expenses = JSON.parse(entries['settle.v3.expenses']).data
    return () => [...expenses].sort(compareExpensesNewestFirst)
  })(),
}

const check = z.safeParse(schemas.expensesSchema, JSON.parse(entries['settle.v3.expenses']).data)
if (!check.success || check.data.length !== 1500) throw new Error('validation changed the heavy data set')

for (const [name, fn] of Object.entries(cases)) {
  for (let i = 0; i < 3; i++) fn() // warm-up
  const times = []
  for (let i = 0; i < runs; i++) {
    const t = performance.now()
    fn()
    times.push(performance.now() - t)
  }
  const s = summarize(times)
  console.log(`${name.padEnd(24)} p50 ${s.p50.toFixed(2).padStart(8)} ms   min ${s.min.toFixed(2).padStart(8)}   max ${s.max.toFixed(2).padStart(8)}`)
}
// Cold (first-call) cost matters most at startup: measure a fresh process with --runs 1.
await closeAppModules()
