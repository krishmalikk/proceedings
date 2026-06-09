'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Markdown from '@/components/Markdown'
import VoteControl from '@/components/VoteControl'
import Replies from '@/components/Replies'

type Tally = { up: number; down: number; score: number; your_vote: number }
const ZERO_TALLY: Tally = { up: 0, down: 0, score: 0, your_vote: 0 }

type PostingDetail = {
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
  body: string
}

function outcomeBadge(outcome: string) {
  const o = outcome.toLowerCase()
  if (o === 'approved' || o === 'issued') return 'badge-success'
  return 'badge-secondary'
}

export default function CaseDetailsPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const [data, setData] = useState<PostingDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [postingTally, setPostingTally] = useState<Tally>(ZERO_TALLY)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetch(`/api/postings/${encodeURIComponent(id)}`)
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.detail || 'Could not load posting')
        return json
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load posting'))
      .finally(() => setLoading(false))
  }, [id])

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-margin-desktop py-8">
      <Link
        href="/search"
        className="inline-flex items-center gap-1 text-label-md text-on-surface-variant hover:text-primary mb-6 transition-colors"
      >
        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        Back to Search
      </Link>

      {loading && <div className="card text-on-surface-variant">Loading posting…</div>}
      {error && <div className="card text-error">{error}</div>}

      {data && (
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main */}
          <div className="flex-1 space-y-6 min-w-0">
            <div className="flex gap-4">
              <div className="pt-1 shrink-0">
                <VoteControl contentId={data.case_id} score={postingTally.score} yourVote={postingTally.your_vote} />
              </div>
              <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-3">
                {data.outcome && <span className={outcomeBadge(data.outcome)}>{data.outcome}</span>}
                {data.visa.map((v) => <span key={v} className="badge-primary">{v}</span>)}
                {data.consulates.map((c) => (
                  <span key={c} className="badge-secondary flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">location_on</span>{c}
                  </span>
                ))}
              </div>
              <h1 className="text-headline-lg text-on-surface mb-2">{data.title}</h1>
              {data.description && (
                <p className="text-body-md text-on-surface-variant">{data.description}</p>
              )}
              </div>
            </div>

            {/* Full posting body */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-secondary">forum</span>
                <h2 className="text-headline-md text-on-surface">Full Experience</h2>
              </div>
              <div className="text-body-md text-on-surface leading-relaxed">
                {data.body ? <Markdown>{data.body}</Markdown> : 'No content available.'}
              </div>
            </div>

            {/* Replies — a clearly separate section below the posting */}
            <Replies postingId={data.case_id} onPostingTally={setPostingTally} />
          </div>

          {/* Sidebar */}
          <aside className="lg:w-80 space-y-6">
            <div className="card">
              <h3 className="text-label-md font-semibold text-on-surface mb-3">Details</h3>
              <dl className="space-y-2 text-body-md">
                <div className="flex justify-between"><dt className="text-on-surface-variant">Source</dt><dd className="text-on-surface">{data.subreddit ? `r/${data.subreddit}` : data.channel}</dd></div>
                <div className="flex justify-between"><dt className="text-on-surface-variant">Posted</dt><dd className="text-on-surface">{data.date || '—'}</dd></div>
                {data.outcome && <div className="flex justify-between"><dt className="text-on-surface-variant">Outcome</dt><dd className="text-on-surface">{data.outcome}</dd></div>}
              </dl>
              {/* Raw metadata JSON — for testing/inspection */}
              <details className="mt-3" open>
                <summary className="text-caption text-on-surface-variant cursor-pointer hover:text-primary select-none">Metadata (JSON)</summary>
                <pre className="mt-2 text-[11px] leading-snug text-on-surface-variant bg-surface-container rounded-lg p-3 overflow-auto max-h-96 whitespace-pre-wrap break-words">
{JSON.stringify(data, null, 2)}
                </pre>
              </details>
            </div>

            {data.tags.length > 0 && (
              <div className="card">
                <h3 className="text-label-md font-semibold text-on-surface mb-3">Topics</h3>
                <div className="flex flex-wrap gap-2">
                  {data.tags.map((t) => (
                    <span key={t} className="text-caption text-on-surface-variant bg-surface-container px-2 py-1 rounded">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Only show for genuine Reddit-sourced posts (otherwise the link goes nowhere useful) */}
            {data.url && (data.channel === 'reddit' || !!data.subreddit || /reddit\.com/i.test(data.url)) && (
              <a href={data.url} target="_blank" rel="noopener noreferrer" className="card-hover flex items-center gap-2 text-secondary">
                <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                View original on Reddit
              </a>
            )}

            <div className="bg-gradient-to-br from-primary to-primary-container rounded-xl p-6 text-center">
              <h3 className="text-headline-md text-on-primary mb-2">Coming Soon</h3>
              <p className="text-body-md text-on-primary opacity-90 mb-4">
                Personalized guidance from a verified immigration attorney is coming soon.
              </p>
              <button disabled className="btn-primary bg-white text-primary opacity-70 cursor-not-allowed">
                Consult an Attorney
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
