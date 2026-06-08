import { NextRequest, NextResponse } from 'next/server'

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000'

function userHeader(request: NextRequest): Record<string, string> {
  const uid = request.headers.get('x-user-id') || ''
  return uid ? { 'X-User-Id': uid } : {}
}

// GET /api/groups/{id} — one group (name, members, is_member) for the chat page.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const res = await fetch(`${PYTHON_API_URL}/api/groups/${encodeURIComponent(params.id)}`, {
      headers: { ...userHeader(request) },
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ detail: data.detail || 'Could not load group' }, { status: res.status })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ detail: 'Unable to reach the groups service.' }, { status: 503 })
  }
}
