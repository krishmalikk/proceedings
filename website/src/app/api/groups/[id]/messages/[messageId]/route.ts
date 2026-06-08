import { NextRequest, NextResponse } from 'next/server'

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000'

function userHeader(request: NextRequest): Record<string, string> {
  const uid = request.headers.get('x-user-id') || ''
  return uid ? { 'X-User-Id': uid } : {}
}

// DELETE /api/groups/{id}/messages/{messageId} — author-only soft delete.
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; messageId: string } }
) {
  try {
    const res = await fetch(
      `${PYTHON_API_URL}/api/groups/${encodeURIComponent(params.id)}/messages/${encodeURIComponent(params.messageId)}`,
      { method: 'DELETE', headers: { ...userHeader(request) } }
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json({ detail: data.detail || 'Could not delete message' }, { status: res.status })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ detail: 'Unable to reach the chat service.' }, { status: 503 })
  }
}
