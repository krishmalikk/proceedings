'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type PostingCard = {
  case_id: string
  title: string
  description: string
  visa: string[]
  consulates: string[]
  outcome: string
  subreddit: string
  channel: string
  tags: string[]
  url: string
  date: string
}

const visaTypes = ['All Types', 'B-1', 'B-2', 'H-1B', 'F-1', 'L-1', 'B-1/B-2']
const outcomes = ['All Outcomes', 'approved', 'issued', 'refused', 'pending']

function outcomeBadge(outcome: string) {
  const o = outcome.toLowerCase()
  if (o === 'approved' || o === 'issued') return 'badge-success'
  return 'badge-secondary'
}

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedVisaType, setSelectedVisaType] = useState('All Types')
  const [selectedOutcome, setSelectedOutcome] = useState('All Outcomes')
  const [results, setResults] = useState<PostingCard[]>([])
  const [total, setTotal] = useState(0)
  const [nextPageToken, setNextPageToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  const buildParams = useCallback((pageToken: string) => {
    const params = new URLSearchParams()
    params.set('q', searchQuery.trim() || 'immigration visa experience')
    if (selectedVisaType !== 'All Types') params.set('visa', selectedVisaType)
    if (selectedOutcome !== 'All Outcomes') params.set('outcome', selectedOutcome)
    params.set('page_size', '15')
    if (pageToken) params.set('page_token', pageToken)
    return params
  }, [searchQuery, selectedVisaType, selectedOutcome])

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

  // Initial load + re-run when a filter changes.
  useEffect(() => {
    runSearch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVisaType, selectedOutcome])

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

          <div>
            <label className="text-label-md text-on-surface font-medium mb-2 block">Outcome</label>
            <div className="flex flex-wrap gap-2">
              {outcomes.map((o) => (
                <button
                  key={o}
                  onClick={() => setSelectedOutcome(o)}
                  className={selectedOutcome === o ? 'pill-active' : 'pill'}
                >
                  {o === 'All Outcomes' ? o : o.charAt(0).toUpperCase() + o.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-surface-container-low rounded-xl p-4">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-secondary">lightbulb</span>
              <div>
                <p className="text-label-md font-medium text-on-surface">Pro Tip</p>
                <p className="text-caption text-on-surface-variant mt-1">
                  Include the consulate or visa type for more relevant matches.
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <p className="text-label-md text-on-surface-variant">
              {loading ? 'Searching…' : `${total} postings found`}
            </p>
          </div>

          {error && (
            <div className="card text-error mb-4">{error}</div>
          )}

          {!loading && !error && results.length === 0 && (
            <div className="card text-on-surface-variant">No postings matched. Try a broader query.</div>
          )}

          <div className="space-y-4">
            {results.map((r) => (
              <Link key={r.case_id} href={`/case/${encodeURIComponent(r.case_id)}`} className="card-hover block">
                <div className="flex items-start justify-between mb-2 gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {r.outcome && <span className={outcomeBadge(r.outcome)}>{r.outcome}</span>}
                    {r.visa.slice(0, 2).map((v) => (
                      <span key={v} className="badge-primary">{v}</span>
                    ))}
                    {r.consulates.slice(0, 2).map((c) => (
                      <span key={c} className="badge-secondary flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">location_on</span>{c}
                      </span>
                    ))}
                  </div>
                </div>

                <h3 className="text-headline-md text-on-surface hover:text-primary transition-colors mb-2">
                  {r.title}
                </h3>

                {r.description && (
                  <p className="text-body-md text-on-surface-variant mb-3 line-clamp-2">{r.description}</p>
                )}

                <div className="flex flex-wrap gap-2 mb-3">
                  {r.tags.slice(0, 4).map((tag) => (
                    <span key={tag} className="text-caption text-on-surface-variant bg-surface-container px-2 py-1 rounded">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between text-caption text-on-surface-variant">
                  <span>{r.subreddit ? `r/${r.subreddit}` : r.channel} · {r.date}</span>
                  <span className="flex items-center gap-1 text-primary">
                    View experience
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </span>
                </div>
              </Link>
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
