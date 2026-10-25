/** Rent & HRA receipts: split the flat's rent, pay the landlord directly, receipts for each share. */
export const RENT_ENABLED = true

export const RENT_PATH = '/app/rent'
export const RENT_NEW_PATH = '/app/rent/new'
export const rentPath = (id: string): string => `/app/rent/${encodeURIComponent(id)}`
export const rentEditPath = (id: string): string => `/app/rent/${encodeURIComponent(id)}/edit`
export const rentReceiptsPath = (id: string): string => `/app/rent/${encodeURIComponent(id)}/receipts`
