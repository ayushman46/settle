/** Split anything: the new-split / edit-split screen and the pure form model behind it. Lazy-load the screen from its own module. */
export { NewSplitScreen } from './NewSplitScreen'
export { NoteField, type NoteFieldProps } from './NoteField'
export {
  blankForm,
  changeCurrency,
  changesSavedMessage,
  formFromExpense,
  formShares,
  formToDraft,
  outcomeLine,
  payerCandidates,
  withFriend,
  withGroup,
  withPeople,
  withPrefill,
  withTemplate,
  type OutcomeInput,
  type PrefillContext,
  type SplitForm,
} from './splitForm'
export { clearSplitDraft, loadSplitDraft, saveSplitDraft, SPLIT_DRAFT_KEY, type SplitDraft, type SplitOrigin, type StoredForm } from './splitDraft'
export { DEFAULT_PLACEHOLDER, splitTemplate, titlePlaceholder, type SplitTemplate, type SplitTip } from './splitTemplates'
