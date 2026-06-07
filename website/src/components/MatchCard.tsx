'use client'

export type MatchData = {
  user_id: string
  username: string
  score: number
  shared: string[]
  summary: string
}

// A ranked candidate ("same boat") with a checkbox to include in the group.
export default function MatchCard({
  m,
  checked,
  onToggle,
}: {
  m: MatchData
  checked: boolean
  onToggle: (userId: string) => void
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
        checked
          ? 'border-primary bg-primary-fixed/40'
          : 'border-outline-variant bg-surface-container-lowest hover:border-primary/50'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(m.user_id)}
        className="mt-1 accent-primary"
        aria-label={`Include ${m.username}`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-label-md font-semibold text-on-surface">{m.username}</span>
          <span className="text-caption text-on-surface-variant whitespace-nowrap">match {m.score}</span>
        </div>
        {m.summary && <p className="text-caption text-on-surface-variant mb-2">{m.summary}</p>}
        <div className="flex flex-wrap gap-1">
          {m.shared.map((s) => (
            <span key={s} className="text-caption text-secondary bg-secondary-container/50 px-2 py-0.5 rounded-full">
              {s}
            </span>
          ))}
        </div>
      </div>
    </label>
  )
}
