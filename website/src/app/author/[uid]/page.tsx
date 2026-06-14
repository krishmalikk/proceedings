'use client'

import { useParams, useRouter } from 'next/navigation'
import AuthorSection from '@/components/AuthorSection'

// Dedicated author view: full structured profile + all of their postings.
// Reached from the "View profile" link in the case-page author section.
export default function AuthorPage() {
  const params = useParams<{ uid: string }>()
  const router = useRouter()
  const uid = params?.uid || ''

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-secondary hover:underline mb-4">
        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        Back
      </button>
      <h1 className="text-headline-md text-on-surface mb-4">Author profile</h1>
      {/* channel='app' so the section renders; compact=false shows background + journey */}
      <AuthorSection authorId={uid} channel="app" compact={false} />
    </div>
  )
}
