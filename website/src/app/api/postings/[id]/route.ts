import { NextRequest, NextResponse } from 'next/server'

import { apiBase } from '@/lib/apiBase'
const PYTHON_API_URL = apiBase()

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const res = await fetch(
      `${PYTHON_API_URL}/api/postings/${encodeURIComponent(params.id)}`
    )
    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { detail: data.detail || 'Posting not found' },
        { status: res.status }
      )
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json(
      { detail: 'Unable to reach the postings service. Please try again later.' },
      { status: 503 }
    )
  }
}
