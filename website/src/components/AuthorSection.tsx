'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Markdown from '@/components/Markdown'

type JourneyEntry = { milestone: string; date: string; experience: string; shared?: boolean }
type Profile = {
  username: string
  current_visa_or_greencard_category: string[]
  visa_applying_for: string[]
  primary_consulate: string
  consulates: string[]
  tags: string[]
  key_stages_or_info: Record<string, string>
  key_dates: Record<string, string>
  background_text: string
  journey: JourneyEntry[]
}
type AuthorPosting = {
  case_id: string
  title: string
  visa: string[]
  consulates: string[]
  outcome: string
  date: string
}

const has = (a?: unknown[]) => Array.isArray(a) && a.length > 0
const hasObj = (o?: Record<string, string>) => o && Object.keys(o).length > 0
const prettyKey = (k: string) => k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

function Chips({ items, kind = 'primary' }: { items: string[]; kind?: 'primary' | 'secondary' | 'plain' }) {
  const cls =
    kind === 'primary' ? 'badge-primary' : kind === 'secondary' ? 'badge-secondary' : 'text-caption text-on-surface-variant bg-surface-container px-2 py-1 rounded'
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((v) => (
        <span key={v} className={cls}>{v}</span>
      ))}
    </div>
  )
}

/**
 * The posting author's structured profile + their other postings. Shown on the
 * case page (below Topics) and on /author/[id]. Renders nothing for non-app
 * postings; an "Anonymous author" note when an app posting has no known author.
 */
export default function AuthorSection({
  authorId,
  channel,
  currentCaseId,
  compact = true,
}: {
  authorId: string
  channel: string
  currentCaseId?: string
  compact?: boolean
}) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [postings, setPostings] = useState<AuthorPosting[]>([])
  const [consulateLabel, setConsulateLabel] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authorId) {
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([
      fetch(`/api/users/${encodeURIComponent(authorId)}/public-profile`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/users/${encodeURIComponent(authorId)}/postings`).then((r) => (r.ok ? r.json() : { postings: [] })),
      fetch('/api/tag-vocab').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([prof, posts, vocab]) => {
        setProfile(prof)
        setPostings((posts?.postings || []) as AuthorPosting[])
        if (vocab?.consulate_options) {
          setConsulateLabel(Object.fromEntries(vocab.consulate_options.map((o: { code: string; label: string }) => [o.code, o.label])))
        }
      })
      .finally(() => setLoading(false))
  }, [authorId])

  // Reddit / other-source postings have no app author — omit entirely.
  if (channel !== 'app') return null

  // App posting with no known author (e.g. published before author capture).
  if (!authorId) {
    return (
      <div className="card">
        <h3 className="text-label-md font-semibold text-on-surface mb-2">Author</h3>
        <p className="text-body-md text-on-surface-variant flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">person_off</span>
          Anonymous author
        </p>
      </div>
    )
  }

  const consLabel = (code: string) => consulateLabel[code] || code
  const otherPostings = postings.filter((p) => p.case_id !== currentCaseId)

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-label-md font-semibold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary text-[20px]">account_circle</span>
          Author
        </h3>
        <Link href={`/author/${encodeURIComponent(authorId)}`} className="text-caption text-secondary hover:underline">
          View profile
        </Link>
      </div>

      {loading ? (
        <div className="h-5 w-24 bg-surface-container rounded animate-pulse" />
      ) : !profile ? (
        <p className="text-body-md text-on-surface-variant">This author hasn’t set up a profile yet.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-title-md text-on-surface">{profile.username || 'Member'}</p>

          {(has(profile.current_visa_or_greencard_category) || has(profile.visa_applying_for)) && (
            <div>
              <p className="text-caption uppercase tracking-wide text-on-surface-variant mb-1">Visa Status</p>
              {has(profile.current_visa_or_greencard_category) && (
                <div className="mb-1.5"><Chips items={profile.current_visa_or_greencard_category} kind="primary" /></div>
              )}
              {has(profile.visa_applying_for) && <Chips items={profile.visa_applying_for} kind="secondary" />}
            </div>
          )}

          {has(profile.consulates) && (
            <div>
              <p className="text-caption uppercase tracking-wide text-on-surface-variant mb-1">Consulates</p>
              <Chips items={profile.consulates.map(consLabel)} kind="secondary" />
            </div>
          )}

          {has(profile.tags) && (
            <div>
              <p className="text-caption uppercase tracking-wide text-on-surface-variant mb-1">Tags</p>
              <Chips items={profile.tags} kind="plain" />
            </div>
          )}

          {hasObj(profile.key_stages_or_info) && (
            <div>
              <p className="text-caption uppercase tracking-wide text-on-surface-variant mb-1">Key Stages</p>
              <ul className="space-y-0.5">
                {Object.entries(profile.key_stages_or_info).map(([k, v]) => (
                  <li key={k} className="text-body-md text-on-surface">{prettyKey(k)}: <span className="text-on-surface-variant">{v}</span></li>
                ))}
              </ul>
            </div>
          )}

          {hasObj(profile.key_dates) && (
            <div>
              <p className="text-caption uppercase tracking-wide text-on-surface-variant mb-1">Key Dates</p>
              <ul className="space-y-0.5">
                {Object.entries(profile.key_dates).map(([k, v]) => (
                  <li key={k} className="text-body-md text-on-surface">{prettyKey(k)}: <span className="text-on-surface-variant">{v}</span></li>
                ))}
              </ul>
            </div>
          )}

          {!compact && profile.background_text && (
            <div>
              <p className="text-caption uppercase tracking-wide text-on-surface-variant mb-1">Background</p>
              <div className="text-body-md"><Markdown>{profile.background_text}</Markdown></div>
            </div>
          )}

          {!compact && has(profile.journey) && (
            <div>
              <p className="text-caption uppercase tracking-wide text-on-surface-variant mb-1">Journey</p>
              <ul className="space-y-1">
                {profile.journey.map((e, i) => (
                  <li key={i} className="text-body-md text-on-surface">
                    <span className="font-medium">{prettyKey(e.milestone)}</span>
                    {e.date ? <span className="text-on-surface-variant"> · {e.date}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Other postings by this author (navigate to each) */}
      {otherPostings.length > 0 && (
        <div className="mt-4 pt-3 border-t border-outline-variant">
          <p className="text-caption uppercase tracking-wide text-on-surface-variant mb-2">
            {currentCaseId ? 'More postings by this author' : 'Postings'} ({otherPostings.length})
          </p>
          <ul className="space-y-2">
            {otherPostings.map((p) => (
              <li key={p.case_id}>
                <Link href={`/case/${encodeURIComponent(p.case_id)}`} className="block group">
                  <span className="text-body-md text-on-surface group-hover:text-primary line-clamp-2">{p.title || p.case_id}</span>
                  <span className="flex flex-wrap gap-1.5 mt-1">
                    {p.visa.slice(0, 3).map((v) => <span key={v} className="badge-primary text-caption">{v}</span>)}
                    {p.outcome ? <span className="badge-secondary text-caption">{p.outcome}</span> : null}
                    {p.date ? <span className="text-caption text-on-surface-variant">{p.date}</span> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
