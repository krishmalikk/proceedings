import { NextRequest, NextResponse } from 'next/server'

import { apiBase } from '@/lib/apiBase'
const PYTHON_API_URL = apiBase()

function userHeader(request: NextRequest): Record<string, string> {
  const uid = request.headers.get('x-user-id') || ''
  const tok = request.headers.get('authorization') || ''
  return { ...(uid ? { 'X-User-Id': uid } : {}), ...(tok ? { Authorization: tok } : {}) }
}

// DELETE /api/postings/{id}/replies/{replyId} — author-only soft delete.
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; replyId: string } }
) {
  try {
    const res = await fetch(
      `${PYTHON_API_URL}/api/postings/${encodeURIComponent(params.id)}/replies/${encodeURIComponent(params.replyId)}`,
      { method: 'DELETE', headers: { ...userHeader(request) } }
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json({ detail: data.detail || 'Could not delete reply' }, { status: res.status })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ detail: 'Unable to reach the replies service.' }, { status: 503 })
  }
}
