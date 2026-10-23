#!/usr/bin/env node
/**
 * Before/after summary of two full runs of bench/run.mjs (bench/results/<label>.json): the
 * headline numbers per profile as a Markdown table, medians with the change. Used for the
 * summary at the top of bench/RESULTS.md.
 *
 *   node bench/compare.mjs bench/results/baseline-298bdd2.json bench/results/final.json
 */
import { readFileSync } from 'node:fs'
import { fmtKb, fmtMs } from './lib/stats.mjs'

const [beforeFile, afterFile] = process.argv.slice(2)
if (!beforeFile || !afterFile) {
  console.error('usage: node bench/compare.mjs <before.json> <after.json>')
  process.exit(2)
}
const before = JSON.parse(readFileSync(beforeFile, 'utf8'))
const after = JSON.parse(readFileSync(afterFile, 'utf8'))

/** [section, label, path into a profile's results, unit] */
const ROWS = [
  ['Cold first visit', '/app (first visit): first paint', ['cold', 'app (empty)', 'summary', 'fcp'], 'ms'],
  ['Cold first visit', '/app (first visit): interactive', ['cold', 'app (empty)', 'summary', 'interactive'], 'ms'],
  ['Cold first visit', '/app (first visit): JS transferred', ['cold', 'app (empty)', 'summary', 'jsKb'], 'kb'],
  ['Cold first visit', '/pay link: first paint', ['cold', 'pay link', 'summary', 'fcp'], 'ms'],
  ['Cold first visit', '/pay link: content (who\'s asking + names)', ['cold', 'pay link', 'summary', 'content'], 'ms'],
  ['Cold first visit', '/pay link: interactive', ['cold', 'pay link', 'summary', 'interactive'], 'ms'],
  ['Cold first visit', '/app with 2 years of data: Home interactive', ['cold', 'app (heavy)', 'summary', 'interactive'], 'ms'],
  ['Warm repeat visit (heavy)', 'Home content painted', ['warm', 'summary', 'content'], 'ms'],
  ['Warm repeat visit (heavy)', 'Home interactive', ['warm', 'summary', 'interactive'], 'ms'],
  ['Warm repeat visit (heavy)', 'Balance finished counting', ['warm', 'summary', 'balanceFinal'], 'ms'],
  ['Warm repeat visit (heavy)', 'Data layer load (parse + validate)', ['warm', 'summary', 'data:load:total'], 'ms'],
  ['Screen opens (heavy)', 'Home → Activity', ['nav', 'summary', 'Home → Activity (tab)'], 'ms'],
  ['Screen opens (heavy)', 'Activity → Expense (bill)', ['nav', 'summary', 'Activity → Expense (bill)'], 'ms'],
  ['Screen opens (heavy)', 'Activity → Groups', ['nav', 'summary', 'Activity → Groups (tab)'], 'ms'],
  ['Screen opens (heavy)', 'Groups → Group detail (300 expenses)', ['nav', 'summary', 'Groups → Group detail (300)'], 'ms'],
  ['Screen opens (heavy)', 'Groups → Home', ['nav', 'summary', 'Groups → Home (tab)'], 'ms'],
  ['Screen opens (heavy)', 'Home → New split', ['nav', 'summary', 'Home → New split'], 'ms'],
  ['Screen opens (heavy)', 'Home → Bill flow', ['nav', 'summary', 'Home → Bill flow'], 'ms'],
  ['Screen opens (heavy)', 'Home → You', ['nav', 'summary', 'Home → You (tab)'], 'ms'],
  ['Screen opens (heavy)', 'You → Home', ['nav', 'summary', 'You → Home (tab)'], 'ms'],
  ['Scrolling to the oldest row', 'Activity (1,500), fling: time to oldest', ['scroll', 'activity:fling', 'summary', 'timeToOldest'], 'ms'],
  ['Scrolling to the oldest row', 'Activity (1,500), fling: long-task time', ['scroll', 'activity:fling', 'summary', 'longTaskMs'], 'ms'],
  ['Scrolling to the oldest row', 'Activity (1,500), fling: p95 frame', ['scroll', 'activity:fling', 'summary', 'p95Frame'], 'ms'],
  ['Scrolling to the oldest row', 'Activity (1,500), jump: time to oldest', ['scroll', 'activity:jump', 'summary', 'timeToOldest'], 'ms'],
  ['Scrolling to the oldest row', 'Group (300), fling: time to oldest', ['scroll', 'group:fling', 'summary', 'timeToOldest'], 'ms'],
  ['Scrolling to the oldest row', 'Group (300), fling: long-task time', ['scroll', 'group:fling', 'summary', 'longTaskMs'], 'ms'],
  ['Scrolling to the oldest row', 'Group (300), fling: p95 frame', ['scroll', 'group:fling', 'summary', 'p95Frame'], 'ms'],
]

function at(obj, path) {
  let v = obj
  for (const k of path) v = v?.[k]
  return typeof v?.p50 === 'number' ? v.p50 : null
}

const fmt = (v, unit) => (v === null ? '—' : unit === 'kb' ? fmtKb(v * 1024) : fmtMs(v))

for (const profile of Object.keys(after.profiles)) {
  if (!before.profiles[profile]) continue
  console.log(`\n#### ${profile === 'low' ? 'Budget Android (low: CPU 4×, 1.6 Mbps, 150 ms RTT)' : 'Mid phone (no throttling)'}\n`)
  console.log('| | metric | before | after | change |')
  console.log('| --- | --- | --- | --- | --- |')
  let section = ''
  for (const [sec, label, path, unit] of ROWS) {
    const a = at(before.profiles[profile], path)
    const b = at(after.profiles[profile], path)
    if (a === null && b === null) continue
    const change = a !== null && b !== null && a !== 0 ? `${b - a > 0 ? '+' : ''}${(((b - a) / a) * 100).toFixed(0)}%` : '—'
    console.log(`| ${sec === section ? '' : sec} | ${label} | ${fmt(a, unit)} | ${fmt(b, unit)} | ${change} |`)
    section = sec
  }
}
