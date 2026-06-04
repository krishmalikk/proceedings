import { Suspense } from 'react'
import UnifiedSearch from '@/components/UnifiedSearch'

// Unified search-first interface (Search ⇄ AI Mode). Consolidates the old
// /search + /ask. Suspense is required because UnifiedSearch reads ?q=&mode=.
export default function SearchPage() {
  return (
    <Suspense fallback={<div className="max-w-3xl mx-auto px-4 py-8 text-on-surface-variant">Loading…</div>}>
      <UnifiedSearch />
    </Suspense>
  )
}
