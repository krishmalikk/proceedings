import { NextRequest, NextResponse } from 'next/server'

import { apiBase } from '@/lib/apiBase'
const PYTHON_API_URL = apiBase()

function userHeader(request: NextRequest): Record<string, string> {
  const uid = request.headers.get('x-user-id') || ''
  return uid ? { 'X-User-Id': uid } : {}
}

// GET /api/profile — the active user's profile.
export async function GET(request: NextRequest) {
  try {
    const res = await fetch(`${PYTHON_API_URL}/api/profile`, { headers: { ...userHeader(request) } })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ detail: data.detail || 'Could not load profile' }, { status: res.status })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ detail: 'Unable to reach the profile service.' }, { status: 503 })
  }
}

// PUT /api/profile — validate + save the active user's profile.
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const res = await fetch(`${PYTHON_API_URL}/api/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...userHeader(request) },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ detail: data.detail || 'Could not save profile' }, { status: res.status })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ detail: 'Unable to reach the profile service.' }, { status: 503 })
  }
}
