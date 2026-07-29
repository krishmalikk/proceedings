'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Markdown from '@/components/Markdown'
import MatchCard, { MatchData } from '@/components/MatchCard'
import { useAuth } from '@/contexts/AuthContext'
import { getActiveUser, setActiveUser, userHeaders, DEMO_PICKER_ENABLED } from '@/lib/activeUser'
import { useRequireUser } from '@/lib/useRequireUser'

type Criteria = {
  current_visa_or_greencard_category: string[]
  visa_applying_for: string[]
  primary_consulate: string
  consulates: string[]
  key_stages_or_info: Record<string, string>
  key_dates: Record<string, string>
  background_text: string
}
type ConsulateOption = { code: string; label: string }
type Vocab = {
  visa: string[]; consulate: string[]; consulate_options: ConsulateOption[]
  profile_stage_key: string[]; date_key: string[]; outcome: string[]; country: string[]
  stage_value_domains: Record<string, string>
}
const EMPTY_VOCAB: Vocab = {
  visa: [], consulate: [], consulate_options: [], profile_stage_key: [],
  date_key: [], outcome: [], country: [], stage_value_domains: {},
}
type ChipField = 'current_visa_or_greencard_category' | 'visa_applying_for' | 'consulates'
type SeedUser = { id: string; username: string; label?: string }
type Turn = { id: string; role: 'user' | 'ai'; content: string }
type Conflict = { field: string; profile_value: unknown; message_value: unknown }
type GroupResult = { group_id: string; name: string; joined: boolean; members: { username: string }[] }
type BrowseGroup = { group_id: string; name: string; criteria_text: string; members: { user_id: string; username: string }[]; is_member: boolean }

const EMPTY: Criteria = {
  current_visa_or_greencard_category: [], visa_applying_for: [], primary_consulate: '',
  consulates: [], key_stages_or_info: {}, key_dates: {}, background_text: '',
}

const GREETING =
  "Hi! I'll help you find others **in the same boat** — applicants in a similar immigration situation. " +
  "Tell me about your situation: your current status (or what you're applying for), the consulate involved, " +
  "and the key dates that place you in line. I'll turn it into match criteria.\n\n" +
  "(Please don't share personal details like your name, date of birth, or passport number.)"

const CHIP_FIELDS: { field: ChipField; label: string; kind: 'visa' | 'consulate' }[] = [
  { field: 'current_visa_or_greencard_category', label: 'Current status', kind: 'visa' },
  { field: 'visa_applying_for', label: 'Applying for', kind: 'visa' },
  { field: 'consulates', label: 'Consulate(s)', kind: 'consulate' },
]

function hasCriteria(c: Criteria): boolean {
  return (
    c.current_visa_or_greencard_category.length > 0 || c.visa_applying_for.length > 0 ||
    c.consulates.length > 0 || Object.keys(c.key_stages_or_info).length > 0 || Object.keys(c.key_dates).length > 0
  )
}

export default function FindPage() {
  const router = useRouter()
  const { user: authUser } = useAuth()
  useRequireUser()
  const [users, setUsers] = useState<SeedUser[]>([])
  const [activeId, setActiveId] = useState('')
  const [tab, setTab] = useState<'find' | 'browse'>('browse')  // land on existing groups
  const [draft, setDraft] = useState<Criteria>(EMPTY)
  const [vocab, setVocab] = useState<Vocab>(EMPTY_VOCAB)
  const [sKey, setSKey] = useState(''); const [sVal, setSVal] = useState('')
  const [dKey, setDKey] = useState(''); const [dVal, setDVal] = useState('')
  const [messages, setMessages] = useState<Turn[]>([{ id: 'greet', role: 'ai', content: GREETING }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // reconcile (validate criteria vs profile) — two-step offer
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [explainer, setExplainer] = useState('')
  const [merged, setMerged] = useState<Criteria | null>(null)
  const [showUpdateOffer, setShowUpdateOffer] = useState(false)
  const [showMergeOffer, setShowMergeOffer] = useState(false)
  const [profileUpdated, setProfileUpdated] = useState(false)

  // matches + group
  const [matches, setMatches] = useState<MatchData[]>([])
  const [searched, setSearched] = useState(false)
  const [matchLoading, setMatchLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [group, setGroup] = useState<GroupResult | null>(null)

  // browse
  const [allGroups, setAllGroups] = useState<BrowseGroup[]>([])
  const [browseLoading, setBrowseLoading] = useState(false)

  const threadRef = useRef<HTMLDivElement>(null)

  // Anonymized handle for the "Signed in as" identity line — never the real
  // Firebase displayName/email (same pattern as TopAppBar.tsx).
  const [handle, setHandle] = useState('')
  useEffect(() => {
    if (!authUser) { setHandle(''); return }
    fetch('/api/profile', { headers: userHeaders() })
      .then((r) => r.json())
      .then((p: { username?: string }) => setHandle(p.username || ''))
      .catch(() => setHandle(''))
  }, [authUser])

  useEffect(() => {
    // Dev-only demo-user picker (off in prod — see DEMO_PICKER_ENABLED).
    if (DEMO_PICKER_ENABLED) {
      fetch('/api/users').then((r) => r.json()).then((list: unknown) => {
        // Defensive: a backend/proxy error returns an object ({detail:…}), not an
        // array. Never feed a non-array to setUsers — users.map() in render would
        // throw a client-side exception (white-screen) instead of degrading.
        const arr: SeedUser[] = Array.isArray(list) ? list : []
        setUsers(arr)
        const saved = getActiveUser()
        const id = saved && arr.some((u) => u.id === saved) ? saved : (arr[0]?.id || '')
        if (id) { setActiveUser(id); setActiveId(id) }
      }).catch(() => {})
    }
    fetch('/api/tag-vocab').then((r) => r.json()).then((d) => setVocab({
      visa: d.visa || [], consulate: d.consulate || [], consulate_options: d.consulate_options || [],
      profile_stage_key: d.profile_stage_key || [], date_key: d.date_key || [],
      outcome: d.outcome || [], country: d.country || [], stage_value_domains: d.stage_value_domains || {},
    })).catch(() => {})
  }, [])

  useEffect(() => { if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight }, [messages, loading])

  const vocabSets = useMemo(() => ({
    visa: new Set(vocab.visa), consulate: new Set(vocab.consulate),
    profile_stage_key: new Set(vocab.profile_stage_key), date_key: new Set(vocab.date_key),
    outcome: new Set(vocab.outcome), country: new Set(vocab.country),
  }), [vocab])
  const consulateByLabel = useMemo(() => new Map(vocab.consulate_options.map((o) => [o.label, o.code])), [vocab])
  const consulateByCode = useMemo(() => new Map(vocab.consulate_options.map((o) => [o.code, o.label])), [vocab])
  const stageDomain = vocab.stage_value_domains[sKey.trim()] || ''
  function stageValueOk(domain: string, v: string): boolean {
    if (domain === 'country') return vocabSets.country.has(v)
    if (domain === 'consulate') return vocabSets.consulate.has(v)
    if (domain === 'visa') return vocabSets.visa.has(v)
    if (domain === 'outcome') return vocabSets.outcome.has(v)
    return true
  }

  function resetFlow() {
    setConflicts([]); setExplainer(''); setMerged(null)
    setShowUpdateOffer(false); setShowMergeOffer(false); setProfileUpdated(false)
    setMatches([]); setSearched(false); setSelected(new Set()); setGroup(null)
  }
  function switchUser(id: string) {
    setActiveUser(id); setActiveId(id); setDraft(EMPTY)
    setMessages([{ id: 'greet', role: 'ai', content: GREETING }]); resetFlow()
  }

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

  function removeChip(field: ChipField, value: string) {
    setDraft((d) => ({ ...d, [field]: d[field].filter((v) => v !== value) }))
  }
  function removeKV(field: 'key_stages_or_info' | 'key_dates', key: string) {
    setDraft((d) => { const n = { ...d[field] }; delete n[key]; return { ...d, [field]: n } })
  }
  // --- manual criteria editing (chips + controlled-vocab dropdowns) ---
  function addChip(field: ChipField, kind: 'visa' | 'consulate', raw: string) {
    let value = raw.trim(); if (!value) return
    if (kind === 'consulate' && consulateByLabel.has(value)) value = consulateByLabel.get(value) as string
    if (!vocabSets[kind].has(value)) {
      setError(kind === 'consulate' ? 'Pick a consulate from the list (e.g. "Mumbai, India (BOM)").' : `"${value}" is not a valid ${kind} — pick one from the list.`)
      return
    }
    setError('')
    setDraft((d) => (d[field].includes(value) ? d : { ...d, [field]: [...d[field], value] }))
  }
  function addStage() {
    const k = sKey.trim(); let v = sVal.trim(); if (!k || !v) return
    if (!vocabSets.profile_stage_key.has(k)) { setError(`"${k}" is not a valid stage key — pick one from the list.`); return }
    const domain = vocab.stage_value_domains[k]
    if (domain === 'consulate' && consulateByLabel.has(v)) v = consulateByLabel.get(v) as string
    if (domain && !stageValueOk(domain, v)) { setError(`"${v}" is not a valid value for "${k}" — pick from the ${domain} list.`); return }
    setError(''); setDraft((d) => ({ ...d, key_stages_or_info: { ...d.key_stages_or_info, [k]: v } })); setSKey(''); setSVal('')
  }
  function addDate() {
    const k = dKey.trim(), v = dVal.trim(); if (!k || !v) return
    if (!vocabSets.date_key.has(k)) { setError(`"${k}" is not a valid date key — pick one from the list.`); return }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) { setError('Date must be YYYY-MM-DD.'); return }
    setError(''); setDraft((d) => ({ ...d, key_dates: { ...d.key_dates, [k]: v } })); setDKey(''); setDVal('')
  }

  // Fetch matches with a given criteria, then surface the ranked candidates.
  const runMatches = useCallback(async (criteria: Criteria) => {
    setMatchLoading(true); setError('')
    try {
      const res = await fetch('/api/find/matches', {
        method: 'POST', headers: userHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ criteria }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Could not find matches')
      setMatches(data.matches || []); setSearched(true); setSelected(new Set()); setGroup(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not find matches')
    } finally { setMatchLoading(false) }
  }, [])

  // Step 1: validate the criteria against the saved profile. On discrepancies,
  // offer to update the profile (step 2a) → then, if declined, offer to fold the
  // profile context into the search (step 2b). Otherwise match straight away.
  async function findMatches() {
    resetFlow()
    try {
      const rr = await fetch('/api/reconcile', {
        method: 'POST', headers: userHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ message: draft }),
      })
      if (rr.ok) {
        const rd = await rr.json()
        if ((rd.conflicts || []).length > 0) {
          setConflicts(rd.conflicts); setExplainer(rd.explainer || '')
          setMerged({ ...EMPTY, ...(rd.merged || {}) })
          setShowUpdateOffer(true)
          return
        }
      }
    } catch { /* reconcile is best-effort */ }
    await runMatches(draft)
  }

  // 2a — accept the profile update, then match on the entered criteria.
  async function acceptUpdate() {
    try {
      const cur = await fetch('/api/profile', { headers: userHeaders() }).then((r) => r.json())
      const next: Record<string, unknown> = { ...cur }
      for (const c of conflicts) {
        if (c.field.includes('.')) {
          const [mapF, key] = c.field.split('.')
          next[mapF] = { ...((next[mapF] as Record<string, unknown>) || {}), [key]: c.message_value }
        } else { next[c.field] = c.message_value }
      }
      const res = await fetch('/api/profile', {
        method: 'PUT', headers: userHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(next),
      })
      if (res.ok) setProfileUpdated(true)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not update profile') }
    setShowUpdateOffer(false); setConflicts([])
    await runMatches(draft)
  }

  // 2b — accept folding the profile context into the criteria → match on merged tags.
  function acceptMerge() {
    const eff = merged || draft
    setDraft(eff); setShowMergeOffer(false)
    runMatches(eff)
  }

  function toggle(userId: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(userId) ? n.delete(userId) : n.add(userId); return n })
  }

  async function createGroup() {
    const members = matches.filter((m) => selected.has(m.user_id)).map((m) => ({ user_id: m.user_id, username: m.username }))
    setError('')
    try {
      const res = await fetch('/api/groups', {
        method: 'POST', headers: userHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ criteria_text: draft.background_text || '', criteria: draft, members }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Could not create group')
      setGroup(data)
      if (data.group_id) router.push(`/groups/${encodeURIComponent(data.group_id)}`)  // open chat
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create group') }
  }

  // --- browse ---
  const loadAllGroups = useCallback(async () => {
    setBrowseLoading(true); setError('')
    try {
      const res = await fetch('/api/groups/all', { headers: userHeaders() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Could not load groups')
      setAllGroups(data.groups || [])
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load groups') }
    finally { setBrowseLoading(false) }
  }, [])

  useEffect(() => { if (tab === 'browse' && activeId) loadAllGroups() }, [tab, activeId, loadAllGroups])

  async function joinGroup(id: string) {
    try {
      const res = await fetch(`/api/groups/${encodeURIComponent(id)}/join`, {
        method: 'POST', headers: userHeaders({ 'Content-Type': 'application/json' }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || 'Could not join') }
      await loadAllGroups()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not join') }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h1 className="text-headline-md text-on-surface">Find users in the same boat</h1>
        {authUser ? (
          /* Firebase-authenticated — the demo picker is inert (the uid wins), so show
             identity instead. Never the real Firebase displayName/email — `handle` is
             the anonymized handle (same pattern as TopAppBar.tsx). */
          <span className="flex items-center gap-2 text-label-md text-on-surface-variant">
            <span className="material-symbols-outlined text-[20px]">account_circle</span>
            Signed in as {handle || 'Anonymous'}
          </span>
        ) : DEMO_PICKER_ENABLED ? (
          <label className="flex items-center gap-2 text-label-md text-on-surface-variant">
            <span className="material-symbols-outlined text-[20px]">switch_account</span>
            Demo user:
            <select value={activeId} onChange={(e) => switchUser(e.target.value)}
              className="bg-surface-container-lowest border border-outline-variant rounded-lg px-2 py-1 text-body-md focus:outline-none focus:border-primary">
              {users.map((u) => <option key={u.id} value={u.id}>{u.label || u.username}</option>)}
            </select>
          </label>
        ) : null}
      </div>

      {/* tabs — the groups list is the landing view */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setTab('browse')} className={`pill ${tab === 'browse' ? 'pill-active' : ''}`}>Groups</button>
        <button onClick={() => setTab('find')} className={`pill ${tab === 'find' ? 'pill-active' : ''}`}>Find / create group</button>
      </div>

      {error && <div className="card text-error mb-4">{error}</div>}

      {tab === 'find' ? (
        <div className="grid gap-6 lg:grid-cols-2 items-start">
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
            <div className="card space-y-3">
              <h2 className="text-label-md font-semibold text-on-surface">Your match criteria</h2>
              <p className="text-caption text-on-surface-variant">Chat on the left, or add / remove tags directly below.</p>

              {CHIP_FIELDS.map((s) => {
                const values = draft[s.field]
                const listId = `fc-${s.kind}`
                return (
                  <div key={s.field}>
                    <p className="text-caption uppercase tracking-wide text-on-surface-variant mb-1">{s.label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {values.length === 0 && <span className="text-caption text-on-surface-variant">None.</span>}
                      {values.map((v) => (
                        <span key={v} className="inline-flex items-center gap-1 text-caption bg-primary-container text-on-primary-container px-2 py-0.5 rounded-full">
                          {s.kind === 'consulate' ? (consulateByCode.get(v) || v) : v}
                          <button onClick={() => removeChip(s.field, v)} className="material-symbols-outlined text-[14px] hover:text-error" aria-label={`Remove ${v}`}>close</button>
                        </span>
                      ))}
                    </div>
                    <input list={listId}
                      placeholder={s.kind === 'consulate' ? 'Add a consulate (city/country)…' : `Add ${s.label.toLowerCase()}…`}
                      onChange={(e) => {
                        const val = e.target.value
                        const valid = s.kind === 'consulate' ? consulateByLabel.has(val) : vocabSets[s.kind].has(val)
                        if (valid) { addChip(s.field, s.kind, val); e.target.value = '' }
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChip(s.field, s.kind, (e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = '' } }}
                      className="mt-1 w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-body-md focus:outline-none focus:border-primary" />
                  </div>
                )
              })}
              <datalist id="fc-visa">{vocab.visa.map((v) => <option key={v} value={v} />)}</datalist>
              <datalist id="fc-consulate">{vocab.consulate_options.map((o) => <option key={o.code} value={o.label} />)}</datalist>

              {/* Status facts (key stages) */}
              <div>
                <p className="text-caption uppercase tracking-wide text-on-surface-variant mb-1">Status facts</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.keys(draft.key_stages_or_info).length === 0 && <span className="text-caption text-on-surface-variant">None.</span>}
                  {Object.entries(draft.key_stages_or_info).map(([k, v]) => (
                    <span key={k} className="inline-flex items-center gap-1 text-caption bg-surface-container text-on-surface-variant px-2 py-0.5 rounded-full">
                      {k.replace(/_/g, ' ')}: {v}
                      <button onClick={() => removeKV('key_stages_or_info', k)} className="material-symbols-outlined text-[14px] hover:text-error" aria-label={`Remove ${k}`}>close</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2 mt-1">
                  <input list="fc-stage-keys" value={sKey} onChange={(e) => { setSKey(e.target.value); setSVal('') }} placeholder="stage key"
                    className="flex-1 min-w-0 bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-body-md focus:outline-none focus:border-primary" />
                  <input list={stageDomain ? `fc-sv-${stageDomain}` : undefined} value={sVal} onChange={(e) => setSVal(e.target.value)}
                    placeholder={stageDomain ? `${stageDomain} value…` : 'value'}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addStage() } }}
                    className="flex-1 min-w-0 bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-body-md focus:outline-none focus:border-primary" />
                  <button onClick={addStage} className="btn-secondary text-label-md">Add</button>
                </div>
                <datalist id="fc-stage-keys">{vocab.profile_stage_key.map((v) => <option key={v} value={v} />)}</datalist>
                <datalist id="fc-sv-country">{vocab.country.map((v) => <option key={v} value={v} />)}</datalist>
                <datalist id="fc-sv-outcome">{vocab.outcome.map((v) => <option key={v} value={v} />)}</datalist>
                <datalist id="fc-sv-visa">{vocab.visa.map((v) => <option key={v} value={v} />)}</datalist>
                <datalist id="fc-sv-consulate">{vocab.consulate_options.map((o) => <option key={o.code} value={o.label} />)}</datalist>
              </div>

              {/* Key dates */}
              <div>
                <p className="text-caption uppercase tracking-wide text-on-surface-variant mb-1">Key dates</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.keys(draft.key_dates).length === 0 && <span className="text-caption text-on-surface-variant">None.</span>}
                  {Object.entries(draft.key_dates).map(([k, v]) => (
                    <span key={k} className="inline-flex items-center gap-1 text-caption bg-surface-container text-on-surface-variant px-2 py-0.5 rounded-full">
                      {k.replace(/_/g, ' ')}: {v}
                      <button onClick={() => removeKV('key_dates', k)} className="material-symbols-outlined text-[14px] hover:text-error" aria-label={`Remove ${k}`}>close</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2 mt-1">
                  <input list="fc-date-keys" value={dKey} onChange={(e) => setDKey(e.target.value)} placeholder="date key"
                    className="flex-1 min-w-0 bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-body-md focus:outline-none focus:border-primary" />
                  <input type="date" value={dVal} onChange={(e) => setDVal(e.target.value)}
                    className="flex-1 min-w-0 bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-body-md focus:outline-none focus:border-primary" />
                  <button onClick={addDate} className="btn-secondary text-label-md">Add</button>
                </div>
                <datalist id="fc-date-keys">{vocab.date_key.map((v) => <option key={v} value={v} />)}</datalist>
              </div>

              <button onClick={findMatches} disabled={matchLoading || !hasCriteria(draft)} className="btn-primary w-full disabled:opacity-50">
                {matchLoading ? 'Finding…' : 'Find matches'}
              </button>
            </div>

            {/* 2a — offer to update the profile */}
            {showUpdateOffer && (
              <div className="card bg-tertiary-container/40 border border-outline-variant">
                <p className="text-body-md text-on-surface">{explainer || 'Some details differ from your saved profile.'}</p>
                <ul className="text-caption text-on-surface-variant mt-1 space-y-0.5">
                  {conflicts.map((c) => (
                    <li key={c.field}>· {c.field.replace(/_/g, ' ').replace('.', ': ')} — profile: {String(c.profile_value)} → here: {String(c.message_value)}</li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button onClick={acceptUpdate} className="btn-secondary text-label-md">Update my profile &amp; continue</button>
                  <button onClick={() => { setShowUpdateOffer(false); setShowMergeOffer(true) }} className="btn-tertiary text-label-md">Don&apos;t update</button>
                </div>
              </div>
            )}

            {/* 2b — offer to fold the profile context into the search */}
            {showMergeOffer && (
              <div className="card bg-tertiary-container/40 border border-outline-variant">
                <p className="text-body-md text-on-surface">Also include your saved profile context in the search, so matches reflect your full situation?</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button onClick={acceptMerge} className="btn-secondary text-label-md">Yes, include my profile</button>
                  <button onClick={() => { setShowMergeOffer(false); runMatches(draft) }} className="btn-tertiary text-label-md">No, just these criteria</button>
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
                    <button onClick={createGroup} className="btn-primary w-full mt-2">
                      Create group and open chat{selected.size > 0 ? ` (+${selected.size})` : ''}
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
                  {group.joined ? 'Joined existing group' : 'Group created'}: <span className="font-semibold">{group.name}</span>
                </p>
                <p className="text-caption text-on-surface-variant mt-1">{group.members.length} member{group.members.length === 1 ? '' : 's'}: {group.members.map((m) => m.username).join(', ')}</p>
                <Link href={`/groups/${encodeURIComponent(group.group_id)}`} className="btn-secondary text-label-md mt-3 inline-flex items-center gap-1">
                  <span className="material-symbols-outlined text-[18px]">chat</span> Open chat
                </Link>
              </div>
            )}
          </aside>
        </div>
      ) : (
        /* GROUPS (landing) — your joined groups first, plus a create-your-group CTA */
        <div className="grid gap-6 lg:grid-cols-2 items-start">
          <div className="space-y-3">
            <h2 className="text-label-md font-semibold text-on-surface">Your groups</h2>
            {browseLoading ? (
              <div className="card text-on-surface-variant">Loading groups…</div>
            ) : allGroups.filter((g) => g.is_member).length === 0 ? (
              <div className="card text-on-surface-variant">You haven&apos;t joined any group yet — create or find one with the panel on the right.</div>
            ) : (
              allGroups.filter((g) => g.is_member).map((g) => (
                  <div key={g.group_id} className={`card flex items-start justify-between gap-4 ${g.is_member ? 'border border-primary/40' : ''}`}>
                    <div className="min-w-0">
                      <p className="text-label-md font-semibold text-on-surface flex items-center gap-1.5">
                        {g.is_member && <span className="material-symbols-outlined text-[16px] text-primary">check_circle</span>}
                        {g.name}
                      </p>
                      {g.criteria_text && <p className="text-caption text-on-surface-variant mt-0.5">{g.criteria_text}</p>}
                      <p className="text-caption text-on-surface-variant mt-1">
                        {g.members.length} member{g.members.length === 1 ? '' : 's'}: {g.members.map((m) => m.username).join(', ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {g.is_member ? (
                        <span className="text-label-md text-secondary whitespace-nowrap flex items-center gap-1">
                          <span className="material-symbols-outlined text-[18px]">check</span>Joined
                        </span>
                      ) : (
                        <button onClick={() => joinGroup(g.group_id)} className="btn-secondary text-label-md whitespace-nowrap">Join</button>
                      )}
                      {g.is_member && (
                        <Link href={`/groups/${encodeURIComponent(g.group_id)}`} className="btn-primary text-label-md whitespace-nowrap inline-flex items-center gap-1">
                          <span className="material-symbols-outlined text-[18px]">chat</span> Open
                        </Link>
                      )}
                    </div>
                  </div>
                ))
            )}
          </div>

          {/* RIGHT — create-your-group CTA (uses the Find-matches flow) */}
          <aside>
            <div className="card text-center">
              <span className="material-symbols-outlined text-[40px] text-secondary">group_add</span>
              <p className="text-body-lg text-on-surface mt-2 font-medium">Did not find a group you are looking for?</p>
              <p className="text-body-md text-on-surface-variant mt-1 mb-4">
                Describe your situation and we&apos;ll find others in the same boat — then form a group.
              </p>
              <button onClick={() => setTab('find')} className="btn-primary w-full">Create your group</button>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
