'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Markdown from '@/components/Markdown'
import MatchCard, { MatchData } from '@/components/MatchCard'
import { getActiveUser, setActiveUser, userHeaders } from '@/lib/activeUser'

type Criteria = {
  current_visa_or_greencard_category: string[]
  visa_applying_for: string[]
  primary_consulate: string
  consulates: string[]
  key_stages_or_info: Record<string, string>
  key_dates: Record<string, string>
  background_text: string
}
type SeedUser = { id: string; username: string; label?: string }
type Turn = { id: string; role: 'user' | 'ai'; content: string }
type Conflict = { field: string; profile_value: unknown; message_value: unknown }

const EMPTY: Criteria = {
  current_visa_or_greencard_category: [], visa_applying_for: [], primary_consulate: '',
  consulates: [], key_stages_or_info: {}, key_dates: {}, background_text: '',
}

const GREETING =
  "Hi! I'll help you find others **in the same boat** — applicants in a similar immigration situation. " +
  "Tell me about your situation: your current status (or what you're applying for), the consulate involved, " +
  "and the key dates that place you in line. I'll turn it into match criteria.\n\n" +
  "(Please don't share personal details like your name, date of birth, or passport number.)"

const CHIP_FIELDS: { field: 'current_visa_or_greencard_category' | 'visa_applying_for' | 'consulates'; label: string }[] = [
  { field: 'current_visa_or_greencard_category', label: 'Current status' },
  { field: 'visa_applying_for', label: 'Applying for' },
  { field: 'consulates', label: 'Consulate(s)' },
]

function hasCriteria(c: Criteria): boolean {
  return (
    c.current_visa_or_greencard_category.length > 0 || c.visa_applying_for.length > 0 ||
    c.consulates.length > 0 || Object.keys(c.key_stages_or_info).length > 0 || Object.keys(c.key_dates).length > 0
  )
}

export default function FindPage() {
  const [users, setUsers] = useState<SeedUser[]>([])
  const [activeId, setActiveId] = useState('')
  const [draft, setDraft] = useState<Criteria>(EMPTY)
  const [messages, setMessages] = useState<Turn[]>([{ id: 'greet', role: 'ai', content: GREETING }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // reconcile (validate criteria vs profile)
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [explainer, setExplainer] = useState('')
  const [profileUpdated, setProfileUpdated] = useState(false)

  // matches + group
  const [matches, setMatches] = useState<MatchData[]>([])
  const [searched, setSearched] = useState(false)
  const [matchLoading, setMatchLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [group, setGroup] = useState<{ group_id: string; members: { username: string }[] } | null>(null)

  const threadRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/users').then((r) => r.json()).then((list: SeedUser[]) => {
      setUsers(list)
      const saved = getActiveUser()
      const id = saved && list.some((u) => u.id === saved) ? saved : (list[0]?.id || '')
      if (id) { setActiveUser(id); setActiveId(id) }
    }).catch(() => {})
  }, [])

  useEffect(() => { if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight }, [messages, loading])

  function resetFlow() {
    setConflicts([]); setExplainer(''); setProfileUpdated(false)
    setMatches([]); setSearched(false); setSelected(new Set()); setGroup(null)
  }
  function switchUser(id: string) { setActiveUser(id); setActiveId(id); setDraft(EMPTY); setMessages([{ id: 'greet', role: 'ai', content: GREETING }]); resetFlow() }

  async function send(text: string) {
    const t = text.trim()
    if (t.length < 1 || loading) return
    setInput(''); setError('')
    const history = messages.map((m) => ({ role: m.role, content: m.content }))
    setMessages((prev) => [...prev, { id: `${Date.now()}-u`, role: 'user', content: t }])
    setLoading(true)
    try {
      const res = await fetch('/api/find/chat', {
        method: 'POST', headers: userHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ messages: [...history, { role: 'user', content: t }], draft }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Find chat error')
      setMessages((prev) => [...prev, { id: `${Date.now()}-a`, role: 'ai', content: data.reply }])
      setDraft({ ...EMPTY, ...data.criteria })
    } catch (e) {
      setMessages((prev) => [...prev, { id: `${Date.now()}-x`, role: 'ai', content: e instanceof Error ? e.message : 'Find chat error' }])
    } finally { setLoading(false) }
  }

  function removeChip(field: 'current_visa_or_greencard_category' | 'visa_applying_for' | 'consulates', value: string) {
    setDraft((d) => ({ ...d, [field]: d[field].filter((v) => v !== value) }))
  }
  function removeKV(field: 'key_stages_or_info' | 'key_dates', key: string) {
    setDraft((d) => { const n = { ...d[field] }; delete n[key]; return { ...d, [field]: n } })
  }

  // Fetch matches with the ENTERED criteria (always — regardless of profile reconcile).
  const runMatches = useCallback(async () => {
    setMatchLoading(true); setError('')
    try {
      const res = await fetch('/api/find/matches', {
        method: 'POST', headers: userHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ criteria: draft }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Could not find matches')
      setMatches(data.matches || []); setSearched(true); setSelected(new Set()); setGroup(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not find matches')
    } finally { setMatchLoading(false) }
  }, [draft])

  // Step 1 of "Find matches": validate criteria vs the saved profile (reconcile).
  // If there are discrepancies, pause and offer to update the profile; otherwise go straight to matching.
  async function findMatches() {
    resetFlow()
    let paused = false
    try {
      const rr = await fetch('/api/reconcile', {
        method: 'POST', headers: userHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ message: draft }),
      })
      if (rr.ok) {
        const rd = await rr.json()
        if ((rd.conflicts || []).length > 0) {
          setConflicts(rd.conflicts); setExplainer(rd.explainer || ''); paused = true
        }
      }
    } catch { /* reconcile is best-effort */ }
    if (!paused) await runMatches()
  }

  // Offer accepted: write the entered values into the profile, then proceed to matching.
  async function updateProfileAndContinue() {
    try {
      const cur = await fetch('/api/profile', { headers: userHeaders() }).then((r) => r.json())
      const next: Record<string, unknown> = { ...cur }
      for (const c of conflicts) {
        if (c.field.includes('.')) {
          const [mapF, key] = c.field.split('.')
          next[mapF] = { ...((next[mapF] as Record<string, unknown>) || {}), [key]: c.message_value }
        } else {
          next[c.field] = c.message_value
        }
      }
      const res = await fetch('/api/profile', {
        method: 'PUT', headers: userHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(next),
      })
      if (res.ok) setProfileUpdated(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update profile')
    }
    setConflicts([])
    await runMatches() // matching still uses the entered criteria
  }

  function toggle(userId: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(userId) ? n.delete(userId) : n.add(userId); return n })
  }

  async function createGroup() {
    const members = matches.filter((m) => selected.has(m.user_id)).map((m) => ({ user_id: m.user_id, username: m.username, score: m.score }))
    if (members.length === 0) return
    setError('')
    try {
      const res = await fetch('/api/groups', {
        method: 'POST', headers: userHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ criteria_text: draft.background_text || '', criteria: draft, members }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Could not create group')
      setGroup(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create group')
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h1 className="text-headline-md text-on-surface">Find users in the same boat</h1>
        <label className="flex items-center gap-2 text-label-md text-on-surface-variant">
          <span className="material-symbols-outlined text-[20px]">switch_account</span>
          Demo user:
          <select value={activeId} onChange={(e) => switchUser(e.target.value)}
            className="bg-surface-container-lowest border border-outline-variant rounded-lg px-2 py-1 text-body-md focus:outline-none focus:border-primary">
            {users.map((u) => <option key={u.id} value={u.id}>{u.label || u.username}</option>)}
          </select>
        </label>
      </div>

      {error && <div className="card text-error mb-4">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        {/* LEFT — expert chat */}
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
              placeholder="Describe your situation…"
              className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-full px-4 py-2 text-body-md focus:outline-none focus:border-primary" />
            <button type="submit" disabled={input.trim().length < 1 || loading} className="btn-primary rounded-full disabled:opacity-40">Send</button>
          </form>
        </div>

        {/* RIGHT — criteria → reconcile → matches → group */}
        <aside className="space-y-4">
          {/* Criteria review */}
          <div className="card">
            <h2 className="text-label-md font-semibold text-on-surface mb-3">Your match criteria</h2>
            {!hasCriteria(draft) ? (
              <p className="text-body-md text-on-surface-variant">Chat on the left to build your criteria.</p>
            ) : (
              <div className="space-y-3">
                {CHIP_FIELDS.map(({ field, label }) => draft[field].length > 0 && (
                  <div key={field}>
                    <p className="text-caption text-on-surface-variant mb-1">{label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {draft[field].map((v) => (
                        <span key={v} className="inline-flex items-center gap-1 text-caption bg-primary-container text-on-primary-container px-2 py-0.5 rounded-full">
                          {v}
                          <button onClick={() => removeChip(field, v)} className="material-symbols-outlined text-[14px] hover:text-error" aria-label={`Remove ${v}`}>close</button>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                {(['key_stages_or_info', 'key_dates'] as const).map((field) => Object.keys(draft[field]).length > 0 && (
                  <div key={field}>
                    <p className="text-caption text-on-surface-variant mb-1">{field === 'key_dates' ? 'Key dates' : 'Status facts'}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(draft[field]).map(([k, v]) => (
                        <span key={k} className="inline-flex items-center gap-1 text-caption bg-surface-container text-on-surface-variant px-2 py-0.5 rounded-full">
                          {k.replace(/_/g, ' ')}: {v}
                          <button onClick={() => removeKV(field, k)} className="material-symbols-outlined text-[14px] hover:text-error" aria-label={`Remove ${k}`}>close</button>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                <button onClick={findMatches} disabled={matchLoading} className="btn-primary w-full disabled:opacity-50">
                  {matchLoading ? 'Finding…' : 'Find matches'}
                </button>
              </div>
            )}
          </div>

          {/* Reconcile: offer to update profile when criteria differ */}
          {conflicts.length > 0 && (
            <div className="card bg-tertiary-container/40 border border-outline-variant">
              <p className="text-body-md text-on-surface">{explainer || 'Some details differ from your saved profile.'}</p>
              <ul className="text-caption text-on-surface-variant mt-1 space-y-0.5">
                {conflicts.map((c) => (
                  <li key={c.field}>· {c.field.replace(/_/g, ' ').replace('.', ': ')} — profile: {String(c.profile_value)} → here: {String(c.message_value)}</li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2 mt-3">
                <button onClick={updateProfileAndContinue} className="btn-secondary text-label-md">Update my profile &amp; continue</button>
                <button onClick={() => { setConflicts([]); runMatches() }} className="btn-tertiary text-label-md">Use these criteria anyway</button>
              </div>
            </div>
          )}
          {profileUpdated && <p className="text-caption text-primary">Profile updated ✓</p>}

          {/* Matches */}
          {searched && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-label-md font-semibold text-on-surface">
                  {matches.length > 0 ? `${matches.length} match${matches.length === 1 ? '' : 'es'}` : 'No matches yet'}
                </h2>
                {matches.length > 0 && <span className="text-caption text-on-surface-variant">{selected.size} selected</span>}
              </div>
              {matches.length === 0 ? (
                <p className="text-body-md text-on-surface-variant">No one matches these criteria yet — try broadening them in the chat.</p>
              ) : (
                <div className="space-y-2">
                  {matches.map((m) => <MatchCard key={m.user_id} m={m} checked={selected.has(m.user_id)} onToggle={toggle} />)}
                  <button onClick={createGroup} disabled={selected.size === 0} className="btn-primary w-full mt-2 disabled:opacity-50">
                    Create group{selected.size > 0 ? ` (${selected.size})` : ''}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Group result */}
          {group && (
            <div className="card bg-secondary-container/40 border border-outline-variant">
              <p className="text-body-md text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">group</span>
                Group created with {group.members.length} member{group.members.length === 1 ? '' : 's'} ✓
              </p>
              <p className="text-caption text-on-surface-variant mt-1">{group.members.map((m) => m.username).join(', ')}</p>
              <p className="text-caption text-on-surface-variant mt-2">You&apos;ll be able to connect with this group in an upcoming release.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
