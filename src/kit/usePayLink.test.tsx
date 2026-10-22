import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDataForTests, updateProfile } from '../data'
import type { Expense } from '../domain/types'
import * as share from '../share'
import { decodePayLink } from '../share'
import { makeExpense } from '../share/testing'
import { seedPeople } from './testPeople'
import { usePayLink } from './usePayLink'

beforeEach(() => {
  resetDataForTests()
  seedPeople()
})

afterEach(() => {
  vi.restoreAllMocks()
  resetDataForTests()
})

describe('usePayLink', () => {
  it('packs the expense into a pay link that opens to the same payload', async () => {
    const expense = makeExpense()
    const { result } = renderHook(() => usePayLink(expense))
    expect(result.current.payload?.to).toEqual({ n: 'Ayush', u: 'ayush@okaxis' })
    expect(result.current.link).toBeNull()
    await waitFor(() => expect(result.current.link).not.toBeNull())
    expect(result.current.link).toMatch(new RegExp(`^${window.location.origin}/pay#`))
    expect(await decodePayLink(result.current.link ?? '')).toEqual(result.current.payload)
  })

  it('packs nothing while disabled, and nothing without an expense', async () => {
    const encode = vi.spyOn(share, 'encodePayLink')
    const { result, rerender } = renderHook(({ expense, enabled }: { expense: Expense | null; enabled: boolean }) => usePayLink(expense, { enabled }), {
      initialProps: { expense: makeExpense() as Expense | null, enabled: false },
    })
    expect(result.current.link).toBeNull()
    rerender({ expense: null, enabled: true })
    expect(result.current).toEqual({ payload: null, link: null })
    expect(encode).not.toHaveBeenCalled()
  })

  it('keeps the link across re-renders, and remakes it when the content changes', async () => {
    const encode = vi.spyOn(share, 'encodePayLink')
    const { result, rerender } = renderHook(({ expense }: { expense: Expense }) => usePayLink(expense), {
      initialProps: { expense: makeExpense() },
    })
    await waitFor(() => expect(result.current.link).not.toBeNull())
    const first = result.current.link

    // An equal expense (a fresh object) is the same link, packed once.
    rerender({ expense: makeExpense() })
    expect(result.current.link).toBe(first)
    expect(encode).toHaveBeenCalledOnce()

    // Adding a UPI ID changes what the link carries.
    act(() => {
      updateProfile({ upiId: 'ayush@oksbi' })
    })
    await waitFor(() => {
      expect(result.current.link).not.toBeNull()
      expect(result.current.link).not.toBe(first)
    })
    expect((await decodePayLink(result.current.link ?? ''))?.to.u).toBe('ayush@oksbi')
    expect(encode).toHaveBeenCalledTimes(2)
  })

  it('hides the link while disabled and shows it again without repacking', async () => {
    const encode = vi.spyOn(share, 'encodePayLink')
    const expense = makeExpense()
    const { result, rerender } = renderHook(({ enabled }: { enabled: boolean }) => usePayLink(expense, { enabled }), {
      initialProps: { enabled: true },
    })
    await waitFor(() => expect(result.current.link).not.toBeNull())
    const link = result.current.link
    rerender({ enabled: false })
    expect(result.current.link).toBeNull()
    rerender({ enabled: true })
    expect(result.current.link).toBe(link)
    expect(encode).toHaveBeenCalledOnce()
  })
})
