import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getPhoto, setPhoto, usePhoto } from './photo'

const revokeObjectURL = vi.fn()

beforeEach(() => {
  Object.assign(URL, { revokeObjectURL })
  revokeObjectURL.mockClear()
})

afterEach(() => {
  setPhoto(null)
})

describe('photo store', () => {
  it('holds the current photo and notifies subscribers', () => {
    const { result } = renderHook(() => usePhoto())
    expect(result.current).toBeNull()
    act(() => setPhoto({ previewUrl: 'blob:one' }))
    expect(result.current).toEqual({ previewUrl: 'blob:one' })
    expect(getPhoto()).toEqual({ previewUrl: 'blob:one' })
  })

  it('revokes the previous object URL when replaced or cleared', () => {
    setPhoto({ previewUrl: 'blob:one' })
    setPhoto({ previewUrl: 'blob:two' })
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:one')
    setPhoto(null)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:two')
    expect(getPhoto()).toBeNull()
  })

  it('does not revoke non-blob URLs or the same URL', () => {
    setPhoto({ previewUrl: 'data:image/png;base64,AA' })
    setPhoto({ previewUrl: 'data:image/png;base64,AA' })
    setPhoto(null)
    expect(revokeObjectURL).not.toHaveBeenCalled()
  })
})
