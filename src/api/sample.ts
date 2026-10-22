import type { ScanResponse } from '../../shared/api'

/**
 * A realistic (fictional) restaurant bill for "Try a sample". Works offline.
 * Items add up to the subtotal; service + tax − discount, rounded off, gives the total.
 */
export const SAMPLE_SCAN: ScanResponse = {
  merchant: 'Saffron Table',
  date: '2026-10-18',
  currency: 'INR',
  category: 'food',
  items: [
    { name: 'Paneer Tikka', quantity: 1, amount: 345 },
    { name: 'Butter Chicken', quantity: 1, amount: 495 },
    { name: 'Dal Makhani', quantity: 1, amount: 325 },
    { name: 'Garlic Naan', quantity: 4, amount: 300 },
    { name: 'Jeera Rice', quantity: 1, amount: 245 },
    { name: 'Fresh Lime Soda', quantity: 2, amount: 240 },
    { name: 'Mango Lassi', quantity: 1, amount: 165 },
    { name: 'Gulab Jamun', quantity: 2, amount: 190 },
  ],
  subtotal: 2305,
  tax: 109.49,
  fees: [],
  serviceCharge: 115.25,
  discount: 230.5,
  tip: null,
  total: 2299,
  warnings: [],
  model: 'sample',
}
