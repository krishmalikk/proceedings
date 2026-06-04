'use client'

import { useState, useEffect, useCallback } from 'react'
import PostingCard, { type PostingCardData } from '@/components/PostingCard'
import StrictnessSlider, { useStrictness, AppliedFilters } from '@/components/StrictnessSlider'
import SuggestedFilters, { facetId, type SuggestedFilterGroup } from '@/components/SuggestedFilters'

const visaTypes = ['All Types', 'B-1', 'B-2', 'H-1B', 'F-1', 'L-1', 'B-1/B-2']

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedVisaType, setSelectedVisaType] = useState('All Types')
  const [strictness, setStrictness] = useStrictness()
  const [selectedFacets, setSelectedFacets] = useState<string[]>([])
  const [suggested, setSuggested] = useState<SuggestedFilterGroup[]>([])
  const [results, setResults] = useState<PostingCardData[]>([])
  const [total, setTotal] = useState(0)
  const [nextPageToken, setNextPageToken] = useState('')
  const [appliedFilters, setAppliedFilters] = useState<Record<string, unknown>>({})
  const [relaxed, setRelaxed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  const buildParams = useCallback((pageToken: string) => {
    const params = new URLSearchParams()
    params.set('q', searchQuery.trim() || 'immigration visa experience')
    if (selectedVisaType !== 'All Types') params.set('visa', selectedVisaType)
    selectedFacets.forEach((f) => params.append('facet', f))
    params.set('strictness', strictness)
    params.set('page_size', '15')
    if (pageToken) params.set('page_token', pageToken)
    return params
  }, [searchQuery, selectedVisaType, strictness, selectedFacets])

  const toggleFacet = (field: string, code: string) => {
    const id = facetId(field, code)
    setSelectedFacets((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const runSearch = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/search?${buildParams('').toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Search failed')
      setResults(data.results || [])
      setTotal(data.total || 0)
      setNextPageToken(data.next_page_token || '')
      setAppliedFilters(data.applied_filters || {})
      setRelaxed(data.relaxed || false)
      setSuggested(data.suggested_filters || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
      setResults([])
      setNextPageToken('')
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  const loadMore = useCallback(async () => {
    if (!nextPageToken || loadingMore) return
    setLoadingMore(true)
    try {
      const res = await fetch(`/api/search?${buildParams(nextPageToken).toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Could not load more')
      setResults((prev) => [...prev, ...(data.results || [])])
      setNextPageToken(data.next_page_token || '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load more')
    } finally {
      setLoadingMore(false)
    }
  }, [nextPageToken, loadingMore, buildParams])

  // Initial load + re-run when a filter, precision, or facet selection changes.
  useEffect(() => {
    runSearch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVisaType, strictness, selectedFacets])

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-margin-desktop py-8">
      {/* Hero */}
      <div className="text-center mb-8">
        <h1 className="text-display-lg md:text-headline-lg text-primary mb-2">
          Find real experiences in seconds.
        </h1>
        <p className="text-body-md text-on-surface-variant">
          Search ingested immigration postings to find experiences like yours.
        </p>
      </div>

      {/* Search input */}
      <div className="max-w-3xl mx-auto mb-8">
        <form
          onSubmit={(e) => { e.preventDefault(); runSearch() }}
          className="relative flex items-center bg-surface-container-lowest border border-outline-variant rounded-xl focus-within:border-primary transition-all"
        >
          <span className="material-symbols-outlined text-on-surface-variant ml-4">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Describe your situation, e.g. 'B1/B2 interview in Mumbai'..."
            className="flex-1 px-4 py-4 bg-transparent border-none focus:ring-0 focus:outline-none text-body-lg text-on-surface"
          />
          <button type="submit" className="btn-primary mr-2 my-2">Find Matches</button>
        </form>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Filters */}
        <aside className="md:w-64 space-y-6">
          <div>
            <label className="text-label-md text-on-surface font-medium mb-2 block">Visa Type</label>
            <select
              value={selectedVisaType}
              onChange={(e) => setSelectedVisaType(e.target.value)}
              className="input"
            >
              {visaTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>

          {/* Dynamic, situation-relevant filters (tag hierarchy + live counts) */}
          {suggested.length > 0 && (
            <div className="bg-surface-container-low rounded-xl p-4">
              <SuggestedFilters
                groups={suggested}
                selected={new Set(selectedFacets)}
                onToggle={toggleFacet}
              />
            </div>
          )}

          <div className="bg-surface-container-low rounded-xl p-4">
            <StrictnessSlider value={strictness} onChange={setStrictness} />
          </div>

          <div className="bg-surface-container-low rounded-xl p-4">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-secondary">lightbulb</span>
              <div>
                <p className="text-label-md font-medium text-on-surface">Pro Tip</p>
                <p className="text-caption text-on-surface-variant mt-1">
                  Mention a consulate (e.g. &quot;Mumbai&quot;) and set precision to <strong>Strict</strong> for exact matches.
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <p className="text-label-md text-on-surface-variant">
              {loading ? 'Searching…' : `${total} postings found`}
            </p>
          </div>

          <div className="mb-4">
            <AppliedFilters filters={appliedFilters} relaxed={relaxed} />
          </div>

          {error && (
            <div className="card text-error mb-4">{error}</div>
          )}

          {!loading && !error && results.length === 0 && (
            <div className="card text-on-surface-variant">No postings matched. Try a broader query.</div>
          )}

          <div className="space-y-4">
            {results.map((r) => (
              <PostingCard key={r.case_id} r={r} />
            ))}
          </div>

          {/* Load more */}
          {!loading && nextPageToken && (
            <div className="flex justify-center mt-6">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="btn-secondary disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}

          {!loading && !nextPageToken && results.length > 0 && (
            <p className="text-center text-caption text-on-surface-variant mt-6">
              Showing all {results.length} of {total} postings
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
