'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PostingCard, { type PostingCardData } from '@/components/PostingCard'
import Markdown from '@/components/Markdown'
import SourceCitation from '@/components/SourceCitation'
import StrictnessSlider, { useStrictness, AppliedFilters } from '@/components/StrictnessSlider'
import SuggestedFilters, { facetId, type SuggestedFilterGroup } from '@/components/SuggestedFilters'

type Mode = 'search' | 'ai'
type Source = { chunk_id: string; text: string; source: string; labels: string[]; score: number }
type AiMessage = {
  id: string
  role: 'user' | 'ai'
  mode?: 'answer' | 'search'
  content: string
  sources?: Source[]
  results?: PostingCardData[]
  suggestedFilters?: SuggestedFilterGroup[]
  appliedFilters?: Record<string, unknown>
  relaxed?: boolean
}

const EXAMPLES = [
  'B1/B2 interview experience in Mumbai',
  'I am on H-1B applying for an extension with a question on RFE',
  'How does the 60-day grace period work after a layoff?',
]

export default function UnifiedSearch({ initialMode = 'search' as Mode }: { initialMode?: Mode }) {
  const router = useRouter()
  const params = useSearchParams()

  const [mode, setMode] = useState<Mode>((params.get('mode') as Mode) || initialMode)
  const [input, setInput] = useState(params.get('q') || '')
  const [query, setQuery] = useState(params.get('q') || '') // last submitted query
  const [strictness, setStrictness] = useStrictness()
  const [selectedFacets, setSelectedFacets] = useState<string[]>([])
  const [error, setError] = useState('')

  // search-mode state
  const [results, setResults] = useState<PostingCardData[]>([])
  const [total, setTotal] = useState(0)
  const [nextPageToken, setNextPageToken] = useState('')
  const [appliedFilters, setAppliedFilters] = useState<Record<string, unknown>>({})
  const [relaxed, setRelaxed] = useState(false)
  const [suggested, setSuggested] = useState<SuggestedFilterGroup[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searched, setSearched] = useState(false)

  // ai-mode state
  const [messages, setMessages] = useState<AiMessage[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const threadRef = useRef<HTMLDivElement>(null)

  const syncUrl = useCallback((q: string, m: Mode) => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    p.set('mode', m)
    router.replace(`/search?${p.toString()}`, { scroll: false })
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
    setSearchLoading(true); setError(''); setSearched(true)
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
      setError(e instanceof Error ? e.message : 'Search failed'); setResults([]); setNextPageToken('')
    } finally {
      setSearchLoading(false)
    }
  }, [searchQs])

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

  const submitChat = useCallback(async (q: string, facets: string[]) => {
    setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'user', content: q }])
    setAiLoading(true); setError('')
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, strictness, facets }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`)
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(), role: 'ai', mode: data.mode, content: data.answer,
        sources: data.sources, results: data.results, suggestedFilters: data.suggested_filters,
        appliedFilters: data.applied_filters, relaxed: data.relaxed,
      }])
    } catch (e) {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(), role: 'ai',
        content: e instanceof Error ? e.message : 'Something went wrong. Please try again.',
      }])
    } finally {
      setAiLoading(false)
    }
  }, [strictness])

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight
  }, [messages])

  // run the initial query (from the URL) once on mount
  useEffect(() => {
    if (query) { mode === 'search' ? runSearch(query, selectedFacets) : submitChat(query, selectedFacets) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // re-run search when precision changes
  useEffect(() => {
    if (mode === 'search' && query) runSearch(query, selectedFacets)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strictness])

  function submit(q: string) {
    const t = q.trim()
    if (t.length < 3) return
    setQuery(t); syncUrl(t, mode)
    mode === 'search' ? runSearch(t, selectedFacets) : submitChat(t, selectedFacets)
  }

  function switchMode(m: Mode) {
    if (m === mode) return
    setMode(m); syncUrl(query, m)
    if (!query) return
    if (m === 'search') runSearch(query, selectedFacets)
    else if (messages.length === 0) submitChat(query, selectedFacets)
  }

  function toggleFacet(field: string, code: string) {
    const id = facetId(field, code)
    const next = selectedFacets.includes(id) ? selectedFacets.filter((x) => x !== id) : [...selectedFacets, id]
    setSelectedFacets(next)
    if (!query) return
    mode === 'search' ? runSearch(query, next) : submitChat(query, next)
  }

  const hasActivity = mode === 'search' ? searched : messages.length > 0

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Hero (collapses once you have results) */}
      {!hasActivity && (
        <div className="text-center mb-6 mt-6">
          <h1 className="text-display-lg md:text-headline-lg text-primary mb-2">Search experiences. Ask anything.</h1>
          <p className="text-body-md text-on-surface-variant">
            Find real immigration postings, or switch to AI mode for grounded answers.
          </p>
        </div>
      )}

      {/* Search bar */}
      <form
        onSubmit={(e) => { e.preventDefault(); submit(input) }}
        className="relative flex items-center bg-surface-container-lowest border border-outline-variant rounded-full focus-within:border-primary transition-all shadow-sm"
      >
        <span className="material-symbols-outlined text-on-surface-variant ml-4">
          {mode === 'ai' ? 'auto_awesome' : 'search'}
        </span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={mode === 'ai' ? 'Ask about your immigration situation…' : 'Search experiences, e.g. "B1/B2 in Mumbai"…'}
          className="flex-1 px-4 py-4 bg-transparent border-none focus:ring-0 focus:outline-none text-body-lg text-on-surface"
        />
        <button type="submit" disabled={input.trim().length < 3} className="btn-primary rounded-full mr-2 my-2 disabled:opacity-40">
          {mode === 'ai' ? 'Ask' : 'Search'}
        </button>
      </form>

      {/* Mode toggle + precision */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
        <div className="inline-flex bg-surface-container rounded-full p-1">
          <button onClick={() => switchMode('search')}
            className={`flex items-center gap-1 px-4 py-1.5 rounded-full text-label-md transition-colors ${mode === 'search' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
            <span className="material-symbols-outlined text-[18px]">search</span> Search
          </button>
          <button onClick={() => switchMode('ai')}
            className={`flex items-center gap-1 px-4 py-1.5 rounded-full text-label-md transition-colors ${mode === 'ai' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span> AI Mode
          </button>
        </div>
        <details className="text-caption text-on-surface-variant">
          <summary className="cursor-pointer select-none">Precision</summary>
          <div className="mt-2 w-64 bg-surface-container-low rounded-xl p-3">
            <StrictnessSlider value={strictness} onChange={setStrictness} />
          </div>
        </details>
      </div>

      {error && <div className="card text-error mt-4">{error}</div>}

      {/* Empty state */}
      {!hasActivity && (
        <div className="mt-8">
          <p className="text-label-md text-on-surface-variant mb-2">Try:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button key={ex} onClick={() => { setInput(ex); submit(ex) }} className="pill text-left">{ex}</button>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- SEARCH MODE ---------------- */}
      {mode === 'search' && searched && (
        <div className="mt-6">
          <p className="text-label-md text-on-surface-variant mb-2">
            {searchLoading ? 'Searching…' : `${total} postings found`}
          </p>
          <AppliedFilters filters={appliedFilters} relaxed={relaxed} />
          {suggested.length > 0 && (
            <div className="bg-surface-container-low rounded-xl p-4 my-4">
              <SuggestedFilters groups={suggested} selected={new Set(selectedFacets)} onToggle={toggleFacet} />
            </div>
          )}
          {!searchLoading && results.length === 0 && (
            <div className="card text-on-surface-variant">No postings matched. Try a broader query or AI Mode.</div>
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

      {/* ---------------- AI MODE ---------------- */}
      {mode === 'ai' && messages.length > 0 && (
        <div ref={threadRef} className="mt-6 space-y-6">
          {messages.map((m, idx) => (
            <div key={m.id}>
              {m.role === 'user' ? (
                <div className="flex justify-end">
                  <div className="bg-primary-container text-on-primary-container rounded-2xl rounded-tr-sm p-3 max-w-[85%]">{m.content}</div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-white text-[18px]">auto_awesome</span>
                  </div>
                  <div className="flex-1 space-y-2 min-w-0">
                    {m.mode === 'search' ? (
                      <div className="space-y-3">
                        <p className="text-caption text-on-surface-variant">Matching experiences:</p>
                        {m.results?.map((r) => <PostingCard key={r.case_id} r={r} />)}
                      </div>
                    ) : (
                      <div className="bg-surface-container rounded-2xl rounded-tl-sm p-4 text-on-surface">
                        <Markdown>{m.content}</Markdown>
                      </div>
                    )}
                    {m.mode !== 'search' && m.sources && m.sources.length > 0 && (
                      <div className="flex gap-2 items-center flex-wrap px-1">
                        <span className="text-caption text-outline">Sources:</span>
                        {Array.from(new Set(m.sources.map((s) => s.source))).slice(0, 3).map((s) => (
                          <SourceCitation key={s} source={s} />
                        ))}
                      </div>
                    )}
                    {idx === messages.length - 1 && m.suggestedFilters && m.suggestedFilters.length > 0 && (
                      <div className="bg-surface-container-low rounded-xl p-3 mt-1">
                        <SuggestedFilters groups={m.suggestedFilters} selected={new Set(selectedFacets)}
                          onToggle={toggleFacet} title="Refine to related experiences" />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          {aiLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-white text-[18px]">auto_awesome</span>
              </div>
              <div className="bg-surface-container rounded-2xl rounded-tl-sm p-4">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-outline rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-outline rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-outline rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <p className="text-caption text-on-surface-variant text-center pt-2">
            AI provides information, not legal advice.
          </p>
        </div>
      )}
    </div>
  )
}
