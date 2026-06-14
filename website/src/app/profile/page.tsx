'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getActiveUser, userHeaders } from '@/lib/activeUser'
import { useAuth } from '@/contexts/AuthContext'
import Markdown from '@/components/Markdown'
import ProfileActivity from '@/components/ProfileActivity'

type JourneyEntry = { milestone: string; date: string; experience: string; shared?: boolean; experience_case_id?: string }
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
  created_at?: string
  updated_at?: string
}

const EMPTY: Profile = {
  username: '', current_visa_or_greencard_category: [], visa_applying_for: [],
  primary_consulate: '', consulates: [], tags: [], key_stages_or_info: {}, key_dates: {},
  background_text: '', journey: [], created_at: '', updated_at: '',
}

type ConsulateOption = { code: string; label: string }
type Vocab = {
  consulate_options: ConsulateOption[]
}

export default function ProfilePage() {
  const router = useRouter()
  const { loading: authLoading } = useAuth()
  const [profile, setProfile] = useState<Profile>(EMPTY)
  const [vocab, setVocab] = useState<Vocab>({ consulate_options: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedJourney, setExpandedJourney] = useState<Set<number>>(new Set())

  useEffect(() => {
    // Wait for Firebase to restore the session before deciding — otherwise a
    // logged-in user could be bounced to /login during the restore window.
    if (authLoading) return
    const uid = getActiveUser()
    if (!uid) {
      router.push('/login')
      return
    }

    // Load profile
    fetch('/api/profile', { headers: userHeaders() })
      .then((r) => r.json())
      .then((p: Profile) => {
        setProfile({ ...EMPTY, ...p })
        setLoading(false)
      })
      .catch(() => {
        setError('Could not load profile')
        setLoading(false)
      })

    // Load vocab for consulate labels
    fetch('/api/tag-vocab')
      .then((r) => r.json())
      .then((d) => setVocab({ consulate_options: d.consulate_options || [] }))
      .catch(() => {})
  }, [router, authLoading])

  const consulateByCode = new Map(vocab.consulate_options.map((o) => [o.code, o.label]))

  const formatLabel = (key: string) =>
    key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    } catch {
      return dateStr
    }
  }

  const toggleJourney = (idx: number) => {
    setExpandedJourney((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const hasData = (arr?: string[]) => arr && arr.length > 0
  const hasObject = (obj?: Record<string, string>) => obj && Object.keys(obj).length > 0

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="card text-error text-center py-8">
          <span className="material-symbols-outlined text-[48px] mb-2">error</span>
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className="btn-secondary mt-4">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  const isEmpty =
    !hasData(profile.current_visa_or_greencard_category) &&
    !hasData(profile.visa_applying_for) &&
    !hasData(profile.consulates) &&
    !hasData(profile.tags) &&
    !hasObject(profile.key_stages_or_info) &&
    !hasObject(profile.key_dates) &&
    !profile.background_text &&
    !hasData(profile.journey as unknown as string[])

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <h1 className="text-headline-md text-on-surface">Your Profile</h1>
        <button onClick={() => router.push('/onboarding')} className="btn-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">edit</span>
          Edit Profile
        </button>
      </div>

      {isEmpty ? (
        <div className="card text-center py-12">
          <span className="material-symbols-outlined text-[64px] text-on-surface-variant mb-4">person_add</span>
          <h2 className="text-title-lg text-on-surface mb-2">No profile set up yet</h2>
          <p className="text-body-md text-on-surface-variant mb-6">
            Tell us about your immigration journey to get personalized help and connect with others in similar situations.
          </p>
          <button onClick={() => router.push('/onboarding')} className="btn-primary">
            Set Up Your Profile
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Account Info */}
          <div className="card">
            <div className="flex items-center gap-4">
              <span className="material-symbols-outlined text-[56px] text-primary">account_circle</span>
              <div>
                <h2 className="text-title-lg text-on-surface">{profile.username || 'Anonymous User'}</h2>
                {profile.created_at && (
                  <p className="text-caption text-on-surface-variant">
                    Member since {formatDate(profile.created_at)}
                  </p>
                )}
                {profile.updated_at && (
                  <p className="text-caption text-on-surface-variant">
                    Last updated {formatDate(profile.updated_at)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Visa Status */}
          {(hasData(profile.current_visa_or_greencard_category) || hasData(profile.visa_applying_for)) && (
            <div className="card">
              <h3 className="text-title-md text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">badge</span>
                Visa Status
              </h3>
              {hasData(profile.current_visa_or_greencard_category) && (
                <div className="mb-3">
                  <p className="text-caption uppercase tracking-wide text-on-surface-variant mb-2">Current Status</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.current_visa_or_greencard_category.map((v, i) => (
                      <span key={i} className="badge-primary">{v}</span>
                    ))}
                  </div>
                </div>
              )}
              {hasData(profile.visa_applying_for) && (
                <div>
                  <p className="text-caption uppercase tracking-wide text-on-surface-variant mb-2">Applying For</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.visa_applying_for.map((v, i) => (
                      <span key={i} className="badge-secondary">{v}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Consulates */}
          {hasData(profile.consulates) && (
            <div className="card">
              <h3 className="text-title-md text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">location_on</span>
                Consulates
              </h3>
              <div className="flex flex-wrap gap-2">
                {profile.consulates.map((c, i) => (
                  <span key={i} className="pill-active flex items-center gap-1">
                    {c === profile.primary_consulate && (
                      <span className="material-symbols-outlined text-[14px]">star</span>
                    )}
                    {consulateByCode.get(c) || c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Key Stages / Info */}
          {hasObject(profile.key_stages_or_info) && (
            <div className="card">
              <h3 className="text-title-md text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">checklist</span>
                Key Stages
              </h3>
              <div className="space-y-2">
                {Object.entries(profile.key_stages_or_info).map(([k, v], i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-outline-variant last:border-0">
                    <span className="text-body-md text-on-surface-variant">{formatLabel(k)}</span>
                    <span className="badge-default">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Key Dates */}
          {hasObject(profile.key_dates) && (
            <div className="card">
              <h3 className="text-title-md text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">calendar_month</span>
                Key Dates
              </h3>
              <div className="space-y-2">
                {Object.entries(profile.key_dates).map(([k, v], i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-outline-variant last:border-0">
                    <span className="text-body-md text-on-surface-variant">{formatLabel(k)}</span>
                    <span className="text-body-md font-medium text-on-surface">{formatDate(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {hasData(profile.tags) && (
            <div className="card">
              <h3 className="text-title-md text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">sell</span>
                Topics & Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {profile.tags.map((t, i) => (
                  <span key={i} className="pill-inactive">{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Background */}
          {profile.background_text && (
            <div className="card">
              <h3 className="text-title-md text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">description</span>
                Background
              </h3>
              <div className="prose prose-sm max-w-none text-on-surface">
                <Markdown>{profile.background_text}</Markdown>
              </div>
            </div>
          )}

          {/* Journey / Experiences */}
          {profile.journey && profile.journey.length > 0 && (
            <div className="card">
              <h3 className="text-title-md text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">timeline</span>
                Immigration Journey
              </h3>
              <ol className="relative border-l border-outline-variant ml-2 space-y-4">
                {profile.journey.map((entry, idx) => (
                  <li key={idx} className="ml-4">
                    <span className="absolute -left-[5px] mt-1 w-2.5 h-2.5 rounded-full bg-primary" />
                    <button
                      onClick={() => toggleJourney(idx)}
                      className="w-full text-left hover:bg-surface-container-low rounded-lg p-2 -ml-2 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-label-md font-semibold text-on-surface">
                          {formatLabel(entry.milestone)}
                        </span>
                        <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                          {expandedJourney.has(idx) ? 'expand_less' : 'expand_more'}
                        </span>
                      </div>
                      {entry.date && (
                        <p className="text-caption text-on-surface-variant">{formatDate(entry.date)}</p>
                      )}
                      {entry.shared && (
                        <span className="badge-success text-caption mt-1">Shared with community</span>
                      )}
                    </button>
                    {expandedJourney.has(idx) && entry.experience && (
                      <div className="mt-2 p-3 bg-surface-container-low rounded-lg">
                        <p className="text-body-md text-on-surface whitespace-pre-wrap">{entry.experience}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* The logged-in user's own activity on the portal */}
      <div className="mt-6">
        <ProfileActivity uid={getActiveUser()} />
      </div>
    </div>
  )
}
