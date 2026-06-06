import { NextResponse } from 'next/server'

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000'

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
