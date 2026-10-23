/**
 * The English the runtime starts with. Without the settle-i18n build plugin (`../vite-plugin.ts`)
 * that is every namespace at once. With it, the plugin swaps this module for an empty one and
 * bundles each namespace with the code that uses its keys, so a screen's English loads with the
 * screen and the first paint carries only what it shows.
 */
export { EN as EAGER } from './index'
