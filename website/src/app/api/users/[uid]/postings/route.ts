import { NextRequest, NextResponse } from 'next/server'

import { apiBase } from '@/lib/apiBase'
const PYTHON_API_URL = apiBase()

export const dynamic = 'force-dynamic' // a user's posting list must be live, not cached

// GET /api/users/[uid]/postings — all app postings authored by a user.
export async function GET(_request: NextRequest, { params }: { params: { uid: string } }) {
  try {
    const res = await fetch(
      `${PYTHON_API_URL}/api/users/${encodeURIComponent(params.uid)}/postings`,
      { cache: 'no-store' }
    )
    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json({ detail: data.detail || 'Could not load postings' }, { status: res.status })
    }
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ detail: 'Unable to reach the postings service.' }, { status: 503 })
  }
}
