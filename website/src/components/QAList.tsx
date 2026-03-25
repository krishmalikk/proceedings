'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import SourceCitation from './SourceCitation'

interface QAItem {
  id: string
  question: string
  answer: string
  sources: string[]
  created_at: string | null
  is_fallback: boolean
  helpful: boolean | null
}

export default function QAList() {
  const [items, setItems] = useState<QAItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  const LIMIT = 10

  async function fetchItems(currentOffset: number, append: boolean = false) {
    try {
      const res = await fetch(`/api/qa?limit=${LIMIT}&offset=${currentOffset}`)
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
      // Silently fail — QA list is supplementary
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems(0)
  }, [])

  function handleLoadMore() {
    const newOffset = offset + LIMIT
    setOffset(newOffset)
    fetchItems(newOffset, true)
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return ''
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return ''
    }
  }

  // Filter out fallback answers
  const displayItems = items.filter(item => !item.is_fallback)

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="card animate-pulse">
            <div className="h-4 bg-cream-300 rounded w-3/4 mb-3" />
            <div className="h-3 bg-cream-200 rounded w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  if (displayItems.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-ink-400">No questions asked yet. Be the first!</p>
      </div>
    )
  }

  return (
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
              {item.sources.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
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
  )
}
