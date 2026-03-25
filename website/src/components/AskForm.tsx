'use client'

import { useState } from 'react'
import { Send, ThumbsUp, ThumbsDown, Loader2, AlertTriangle } from 'lucide-react'
import SourceCitation from './SourceCitation'

interface Source {
  chunk_id: string
  text: string
  source: string
  labels: string[]
  score: number
}

interface AskResult {
  answer: string
  sources: Source[]
  is_fallback: boolean
  id: string
}

export default function AskForm() {
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState<AskResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [feedbackGiven, setFeedbackGiven] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!question.trim() || question.trim().length < 5) return

    setLoading(true)
    setError('')
    setResult(null)
    setFeedbackGiven(false)

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || `Request failed (${res.status})`)
      }

      const data: AskResult = await res.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleFeedback(helpful: boolean) {
    if (!result?.id || feedbackGiven) return
    setFeedbackGiven(true)

    try {
      await fetch(`/api/qa/${result.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ helpful }),
      })
    } catch {
      // Feedback is best-effort
    }
  }

  return (
    <div>
      {/* Question Input */}
      <form onSubmit={handleSubmit} className="relative">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question about immigration law, visa processes, green cards..."
          className="w-full px-6 py-4 pr-14 text-ink-900 bg-white border border-ink-200 rounded-2xl resize-none focus:outline-none focus:border-ink-400 focus:ring-1 focus:ring-ink-400 transition-colors"
          rows={3}
          maxLength={500}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || question.trim().length < 5}
          className="absolute bottom-4 right-4 p-2.5 bg-ink-900 text-cream-50 rounded-full disabled:opacity-40 hover:bg-ink-800 transition-colors"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>
      <p className="text-xs text-ink-400 mt-2 text-right">{question.length}/500</p>

      {/* Error */}
      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Answer */}
      {result && (
        <div className="mt-8">
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-ink-900 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-cream-50 text-xs font-medium">P</span>
              </div>
              <span className="text-sm font-medium text-ink-500">Proceedings Assistant</span>
            </div>

            <div className="prose prose-ink max-w-none">
              <p className="text-ink-700 leading-relaxed whitespace-pre-wrap">
                {result.answer}
              </p>
            </div>

            {/* Sources */}
            {result.sources.length > 0 && (
              <div className="mt-6 pt-4 border-t border-ink-100">
                <p className="overline mb-3">Sources</p>
                <div className="flex flex-wrap gap-2">
                  {[...new Set(result.sources.map(s => s.source))].map((source) => (
                    <SourceCitation key={source} source={source} />
                  ))}
                </div>
              </div>
            )}

            {/* Feedback */}
            <div className="mt-4 pt-4 border-t border-ink-100 flex items-center gap-3">
              <span className="text-xs text-ink-400">Was this helpful?</span>
              {feedbackGiven ? (
                <span className="text-xs text-ink-500">Thanks for your feedback</span>
              ) : (
                <>
                  <button
                    onClick={() => handleFeedback(true)}
                    className="p-1.5 rounded-lg hover:bg-cream-200 transition-colors"
                  >
                    <ThumbsUp className="w-4 h-4 text-ink-400 hover:text-ink-700" />
                  </button>
                  <button
                    onClick={() => handleFeedback(false)}
                    className="p-1.5 rounded-lg hover:bg-cream-200 transition-colors"
                  >
                    <ThumbsDown className="w-4 h-4 text-ink-400 hover:text-ink-700" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-ink-400 mt-3 text-center">
            This is general information only, not legal advice. Consult an attorney for case-specific guidance.
          </p>
        </div>
      )}
    </div>
  )
}
