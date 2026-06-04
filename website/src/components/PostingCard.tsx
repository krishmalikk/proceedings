import Link from 'next/link'

export type PostingCardData = {
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

export function outcomeBadge(outcome: string) {
  const o = outcome.toLowerCase()
  if (o === 'approved' || o === 'issued') return 'badge-success'
  return 'badge-secondary'
}

export default function PostingCard({ r }: { r: PostingCardData }) {
  return (
    <Link href={`/case/${encodeURIComponent(r.case_id)}`} className="card-hover block">
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
  )
}
