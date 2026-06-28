'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import GroupChat from '@/components/GroupChat'
import { userHeaders } from '@/lib/activeUser'
import { useRequireUser } from '@/lib/useRequireUser'

type Group = {
  group_id: string
  name: string
  criteria_text?: string
  members: { user_id: string; username: string }[]
  is_member: boolean
}

export default function GroupPage() {
  useRequireUser()
  const params = useParams<{ id: string }>()
  const id = params?.id
  const [group, setGroup] = useState<Group | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetch(`/api/groups/${encodeURIComponent(id)}`, { headers: { ...userHeaders() } })
      .then(async (r) => {
        const j = await r.json()
        if (!r.ok) throw new Error(j.detail || 'Could not load group')
        return j
      })
      .then(setGroup)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load group'))
      .finally(() => setLoading(false))
  }, [id])

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Link href="/find" className="inline-flex items-center gap-1 text-label-md text-on-surface-variant hover:text-primary mb-4 transition-colors">
        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        Back to groups
      </Link>

      {loading && <div className="card text-on-surface-variant">Loading group…</div>}
      {error && <div className="card text-error">{error}</div>}

      {group && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-secondary">diversity_3</span>
            <h1 className="text-headline-md text-on-surface">{group.name}</h1>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
            <GroupChat groupId={group.group_id} />
            <aside className="card h-fit">
              <h3 className="text-label-md font-semibold text-on-surface mb-2">Members ({group.members.length})</h3>
              <ul className="space-y-1">
                {group.members.map((m) => (
                  <li key={m.user_id} className="text-body-md text-on-surface-variant flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-on-surface-variant">account_circle</span>
                    {m.username}
                  </li>
                ))}
              </ul>
              {group.criteria_text && (
                <p className="text-caption text-on-surface-variant mt-3 pt-3 border-t border-outline-variant">{group.criteria_text}</p>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  )
}
