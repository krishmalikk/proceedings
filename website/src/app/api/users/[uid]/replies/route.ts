import { NextRequest, NextResponse } from 'next/server'

import { apiBase } from '@/lib/apiBase'
const PYTHON_API_URL = apiBase()

export const dynamic = 'force-dynamic' // a user's activity must be live, not cached

// GET /api/users/[uid]/replies — all replies a user has authored.
export async function GET(_request: NextRequest, { params }: { params: { uid: string } }) {
  try {
    const res = await fetch(
      `${PYTHON_API_URL}/api/users/${encodeURIComponent(params.uid)}/replies`,
      { cache: 'no-store' }
    )
    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json({ detail: data.detail || 'Could not load activity' }, { status: res.status })
    }
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ detail: 'Unable to reach the activity service.' }, { status: 503 })
  }
}
