'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { userHeaders } from '@/lib/activeUser'

type Posting = { case_id: string; title: string; visa: string[]; outcome: string; date: string }
type Reply = { id: string; parent_case_id: string; body: string; created_at: string }
type Group = { group_id: string; name: string; criteria_text: string; members: { username: string }[] }

const fmtDate = (s: string) => {
  if (!s) return ''
  try {
    return new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return s.slice(0, 10)
  }
}

function SectionCard({
  icon, title, count, empty, children,
}: { icon: string; title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h3 className="text-title-md text-on-surface mb-3 flex items-center gap-2">
        <span className="material-symbols-outlined text-secondary">{icon}</span>
        {title}
        {count > 0 && <span className="text-caption text-on-surface-variant">({count})</span>}
      </h3>
      {count === 0 ? <p className="text-body-md text-on-surface-variant">{empty}</p> : children}
    </div>
  )
}

/**
 * The logged-in user's own activity on the portal — their postings, their
 * replies, and the groups they belong to. Rendered on /profile.
 */
export default function ProfileActivity({ uid }: { uid: string }) {
  const [postings, setPostings] = useState<Posting[]>([])
  const [replies, setReplies] = useState<Reply[]>([])
  const [groups, setGroups] = useState<Group[]>([])

  useEffect(() => {
    if (!uid) return
    fetch(`/api/users/${encodeURIComponent(uid)}/postings`)
      .then((r) => (r.ok ? r.json() : { postings: [] })).then((d) => setPostings(d.postings || [])).catch(() => {})
    fetch(`/api/users/${encodeURIComponent(uid)}/replies`)
      .then((r) => (r.ok ? r.json() : { replies: [] })).then((d) => setReplies(d.replies || [])).catch(() => {})
    fetch('/api/groups', { headers: userHeaders() })
      .then((r) => (r.ok ? r.json() : { groups: [] })).then((d) => setGroups(d.groups || [])).catch(() => {})
  }, [uid])

  return (
    <div className="space-y-4">
      {/* 1) Your postings */}
      <SectionCard icon="article" title="Your Postings" count={postings.length} empty="You haven’t posted anything yet.">
        <ul className="space-y-2">
          {postings.map((p) => (
            <li key={p.case_id}>
              <Link href={`/case/${encodeURIComponent(p.case_id)}`} className="block group">
                <span className="text-body-md text-on-surface group-hover:text-primary line-clamp-2">{p.title || p.case_id}</span>
                <span className="flex flex-wrap items-center gap-1.5 mt-1">
                  {p.visa.slice(0, 3).map((v) => <span key={v} className="badge-primary text-caption">{v}</span>)}
                  {p.outcome ? <span className="badge-secondary text-caption">{p.outcome}</span> : null}
                  {p.date ? <span className="text-caption text-on-surface-variant">{fmtDate(p.date)}</span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </SectionCard>

      {/* 2) Your activity — replies to any posting */}
      <SectionCard icon="forum" title="Your Activity" count={replies.length} empty="You haven’t replied to any postings yet.">
        <ul className="space-y-3">
          {replies.map((r) => (
            <li key={r.id}>
              <Link href={`/case/${encodeURIComponent(r.parent_case_id)}`} className="block group">
                <span className="text-body-md text-on-surface line-clamp-2 group-hover:text-primary">{r.body}</span>
                <span className="flex items-center gap-1.5 mt-0.5 text-caption text-on-surface-variant">
                  <span className="material-symbols-outlined text-[14px]">reply</span>
                  replied on a posting{r.created_at ? ` · ${fmtDate(r.created_at)}` : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </SectionCard>

      {/* 3) Your groups */}
      <SectionCard icon="diversity_3" title="Your Groups" count={groups.length} empty="You’re not part of any group yet.">
        <ul className="space-y-2">
          {groups.map((g) => (
            <li key={g.group_id}>
              <Link href={`/groups/${encodeURIComponent(g.group_id)}`} className="block group">
                <span className="text-body-md text-on-surface group-hover:text-primary">{g.name || 'Group'}</span>
                <span className="block text-caption text-on-surface-variant">
                  {g.members?.length || 0} member{(g.members?.length || 0) === 1 ? '' : 's'}
                  {g.criteria_text ? ` · ${g.criteria_text}` : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  )
}
