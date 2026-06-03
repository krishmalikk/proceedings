import { NextRequest, NextResponse } from 'next/server'

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000'

export async function GET(request: NextRequest) {
  try {
    // Forward the incoming query string (q, visa, consulate, outcome, page_*) as-is.
    const qs = request.nextUrl.search
    const res = await fetch(`${PYTHON_API_URL}/api/search${qs}`, { method: 'GET' })
    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { detail: data.detail || 'Backend error' },
        { status: res.status }
      )
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json(
      { detail: 'Unable to reach the search service. Please try again later.' },
      { status: 503 }
    )
  }
}
