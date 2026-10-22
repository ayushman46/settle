import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { resetDataForTests } from '../data/testing'

afterEach(() => {
  // Unmount first, so nothing is subscribed while the data layer resets.
  cleanup()
  // The stores keep their state in memory as well as in localStorage: clearing storage alone
  // would let one test's people and splits leak into the next.
  resetDataForTests()
})
