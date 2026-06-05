import { NextRequest, NextResponse } from 'next/server'

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const title = (body.title || '').trim()
    const description = (body.description || '').trim()

    if (title.length < 3 || description.length < 10) {
      return NextResponse.json(
        { detail: 'Enter a title (3+ chars) and a description (10+ chars) before suggesting tags.' },
        { status: 400 }
      )
    }

    const res = await fetch(`${PYTHON_API_URL}/api/tag-suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description }),
    })
    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json({ detail: data.detail || 'Could not suggest tags' }, { status: res.status })
    }
    return NextResponse.json(data)
  } catch {
    return NextResponse.json(
      { detail: 'Unable to reach the tagging service. Please try again later.' },
      { status: 503 }
    )
  }
}
