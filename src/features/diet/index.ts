/** Veg and no-drinks memory: who doesn't drink and who is vegetarian, taken off those items on a bill by themselves. */
export { classifyItem, type DietKind } from './classify'
export { DietStrip, type DietStripProps } from './DietStrip'
export { DietToggles, type DietTogglesProps } from './DietToggles'
export { dietStore, setDiet, useDietPrefs, useFriendDiet } from './store'
