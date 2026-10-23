import { describe, expect, it } from 'vitest'
import { CATEGORY_IDS } from '../shared/categories'
import { BILL_SCHEMA, SYSTEM_PROMPT, USER_PROMPT } from './prompt'

describe('BILL_SCHEMA', () => {
  it('is strict-mode friendly: every property required, no extras allowed', () => {
    expect(BILL_SCHEMA.additionalProperties).toBe(false)
    expect([...BILL_SCHEMA.required].sort()).toEqual(Object.keys(BILL_SCHEMA.properties).sort())
    const item = BILL_SCHEMA.properties.items.items
    expect(item.additionalProperties).toBe(false)
    expect([...item.required].sort()).toEqual(Object.keys(item.properties).sort())
  })

  it('uses only widely supported keywords', () => {
    const text = JSON.stringify(BILL_SCHEMA)
    for (const keyword of ['$ref', 'anyOf', 'oneOf', 'allOf', 'format', 'pattern', '$defs']) expect(text).not.toContain(`"${keyword}"`)
  })

  it('lists items before the totals they add up to', () => {
    const keys = Object.keys(BILL_SCHEMA.properties)
    expect(keys.indexOf('items')).toBeLessThan(keys.indexOf('subtotal'))
    expect(keys.at(-1)).toBe('total')
  })

  it('asks for one of the shared categories, right after the merchant', () => {
    expect(BILL_SCHEMA.properties.category).toEqual({ type: 'string', enum: [...CATEGORY_IDS], description: 'What the bill is for' })
    const keys = Object.keys(BILL_SCHEMA.properties)
    expect(keys.indexOf('category')).toBe(keys.indexOf('merchant') + 1)
  })
})

describe('prompts', () => {
  it('embed the schema for models that ignore response_format', () => {
    expect(USER_PROMPT).toContain(JSON.stringify(BILL_SCHEMA))
  })

  it('cover the layouts that trip models up', () => {
    for (const rule of ['CGST', 'SGST', 'Round-off', 'Service charge', 'LINE TOTAL', 'wraps', 'SUGGESTED tips', 'incl. VAT', 'POSITIVE', 'never its rate', 'isBill']) {
      expect(SYSTEM_PROMPT).toContain(rule)
    }
  })

  it('read service bills (electricity, rides, stays) as a total without items', () => {
    for (const rule of ['EMPTY items list', 'electricity', 'cab', 'hotel', 'payable by the due date']) expect(SYSTEM_PROMPT).toContain(rule)
    for (const category of CATEGORY_IDS) expect(SYSTEM_PROMPT).toContain(category)
  })
})

describe('delivery-app fees in the prompt (spec 08 §5)', () => {
  it('asks for fees right after serviceCharge, each with a kind', () => {
    const required = [...BILL_SCHEMA.required]
    expect(required.indexOf('fees')).toBe(required.indexOf('serviceCharge') + 1)
    const keys = Object.keys(BILL_SCHEMA.properties)
    expect(keys.indexOf('fees')).toBe(keys.indexOf('serviceCharge') + 1)
    expect(BILL_SCHEMA.properties.fees.items.properties.kind.enum).toEqual(['delivery', 'platform', 'packaging', 'surge', 'small_order', 'tip', 'donation', 'fee_tax', 'other'])
    expect(BILL_SCHEMA.properties.serviceCharge.description).toBe('Restaurant service charge only — not delivery, platform or packaging fees')
  })

  it('teaches Indian delivery and quick-commerce layouts', () => {
    for (const rule of ['FOOD DELIVERY AND QUICK COMMERCE', 'Blinkit', 'Zepto', 'struck-out MRP', 'delivery partner fee → delivery', 'small cart / small order fee → small_order', 'Feeding India', 'fee_tax', 'Never put these in serviceCharge', 'Swiggy One, Zomato Gold', '"To pay"', 'groceries for Blinkit']) {
      expect(SYSTEM_PROMPT).toContain(rule)
    }
    expect(USER_PROMPT).toContain('"fees"')
  })
})
