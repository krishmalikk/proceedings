import { NextRequest, NextResponse } from 'next/server'

import { apiBase } from '@/lib/apiBase'
const PYTHON_API_URL = apiBase()

function userHeader(request: NextRequest): Record<string, string> {
  const uid = request.headers.get('x-user-id') || ''
  const tok = request.headers.get('authorization') || ''
  return { ...(uid ? { 'X-User-Id': uid } : {}), ...(tok ? { Authorization: tok } : {}) }
}

// GET /api/groups/{id}/messages?since=&limit= — members-only list (polled).
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sp = request.nextUrl.searchParams
    const qs = new URLSearchParams()
    if (sp.get('since')) qs.set('since', sp.get('since') as string)
    if (sp.get('limit')) qs.set('limit', sp.get('limit') as string)
    const tail = qs.toString() ? `?${qs.toString()}` : ''
    const res = await fetch(`${PYTHON_API_URL}/api/groups/${encodeURIComponent(params.id)}/messages${tail}`, {
      headers: { ...userHeader(request) },
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ detail: data.detail || 'Could not load messages' }, { status: res.status })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ detail: 'Unable to reach the chat service.' }, { status: 503 })
  }
}

// POST /api/groups/{id}/messages — members-only send (PII-scrubbed server-side).
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const res = await fetch(`${PYTHON_API_URL}/api/groups/${encodeURIComponent(params.id)}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...userHeader(request) },
      body: JSON.stringify({ text: body.text }),
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ detail: data.detail || 'Could not send message' }, { status: res.status })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ detail: 'Unable to reach the chat service.' }, { status: 503 })
  }
}
