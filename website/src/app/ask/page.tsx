import { Metadata } from 'next'
import { AlertTriangle } from 'lucide-react'
import AskForm from '@/components/AskForm'
import QAList from '@/components/QAList'

export const metadata: Metadata = {
  title: 'Ask a Question | Proceedings',
  description: 'Ask questions about immigration law, visa processes, green cards, and more. Get answers backed by authoritative sources.',
}

export default function AskPage() {
  return (
    <>
      {/* Hero / Ask Section */}
      <section className="bg-cream-100 section-padding-sm">
        <div className="container-narrow">
          <div className="text-center mb-10">
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="accent-line" />
              <span className="overline">Immigration Q&A</span>
              <div className="accent-line" />
            </div>

            <h1 className="mb-4">
              Ask an Immigration Question
            </h1>

            <p className="text-lg text-ink-600 max-w-2xl mx-auto">
              Get answers about visa processes, green cards, work permits, and more — sourced from official government pages and immigration law resources.
            </p>
          </div>

          {/* Disclaimer */}
          <div className="max-w-2xl mx-auto mb-8">
            <div className="flex items-start gap-3 px-4 py-3 bg-cream-300/50 border border-cream-400 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-ink-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-ink-600">
                This tool provides general information only. It does not provide legal advice, eligibility determinations, or case assessments. For case-specific guidance, consult a licensed immigration attorney.
              </p>
            </div>
          </div>

          {/* Ask Form */}
          <div className="max-w-2xl mx-auto">
            <AskForm />
          </div>
        </div>
      </section>

      {/* Recent Questions */}
      <section className="bg-white section-padding">
        <div className="container-narrow">
          <div className="text-center mb-12">
            <span className="overline">Community</span>
            <h2 className="mt-4">
              Recent Questions
            </h2>
            <p className="mt-3 text-ink-600">
              Browse questions others have asked about immigration processes.
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
