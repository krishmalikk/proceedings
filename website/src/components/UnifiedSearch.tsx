'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PostingCard, { type PostingCardData } from '@/components/PostingCard'
import Markdown from '@/components/Markdown'
import SourceCitation from '@/components/SourceCitation'
import StrictnessSlider, { useStrictness, AppliedFilters } from '@/components/StrictnessSlider'
import SuggestedFilters, { facetId, type SuggestedFilterGroup } from '@/components/SuggestedFilters'

type Source = { chunk_id: string; text: string; source: string; labels: string[]; score: number }
type Turn = { id: string; role: 'user' | 'ai'; content: string; sources?: Source[] }

const EXAMPLES = [
  'B1/B2 interview experience in Mumbai',
  'I am on H-1B applying for an extension with a question on RFE',
  'How does the 60-day grace period work after a layoff?',
]

export default function UnifiedSearch() {
  const router = useRouter()
  const params = useSearchParams()

  const [input, setInput] = useState(params.get('q') || '')
  const [query, setQuery] = useState(params.get('q') || '')
  const [strictness, setStrictness] = useStrictness()
  const [selectedFacets, setSelectedFacets] = useState<string[]>([])

  // AI overview + follow-up thread (Gemini-style)
  const [turns, setTurns] = useState<Turn[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [followup, setFollowup] = useState('')

  // search results
  const [results, setResults] = useState<PostingCardData[]>([])
  const [total, setTotal] = useState(0)
  const [nextPageToken, setNextPageToken] = useState('')
  const [appliedFilters, setAppliedFilters] = useState<Record<string, unknown>>({})
  const [relaxed, setRelaxed] = useState(false)
  const [suggested, setSuggested] = useState<SuggestedFilterGroup[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')

  const syncUrl = useCallback((q: string) => {
    router.replace(q ? `/search?q=${encodeURIComponent(q)}` : '/search', { scroll: false })
  }, [router])

  const searchQs = useCallback((q: string, facets: string[], pageToken: string) => {
    const p = new URLSearchParams()
    p.set('q', q || 'immigration visa experience')
    facets.forEach((f) => p.append('facet', f))
    p.set('strictness', strictness)
    p.set('page_size', '15')
    if (pageToken) p.set('page_token', pageToken)
    return p.toString()
  }, [strictness])

  const runSearch = useCallback(async (q: string, facets: string[]) => {
    setSearchLoading(true); setSearched(true)
    try {
      const res = await fetch(`/api/search?${searchQs(q, facets, '')}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Search failed')
      setResults(data.results || [])
      setTotal(data.total || 0)
      setNextPageToken(data.next_page_token || '')
      setAppliedFilters(data.applied_filters || {})
      setRelaxed(data.relaxed || false)
      setSuggested(data.suggested_filters || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed'); setResults([])
    } finally {
      setSearchLoading(false)
    }
  }, [searchQs])

  const askAi = useCallback(async (q: string): Promise<Turn> => {
    const res = await fetch('/api/ask', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`)
    return { id: `${Date.now()}-ai`, role: 'ai', content: data.answer, sources: data.sources }
  }, [])

  // Main query: fire AI overview + search results IN PARALLEL (one consolidated response).
  const run = useCallback(async (q: string, facets: string[]) => {
    setError('')
    setAiLoading(true); setTurns([])
    runSearch(q, facets)
    try {
      setTurns([await askAi(q)])
    } catch (e) {
      setTurns([{ id: `${Date.now()}-err`, role: 'ai', content: e instanceof Error ? e.message : 'AI error' }])
    } finally {
      setAiLoading(false)
    }
  }, [runSearch, askAi])

  const loadMore = useCallback(async () => {
    if (!nextPageToken || loadingMore) return
    setLoadingMore(true)
    try {
      const res = await fetch(`/api/search?${searchQs(query, selectedFacets, nextPageToken)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Could not load more')
      setResults((prev) => [...prev, ...(data.results || [])])
      setNextPageToken(data.next_page_token || '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load more')
    } finally {
      setLoadingMore(false)
    }
  }, [nextPageToken, loadingMore, searchQs, query, selectedFacets])

  // run initial query from URL once
  useEffect(() => {
    if (query) run(query, selectedFacets)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // re-run search when precision changes (AI overview unaffected)
  useEffect(() => {
    if (query) runSearch(query, selectedFacets)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strictness])

  function submit(q: string) {
    const t = q.trim()
    if (t.length < 3) return
    setQuery(t); syncUrl(t); run(t, selectedFacets)
  }

  async function askFollowup(q: string) {
    const t = q.trim()
    if (t.length < 3) return
    setFollowup('')
    setTurns((prev) => [...prev, { id: `${Date.now()}-u`, role: 'user', content: t }])
    setAiLoading(true)
    try {
      const aiTurn = await askAi(t)
      setTurns((prev) => [...prev, aiTurn])
    } catch (e) {
      setTurns((prev) => [...prev, { id: `${Date.now()}-e`, role: 'ai', content: e instanceof Error ? e.message : 'AI error' }])
    } finally {
      setAiLoading(false)
    }
  }

  function toggleFacet(field: string, code: string) {
    const id = facetId(field, code)
    const next = selectedFacets.includes(id) ? selectedFacets.filter((x) => x !== id) : [...selectedFacets, id]
    setSelectedFacets(next)
    if (query) runSearch(query, next)
  }

  const active = searched || turns.length > 0 || aiLoading

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {!active && (
        <div className="text-center mb-6 mt-6">
          <h1 className="text-display-lg md:text-headline-lg text-primary mb-2">Ask anything. See real experiences.</h1>
          <p className="text-body-md text-on-surface-variant">
            One search gives you an AI answer and the matching immigration postings.
          </p>
        </div>
      )}

      {/* Single search bar */}
      <form
        onSubmit={(e) => { e.preventDefault(); submit(input) }}
        className="relative flex items-center bg-surface-container-lowest border border-outline-variant rounded-full focus-within:border-primary transition-all shadow-sm"
      >
        <span className="material-symbols-outlined text-on-surface-variant ml-4">search</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='Search or ask — e.g. "B1/B2 interview in Mumbai"'
          className="flex-1 px-4 py-4 bg-transparent border-none focus:ring-0 focus:outline-none text-body-lg text-on-surface"
        />
        <button type="submit" disabled={input.trim().length < 3} className="btn-primary rounded-full mr-2 my-2 disabled:opacity-40">
          Search
        </button>
      </form>

      {error && <div className="card text-error mt-4">{error}</div>}

      {!active && (
        <div className="mt-8">
          <p className="text-label-md text-on-surface-variant mb-2">Try:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button key={ex} onClick={() => { setInput(ex); submit(ex) }} className="pill text-left">{ex}</button>
            ))}
          </div>
        </div>
      )}

      {/* ===== AI OVERVIEW (top of the consolidated response) ===== */}
      {active && (
        <div className="mt-6 rounded-2xl border border-primary-container bg-primary-container/20 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-primary">auto_awesome</span>
            <span className="text-label-md font-semibold text-primary">AI Overview</span>
          </div>

          <div className="space-y-4">
            {turns.map((t) => (
              t.role === 'user' ? (
                <div key={t.id} className="flex items-center gap-2 text-label-md text-on-surface font-medium">
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant">subdirectory_arrow_right</span>
                  {t.content}
                </div>
              ) : (
                <div key={t.id} className="space-y-2">
                  <div className="text-on-surface"><Markdown>{t.content}</Markdown></div>
                  {t.sources && t.sources.length > 0 && (
                    <div className="flex gap-2 items-center flex-wrap">
                      <span className="text-caption text-outline">Sources:</span>
                      {Array.from(new Set(t.sources.map((s) => s.source))).slice(0, 3).map((s) => (
                        <SourceCitation key={s} source={s} />
                      ))}
                    </div>
                  )}
                </div>
              )
            ))}
            {aiLoading && (
              <div className="flex gap-1 py-1">
                <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
          </div>

          {/* Follow-up (Gemini-style) */}
          {turns.length > 0 && (
            <form onSubmit={(e) => { e.preventDefault(); askFollowup(followup) }} className="mt-4 flex items-center gap-2">
              <input
                value={followup}
                onChange={(e) => setFollowup(e.target.value)}
                placeholder="Ask a follow-up…"
                className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-full px-4 py-2 text-body-md focus:outline-none focus:border-primary"
              />
              <button type="submit" disabled={followup.trim().length < 3 || aiLoading}
                className="btn-secondary rounded-full disabled:opacity-40">Ask</button>
            </form>
          )}
          <p className="text-caption text-on-surface-variant mt-3">AI provides information, not legal advice.</p>
        </div>
      )}

      {/* ===== SEARCH RESULTS (below the AI overview) ===== */}
      {active && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-2">
            <p className="text-label-md text-on-surface font-semibold">
              {searchLoading ? 'Finding postings…' : `${total} matching postings`}
            </p>
            <details className="text-caption text-on-surface-variant">
              <summary className="cursor-pointer select-none">Precision</summary>
              <div className="mt-2 w-64 bg-surface-container-low rounded-xl p-3 absolute right-4 z-10 shadow-lg">
                <StrictnessSlider value={strictness} onChange={setStrictness} />
              </div>
            </details>
          </div>

          <AppliedFilters filters={appliedFilters} relaxed={relaxed} />
          {suggested.length > 0 && (
            <div className="bg-surface-container-low rounded-xl p-4 my-3">
              <SuggestedFilters groups={suggested} selected={new Set(selectedFacets)} onToggle={toggleFacet} />
            </div>
          )}

          {!searchLoading && results.length === 0 && (
            <div className="card text-on-surface-variant">No postings matched — try a broader query.</div>
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
