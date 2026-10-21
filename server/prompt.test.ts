import { describe, expect, it } from 'vitest'
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
})
