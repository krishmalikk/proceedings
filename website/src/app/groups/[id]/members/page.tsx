'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { userHeaders } from '@/lib/activeUser'
import { useRequireUser } from '@/lib/useRequireUser'
import type { MemberAttributes } from '@/components/MemberHoverCard'
import { displayValue, type PostJoinRow } from '@/lib/postJoinAttributes'

type Group = {
  group_id: string
  name: string
  group_type?: string
  criteria_tags?: { tags?: string[]; current_visa_or_greencard_category?: string[] }
  members: { user_id: string; username: string }[]
  is_member: boolean
}

/**
 * Every member's submitted attributes for one group, as a real table — the
 * wide view the 16rem sidebar could never give. First nested page under a
 * dynamic segment in this app (the API tree does this; the page tree hadn't),
 * and the first <table>, so the styling is composed from existing tokens
 * rather than a new primitive.
 */
export default function GroupMembersPage() {
  useRequireUser()
  const params = useParams<{ id: string }>()
  const id = params?.id || ''

  const [group, setGroup] = useState<Group | null>(null)
  const [attrs, setAttrs] = useState<MemberAttributes[]>([])
  const [templates, setTemplates] = useState<Record<string, PostJoinRow[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      fetch(`/api/groups/${encodeURIComponent(id)}`, { headers: { ...userHeaders() } })
        .then(async (r) => {
          const j = await r.json()
          if (!r.ok) throw new Error(j.detail || 'Could not load group')
          return j as Group
        }),
      fetch(`/api/groups/${encodeURIComponent(id)}/attributes`, { headers: { ...userHeaders() } })
        .then((r) => (r.ok ? r.json() : { attributes: [] })),
      fetch('/api/tag-vocab').then((r) => (r.ok ? r.json() : {}))
        .then((v) => (v as { post_join_attribute_templates?: Record<string, PostJoinRow[]> })),
    ])
      .then(([g, a, v]) => {
        setGroup(g)
        setAttrs(a.attributes || [])
        setTemplates(v.post_join_attribute_templates || {})
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load group'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  const rows: PostJoinRow[] = useMemo(() => {
    const c = group?.criteria_tags
    if (!group || group.group_type !== 'timeline' || !c) return []
    const candidates = [...(c.tags || []), ...(c.current_visa_or_greencard_category || [])]
    const matched = candidates.find((t) => t in templates) || ''
    return matched ? templates[matched] || [] : []
  }, [group, templates])

  const byUser = useMemo(
    () => Object.fromEntries(attrs.map((a) => [a.user_id, a])),
    [attrs],
  )

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Link href={`/groups/${encodeURIComponent(id)}`}
        className="inline-flex items-center gap-1 text-label-md text-on-surface-variant hover:text-primary mb-4 transition-colors">
        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        Back to group
      </Link>

      {loading && <div className="card text-on-surface-variant">Loading…</div>}
      {error && <div className="card text-error mb-4">{error}</div>}

      {group && !loading && (
        <>
          <h1 className="text-headline-md text-on-surface mb-1">{group.name}</h1>
          <p className="text-body-md text-on-surface-variant mb-4">
            What everyone in this group has shared. {group.members.length} member
            {group.members.length === 1 ? '' : 's'}.
          </p>

          {!group.is_member ? (
            <div className="card text-on-surface-variant">Only members can see this.</div>
          ) : rows.length === 0 ? (
            <div className="card text-on-surface-variant">
              This group doesn&apos;t collect timeline attributes.
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr>
                    <th className="text-caption uppercase tracking-wide text-on-surface-variant text-left align-bottom pb-2 pr-4 w-32">
                      Member
                    </th>
                    {/* The clamp lives on an inner span, not the th:
                        line-clamp sets display:-webkit-box, which on a cell
                        would drop table-cell layout and misalign the column.
                        title= keeps the full label reachable when it clips. */}
                    {rows.map((r) => (
                      <th key={r.key} title={r.label}
                        className="text-caption uppercase tracking-wide text-on-surface-variant text-left align-bottom pb-2 pr-3">
                        <span className="max-w-[7.5rem] leading-tight line-clamp-2">{r.label}</span>
                      </th>
                    ))}
                    <th className="text-caption uppercase tracking-wide text-on-surface-variant text-left align-bottom pb-2 min-w-[8rem]">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {group.members.map((m) => {
                    const a = byUser[m.user_id]
                    return (
                      <tr key={m.user_id} className="border-b border-outline-variant last:border-0">
                        <td className="text-body-md text-on-surface py-2 pr-4 whitespace-nowrap">{m.username}</td>
                        {rows.map((r) => (
                          <td key={r.key} className="text-body-md text-on-surface-variant py-2 pr-3 whitespace-nowrap">
                            {r.kind === 'checkbox'
                              ? (a?.values?.[r.key]
                                  ? <span className="material-symbols-outlined text-[18px] text-primary" title="Yes">check</span>
                                  : <span className="text-on-surface-variant/40">—</span>)
                              : (displayValue(r, a?.values?.[r.key]) || <span className="text-on-surface-variant/40">—</span>)}
                          </td>
                        ))}
                        <td className="text-caption text-on-surface-variant py-2">
                          {a?.notes || <span className="text-on-surface-variant/40">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
