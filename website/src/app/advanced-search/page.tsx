'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import PostingCard, { type PostingCardData } from '@/components/PostingCard'
import { facetId } from '@/components/SuggestedFilters'
import TagAutocomplete from '@/components/TagAutocomplete'
import StrictnessSlider, { useStrictness } from '@/components/StrictnessSlider'

type TagField = 'current_visa_or_greencard_category' | 'visa_applying_for' | 'consulates' | 'tags'
type Tag = { field: TagField; code: string; label: string }
type ConsulateOption = { code: string; label: string }
type Vocab = {
  visa: string[]
  consulate: string[]
  consulate_options: ConsulateOption[]
  tag: string[]
}
const EMPTY_VOCAB: Vocab = { visa: [], consulate: [], consulate_options: [], tag: [] }

const CATEGORY_FIELDS: { field: TagField; label: string; kind: 'visa' | 'consulate' | 'tag' }[] = [
  { field: 'current_visa_or_greencard_category', label: 'Current status', kind: 'visa' },
  { field: 'visa_applying_for', label: 'Applying for', kind: 'visa' },
  { field: 'consulates', label: 'Consulate(s)', kind: 'consulate' },
  { field: 'tags', label: 'Tags', kind: 'tag' },
]

export default function AdvancedSearchPage() {
  const [freeText, setFreeText] = useState('')
  const [tags, setTags] = useState<Tag[]>([])
  const [strictness, setStrictness] = useStrictness()
  const [revealedFields, setRevealedFields] = useState<Set<TagField>>(new Set())
  const [vocab, setVocab] = useState<Vocab>(EMPTY_VOCAB)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  // results — mirrors UnifiedSearch.tsx's MIDDLE panel state
  const [results, setResults] = useState<PostingCardData[]>([])
  const [total, setTotal] = useState(0)
  const [nextPageToken, setNextPageToken] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    fetch('/api/tag-vocab').then((r) => r.json()).then((d) => setVocab({
      visa: d.visa || [], consulate: d.consulate || [],
      consulate_options: d.consulate_options || [], tag: d.tag || [],
    })).catch(() => {})
  }, [])

  const consulateByLabel = useMemo(() => new Map(vocab.consulate_options.map((o) => [o.label, o.code])), [vocab])
  const consulateByCode = useMemo(() => new Map(vocab.consulate_options.map((o) => [o.code, o.label])), [vocab])

  function tagsFor(field: TagField): Tag[] {
    return tags.filter((t) => t.field === field)
  }
  function isShown(field: TagField): boolean {
    return revealedFields.has(field) || tags.some((t) => t.field === field)
  }
  function reveal(field: TagField) {
    setRevealedFields((prev) => new Set(prev).add(field))
  }

  // A category that's ever held a tag (generated or manual) stays visible
  // even after its last tag is removed — avoids layout/focus jumping while
  // the user is actively editing it. No separate "invalid value" validation
  // path is needed here — TagAutocomplete only ever offers suggestions
  // filtered from the fetched vocab list itself, so every pickable value is
  // valid by construction (mirrors mobile's TagPicker).
  function addTag(field: TagField, code: string) {
    reveal(field)
    setTags((prev) => (prev.some((t) => t.field === field && t.code === code) ? prev : [...prev, { field, code, label: code }]))
  }
  function removeTag(field: TagField, code: string) {
    setTags((prev) => prev.filter((t) => !(t.field === field && t.code === code)))
  }

  // "Send" — generate tags from free text (additive: never drops what's
  // already on screen, including manually-added tags or a prior Send).
  async function send() {
    const t = freeText.trim()
    if (t.length < 1 || generating) return
    setGenerating(true); setError('')
    try {
      const res = await fetch('/api/search/query-tags', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: t }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Could not generate tags')
      const generated: Tag[] = data.tags || []
      setRevealedFields((prev) => {
        const next = new Set(prev)
        generated.forEach((g) => next.add(g.field))
        return next
      })
      setTags((prev) => {
        const next = [...prev]
        for (const g of generated) {
          if (!next.some((t2) => t2.field === g.field && t2.code === g.code)) next.push(g)
        }
        return next
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate tags')
    } finally {
      setGenerating(false)
    }
  }

  // "Search" — runs the same /api/search mechanism as Home search, results
  // render inline on this page (no navigation).
  const runSearch = useCallback(async (q: string, tagList: Tag[], pageToken: string) => {
    if (pageToken) setLoadingMore(true); else setSearchLoading(true)
    setError('')
    try {
      const p = new URLSearchParams()
      p.set('q', q || 'immigration visa experience')
      tagList.forEach((t) => p.append('facet', facetId(t.field, t.code)))
      p.set('strictness', strictness)
      p.set('page_size', '15')
      p.set('sort', 'event')
      if (pageToken) p.set('page_token', pageToken)
      const res = await fetch(`/api/search?${p.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Search failed')
      setResults((prev) => (pageToken ? [...prev, ...(data.results || [])] : data.results || []))
      setTotal(data.total || 0)
      setNextPageToken(data.next_page_token || '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setSearchLoading(false); setLoadingMore(false); setSearched(true)
    }
  }, [strictness])

  function loadMore() {
    if (!nextPageToken || loadingMore) return
    runSearch(freeText, tags, nextPageToken)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <Link href="/" className="inline-flex items-center gap-1 text-label-md text-on-surface-variant hover:text-primary mb-4 transition-colors">
        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        Back to search
      </Link>
      <h1 className="text-headline-md text-on-surface mb-4">Advanced Search</h1>

      {error && <div className="card text-error mb-4">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        {/* LEFT — free text */}
        <div className="bg-surface-container-low rounded-xl p-4 flex flex-col">
          <label className="text-label-md font-semibold text-on-surface mb-2">Describe what you&apos;re looking for</label>
          <textarea value={freeText} onChange={(e) => setFreeText(e.target.value)}
            placeholder="e.g. H-1B RFE experiences at the Mumbai consulate…"
            rows={6}
            className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary resize-none" />
          <button onClick={send} disabled={generating || freeText.trim().length < 1} className="btn-primary mt-3 self-start disabled:opacity-50">
            {generating ? 'Generating…' : 'Send'}
          </button>
        </div>

        {/* RIGHT — generated + editable tags */}
        <div className="card space-y-3">
          <h2 className="text-label-md font-semibold text-on-surface">Search tags</h2>
          {tags.length === 0 && revealedFields.size === 0 && (
            <p className="text-caption text-on-surface-variant">Click Send to generate tags from your text, or add one manually below.</p>
          )}

          {CATEGORY_FIELDS.filter((c) => isShown(c.field)).map((c) => {
            const values = tagsFor(c.field)
            const options = c.kind === 'visa' ? vocab.visa
              : c.kind === 'consulate' ? vocab.consulate_options.map((o) => o.label)
                : vocab.tag
            return (
              <div key={c.field}>
                <p className="text-caption uppercase tracking-wide text-on-surface-variant mb-1">{c.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {values.length === 0 && <span className="text-caption text-on-surface-variant">None.</span>}
                  {values.map((t) => (
                    <span key={t.code} className="inline-flex items-center gap-1 text-caption bg-primary-container text-on-primary-container px-2 py-0.5 rounded-full">
                      {c.kind === 'consulate' ? (consulateByCode.get(t.code) || t.code) : t.code}
                      <button onClick={() => removeTag(c.field, t.code)} className="material-symbols-outlined text-[14px] hover:text-error" aria-label={`Remove ${t.code}`}>close</button>
                    </span>
                  ))}
                </div>
                <TagAutocomplete
                  placeholder={c.kind === 'consulate' ? 'Search a consulate (city/country)…' : `Search ${c.label.toLowerCase()}…`}
                  options={options}
                  onPick={(picked) => {
                    const code = c.kind === 'consulate' ? consulateByLabel.get(picked) || picked : picked
                    addTag(c.field, code)
                  }}
                />
              </div>
            )
          })}

          {CATEGORY_FIELDS.filter((c) => !isShown(c.field)).length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {CATEGORY_FIELDS.filter((c) => !isShown(c.field)).map((c) => (
                <button key={c.field} onClick={() => reveal(c.field)} className="pill">+ Add {c.label}</button>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-outline-variant">
            <StrictnessSlider value={strictness} onChange={setStrictness} />
          </div>

          <button onClick={() => runSearch(freeText, tags, '')} disabled={searchLoading} className="btn-primary w-full mt-2 disabled:opacity-50">
            {searchLoading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </div>

      {/* Results — inline, no navigation */}
      {searched && (
        <div className="mt-6">
          <p className="text-label-md text-on-surface font-semibold mb-2">
            {searchLoading ? 'Searching…' : `${total} posting${total === 1 ? '' : 's'}`}
          </p>
          {!searchLoading && results.length === 0 && (
            <div className="card text-on-surface-variant">No postings matched your tags — try removing one or broadening your text.</div>
          )}
          <div className="space-y-4">
            {results.map((r) => <PostingCard key={r.case_id} r={r} />)}
          </div>
          {!searchLoading && nextPageToken && (
            <div className="flex justify-center mt-6">
              <button onClick={loadMore} disabled={loadingMore} className="btn-secondary disabled:opacity-50">
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
