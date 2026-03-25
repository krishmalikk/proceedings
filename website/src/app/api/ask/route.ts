import { NextRequest, NextResponse } from 'next/server'

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const question = body.question?.trim()

    if (!question || question.length < 5 || question.length > 500) {
      return NextResponse.json(
        { detail: 'Question must be between 5 and 500 characters.' },
        { status: 400 }
      )
    }

    const res = await fetch(`${PYTHON_API_URL}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    })

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
      { detail: 'Unable to reach the question service. Please try again later.' },
      { status: 503 }
    )
  }
}
