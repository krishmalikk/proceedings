/**
 * Base URL of the FastAPI backend that the Next.js proxy routes forward to.
 *
 * Every proxy appends its own "/api/..." path (e.g. `${apiBase()}/api/users`),
 * so the env var is expected to be the bare backend ORIGIN with no path. We
 * normalize defensively: a trailing slash — or an accidental trailing "/api"
 * segment on PYTHON_API_URL — would otherwise yield "…/api/api/..." and 404
 * every call (the root cause of the /find client-side crash). Stripping both is
 * idempotent and safe for a correctly-configured value.
 */
export function apiBase(): string {
  const raw = (process.env.PYTHON_API_URL || 'http://localhost:8000').trim()
  return raw
    .replace(/\/+$/, '') // drop trailing slash(es): "…/" → "…"
    .replace(/\/api$/i, '') // drop a stray trailing "/api": "…/api" → "…"
    .replace(/\/+$/, '') // re-trim in case the input was "…/api/"
}
