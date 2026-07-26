'use client'

import { useEffect, useState } from 'react'
import PostingCardComponent, { type PostingCardData } from '@/components/PostingCard'

type SearchResponse = {
  results: PostingCardData[]
  next_page_token: string
  total: number
}

export default function NewsPage() {
  const [items, setItems] = useState<PostingCardData[]>([])
  const [nextPageToken, setNextPageToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  function load(pageToken = '') {
    const isMore = !!pageToken
    if (isMore) setLoadingMore(true)
    else setLoading(true)
    // No custom `q` — the hard doc_kind:gov_news facet below is what
    // actually scopes results. A query containing words like "news update"
    // risks colliding with /api/search's own NL-driven auto-facet
    // extraction (confirmed while testing: it can infer an unrelated
    // tag:news-update filter from that exact phrase), so this deliberately
    // relies on the default query + the explicit facet instead. Filtering
    // on `doc_kind`, not `channel`: `channel` isn't registered as an
    // indexable/filterable field in the datastore schema (confirmed live —
    // it 400s), `doc_kind` already is.
    const qs = new URLSearchParams({ facet: 'doc_kind:gov_news', page_size: '20' })
    if (pageToken) qs.set('page_token', pageToken)
    fetch(`/api/search?${qs.toString()}`)
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.detail || 'Could not load news')
        return json as SearchResponse
      })
      .then((data) => {
        setItems((prev) => (isMore ? [...prev, ...data.results] : data.results))
        setNextPageToken(data.next_page_token || '')
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load news'))
      .finally(() => {
        setLoading(false)
        setLoadingMore(false)
      })
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-margin-desktop py-8">
      <div className="mb-6">
        <h1 className="text-headline-lg text-primary mb-2">News</h1>
        <p className="text-body-md text-on-surface-variant">
          Official updates from government immigration agencies.
        </p>
      </div>

      {loading && <div className="card text-on-surface-variant">Loading news…</div>}
      {error && <div className="card text-error">{error}</div>}
      {!loading && !error && items.length === 0 && (
        <div className="card text-on-surface-variant">No news updates yet — check back soon.</div>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-4 max-w-3xl">
          {items.map((item) => (
            <PostingCardComponent key={item.case_id} r={item} />
          ))}

          {nextPageToken && (
            <button
              onClick={() => load(nextPageToken)}
              disabled={loadingMore}
              className="w-full py-3 text-label-md text-primary border border-outline-variant rounded-xl hover:bg-surface-container transition-colors disabled:opacity-50"
            >
              {loadingMore ? 'Loading…' : 'Load older updates'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
