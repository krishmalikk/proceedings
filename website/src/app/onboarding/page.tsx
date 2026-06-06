'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Markdown from '@/components/Markdown'
import { getActiveUser, setActiveUser, userHeaders } from '@/lib/activeUser'

type JourneyEntry = { milestone: string; date: string; experience: string }
type Profile = {
  username: string
  current_visa_or_greencard_category: string[]
  visa_applying_for: string[]
  primary_consulate: string
  consulates: string[]
  key_stages_or_info: Record<string, string>
  key_dates: Record<string, string>
  background_text: string
  journey: JourneyEntry[]
  created_at?: string
  updated_at?: string
}
type SeedUser = { id: string; username: string; label?: string }
type Turn = { id: string; role: 'user' | 'ai'; content: string }
type Stage = 'basics' | 'experiences'

const EMPTY: Profile = {
  username: '', current_visa_or_greencard_category: [], visa_applying_for: [],
  primary_consulate: '', consulates: [], key_stages_or_info: {}, key_dates: {},
  background_text: '', journey: [], created_at: '', updated_at: '',
}

const GREETING_BASICS =
  "Hi! Let's set up the **basics** of your immigration profile — your current situation, journey and key " +
  "dates. This is just your background, not a Q&A (you can post questions as messages later). " +
  "After we save this, I'll ask about your **experiences** at the milestones you've crossed.\n\n" +
  "To start: are you currently in the U.S. on a visa, or applying for one from abroad? " +
  "(Please don't share personal details like your name, date of birth, or passport number.)"

const GREETING_EXPERIENCES =
  "Your basic profile is saved ✓. Now let's capture your **experiences** at the milestones you've already " +
  "crossed — these help others going through the same steps (and aren't tagged to your current status)."

const TAG_CHIPS: { field: keyof Profile; label: string }[] = [
  { field: 'current_visa_or_greencard_category', label: 'Current status' },
  { field: 'visa_applying_for', label: 'Applying for' },
  { field: 'consulates', label: 'Consulate(s)' },
]

export default function OnboardingPage() {
  const [users, setUsers] = useState<SeedUser[]>([])
  const [activeId, setActiveId] = useState('')
  const [stage, setStage] = useState<Stage>('basics')
  const [draft, setDraft] = useState<Profile>(EMPTY)
  const [messages, setMessages] = useState<Turn[]>([{ id: 'greet', role: 'ai', content: GREETING_BASICS }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState('')
  const [error, setError] = useState('')
  const threadRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/users').then((r) => r.json()).then((list: SeedUser[]) => {
      setUsers(list)
      const saved = getActiveUser()
      const id = saved && list.some((u) => u.id === saved) ? saved : (list[0]?.id || '')
      if (id) { setActiveUser(id); setActiveId(id) }
    }).catch(() => {})
  }, [])

  const loadProfile = useCallback(() => {
    fetch('/api/profile', { headers: userHeaders() }).then((r) => r.json()).then((p: Profile) => {
      setDraft({ ...EMPTY, ...p })
      setSavedAt(p.updated_at || '')
      setStage('basics')
      setMessages([{ id: 'greet', role: 'ai', content: GREETING_BASICS }])
    }).catch(() => {})
  }, [])

  useEffect(() => { if (activeId) loadProfile() }, [activeId, loadProfile])
  useEffect(() => { if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight }, [messages, loading])

  function switchUser(id: string) { setActiveUser(id); setActiveId(id) }

  async function send(text: string) {
    const t = text.trim()
    if (t.length < 1 || loading) return
    setInput(''); setError('')
    const history = messages.map((m) => ({ role: m.role, content: m.content }))
    setMessages((prev) => [...prev, { id: `${Date.now()}-u`, role: 'user', content: t }])
    setLoading(true)
    try {
      const res = await fetch('/api/onboard', {
        method: 'POST', headers: userHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ stage, messages: [...history, { role: 'user', content: t }], draft }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Onboarding error')
      setMessages((prev) => [...prev, { id: `${Date.now()}-a`, role: 'ai', content: data.reply }])
      setDraft({ ...EMPTY, ...data.profile })
    } catch (e) {
      setMessages((prev) => [...prev, { id: `${Date.now()}-x`, role: 'ai', content: e instanceof Error ? e.message : 'Onboarding error' }])
    } finally { setLoading(false) }
  }

  function removeChip(field: keyof Profile, value: string) {
    setDraft((d) => ({ ...d, [field]: (d[field] as string[]).filter((v) => v !== value) }))
  }
  function removeKV(field: 'key_stages_or_info' | 'key_dates', key: string) {
    setDraft((d) => { const n = { ...d[field] }; delete n[key]; return { ...d, [field]: n } })
  }
  function removeJourney(idx: number) {
    setDraft((d) => ({ ...d, journey: d.journey.filter((_, i) => i !== idx) }))
  }
  const prettyMilestone = (m: string) => m.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  async function persist(): Promise<Profile | null> {
    const res = await fetch('/api/profile', {
      method: 'PUT', headers: userHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(draft),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || 'Could not save profile')
    setDraft({ ...EMPTY, ...data }); setSavedAt(data.updated_at || new Date().toISOString())
    return data
  }

  // Stage 1 → save basics, then move to Stage 2 and have the bot open the experiences pass.
  async function saveAndContinue() {
    setSaving(true); setError('')
    try {
      const saved = await persist()
      setStage('experiences'); setMessages([]); setLoading(true)
      try {
        const res = await fetch('/api/onboard', {
          method: 'POST', headers: userHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ stage: 'experiences', messages: [], draft: saved || draft }),
        })
        const data = await res.json()
        setMessages([{ id: 's2', role: 'ai', content: data.reply || GREETING_EXPERIENCES }])
        if (data.profile) setDraft({ ...EMPTY, ...data.profile })
      } catch {
        setMessages([{ id: 's2', role: 'ai', content: GREETING_EXPERIENCES }])
      } finally { setLoading(false) }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save profile')
    } finally { setSaving(false) }
  }

  async function saveExperiences() {
    setSaving(true); setError('')
    try { await persist() } catch (e) { setError(e instanceof Error ? e.message : 'Could not save') }
    finally { setSaving(false) }
  }

  function backToBasics() {
    setStage('basics'); setMessages([{ id: 'greet', role: 'ai', content: GREETING_BASICS }])
  }

  const hasBasics =
    draft.current_visa_or_greencard_category.length > 0 || draft.visa_applying_for.length > 0 ||
    draft.consulates.length > 0 || Object.keys(draft.key_stages_or_info).length > 0 ||
    Object.keys(draft.key_dates).length > 0 || draft.background_text.trim().length > 0

  const Step = ({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) => (
    <div className={`flex items-center gap-2 ${active ? 'text-primary' : 'text-on-surface-variant'}`}>
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-caption font-semibold ${active ? 'bg-primary text-on-primary' : done ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container'}`}>
        {done ? <span className="material-symbols-outlined text-[16px]">check</span> : n}
      </span>
      <span className="text-label-md">{label}</span>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <h1 className="text-headline-md text-on-surface">Set up your profile</h1>
        <label className="flex items-center gap-2 text-label-md text-on-surface-variant">
          <span className="material-symbols-outlined text-[20px]">switch_account</span>
          Demo user:
          <select value={activeId} onChange={(e) => switchUser(e.target.value)}
            className="bg-surface-container-lowest border border-outline-variant rounded-lg px-2 py-1 text-body-md focus:outline-none focus:border-primary">
            {users.map((u) => <option key={u.id} value={u.id}>{u.label || u.username}</option>)}
          </select>
        </label>
      </div>

      {/* stepper */}
      <div className="flex items-center gap-4 mb-4">
        <Step n={1} label="Basics" active={stage === 'basics'} done={stage === 'experiences'} />
        <span className="w-8 h-0.5 bg-outline-variant" />
        <Step n={2} label="Experiences" active={stage === 'experiences'} done={false} />
      </div>

      {error && <div className="card text-error mb-4">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        {/* LEFT — chat */}
        <div className="bg-surface-container-low rounded-xl p-4 flex flex-col" style={{ minHeight: '60vh' }}>
          <div ref={threadRef} className="flex-1 space-y-4 overflow-y-auto max-h-[64vh] pr-1">
            {messages.map((m) => (
              m.role === 'user' ? (
                <div key={m.id} className="flex justify-end">
                  <div className="bg-primary-container text-on-primary-container rounded-2xl rounded-tr-sm px-3 py-2 text-body-md max-w-[85%]">{m.content}</div>
                </div>
              ) : (
                <div key={m.id} className="bg-surface-container rounded-2xl rounded-tl-sm p-3 text-on-surface max-w-[90%]">
                  <Markdown>{m.content}</Markdown>
                </div>
              )
            ))}
            {loading && (
              <div className="flex gap-1 py-1">
                <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(input) }} className="mt-3 flex items-center gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)}
              placeholder={stage === 'basics' ? 'Describe your situation…' : 'Share your experience…'}
              className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-full px-4 py-2 text-body-md focus:outline-none focus:border-primary" />
            <button type="submit" disabled={input.trim().length < 1 || loading} className="btn-primary rounded-full disabled:opacity-40">Send</button>
          </form>
        </div>

        {/* RIGHT — stage-specific review + save */}
        <aside className="bg-surface-container-low rounded-xl p-4 space-y-4 h-fit">
          {stage === 'basics' ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">badge</span>
                  <span className="text-label-md font-semibold text-on-surface">Basic profile</span>
                </div>
                {savedAt && <span className="badge-success text-caption">saved</span>}
              </div>
              <p className="text-caption text-on-surface-variant">{draft.username}</p>
              {!hasBasics && <p className="text-caption text-on-surface-variant">Nothing captured yet — chat on the left to begin.</p>}

              {TAG_CHIPS.map((s) => {
                const vals = draft[s.field] as string[]
                if (!vals.length) return null
                return (
                  <div key={s.field}>
                    <p className="text-caption uppercase tracking-wide text-on-surface-variant mb-1">{s.label}</p>
                    <div className="flex flex-wrap gap-2">
                      {vals.map((v) => (
                        <span key={v} className="pill-active flex items-center gap-1">{v}
                          <button onClick={() => removeChip(s.field, v)} aria-label={`Remove ${v}`}><span className="material-symbols-outlined text-[16px]">close</span></button>
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}

              {Object.keys(draft.key_stages_or_info).length > 0 && (
                <div>
                  <p className="text-caption uppercase tracking-wide text-on-surface-variant mb-1">Situation</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(draft.key_stages_or_info).map(([k, v]) => (
                      <span key={k} className="pill-active flex items-center gap-1">{k}: {v}
                        <button onClick={() => removeKV('key_stages_or_info', k)} aria-label={`Remove ${k}`}><span className="material-symbols-outlined text-[16px]">close</span></button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {Object.keys(draft.key_dates).length > 0 && (
                <div>
                  <p className="text-caption uppercase tracking-wide text-on-surface-variant mb-1">Key dates</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(draft.key_dates).map(([k, v]) => (
                      <span key={k} className="pill-active flex items-center gap-1">{k}: {v}
                        <button onClick={() => removeKV('key_dates', k)} aria-label={`Remove ${k}`}><span className="material-symbols-outlined text-[16px]">close</span></button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-caption uppercase tracking-wide text-on-surface-variant mb-1">Background</p>
                <textarea value={draft.background_text} onChange={(e) => setDraft((d) => ({ ...d, background_text: e.target.value }))}
                  rows={4} placeholder="Your situation/intent (no personal identifiers)…"
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary resize-y" />
              </div>

              <button onClick={saveAndContinue} disabled={saving || !hasBasics} className="btn-primary w-full disabled:opacity-40">
                {saving ? 'Saving…' : 'Save & continue to experiences'}
              </button>
              <p className="text-caption text-on-surface-variant text-center">PII-free. Past experiences are added in the next step.</p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">timeline</span>
                  <span className="text-label-md font-semibold text-on-surface">Your experiences</span>
                </div>
                {savedAt && <span className="badge-success text-caption">saved</span>}
              </div>

              {draft.journey.length === 0 && <p className="text-caption text-on-surface-variant">No experiences yet — answer on the left to add them.</p>}

              {draft.journey.length > 0 && (
                <ol className="relative border-l border-outline-variant ml-1 space-y-3">
                  {draft.journey.map((e, i) => (
                    <li key={`${e.milestone}-${e.date}-${i}`} className="ml-3">
                      <span className="absolute -left-[5px] mt-1 w-2.5 h-2.5 rounded-full bg-primary" />
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-label-md text-on-surface font-medium">{prettyMilestone(e.milestone)}</p>
                          {e.date && <p className="text-caption text-on-surface-variant">{e.date}</p>}
                        </div>
                        <button onClick={() => removeJourney(i)} aria-label="Remove experience" className="text-on-surface-variant hover:text-error">
                          <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      </div>
                      <p className="text-body-md text-on-surface-variant mt-0.5 whitespace-pre-wrap">{e.experience}</p>
                    </li>
                  ))}
                </ol>
              )}

              <button onClick={saveExperiences} disabled={saving} className="btn-primary w-full disabled:opacity-40">
                {saving ? 'Saving…' : 'Save experiences'}
              </button>
              <button onClick={backToBasics} className="btn-secondary w-full">Back to basics</button>
              <p className="text-caption text-on-surface-variant text-center">Experiences are stored as text and never tagged to your current status.</p>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
