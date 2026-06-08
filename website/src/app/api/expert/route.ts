import { NextRequest, NextResponse } from 'next/server'

import { apiBase } from '@/lib/apiBase'
const PYTHON_API_URL = apiBase()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const question = body.question?.trim()
    const history = Array.isArray(body.history) ? body.history : []

    if (!question || question.length < 3 || question.length > 500) {
      return NextResponse.json(
        { detail: 'Message must be between 3 and 500 characters.' },
        { status: 400 }
      )
    }

    const res = await fetch(`${PYTHON_API_URL}/api/expert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, history }),
    })
    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json({ detail: data.detail || 'Backend error' }, { status: res.status })
    }
    return NextResponse.json(data)
  } catch {
    return NextResponse.json(
      { detail: 'Unable to reach the AI service. Please try again later.' },
      { status: 503 }
    )
  }
}
