'use client'

import { useState } from 'react'
import { AlertTriangle, MessageCircle } from 'lucide-react'
import AskForm from '@/components/AskForm'
import QAList from '@/components/QAList'

const POPULAR_QUESTIONS = [
  'How do I apply for a green card through marriage?',
  'What are the H-1B visa requirements?',
  'What is the naturalization process?',
  'How do I apply for asylum in the US?',
  'What is DACA and who is eligible?',
  'How do I get a work permit (EAD)?',
]

export default function AskPage() {
  const [selectedQuestion, setSelectedQuestion] = useState('')

  return (
    <>
      {/* Hero / Ask Section */}
      <section className="bg-cream-100 py-12 sm:py-16 lg:py-20">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="text-center mb-10">
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="w-12 h-0.5 bg-ink-900" />
              <span className="text-xs font-medium uppercase tracking-widest text-ink-500">Legal Q&A</span>
              <div className="w-12 h-0.5 bg-ink-900" />
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-normal leading-tight tracking-tight font-serif text-ink-900 mb-4">
              Ask a Legal Question
            </h1>

            <p className="text-lg text-ink-600 max-w-2xl mx-auto">
              Get answers about immigration, visas, green cards, and more — sourced from official government pages and law firm resources.
            </p>
          </div>

          {/* Disclaimer */}
          <div className="max-w-2xl mx-auto mb-8">
            <div className="flex items-start gap-3 px-4 py-3 bg-cream-300/50 border border-cream-400 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-ink-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-ink-600">
                This tool provides general information only. It does not provide legal advice, eligibility determinations, or case assessments. For case-specific guidance, consult a licensed attorney.
              </p>
            </div>
          </div>

          {/* Ask Form */}
          <div className="max-w-2xl mx-auto">
            <AskForm key={selectedQuestion} initialQuestion={selectedQuestion} />
          </div>
        </div>
      </section>

      {/* Popular Questions */}
      <section className="bg-white py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="text-center mb-8">
            <span className="text-xs font-medium uppercase tracking-widest text-ink-500">Popular</span>
            <h2 className="text-3xl sm:text-4xl font-normal leading-tight font-serif text-ink-900 mt-4">
              Common Questions
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-3xl mx-auto">
            {POPULAR_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => {
                  setSelectedQuestion('')
                  setTimeout(() => setSelectedQuestion(q), 0)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="bg-white border border-ink-100 rounded-2xl p-4 text-left shadow-sm transition-all duration-200 hover:shadow-md hover:border-ink-200 group"
              >
                <div className="flex items-start gap-3">
                  <MessageCircle className="w-4 h-4 text-ink-300 mt-1 flex-shrink-0 group-hover:text-ink-500 transition-colors" />
                  <p className="text-sm text-ink-700 leading-snug group-hover:text-ink-900 transition-colors">
                    {q}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Questions */}
      <section className="bg-cream-100 py-20 sm:py-24 lg:py-32">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="text-center mb-12">
            <span className="text-xs font-medium uppercase tracking-widest text-ink-500">Community</span>
            <h2 className="text-3xl sm:text-4xl font-normal leading-tight font-serif text-ink-900 mt-4">
              Recent Questions
            </h2>
            <p className="mt-3 text-ink-600">
              Browse questions others have asked about legal topics.
            </p>
          </div>

          <div className="max-w-2xl mx-auto">
            <QAList />
          </div>
        </div>
      </section>
    </>
  )
}
