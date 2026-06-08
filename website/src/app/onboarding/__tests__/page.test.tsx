import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import OnboardingPage from '../page'

vi.mock('@/lib/activeUser', () => ({
  getActiveUser: vi.fn(() => 'demo-arjun'),
  setActiveUser: vi.fn(),
  userHeaders: vi.fn((h?: Record<string, string>) => h || {}),
}))
vi.mock('@/components/Markdown', () => ({ default: ({ children }: { children: string }) => <div>{children}</div> }))

const PROFILE = {
  username: 'arjun-h1b',
  current_visa_or_greencard_category: ['H-1B'], visa_applying_for: [],
  primary_consulate: 'BOM', consulates: ['BOM'],
  key_stages_or_info: {}, key_dates: {},
  background_text: 'On H-1B from India; EB-2 PERM in progress.',
  journey: [], updated_at: '2026-06-01T00:00:00Z',  // already onboarded
}

let onboardBody: { stage?: string; messages?: { content: string }[] } | null = null
function mockApi() {
  onboardBody = null
  global.fetch = vi.fn(async (url: string, opts?: { method?: string; body?: string }) => {
    const u = String(url); const method = opts?.method || 'GET'
    if (u.includes('/api/users')) return { ok: true, status: 200, json: async () => [{ id: 'demo-arjun', username: 'arjun-h1b', label: 'Arjun' }] } as Response
    if (u.includes('/api/onboard') && method === 'POST') {
      onboardBody = JSON.parse(opts!.body as string)
      return { ok: true, status: 200, json: async () => ({ reply: 'Updated your tags.', profile: { ...PROFILE, visa_applying_for: ['EB-2'] }, done: false }) } as Response
    }
    if (u.includes('/api/profile')) return { ok: true, status: 200, json: async () => PROFILE } as Response
    return { ok: true, status: 200, json: async () => ({}) } as Response
  }) as unknown as typeof fetch
}

beforeEach(() => mockApi())

describe('OnboardingPage (consolidated profile)', () => {
  it('loads the saved profile and greets a returning user', async () => {
    render(<OnboardingPage />)
    expect(await screen.findByText('H-1B')).toBeInTheDocument()                 // current-status chip from saved profile
    expect(screen.getByDisplayValue(/EB-2 PERM in progress/)).toBeInTheDocument() // background prefilled
    expect(screen.getByText(/Welcome back/)).toBeInTheDocument()                // returning-user greeting
    expect(screen.getByRole('heading', { name: 'Your profile' })).toBeInTheDocument()
  })

  it('re-generates tags from the background text via /api/onboard', async () => {
    render(<OnboardingPage />)
    await screen.findByText('H-1B')
    fireEvent.click(screen.getByText('Re-generate tags from this text'))
    await waitFor(() => expect(onboardBody).not.toBeNull())
    expect(onboardBody?.stage).toBe('basics')
    expect(onboardBody?.messages?.[0].content).toMatch(/EB-2 PERM/)             // background sent as the message
    expect(await screen.findByText('EB-2')).toBeInTheDocument()                 // new tag applied to the draft
    expect(screen.getByText(/Tags updated from your background/)).toBeInTheDocument()
  })
})
