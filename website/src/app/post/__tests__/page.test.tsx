import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PostPage from '../page'

// Active user = demo-arjun; userHeaders forwards it as X-User-Id (as the real lib does).
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: null, loading: false, signOut: vi.fn() }) }))
vi.mock('@/lib/activeUser', () => ({
  getActiveUser: vi.fn(() => 'demo-arjun'),
  userHeaders: vi.fn((h?: Record<string, string>) => ({ ...(h || {}), 'X-User-Id': 'demo-arjun' })),
  DEMO_PICKER_ENABLED: true,
}))

const json = (data: unknown, ok = true, status = 200) =>
  ({ ok, status, json: async () => data }) as Response

const EMPTY_GROUPS = {
  visa_applying_for: [],
  current_visa_or_greencard_category: [],
  primary_consulate: '',
  consulates: [],
  tags: [],
  concerns_or_questions_tags: [],
}
const VOCAB = {
  visa: ['H-1B', 'F-1'], consulate: ['BOM'],
  consulate_options: [{ code: 'BOM', label: 'Mumbai, India (BOM)' }], consulate_tree: [],
  tag: ['premium-processing'], stage_key: [], date_key: [], outcome: [], country: [],
  misc: [], misc_options: [], profile_stage_key: [], stage_value_domains: {},
}
// The author's saved profile says H-1B; the message will say F-1 → a conflict.
const PROFILE = {
  username: 'arjun-h1b', current_visa_or_greencard_category: ['H-1B'], visa_applying_for: [],
  primary_consulate: 'BOM', consulates: ['BOM'], tags: [], key_stages_or_info: {}, key_dates: {},
  background_text: '', journey: [],
}

let putBody: Record<string, unknown> | null = null
let profileReadHeader: string | undefined
let putHeader: string | undefined

function mockApi() {
  putBody = null; profileReadHeader = undefined; putHeader = undefined
  global.fetch = vi.fn(async (url: string, opts?: { method?: string; body?: string; headers?: Record<string, string> }) => {
    const u = String(url); const method = opts?.method || 'GET'
    const xuid = opts?.headers?.['X-User-Id']
    if (u.includes('/api/tag-vocab')) return json(VOCAB)
    if (u.includes('/api/tag-suggest')) {
      return json({
        groups: { ...EMPTY_GROUPS, current_visa_or_greencard_category: ['F-1'] }, // message says F-1
        relevant_sections: ['current_visa_or_greencard_category'], posting_type: 'in_us_status',
        key_stages_or_info: {}, key_dates: {},
      })
    }
    if (u.includes('/api/reconcile')) {
      return json({
        merged: { ...EMPTY_GROUPS, current_visa_or_greencard_category: ['F-1'], consulates: ['BOM'], primary_consulate: 'BOM', key_stages_or_info: {}, key_dates: {} },
        conflicts: [{ field: 'current_visa_or_greencard_category', profile_value: ['H-1B'], message_value: ['F-1'] }],
        prefilled: [],
      })
    }
    if (u.includes('/api/profile') && method === 'PUT') {
      putHeader = xuid; putBody = JSON.parse(opts!.body as string)
      return json({ ...PROFILE, ...putBody })
    }
    if (u.includes('/api/profile')) { profileReadHeader = xuid; return json(PROFILE) }
    return json({})
  }) as unknown as typeof fetch
}

beforeEach(() => mockApi())

async function previewWithConflict() {
  render(<PostPage />)
  fireEvent.change(screen.getByPlaceholderText(/H-1B extension with an RFE/), { target: { value: 'F-1 OPT to STEM OPT' } })
  fireEvent.change(screen.getByPlaceholderText(/Describe your situation/), {
    target: { value: 'I am currently on an F-1 student visa on OPT applying for the STEM OPT extension.' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
  // The reconcile conflict surfaces the "Update my profile to match" offer.
  expect(await screen.findByText('Update my profile to match')).toBeInTheDocument()
}

describe('PostPage — reconcile + update-profile-to-match (profile ↔ message)', () => {
  it('shows the conflict when the message disagrees with the saved profile', async () => {
    await previewWithConflict()
    // The conflict (H-1B vs F-1) is shown to the user.
    expect(screen.getByText(/profile: H-1B → this post: F-1/i)).toBeInTheDocument()
  })

  it('"Update my profile to match" PUTs the message value and confirms', async () => {
    await previewWithConflict()
    fireEvent.click(screen.getByText('Update my profile to match'))

    // The PUT must apply the conflict's message_value to the profile field…
    await waitFor(() => expect(putBody).not.toBeNull())
    expect(putBody?.current_visa_or_greencard_category).toEqual(['F-1'])
    // …targeted at the active user (X-User-Id forwarded for both read and write)…
    expect(profileReadHeader).toBe('demo-arjun')
    expect(putHeader).toBe('demo-arjun')
    // …and the UI confirms it persisted.
    expect(await screen.findByText(/Profile updated/)).toBeInTheDocument()
  })

  it('does not lose other profile fields on update (full profile re-sent)', async () => {
    await previewWithConflict()
    fireEvent.click(screen.getByText('Update my profile to match'))
    await waitFor(() => expect(putBody).not.toBeNull())
    // username/consulates from the existing profile are preserved in the PUT.
    expect(putBody?.username).toBe('arjun-h1b')
    expect(putBody?.consulates).toEqual(['BOM'])
  })
})

// A generic FAMILY-IMMIGRATION/EMPLOYMENT-IMMIGRATION (backend:
// posting.py's _apply_visa_backfill(), a last-resort fallback meant for
// manual curation with no original poster to ask) must never be enough to
// enable Submit for a LIVE app user, who's right here and can always be
// asked directly for the specific category instead.
describe('PostPage — generic visa-fallback gating (FAMILY-IMMIGRATION / EMPLOYMENT-IMMIGRATION)', () => {
  function mockTagSuggest(groups: Partial<typeof EMPTY_GROUPS>) {
    global.fetch = vi.fn(async (url: string) => {
      const u = String(url)
      if (u.includes('/api/tag-vocab')) return json(VOCAB)
      if (u.includes('/api/tag-suggest')) {
        return json({
          groups: { ...EMPTY_GROUPS, ...groups },
          relevant_sections: ['current_visa_or_greencard_category'], posting_type: 'general_question',
          key_stages_or_info: {}, key_dates: {},
        })
      }
      if (u.includes('/api/reconcile')) return json({}, false, 404) // no active user path exercised here
      return json({})
    }) as unknown as typeof fetch
  }

  async function previewWith(groups: Partial<typeof EMPTY_GROUPS>) {
    mockTagSuggest(groups)
    render(<PostPage />)
    fireEvent.change(screen.getByPlaceholderText(/H-1B extension with an RFE/), { target: { value: 'General I-130/I-485 question' } })
    fireEvent.change(screen.getByPlaceholderText(/Describe your situation/), {
      target: { value: 'For those who filed I-130 and I-485 at the same time, how long until approval?' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    await screen.findByText('Review tags')
  }

  it('a generic-only category does NOT enable Submit, and shows the "need the exact category" message', async () => {
    await previewWith({ current_visa_or_greencard_category: ['FAMILY-IMMIGRATION'] })
    expect(screen.getByRole('button', { name: /Submit posting/ })).toBeDisabled()
    expect(screen.getByText(/need the exact category/i)).toBeInTheDocument()
    // The generic value is still shown as a removable chip, not hidden.
    expect(screen.getByText('FAMILY-IMMIGRATION')).toBeInTheDocument()
  })

  it('EMPLOYMENT-IMMIGRATION alone also does NOT enable Submit', async () => {
    await previewWith({ current_visa_or_greencard_category: ['EMPLOYMENT-IMMIGRATION'] })
    expect(screen.getByRole('button', { name: /Submit posting/ })).toBeDisabled()
  })

  it('a SPECIFIC code (e.g. IR-1) alongside — or instead of — the generic one DOES enable Submit', async () => {
    await previewWith({ current_visa_or_greencard_category: ['FAMILY-IMMIGRATION', 'IR-1'] })
    expect(screen.getByRole('button', { name: /Submit posting/ })).not.toBeDisabled()
    expect(screen.queryByText(/need the exact category/i)).toBeNull()
  })

  it('no visa signal at all still shows the ORIGINAL generic-empty message, not the fallback-specific one', async () => {
    await previewWith({})
    expect(screen.getByRole('button', { name: /Submit posting/ })).toBeDisabled()
    expect(screen.getByText(/Add at least one visa\/status under/i)).toBeInTheDocument()
    expect(screen.queryByText(/need the exact category/i)).toBeNull()
  })

  it('a specific visa_applying_for code alone (unrelated to the fallback) still enables Submit as before', async () => {
    await previewWith({ visa_applying_for: ['H-1B'] })
    expect(screen.getByRole('button', { name: /Submit posting/ })).not.toBeDisabled()
  })
})
