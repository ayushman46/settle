/** English copy for S3 · food-delivery splits. Keys: `delivery.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const delivery = {
  // The scan step opened from Home's "Food order" tile.
  'delivery.scan.title': 'Split a food order',
  'delivery.scan.subtitle':
    "Upload the order screenshot from Swiggy, Zomato, Blinkit, Zepto or Instamart — we'll pick out the items, fees and coupon.",
  'delivery.scan.choose.cta': 'Choose screenshot',
  'delivery.scan.camera.cta': 'Take a photo',
  // Extra lines in the rotating "reading" status while a delivery order is read.
  'delivery.scan.status.fees': 'Finding the fees…',
  'delivery.scan.status.coupon': 'Checking the coupon…',

  // The fees section on the bill review step.
  'delivery.review.fees.title': 'Fees & charges',
  'delivery.review.fees.add.cta': 'Add fee',
  'delivery.review.fees.hint': "You'll choose how to share fees on the next step.",
  // A fee row's accessible name: "Delivery fee, ₹35, edit".
  'delivery.review.fees.row.aria': '{label}, {amount}, edit',
  'delivery.review.fees.removed.toast': 'Removed {label}',
  'delivery.review.fees.full.toast': 'A bill can hold up to {max} fees.',
  'delivery.review.fees.converted.toast': '{label} is now an item — say who had it on the next steps',
  'delivery.review.fees.undoFailed.toast': "Couldn't undo — the bill changed",
  // The sheet for one fee.
  'delivery.fee.title': 'Fee',
  'delivery.fee.name.label': 'Name',
  'delivery.fee.amount.label': 'Amount',
  'delivery.fee.amount.error': 'Enter the fee (more than 0)',
  'delivery.fee.kind.label': 'Kind',
  'delivery.fee.kind.delivery': 'Delivery',
  'delivery.fee.kind.platform': 'Platform',
  'delivery.fee.kind.packaging': 'Packaging',
  'delivery.fee.kind.surge': 'Surge/rain',
  'delivery.fee.kind.smallOrder': 'Small order',
  'delivery.fee.kind.tip': 'Tip',
  'delivery.fee.kind.donation': 'Donation',
  'delivery.fee.kind.feeTax': 'GST on fees',
  'delivery.fee.kind.other': 'Other',
  // The name a fee gets when none is typed (also the field's placeholder).
  'delivery.fee.default.delivery': 'Delivery fee',
  'delivery.fee.default.platform': 'Platform fee',
  'delivery.fee.default.packaging': 'Packaging',
  'delivery.fee.default.surge': 'Rain fee',
  'delivery.fee.default.smallOrder': 'Small order fee',
  'delivery.fee.default.tip': 'Tip',
  'delivery.fee.default.donation': 'Donation',
  'delivery.fee.default.feeTax': 'GST on fees',
  'delivery.fee.default.other': 'Fee',
  'delivery.fee.add.cta': 'Add fee',
  'delivery.fee.save.cta': 'Save',
  'delivery.fee.remove.cta': 'Remove fee',
  'delivery.fee.tip.hint': 'Only one person tipping? Add it as an item instead.',
  'delivery.fee.tip.cta': 'Make it an item',

  // The fee policy on the "What you paid" step.
  'delivery.paid.policy.label': 'How should fees be shared?',
  'delivery.paid.policy.equal': 'Equally',
  'delivery.paid.policy.proportional': 'By what each had',
  'delivery.paid.explain.equal':
    '{fees} in fees split equally between everyone who ordered — tax and the {coupon} coupon go by what each had.',
  'delivery.paid.explain.equal.coupon':
    '{fees} in fees split equally between everyone who ordered — the {coupon} coupon goes by what each had.',
  'delivery.paid.explain.equal.tax': '{fees} in fees split equally between everyone who ordered — tax goes by what each had.',
  'delivery.paid.explain.equal.only': '{fees} in fees split equally between everyone who ordered.',
  'delivery.paid.explain.proportional': 'Fees, tax and the coupon are all shared by what each person had.',
  'delivery.paid.explain.proportional.coupon': 'Fees and the coupon are both shared by what each person had.',
  'delivery.paid.explain.proportional.tax': 'Fees and tax are both shared by what each person had.',
  'delivery.paid.explain.proportional.only': 'Fees are shared by what each person had.',

  // Each person's lines on the result step.
  'delivery.result.fees': 'Fees',
  'delivery.result.other': 'Tax, charges & offers',
  'delivery.result.total': 'Total',
  'delivery.result.none': "Didn't order · {amount}",
} as const satisfies Messages
