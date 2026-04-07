'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import SourceCitation from './SourceCitation'
import CategoryPill from './CategoryPill'

interface QAItem {
  id: string
  question: string
  answer: string
  sources: string[]
  labels: string[]
  created_at: string | null
  is_fallback: boolean
  helpful: boolean | null
}

const FILTER_CATEGORIES = [
  'h1b-visa', 'family-based-immigration', 'asylum-refugees',
  'naturalization-citizenship', 'daca', 'employment-green-cards',
  'student-visas', 'temporary-work-visas', 'adjustment-of-status',
  'visa-fees-filing', 'deportation-defense', 'work-authorization',
]

export default function QAList() {
  const [items, setItems] = useState<QAItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [activeFilter, setActiveFilter] = useState('')

  const LIMIT = 10

  async function fetchItems(currentOffset: number, append: boolean = false, category: string = '') {
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(currentOffset) })
      if (category) params.set('category', category)

      const res = await fetch(`/api/qa?${params}`)
      if (!res.ok) return
      const data = await res.json()
      const newItems: QAItem[] = data.items || []

      if (append) {
        setItems(prev => [...prev, ...newItems])
      } else {
        setItems(newItems)
      }

      setHasMore(newItems.length === LIMIT)
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems(0, false, activeFilter)
  }, [activeFilter])

  function handleLoadMore() {
    const newOffset = offset + LIMIT
    setOffset(newOffset)
    fetchItems(newOffset, true, activeFilter)
  }

  function handleFilterClick(category: string) {
    const newFilter = activeFilter === category ? '' : category
    setActiveFilter(newFilter)
    setOffset(0)
    setLoading(true)
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return ''
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return ''
    }
  }

  const displayItems = items.filter(item => !item.is_fallback)

  return (
    <div>
      {/* Category Filters */}
      <div className="mb-6 overflow-x-auto pb-2">
        <div className="flex gap-2 min-w-max">
          <span
            className={`inline-flex items-center px-4 py-2 text-sm rounded-pill border cursor-pointer transition-colors ${
              !activeFilter
                ? 'border-ink-900 bg-ink-900 text-cream-50'
                : 'border-ink-200 bg-white/50 text-ink-600 hover:border-ink-300'
            }`}
            onClick={() => { setActiveFilter(''); setOffset(0); setLoading(true); }}
          >
            All
          </span>
          {FILTER_CATEGORIES.map((cat) => (
            <CategoryPill
              key={cat}
              label={cat}
              size="md"
              active={activeFilter === cat}
              onClick={() => handleFilterClick(cat)}
            />
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 bg-cream-300 rounded w-3/4 mb-3" />
              <div className="h-3 bg-cream-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && displayItems.length === 0 && (
        <div className="text-center py-12">
          <p className="text-ink-400">
            {activeFilter ? 'No questions in this category yet.' : 'No questions asked yet. Be the first!'}
          </p>
        </div>
      )}

      {/* Q&A List */}
      {!loading && (
        <div className="space-y-3">
          {displayItems.map((item) => (
            <div key={item.id} className="card-hover cursor-pointer" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-ink-900 leading-snug">
                    {item.question}
                  </p>
                  {expandedId !== item.id && (
                    <p className="text-sm text-ink-500 mt-1 line-clamp-2">
                      {item.answer}
                    </p>
                  )}
                  {/* Labels preview */}
                  {expandedId !== item.id && item.labels && item.labels.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.labels.filter(l => l !== 'general-immigration-info' && l !== 'general-legal-info').slice(0, 3).map((label) => (
                        <CategoryPill key={label} label={label} size="sm" />
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {item.created_at && (
                    <span className="text-xs text-ink-400 hidden sm:inline">
                      {formatDate(item.created_at)}
                    </span>
                  )}
                  {expandedId === item.id ? (
                    <ChevronUp className="w-4 h-4 text-ink-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-ink-400" />
                  )}
                </div>
              </div>

              {expandedId === item.id && (
                <div className="mt-4 pt-4 border-t border-ink-100">
                  <p className="text-ink-700 leading-relaxed whitespace-pre-wrap">
                    {item.answer}
                  </p>
                  {/* Labels */}
                  {item.labels && item.labels.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {item.labels.filter(l => l !== 'general-immigration-info' && l !== 'general-legal-info').map((label) => (
                        <CategoryPill key={label} label={label} size="sm" />
                      ))}
                    </div>
                  )}
                  {/* Sources */}
                  {item.sources.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.sources.map((source) => (
                        <SourceCitation key={source} source={source} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {hasMore && (
            <div className="text-center pt-4">
              <button onClick={handleLoadMore} className="btn-secondary text-sm">
                Load More
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
