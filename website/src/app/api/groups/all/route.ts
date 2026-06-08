import { NextRequest, NextResponse } from 'next/server'

import { apiBase } from '@/lib/apiBase'
const PYTHON_API_URL = apiBase()

function userHeader(request: NextRequest): Record<string, string> {
  const uid = request.headers.get('x-user-id') || ''
  return uid ? { 'X-User-Id': uid } : {}
}

// GET /api/groups/all — all groups to browse (flagged with the viewer's membership).
export async function GET(request: NextRequest) {
  try {
    const res = await fetch(`${PYTHON_API_URL}/api/groups/all`, { headers: { ...userHeader(request) } })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ detail: data.detail || 'Could not load groups' }, { status: res.status })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ detail: 'Unable to reach the groups service.' }, { status: 503 })
  }
}
