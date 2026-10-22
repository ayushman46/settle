import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const BENCH_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const ROOT = resolve(BENCH_DIR, '..')
export const DEFAULT_DIST = resolve(ROOT, 'dist')
/** Seed data, saved builds, profiles and the server's working directory (never committed or linted). */
export const CACHE_DIR = resolve(ROOT, 'node_modules', '.cache', 'settle-bench')
