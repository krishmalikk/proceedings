import { NextRequest, NextResponse } from 'next/server'

import { apiBase } from '@/lib/apiBase'
const PYTHON_API_URL = apiBase()

// Postings authored under a given first-party handle (author-by-handle page).
export async function GET(
  _request: NextRequest,
  { params }: { params: { handle: string } }
) {
  try {
    const res = await fetch(
      `${PYTHON_API_URL}/api/authors/by-handle/${encodeURIComponent(params.handle)}/postings`,
      { cache: 'no-store' }
    )
    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json(
        { detail: data.detail || 'Could not load author postings' },
        { status: res.status }
      )
    }
    return NextResponse.json(data)
  } catch {
    return NextResponse.json(
      { detail: 'Unable to reach the postings service. Please try again later.' },
      { status: 503 }
    )
  }
}
