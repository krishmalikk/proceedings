'use client'

import VoteControl from './VoteControl'

export type ReplyCardData = {
  id: string
  parent_case_id: string
  body: string
  author_handle: string
  created_at: string
  deleted: boolean
  up: number
  down: number
  score: number
  your_vote: number
  is_author: boolean
}

function timeAgo(iso: string): string {
  const t = Date.parse(iso)
  if (isNaN(t)) return ''
  const sec = Math.floor((Date.now() - t) / 1000)
  if (sec < 60) return 'just now'
  const m = Math.floor(sec / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(t).toLocaleDateString()
}

// One reply: a left vote rail + author/time/body. Distinct, lighter styling
// keeps replies visually subordinate to (not inter-mingled with) the posting.
export default function ReplyItem({ r, onDelete }: { r: ReplyCardData; onDelete: (id: string) => void }) {
  return (
    <div className="flex gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
      <div className="pt-0.5">
        <VoteControl contentId={r.id} score={r.score} yourVote={r.your_vote} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-caption text-on-surface-variant mb-1">
          <span className="font-semibold text-on-surface">{r.author_handle}</span>
          <span aria-hidden>·</span>
          <span>{timeAgo(r.created_at)}</span>
          {r.is_author && (
            <button
              onClick={() => onDelete(r.id)}
              className="ml-auto inline-flex items-center hover:text-error transition-colors"
              aria-label="Delete reply"
              title="Delete reply"
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
            </button>
          )}
        </div>
        <p className="text-body-md text-on-surface whitespace-pre-wrap break-words">{r.body}</p>
      </div>
    </div>
  )
}
