import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { EN } from '../../i18n/en'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { TOOL_SECTIONS, TOOLS } from './registry'
import { ToolsScreen } from './ToolsScreen'

beforeEach(() => {
  resetProScreens()
})

describe('the list of tools', () => {
  it('names every tool once, with copy that exists and a place to go', () => {
    const ids = TOOLS.map((tool) => tool.id)
    expect(new Set(ids).size).toBe(ids.length)
    const copy = EN as Record<string, string>
    for (const tool of TOOLS) {
      expect(copy[tool.title], tool.title).toBeTruthy()
      expect(copy[tool.body], tool.body).toBeTruthy()
      expect(TOOL_SECTIONS).toContain(tool.section)
      if (tool.place !== 'cash') expect(tool.path, tool.id).toMatch(/^\/app\//)
      // One plain line each.
      expect((copy[tool.body] ?? '').length, tool.body).toBeLessThanOrEqual(92)
    }
  })
})

describe('ToolsScreen', () => {
  it('shows the tools in groups and opens one', async () => {
    const { user } = renderAt('/app/tools', <ToolsScreen />)
    expect(screen.getByRole('heading', { level: 1, name: 'Everything Settle does' })).toBeInTheDocument()
    const settle = screen.getByRole('region', { name: 'Pay and settle' })
    expect(within(settle).getByText('Pay in parts')).toBeInTheDocument()
    // A tool that lives inside a group says so.
    expect(within(settle).getAllByText('In a group').length).toBeGreaterThan(0)
    await user.click(within(settle).getByRole('button', { name: /Pay in parts/ }))
    expect(currentUrl()).toBe('/app/kist')
  })

  it('finds a tool by a word in its name or its description, and says when there is none', async () => {
    const { user } = renderAt('/app/tools', <ToolsScreen />)
    await user.type(screen.getByLabelText('Search the tools'), 'interest')
    expect(screen.getByText('Interest on a loan')).toBeInTheDocument()
    expect(screen.queryByText('Pay in parts')).not.toBeInTheDocument()
    await user.clear(screen.getByLabelText('Search the tools'))
    await user.type(screen.getByLabelText('Search the tools'), 'zzzz')
    expect(screen.getByText(/Nothing by that name/)).toBeInTheDocument()
  })

  it('opens the cash notes helper in place', async () => {
    const { user } = renderAt('/app/tools', <ToolsScreen />)
    await user.type(screen.getByLabelText('Search the tools'), 'notes')
    await user.click(screen.getAllByRole('button', { name: /notes/i })[0] as HTMLElement)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })
})
