'use client'

import { useState, useEffect } from 'react'

export type Strictness = 'broad' | 'balanced' | 'strict'

const LEVELS: Strictness[] = ['broad', 'balanced', 'strict']
const DESCRIPTIONS: Record<Strictness, string> = {
  broad: 'Loosest — related experiences ranked by relevance.',
  balanced: 'Relevant matches first, related ones still shown.',
  strict: 'Exact matches only (e.g. Mumbai = BOM).',
}

// Shared, persisted precision setting.
export function useStrictness(): [Strictness, (v: Strictness) => void] {
  const [value, setValue] = useState<Strictness>('balanced')
  useEffect(() => {
    const saved = (typeof window !== 'undefined'
      ? (localStorage.getItem('search-strictness') as Strictness | null)
      : null)
    if (saved && LEVELS.includes(saved)) setValue(saved)
  }, [])
  const set = (v: Strictness) => {
    setValue(v)
    try { localStorage.setItem('search-strictness', v) } catch { /* ignore */ }
  }
  return [value, set]
}

export default function StrictnessSlider({
  value,
  onChange,
}: {
  value: Strictness
  onChange: (v: Strictness) => void
}) {
  const idx = LEVELS.indexOf(value)
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-1">
        <span className="material-symbols-outlined text-[18px] text-secondary">tune</span>
        <span className="text-label-md text-on-surface font-medium">Match precision</span>
      </div>
      <input
        type="range"
        min={0}
        max={2}
        step={1}
        value={idx}
        onChange={(e) => onChange(LEVELS[Number(e.target.value)])}
        className="w-full accent-primary cursor-pointer"
        aria-label="Match precision"
      />
      <div className="flex justify-between text-caption text-on-surface-variant">
        <span className={idx === 0 ? 'text-primary font-medium' : ''}>Broad</span>
        <span className={idx === 1 ? 'text-primary font-medium' : ''}>Balanced</span>
        <span className={idx === 2 ? 'text-primary font-medium' : ''}>Strict</span>
      </div>
      <p className="text-caption text-on-surface-variant">{DESCRIPTIONS[value]}</p>
    </div>
  )
}

// Friendly labels for the generic facet keys (any tag is supported).
const FACET_LABELS: Record<string, string> = {
  consulate: 'Consulate',
  visa: 'Visa',
  category: 'Category',
  outcome: 'Outcome',
  tag: 'Tag',
}

// Small chips row showing the facets the backend actually applied. Generic over
// any facet key returned by the backend (consulate, visa, category, outcome, tag…).
export function AppliedFilters({
  filters,
  relaxed,
}: {
  filters?: Record<string, unknown>
  relaxed?: boolean
}) {
  if (!filters) return null
  const chips: string[] = []
  for (const [key, value] of Object.entries(filters)) {
    const values = Array.isArray(value) ? (value as string[]) : value ? [String(value)] : []
    if (values.length === 0) continue
    const label = FACET_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1)
    chips.push(`${label}: ${values.join('/')}`)
  }
  if (chips.length === 0 && !relaxed) return null
  return (
    <div className="flex flex-wrap items-center gap-2 px-1">
      {chips.map((c) => (
        <span key={c} className="badge-secondary text-caption">{c}</span>
      ))}
      {relaxed && (
        <span className="text-caption text-on-surface-variant italic">
          No exact matches — showing related results.
        </span>
      )}
    </div>
  )
}
