import { NextRequest, NextResponse } from 'next/server'

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000'

function userHeader(request: NextRequest): Record<string, string> {
  const uid = request.headers.get('x-user-id') || ''
  return uid ? { 'X-User-Id': uid } : {}
}

// GET /api/postings/{id}/replies — flat replies + the posting's vote tally.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sort = request.nextUrl.searchParams.get('sort') || 'top'
    const res = await fetch(
      `${PYTHON_API_URL}/api/postings/${encodeURIComponent(params.id)}/replies?sort=${encodeURIComponent(sort)}`,
      { headers: { ...userHeader(request) } }
    )
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ detail: data.detail || 'Could not load replies' }, { status: res.status })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ detail: 'Unable to reach the replies service.' }, { status: 503 })
  }
}

// POST /api/postings/{id}/replies — post a reply (requires an active user).
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const res = await fetch(`${PYTHON_API_URL}/api/postings/${encodeURIComponent(params.id)}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...userHeader(request) },
      body: JSON.stringify({ body: body.body }),
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ detail: data.detail || 'Could not post reply' }, { status: res.status })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ detail: 'Unable to reach the replies service.' }, { status: 503 })
  }
}
