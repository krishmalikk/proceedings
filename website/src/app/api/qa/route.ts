import { NextRequest, NextResponse } from 'next/server'

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit') || '20'
    const offset = searchParams.get('offset') || '0'
    const category = searchParams.get('category') || ''

    const params = new URLSearchParams({ limit, offset })
    if (category) params.set('category', category)

    const res = await fetch(
      `${PYTHON_API_URL}/api/qa?${params}`
    )

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
      { items: [] },
      { status: 200 }
    )
  }
}
