'use client'

import { useState, useEffect, useRef } from 'react'
import SourceCitation from './SourceCitation'
import Markdown from './Markdown'
import PostingCard, { type PostingCardData } from './PostingCard'
import StrictnessSlider, { useStrictness, AppliedFilters } from './StrictnessSlider'
import SuggestedFilters, { facetId, type SuggestedFilterGroup } from './SuggestedFilters'

interface Source {
  chunk_id: string
  text: string
  source: string
  labels: string[]
  score: number
}

interface ChatResult {
  mode: 'answer' | 'search'
  intent: string
  answer: string
  sources: Source[]
  is_fallback: boolean
  results: PostingCardData[]
  next_page_token: string
  applied_filters: Record<string, unknown>
  relaxed: boolean
  effective_strictness: string
  suggested_filters: SuggestedFilterGroup[]
  id: string
}

interface Message {
  id: string
  type: 'user' | 'ai'
  mode?: 'answer' | 'search'
  content: string
  sources?: Source[]
  results?: PostingCardData[]
  appliedFilters?: Record<string, unknown>
  relaxed?: boolean
  suggestedFilters?: SuggestedFilterGroup[]
  query?: string
  resultId?: string
}

const suggestedTopics = [
  { icon: 'work', label: 'H-1B Process', question: 'What is the H-1B visa process and requirements?' },
  { icon: 'card_membership', label: 'Green Card Eligibility', question: 'How do I know if I\'m eligible for a green card?' },
  { icon: 'fact_check', label: 'Document Checklist', question: 'What documents do I need for my immigration application?' },
  { icon: 'family_restroom', label: 'Family Sponsorship', question: 'How can I sponsor a family member for immigration?' },
]

const quickHelp = [
  { icon: 'school', label: 'Student Visas', question: 'How do I transition from F-1 to H-1B?' },
  { icon: 'schedule', label: 'Processing Times', question: 'What are current I-485 wait times?' },
]

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [strictness, setStrictness] = useStrictness()
  const [selectedFacets, setSelectedFacets] = useState<string[]>([])
  const [lastQuery, setLastQuery] = useState('')
  const [feedbackGiven, setFeedbackGiven] = useState<Set<string>>(new Set())
  const chatHistoryRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight
    }
  }, [messages])

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }

  async function submitQuestion(question: string, facets: string[] = selectedFacets) {
    if (!question.trim() || question.trim().length < 5) return
    setLastQuery(question.trim())

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: question.trim(),
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setLoading(true)

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim(), strictness, facets }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || `Request failed (${res.status})`)
      }

      const data: ChatResult = await res.json()

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        mode: data.mode,
        content: data.answer,
        sources: data.sources,
        results: data.results,
        appliedFilters: data.applied_filters,
        relaxed: data.relaxed,
        suggestedFilters: data.suggested_filters,
        query: question.trim(),
        resultId: data.id,
      }

      setMessages(prev => [...prev, aiMessage])
    } catch (err) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  // Clicking a suggested-filter chip toggles it and re-asks the last question
  // with the selected facets applied as exact filters.
  function toggleFacet(field: string, code: string) {
    const id = facetId(field, code)
    const next = selectedFacets.includes(id)
      ? selectedFacets.filter((x) => x !== id)
      : [...selectedFacets, id]
    setSelectedFacets(next)
    if (lastQuery) submitQuestion(lastQuery, next)
  }

  async function handleFeedback(messageId: string, resultId: string, helpful: boolean) {
    if (feedbackGiven.has(messageId)) return

    setFeedbackGiven(prev => new Set([...Array.from(prev), messageId]))

    try {
      await fetch(`/api/qa/${resultId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ helpful }),
      })
    } catch {
      // Feedback is best-effort
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submitQuestion(inputValue)
    }
  }

  return (
    <div className="flex h-[calc(100vh-64px-64px)] md:h-[calc(100vh-64px)]">
      {/* Sidebar - Desktop only */}
      <aside className="hidden md:flex flex-col w-72 bg-surface-container-low border-r border-outline-variant p-6 gap-6 overflow-y-auto">
        <div>
          <h3 className="text-label-md text-primary mb-3 uppercase tracking-wider font-semibold">
            Suggested Topics
          </h3>
          <div className="space-y-1">
            {suggestedTopics.map((topic) => (
              <button
                key={topic.label}
                onClick={() => submitQuestion(topic.question)}
                disabled={loading}
                className="w-full text-left p-3 rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant text-body-md flex items-center gap-3 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[20px]">{topic.icon}</span>
                {topic.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto">
          <h3 className="text-label-md text-primary mb-3 uppercase tracking-wider font-semibold">
            Recent History
          </h3>
          <div className="space-y-1 opacity-60">
            {messages.filter(m => m.type === 'user').slice(-3).map((msg) => (
              <div key={msg.id} className="p-2 text-caption text-on-surface-variant truncate">
                {msg.content}
              </div>
            ))}
            {messages.filter(m => m.type === 'user').length === 0 && (
              <div className="p-2 text-caption text-on-surface-variant">No recent questions</div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <section className="flex-1 flex flex-col bg-background">
        {/* Message History */}
        <div
          ref={chatHistoryRef}
          className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6"
        >
          {messages.length === 0 ? (
            /* Welcome Screen */
            <div className="max-w-3xl mx-auto space-y-8 py-4">
              <div className="text-center space-y-2">
                <h1 className="text-headline-lg text-primary">Your Immigration Assistant</h1>
                <p className="text-body-md text-on-surface-variant max-w-lg mx-auto">
                  Ask any question about US immigration processes, forms, or eligibility.
                  I&apos;m here to guide you with official citations.
                </p>
              </div>

              {/* Quick Help Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {quickHelp.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => submitQuestion(item.question)}
                    disabled={loading}
                    className="p-4 bg-surface-container-low rounded-xl text-left hover:bg-surface-container border border-transparent hover:border-primary-container transition-all group disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-secondary mb-1">{item.icon}</span>
                    <div className="text-label-md text-on-surface">{item.label}</div>
                    <div className="text-caption text-on-surface-variant group-hover:text-primary transition-colors">
                      {item.question}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Chat Messages */
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((message, idx) => (
                <div key={message.id}>
                  {message.type === 'user' ? (
                    /* User Message */
                    <div className="flex gap-3 justify-end">
                      <div className="bg-primary-container text-on-primary-container rounded-2xl rounded-tr-sm p-4 max-w-[85%] shadow-sm">
                        {message.content}
                      </div>
                      <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-on-surface-variant text-[18px]">person</span>
                      </div>
                    </div>
                  ) : (
                    /* AI Message */
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-white text-[18px]">smart_toy</span>
                      </div>
                      <div className="flex-1 space-y-2">
                        {message.mode === 'search' ? (
                          /* Search mode — ranked posting cards */
                          <div className="space-y-3">
                            <p className="text-caption text-on-surface-variant px-1">
                              Here are matching experiences:
                            </p>
                            <AppliedFilters filters={message.appliedFilters} relaxed={message.relaxed} />
                            {message.results?.map((r) => (
                              <PostingCard key={r.case_id} r={r} />
                            ))}
                            {message.query && (
                              <a
                                href={`/search?q=${encodeURIComponent(message.query)}`}
                                className="inline-flex items-center gap-1 text-caption text-primary px-1 hover:underline"
                              >
                                View all results
                                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                              </a>
                            )}
                          </div>
                        ) : (
                        <div className="bg-surface-container rounded-2xl rounded-tl-sm p-4 text-on-surface">
                          <Markdown>{message.content}</Markdown>
                        </div>
                        )}

                        {/* Sources (answer mode) */}
                        {message.mode !== 'search' && message.sources && message.sources.length > 0 && (
                          <div className="flex gap-2 items-center px-1">
                            <span className="text-caption text-outline">Sources:</span>
                            {Array.from(new Set(message.sources.map(s => s.source))).slice(0, 3).map((source) => (
                              <SourceCitation key={source} source={source} />
                            ))}
                          </div>
                        )}

                        {/* Feedback */}
                        {message.resultId && (
                          <div className="flex items-center gap-2 px-1">
                            {feedbackGiven.has(message.id) ? (
                              <span className="text-caption text-on-surface-variant">Thanks for your feedback!</span>
                            ) : (
                              <>
                                <span className="text-caption text-outline">Helpful?</span>
                                <button
                                  onClick={() => handleFeedback(message.id, message.resultId!, true)}
                                  className="p-1 rounded hover:bg-surface-container transition-colors"
                                >
                                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant hover:text-secondary">thumb_up</span>
                                </button>
                                <button
                                  onClick={() => handleFeedback(message.id, message.resultId!, false)}
                                  className="p-1 rounded hover:bg-surface-container transition-colors"
                                >
                                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant hover:text-error">thumb_down</span>
                                </button>
                              </>
                            )}
                          </div>
                        )}

                        {/* Context-aware refinements (only on the latest reply) */}
                        {idx === messages.length - 1 && message.suggestedFilters && message.suggestedFilters.length > 0 && (
                          <div className="bg-surface-container-low rounded-xl p-3 mt-1">
                            <SuggestedFilters
                              groups={message.suggestedFilters}
                              selected={new Set(selectedFacets)}
                              onToggle={toggleFacet}
                              title="Refine to related experiences"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Loading indicator */}
              {loading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-white text-[18px]">smart_toy</span>
                  </div>
                  <div className="bg-surface-container rounded-2xl rounded-tl-sm p-4">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-outline rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-outline rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-outline rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 md:p-6 border-t border-outline-variant bg-surface">
          <div className="max-w-3xl mx-auto space-y-2">
            <div className="bg-surface-container-low rounded-xl px-4 py-2 max-w-xs">
              <StrictnessSlider value={strictness} onChange={setStrictness} />
            </div>
            <div className="relative flex items-end gap-2 bg-surface-container-highest rounded-xl p-2 border-2 border-transparent focus-within:border-primary transition-all">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder="Type your immigration question here..."
                rows={1}
                maxLength={500}
                disabled={loading}
                className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-body-md text-on-surface p-2 resize-none max-h-32"
              />
              <button
                onClick={() => submitQuestion(inputValue)}
                disabled={loading || inputValue.trim().length < 5}
                className="bg-primary text-on-primary p-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center"
              >
                <span className="material-symbols-outlined">send</span>
              </button>
            </div>

            <div className="flex justify-between items-center px-1">
              <p className="text-caption text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
                Confidential. This AI provides information, not legal advice.
              </p>
              <span className="text-caption text-outline">{inputValue.length}/500</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
