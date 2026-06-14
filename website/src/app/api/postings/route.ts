import { NextRequest, NextResponse } from 'next/server'

import { apiBase } from '@/lib/apiBase'
const PYTHON_API_URL = apiBase()

// POST /api/postings — publish a new posting (composer submit).
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const title = (body.title || '').trim()
    const description = (body.description || '').trim()

    if (title.length < 3 || description.length < 10) {
      return NextResponse.json(
        { detail: 'A title (3+ chars) and description (10+ chars) are required.' },
        { status: 400 }
      )
    }

    // Forward the active user so the backend records the posting↔author link
    // (the case-page author section depends on it). Anonymous if absent.
    const uid = request.headers.get('x-user-id') || ''
    const res = await fetch(`${PYTHON_API_URL}/api/postings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(uid ? { 'X-User-Id': uid } : {}) },
      body: JSON.stringify({
        title,
        description,
        tags: body.tags || {},
        key_stages_or_info: body.key_stages_or_info || {},
        key_dates: body.key_dates || {},
      }),
    })
    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json({ detail: data.detail || 'Could not publish posting' }, { status: res.status })
    }
    return NextResponse.json(data)
  } catch {
    return NextResponse.json(
      { detail: 'Unable to reach the postings service. Please try again later.' },
      { status: 503 }
    )
  }
}
