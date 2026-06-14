import { NextRequest, NextResponse } from 'next/server'

import { apiBase } from '@/lib/apiBase'
const PYTHON_API_URL = apiBase()

export const dynamic = 'force-dynamic' // an author's profile must be live, not cached

// GET /api/users/[uid]/public-profile — a posting author's structured profile.
export async function GET(_request: NextRequest, { params }: { params: { uid: string } }) {
  try {
    const res = await fetch(
      `${PYTHON_API_URL}/api/users/${encodeURIComponent(params.uid)}/public-profile`,
      { cache: 'no-store' }
    )
    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json({ detail: data.detail || 'Profile not found' }, { status: res.status })
    }
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ detail: 'Unable to reach the profile service.' }, { status: 503 })
  }
}
