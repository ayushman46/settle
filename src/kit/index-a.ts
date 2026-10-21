/**
 * Settle kit (part A): the people, category, amount, date and split building blocks every
 * screen composes. Data-aware where it helps (people come from `src/data`), pure UI otherwise.
 */
export { AmountHero, type AmountHeroProps } from './AmountHero'
export { amountInWords, indianNumberWords } from './amountWords'
export { CategoryPicker, type CategoryPickerProps } from './CategoryPicker'
export { DateField, type DateFieldProps } from './DateField'
export { fullDateLabel, relativeDateLabel } from './dateLabel'
export { FriendAvatar, type FriendAvatarProps } from './FriendAvatar'
export { FriendChip, type FriendChipProps } from './FriendChip'
export { friendLabel, friendObjectLabel, ME_LABEL, UNKNOWN_FRIEND_LABEL } from './friendName'
export { PayerPicker, type PayerPickerProps } from './PayerPicker'
