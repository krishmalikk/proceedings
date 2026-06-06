import { NextRequest, NextResponse } from 'next/server'

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000'

// POST /api/reconcile — merge the active user's profile with an in-progress message.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const uid = request.headers.get('x-user-id') || ''
    const res = await fetch(`${PYTHON_API_URL}/api/reconcile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(uid ? { 'X-User-Id': uid } : {}) },
      body: JSON.stringify({ message: body.message || {} }),
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ detail: data.detail || 'Reconcile failed' }, { status: res.status })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ detail: 'Unable to reach the reconcile service.' }, { status: 503 })
  }
}
