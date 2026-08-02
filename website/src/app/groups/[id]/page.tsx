'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import GroupChat from '@/components/GroupChat'
import { userHeaders } from '@/lib/activeUser'
import { useRequireUser } from '@/lib/useRequireUser'

type Group = {
  group_id: string
  name: string
  description: string
  criteria_text?: string
  members: { user_id: string; username: string }[]
  created_by: string
  is_admin: boolean
  is_member: boolean
  created_at: string
  last_activity_at: string
}

// Relative "X ago" for data-freshness (mirrors GroupChat/ReplyItem).
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

export default function GroupPage() {
  useRequireUser()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id
  const [group, setGroup] = useState<Group | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // rename (admin only)
  const [editing, setEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [descDraft, setDescDraft] = useState('')
  const [saving, setSaving] = useState(false)

  // invite (any member)
  const [inviteHandle, setInviteHandle] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')

  // delete (admin only)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(() => {
    if (!id) return
    setLoading(true)
    fetch(`/api/groups/${encodeURIComponent(id)}`, { headers: { ...userHeaders() } })
      .then(async (r) => {
        const j = await r.json()
        if (!r.ok) throw new Error(j.detail || 'Could not load group')
        return j
      })
      .then((g: Group) => { setGroup(g); setNameDraft(g.name); setDescDraft(g.description || '') })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load group'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  async function saveRename() {
    if (!group) return
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/groups/${encodeURIComponent(group.group_id)}`, {
        method: 'PUT', headers: userHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ name: nameDraft, description: descDraft }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Could not rename group')
      setGroup(data)
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not rename group')
    } finally {
      setSaving(false)
    }
  }

  async function inviteMember() {
    if (!group || !inviteHandle.trim()) return
    setInviting(true); setInviteMsg(''); setError('')
    try {
      const res = await fetch(`/api/groups/${encodeURIComponent(group.group_id)}/invite`, {
        method: 'POST', headers: userHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ handle: inviteHandle.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Could not invite that handle')
      setGroup(data)
      setInviteHandle('')
      setInviteMsg('Added to the group.')
    } catch (e) {
      setInviteMsg(e instanceof Error ? e.message : 'Could not invite that handle')
    } finally {
      setInviting(false)
    }
  }

  async function deleteGroup() {
    if (!group) return
    setDeleting(true); setError('')
    try {
      const res = await fetch(`/api/groups/${encodeURIComponent(group.group_id)}`, {
        method: 'DELETE', headers: userHeaders(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Could not delete group')
      router.push('/find')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete group')
      setDeleting(false)
      setConfirmingDelete(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Link href="/find" className="inline-flex items-center gap-1 text-label-md text-on-surface-variant hover:text-primary mb-4 transition-colors">
        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        Back to groups
      </Link>

      {loading && <div className="card text-on-surface-variant">Loading group…</div>}
      {error && <div className="card text-error mb-4">{error}</div>}

      {group && (
        <>
          <div className="mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="material-symbols-outlined text-secondary">diversity_3</span>
              {editing ? (
                <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} maxLength={100}
                  className="text-headline-md text-on-surface bg-surface-container-lowest border border-outline-variant rounded-lg px-2 py-1 focus:outline-none focus:border-primary" />
              ) : (
                <h1 className="text-headline-md text-on-surface">{group.name}</h1>
              )}
              {group.is_admin && !editing && (
                <button onClick={() => setEditing(true)} className="text-label-md text-primary hover:underline">Rename</button>
              )}
            </div>
            {editing ? (
              <div className="mt-2 space-y-2 max-w-xl">
                <textarea value={descDraft} onChange={(e) => setDescDraft(e.target.value)} maxLength={500}
                  placeholder="What's this group for?"
                  className="w-full text-body-md bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 focus:outline-none focus:border-primary" rows={2} />
                <div className="flex gap-2">
                  <button onClick={saveRename} disabled={saving || !nameDraft.trim()} className="btn-primary text-label-md disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => { setEditing(false); setNameDraft(group.name); setDescDraft(group.description || '') }}
                    className="btn-tertiary text-label-md">Cancel</button>
                </div>
              </div>
            ) : (
              group.description && <p className="text-body-md text-on-surface-variant mt-1">{group.description}</p>
            )}
            <p className="text-caption text-on-surface-variant mt-1">
              Created {timeAgo(group.created_at) || group.created_at}
              {group.last_activity_at && ` · Last activity ${timeAgo(group.last_activity_at)}`}
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
            <GroupChat groupId={group.group_id} />
            <aside className="card h-fit space-y-3">
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-2">Members ({group.members.length})</h3>
                <ul className="space-y-1">
                  {group.members.map((m) => (
                    <li key={m.user_id} className="text-body-md text-on-surface-variant flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-on-surface-variant">account_circle</span>
                      {m.username}
                      {m.user_id === group.created_by && (
                        <span className="text-caption text-primary bg-primary-container px-1.5 py-0.5 rounded-full">Admin</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-3 border-t border-outline-variant">
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Invite someone</h3>
                <p className="text-caption text-on-surface-variant mb-2">Know someone else in the same boat? Add them by handle.</p>
                <div className="flex gap-1.5">
                  <input value={inviteHandle} onChange={(e) => setInviteHandle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); inviteMember() } }}
                    placeholder="their handle…"
                    className="flex-1 min-w-0 bg-surface-container-lowest border border-outline-variant rounded-lg px-2 py-1.5 text-body-md focus:outline-none focus:border-primary" />
                  <button onClick={inviteMember} disabled={inviting || !inviteHandle.trim()} className="btn-secondary text-label-md disabled:opacity-50">
                    {inviting ? '…' : 'Invite'}
                  </button>
                </div>
                {inviteMsg && <p className="text-caption text-on-surface-variant mt-1">{inviteMsg}</p>}
              </div>

              {group.criteria_text && (
                <p className="text-caption text-on-surface-variant pt-3 border-t border-outline-variant">{group.criteria_text}</p>
              )}

              {group.is_admin && (
                <div className="pt-3 border-t border-outline-variant">
                  {confirmingDelete ? (
                    <div className="space-y-2">
                      <p className="text-caption text-error">Delete this group for everyone? This can&apos;t be undone.</p>
                      <div className="flex gap-2">
                        <button onClick={deleteGroup} disabled={deleting} className="text-label-md text-error hover:underline disabled:opacity-50">
                          {deleting ? 'Deleting…' : 'Confirm delete'}
                        </button>
                        <button onClick={() => setConfirmingDelete(false)} disabled={deleting} className="text-label-md text-on-surface-variant hover:underline">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmingDelete(true)} className="text-label-md text-error hover:underline">
                      Delete group
                    </button>
                  )}
                </div>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  )
}
