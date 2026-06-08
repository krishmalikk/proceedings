import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ProfilePage from '../page'

vi.mock('@/lib/activeUser', () => ({
  getActiveUser: vi.fn(() => 'demo-arjun'),
  setActiveUser: vi.fn(),
  userHeaders: vi.fn((h?: Record<string, string>) => h || {}),
}))

const VOCAB = {
  visa: ['H-1B', 'EB-2'], consulate: ['BOM'],
  consulate_options: [{ code: 'BOM', label: 'Mumbai, India (BOM)' }],
  tag: [], stage_key: ['citizen_of_country'], date_key: ['h1b_filed_date'],
}
const PROFILE = {
  username: 'arjun-h1b',
  current_visa_or_greencard_category: ['H-1B'], visa_applying_for: [],
  primary_consulate: 'BOM', consulates: ['BOM'],
  key_stages_or_info: { citizen_of_country: 'IN' }, key_dates: {},
  background_text: 'on H-1B', journey: [],
}

let putBody: unknown = null
function mockApi() {
  putBody = null
  global.fetch = vi.fn(async (url: string, opts?: { method?: string; body?: string }) => {
    const u = String(url); const method = opts?.method || 'GET'
    if (u.includes('/api/users')) return { ok: true, status: 200, json: async () => [{ id: 'demo-arjun', username: 'arjun-h1b', label: 'Arjun' }] } as Response
    if (u.includes('/api/tag-vocab')) return { ok: true, status: 200, json: async () => VOCAB } as Response
    if (u.includes('/api/profile') && method === 'PUT') { putBody = JSON.parse(opts!.body as string); return { ok: true, status: 200, json: async () => putBody } as Response }
    if (u.includes('/api/profile')) return { ok: true, status: 200, json: async () => PROFILE } as Response
    return { ok: true, status: 200, json: async () => ({}) } as Response
  }) as unknown as typeof fetch
}

beforeEach(() => { mockApi() })

describe('ProfilePage', () => {
  it('renders the loaded profile (tags + background)', async () => {
    render(<ProfilePage />)
    expect(await screen.findByText('H-1B')).toBeInTheDocument()      // current-status chip
    expect(screen.getByDisplayValue('on H-1B')).toBeInTheDocument()  // background textarea
    expect(screen.getByDisplayValue('arjun-h1b')).toBeInTheDocument() // username
  })

  it('adds a valid tag via the autocomplete input', async () => {
    render(<ProfilePage />)
    await screen.findByText('H-1B')
    const input = screen.getByPlaceholderText('Add visa / category applying for…')
    fireEvent.keyDown(input, { key: 'Enter', target: { value: 'EB-2' } })
    expect(await screen.findByText('EB-2')).toBeInTheDocument()
  })

  it('rejects an out-of-vocabulary tag with an error', async () => {
    render(<ProfilePage />)
    await screen.findByText('H-1B')
    const input = screen.getByPlaceholderText('Add visa / category applying for…')
    fireEvent.keyDown(input, { key: 'Enter', target: { value: 'NOT-A-VISA' } })
    expect(await screen.findByText(/is not a valid visa value/i)).toBeInTheDocument()
  })

  it('saves via PUT /api/profile with the edited profile', async () => {
    render(<ProfilePage />)
    await screen.findByText('H-1B')
    fireEvent.click(screen.getByText('Save profile'))
    await waitFor(() => expect(putBody).not.toBeNull())
    expect((putBody as { username: string }).username).toBe('arjun-h1b')
    expect(await screen.findByText('Saved')).toBeInTheDocument()
  })
})
