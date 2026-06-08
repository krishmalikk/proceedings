import { NextRequest, NextResponse } from 'next/server'

import { apiBase } from '@/lib/apiBase'
const PYTHON_API_URL = apiBase()

function userHeader(request: NextRequest): Record<string, string> {
  const uid = request.headers.get('x-user-id') || ''
  return uid ? { 'X-User-Id': uid } : {}
}

// POST /api/find/chat — one expert-chat turn that builds the match criteria.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const res = await fetch(`${PYTHON_API_URL}/api/find/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...userHeader(request) },
      body: JSON.stringify({ messages: body.messages || [], draft: body.draft || {} }),
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ detail: data.detail || 'Find chat failed' }, { status: res.status })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ detail: 'Unable to reach the find service.' }, { status: 503 })
  }
}
