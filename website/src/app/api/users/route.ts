import { NextRequest, NextResponse } from 'next/server'

import { apiBase } from '@/lib/apiBase'
const PYTHON_API_URL = apiBase()

// GET /api/users — the baked seed roster for the dev persona picker.
export async function GET() {
  try {
    const res = await fetch(`${PYTHON_API_URL}/api/users`, { next: { revalidate: 300 } })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ detail: data.detail || 'Could not load users' }, { status: res.status })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}

// POST /api/users — mint a fresh dev user to onboard from scratch.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const res = await fetch(`${PYTHON_API_URL}/api/users`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ detail: data.detail || 'Could not create user' }, { status: res.status })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ detail: 'Unable to reach the user service.' }, { status: 503 })
  }
}
