import { NextResponse } from 'next/server'

import { apiBase } from '@/lib/apiBase'
const PYTHON_API_URL = apiBase()

export async function GET() {
  try {
    const res = await fetch(`${PYTHON_API_URL}/api/tag-vocab`, {
      // vocab is static; let Next cache it for an hour
      next: { revalidate: 3600 },
    })
    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json({ detail: data.detail || 'Could not load vocab' }, { status: res.status })
    }
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ visa: [], consulate: [], consulate_options: [], tag: [], stage_key: [], date_key: [] }, { status: 200 })
  }
}
