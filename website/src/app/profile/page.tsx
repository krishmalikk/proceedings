'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { getActiveUser, setActiveUser, userHeaders } from '@/lib/activeUser'

type KV = Record<string, string>
type JourneyEntry = { milestone: string; date: string; experience: string; shared: boolean; experience_case_id?: string }
type Profile = {
  username: string
  current_visa_or_greencard_category: string[]
  visa_applying_for: string[]
  primary_consulate: string
  consulates: string[]
  key_stages_or_info: KV
  key_dates: KV
  background_text: string
  journey: JourneyEntry[]
}
type ConsulateOption = { code: string; label: string }
type Vocab = { visa: string[]; consulate: string[]; consulate_options: ConsulateOption[]; tag: string[]; stage_key: string[]; date_key: string[] }
type SeedUser = { id: string; username: string; label?: string }

const EMPTY: Profile = {
  username: '', current_visa_or_greencard_category: [], visa_applying_for: [],
  primary_consulate: '', consulates: [], key_stages_or_info: {}, key_dates: {},
  background_text: '', journey: [],
}

const EMPTY_VOCAB: Vocab = { visa: [], consulate: [], consulate_options: [], tag: [], stage_key: [], date_key: [] }

// Common milestones for the journey editor's autocomplete. Free-form: anything
// the user types is slugified + accepted server-side (profile._clean_journey).
const MILESTONE_SUGGESTIONS = [
  'visa_interview', 'visa_stamping', 'port_of_entry', 'opt_start', 'stem_opt_extension',
  'h1b_filed', 'h1b_approval', 'perm_filed', 'perm_certified', 'i140_filed', 'i140_approval',
  'i485_filed', 'green_card_approval', 'naturalization',
]

type ListField = 'current_visa_or_greencard_category' | 'visa_applying_for' | 'consulates'
const LIST_SECTIONS: { field: ListField; label: string; vocab: 'visa' | 'consulate' }[] = [
  { field: 'current_visa_or_greencard_category', label: 'Current visa / green-card category', vocab: 'visa' },
  { field: 'visa_applying_for', label: 'Visa / category applying for', vocab: 'visa' },
  { field: 'consulates', label: 'Consulate(s)', vocab: 'consulate' },
]

function normalize(p: unknown): Profile {
  const o = (p && typeof p === 'object') ? p as Partial<Profile> : {}
  return {
    ...EMPTY,
    ...o,
    current_visa_or_greencard_category: Array.isArray(o.current_visa_or_greencard_category) ? o.current_visa_or_greencard_category : [],
    visa_applying_for: Array.isArray(o.visa_applying_for) ? o.visa_applying_for : [],
    consulates: Array.isArray(o.consulates) ? o.consulates : [],
    key_stages_or_info: (o.key_stages_or_info && typeof o.key_stages_or_info === 'object') ? o.key_stages_or_info as KV : {},
    key_dates: (o.key_dates && typeof o.key_dates === 'object') ? o.key_dates as KV : {},
    journey: Array.isArray(o.journey) ? o.journey.map((e) => ({
      milestone: e.milestone || '', date: e.date || '', experience: e.experience || '',
      shared: e.shared !== false, experience_case_id: e.experience_case_id || '',
    })) : [],
  }
}

export default function ProfilePage() {
  const [users, setUsers] = useState<SeedUser[]>([])
  const [activeId, setActiveId] = useState('')
  const [profile, setProfile] = useState<Profile>(EMPTY)
  const [vocab, setVocab] = useState<Vocab>(EMPTY_VOCAB)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // KV add inputs
  const [sKey, setSKey] = useState(''); const [sVal, setSVal] = useState('')
  const [dKey, setDKey] = useState(''); const [dVal, setDVal] = useState('')

  useEffect(() => {
    fetch('/api/users').then((r) => r.json()).then((list: unknown) => {
      const arr: SeedUser[] = Array.isArray(list) ? list : []
      setUsers(arr)
      const saved = getActiveUser()
      const id = saved && arr.some((u) => u.id === saved) ? saved : (arr[0]?.id || '')
      if (id) { setActiveUser(id); setActiveId(id) }
    }).catch(() => {})
    fetch('/api/tag-vocab').then((r) => r.json()).then((d) => setVocab({
      visa: d.visa || [], consulate: d.consulate || [], consulate_options: d.consulate_options || [],
      tag: d.tag || [], stage_key: d.stage_key || [], date_key: d.date_key || [],
    })).catch(() => {})
  }, [])

  useEffect(() => {
    if (!activeId) return
    setLoading(true); setError(''); setSaved(false)
    fetch('/api/profile', { headers: userHeaders() })
      .then((r) => r.json())
      .then((p) => setProfile(normalize(p)))
      .catch(() => setError('Could not load profile'))
      .finally(() => setLoading(false))
  }, [activeId])

  const vocabSets = useMemo(() => ({
    visa: new Set(vocab.visa), consulate: new Set(vocab.consulate),
    stage_key: new Set(vocab.stage_key), date_key: new Set(vocab.date_key),
  }), [vocab])
  const consulateByLabel = useMemo(() => new Map(vocab.consulate_options.map((o) => [o.label, o.code])), [vocab])
  const consulateByCode = useMemo(() => new Map(vocab.consulate_options.map((o) => [o.code, o.label])), [vocab])

  function switchUser(id: string) { setActiveUser(id); setActiveId(id) }

  function removeTag(field: ListField, value: string) {
    setSaved(false)
    setProfile((p) => ({ ...p, [field]: p[field].filter((t) => t !== value) }))
  }
  function addTag(field: ListField, kind: 'visa' | 'consulate', raw: string) {
    let value = raw.trim()
    if (!value) return
    if (kind === 'consulate' && consulateByLabel.has(value)) value = consulateByLabel.get(value) as string
    if (!vocabSets[kind].has(value)) {
      setError(kind === 'consulate' ? 'Pick a consulate from the list (e.g. "Mumbai, India (BOM)").' : `"${value}" is not a valid ${kind} value.`)
      return
    }
    setError(''); setSaved(false)
    setProfile((p) => (p[field].includes(value) ? p : { ...p, [field]: [...p[field], value] }))
  }

  function addStage() {
    const k = sKey.trim(), v = sVal.trim()
    if (!k || !v) return
    if (!vocabSets.stage_key.has(k)) { setError(`"${k}" is not a valid stage key.`); return }
    setError(''); setSaved(false); setProfile((p) => ({ ...p, key_stages_or_info: { ...p.key_stages_or_info, [k]: v } })); setSKey(''); setSVal('')
  }
  function addDate() {
    const k = dKey.trim(), v = dVal.trim()
    if (!k || !v) return
    if (!vocabSets.date_key.has(k)) { setError(`"${k}" is not a valid date key.`); return }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) { setError('Date must be YYYY-MM-DD.'); return }
    setError(''); setSaved(false); setProfile((p) => ({ ...p, key_dates: { ...p.key_dates, [k]: v } })); setDKey(''); setDVal('')
  }
  const removeStage = (k: string) => { setSaved(false); setProfile((p) => { const n = { ...p.key_stages_or_info }; delete n[k]; return { ...p, key_stages_or_info: n } }) }
  const removeDate = (k: string) => { setSaved(false); setProfile((p) => { const n = { ...p.key_dates }; delete n[k]; return { ...p, key_dates: n } }) }

  function updateEntry(i: number, patch: Partial<JourneyEntry>) {
    setSaved(false); setProfile((p) => ({ ...p, journey: p.journey.map((e, idx) => (idx === i ? { ...e, ...patch } : e)) }))
  }
  function addEntry() { setSaved(false); setProfile((p) => ({ ...p, journey: [...p.journey, { milestone: '', date: '', experience: '', shared: true }] })) }
  function removeEntry(i: number) { setSaved(false); setProfile((p) => ({ ...p, journey: p.journey.filter((_, idx) => idx !== i) })) }

  async function save() {
    setSaving(true); setError(''); setSaved(false)
    try {
      const primary = profile.consulates.includes(profile.primary_consulate) ? profile.primary_consulate : (profile.consulates[0] || '')
      const res = await fetch('/api/profile', {
        method: 'PUT', headers: userHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ ...profile, primary_consulate: primary }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Could not save profile')
      setProfile(normalize(data)); setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save profile')
    } finally { setSaving(false) }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="text-headline-md text-on-surface">Your profile</h1>
          <p className="text-body-md text-on-surface-variant mt-0.5">
            Review and edit your immigration details and tags. Prefer a guided setup?{' '}
            <Link href="/onboarding" className="text-primary hover:underline">Use the onboarding chat</Link>.
          </p>
        </div>
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
      {loading ? (
        <div className="card text-on-surface-variant">Loading profile…</div>
      ) : (
        <div className="space-y-5">
          {/* Username */}
          <section className="card">
            <label className="text-label-md text-on-surface font-medium">Display name</label>
            <input
              value={profile.username}
              onChange={(e) => { setSaved(false); setProfile((p) => ({ ...p, username: e.target.value })) }}
              placeholder="Your handle"
              className="mt-1 w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
            />
          </section>

          {/* Visa / status / consulates */}
          <section className="card space-y-4">
            <h2 className="text-title-md text-on-surface">Status &amp; consulates</h2>
            {LIST_SECTIONS.map((s) => {
              const values = profile[s.field]
              const listId = `vocab-${s.field}`
              return (
                <div key={s.field}>
                  <label className="text-label-md text-on-surface">{s.label}</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {values.length === 0 && <span className="text-caption text-on-surface-variant">None yet.</span>}
                    {values.map((v) => (
                      <span key={v} className="pill-active flex items-center gap-1">
                        {s.vocab === 'consulate' ? (consulateByCode.get(v) || v) : v}
                        <button onClick={() => removeTag(s.field, v)} aria-label={`Remove ${v}`} className="ml-0.5">
                          <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      </span>
                    ))}
                  </div>
                  <input
                    list={listId}
                    placeholder={s.vocab === 'consulate' ? 'Search by city or country…' : `Add ${s.label.toLowerCase()}…`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addTag(s.field, s.vocab, (e.target as HTMLInputElement).value)
                        ;(e.target as HTMLInputElement).value = ''
                      }
                    }}
                    className="mt-2 w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-body-md focus:outline-none focus:border-primary"
                  />
                  <datalist id={listId}>
                    {s.vocab === 'consulate'
                      ? vocab.consulate_options.map((o) => <option key={o.code} value={o.label} />)
                      : vocab.visa.map((v) => <option key={v} value={v} />)}
                  </datalist>
                </div>
              )
            })}
            <p className="text-caption text-on-surface-variant">The first consulate is used as your primary.</p>
          </section>

          {/* Key stages */}
          <section className="card">
            <h2 className="text-title-md text-on-surface mb-2">Key stages / status facts</h2>
            <div className="space-y-1">
              {Object.entries(profile.key_stages_or_info).map(([k, v]) => (
                <span key={k} className="pill-active flex items-center gap-1 w-fit">
                  {k}: {v}
                  <button onClick={() => removeStage(k)} aria-label={`Remove ${k}`} className="ml-0.5">
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <input list="stage-keys" value={sKey} onChange={(e) => setSKey(e.target.value)} placeholder="stage key"
                className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-body-md focus:outline-none focus:border-primary" />
              <input value={sVal} onChange={(e) => setSVal(e.target.value)} placeholder="value"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addStage() } }}
                className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-body-md focus:outline-none focus:border-primary" />
              <button onClick={addStage} className="btn-secondary text-label-md">Add</button>
            </div>
            <datalist id="stage-keys">{vocab.stage_key.map((v) => <option key={v} value={v} />)}</datalist>
          </section>

          {/* Key dates */}
          <section className="card">
            <h2 className="text-title-md text-on-surface mb-2">Key dates</h2>
            <div className="space-y-1">
              {Object.entries(profile.key_dates).map(([k, v]) => (
                <span key={k} className="pill-active flex items-center gap-1 w-fit">
                  {k}: {v}
                  <button onClick={() => removeDate(k)} aria-label={`Remove ${k}`} className="ml-0.5">
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <input list="date-keys" value={dKey} onChange={(e) => setDKey(e.target.value)} placeholder="date key"
                className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-body-md focus:outline-none focus:border-primary" />
              <input type="date" value={dVal} onChange={(e) => setDVal(e.target.value)}
                className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-body-md focus:outline-none focus:border-primary" />
              <button onClick={addDate} className="btn-secondary text-label-md">Add</button>
            </div>
            <datalist id="date-keys">{vocab.date_key.map((v) => <option key={v} value={v} />)}</datalist>
          </section>

          {/* Background */}
          <section className="card">
            <h2 className="text-title-md text-on-surface mb-2">Background</h2>
            <textarea
              value={profile.background_text}
              onChange={(e) => { setSaved(false); setProfile((p) => ({ ...p, background_text: e.target.value })) }}
              maxLength={2000} rows={4}
              placeholder="A short summary of your situation (no personal identifiers — emails/phones/A-numbers are auto-removed)."
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary resize-y"
            />
            <p className="text-caption text-on-surface-variant mt-1">{profile.background_text.length}/2000</p>
          </section>

          {/* Journey / experiences */}
          <section className="card">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-title-md text-on-surface">Experiences</h2>
              <button onClick={addEntry} className="btn-secondary text-label-md flex items-center gap-1">
                <span className="material-symbols-outlined text-[18px]">add</span> Add experience
              </button>
            </div>
            {profile.journey.length === 0 && <p className="text-caption text-on-surface-variant">No experiences yet. Add one to share your timeline.</p>}
            <div className="space-y-3">
              {profile.journey.map((e, i) => (
                <div key={i} className="border border-outline-variant rounded-lg p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <input list="milestones" value={e.milestone} onChange={(ev) => updateEntry(i, { milestone: ev.target.value })}
                      placeholder="milestone (e.g. visa_interview)"
                      className="flex-1 min-w-[12rem] bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-body-md focus:outline-none focus:border-primary" />
                    <input type="date" value={e.date} onChange={(ev) => updateEntry(i, { date: ev.target.value })}
                      className="bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-body-md focus:outline-none focus:border-primary" />
                    <button onClick={() => removeEntry(i)} aria-label="Delete experience" className="p-1 text-on-surface-variant hover:text-error">
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                  </div>
                  <textarea value={e.experience} onChange={(ev) => updateEntry(i, { experience: ev.target.value })}
                    maxLength={4000} rows={3} placeholder="Describe what happened…"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary resize-y" />
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="flex items-center gap-2 text-label-md text-on-surface-variant">
                      <input type="checkbox" checked={e.shared} onChange={(ev) => updateEntry(i, { shared: ev.target.checked })} />
                      Share publicly (searchable by others)
                    </label>
                    {e.experience_case_id
                      ? <span className="badge-success text-caption">Published</span>
                      : (e.shared ? <span className="text-caption text-on-surface-variant">Will publish on save</span> : null)}
                  </div>
                </div>
              ))}
            </div>
            <datalist id="milestones">{MILESTONE_SUGGESTIONS.map((m) => <option key={m} value={m} />)}</datalist>
          </section>

          {/* Save bar */}
          <div className="sticky bottom-0 bg-surface/95 backdrop-blur border-t border-outline-variant py-3 flex items-center gap-3">
            <button onClick={save} disabled={saving || !activeId} className="btn-primary disabled:opacity-40">
              {saving ? 'Saving…' : 'Save profile'}
            </button>
            {saved && <span className="text-label-md text-primary flex items-center gap-1"><span className="material-symbols-outlined text-[18px]">check_circle</span> Saved</span>}
            <p className="text-caption text-on-surface-variant ml-auto">
              Tags are validated against the controlled vocabulary; invalid values are dropped and dates normalized on save.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
