import { Metadata } from 'next'
import { Clock, FileText, Calendar, Check, X, ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Proceedings | Intake Assistant for Law Firms',
  description: 'Respond to prospective clients around the clock. Our intake assistant handles after-hours inquiries, provides firm-approved information, and books consultations.',
}

const benefits = [
  {
    icon: Clock,
    title: 'After-Hours Coverage',
    description: 'Respond to prospective clients at any hour. Capture contact information and case details when your office is closed.',
  },
  {
    icon: FileText,
    title: 'Firm-Approved Answers',
    description: 'Provide general information drawn from your website, FAQs, and approved materials. Every response includes citations.',
  },
  {
    icon: Calendar,
    title: 'Lead Routing',
    description: 'Schedule consultations directly or route qualified leads to your intake team via email or your existing CRM.',
  },
]

const capabilities = [
  'After-hours intake',
  'Lead capture',
  'Consultation booking',
  'FAQ responses',
  'Citation-backed answers',
  'CRM integration',
]

const whatItIs = [
  'Intake support for prospective clients',
  'General information from firm-approved sources',
  'Consultation scheduling and lead routing',
  'After-hours coverage for your firm',
  'Clear escalation to speak with an attorney',
]

const whatItIsNot = [
  'Legal advice or legal opinions',
  'Eligibility determinations',
  'Case strategy recommendations',
  'Outcome predictions or timeline guarantees',
  'A replacement for attorney consultation',
]

const faqs = [
  {
    question: 'What information does the assistant provide?',
    answer: 'The assistant provides general information drawn exclusively from your firm\'s approved materials: your website content, FAQs, practice area descriptions, and other documents you provide. Every response cites the source. The assistant does not provide legal advice, opinions, or case-specific guidance.',
  },
  {
    question: 'How does it handle questions it cannot answer?',
    answer: 'When a question falls outside the scope of approved materials, the assistant clearly states it cannot answer that question and offers to schedule a consultation with an attorney or routes the inquiry to your intake team.',
  },
  {
    question: 'Can it book consultations directly?',
    answer: 'Yes. The assistant can integrate with your scheduling system to book consultations during available times. Alternatively, it can capture lead information and forward it to your intake team for follow-up.',
  },
  {
    question: 'How do you ensure appropriate boundaries?',
    answer: 'We implement strict guardrails that prevent the assistant from offering legal advice, eligibility assessments, strategy recommendations, or outcome predictions. The system is trained to recognize these requests and respond appropriately by routing to an attorney.',
  },
  {
    question: 'What happens to collected data?',
    answer: 'All data is stored securely and is accessible only to your firm. We do not use client data to train models or share it with third parties. Detailed information is available on our Safety & Privacy page.',
  },
]

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <section className="bg-cream-100 section-padding">
        <div className="container-wide">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left Content */}
            <div>
              <div className="flex items-center gap-4 mb-6">
                <div className="accent-line" />
                <span className="overline">Intake Assistant for Law Firms</span>
              </div>

              <h1 className="mb-6">
                Respond to Every Prospective Client, Around the Clock
              </h1>

              <p className="text-lg text-ink-600 leading-relaxed mb-8 max-w-lg">
                Capture leads, answer questions from firm-approved content, and book consultations—even when your office is closed.
              </p>

              <div className="flex flex-wrap gap-3 mb-10">
                <a href="#book-demo" className="btn-primary">
                  Book a Demo
                </a>
                <a href="#demo" className="btn-secondary">
                  See Demo
                </a>
              </div>

              {/* Capability Pills */}
              <div className="flex flex-wrap gap-2">
                {capabilities.map((cap) => (
                  <span key={cap} className="pill">
                    {cap}
                  </span>
                ))}
              </div>
            </div>

            {/* Right - Demo Preview Card */}
            <div className="relative">
              <div className="bg-white rounded-3xl border border-ink-100 p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-ink-100">
                  <div className="w-10 h-10 bg-ink-900 rounded-full flex items-center justify-center">
                    <span className="text-cream-50 text-sm font-medium">P</span>
                  </div>
                  <div>
                    <p className="font-medium text-ink-900">Proceedings Assistant</p>
                    <p className="text-xs text-ink-500">Online now</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-cream-100 rounded-2xl rounded-tl-none p-4 max-w-[85%]">
                    <p className="text-sm text-ink-700">
                      Hello! I can help you learn about our services and schedule a consultation. What brings you here today?
                    </p>
                  </div>

                  <div className="bg-ink-900 rounded-2xl rounded-tr-none p-4 max-w-[85%] ml-auto">
                    <p className="text-sm text-cream-100">
                      I was in a car accident last week. Do you handle personal injury cases?
                    </p>
                  </div>

                  <div className="bg-cream-100 rounded-2xl rounded-tl-none p-4 max-w-[85%]">
                    <p className="text-sm text-ink-700">
                      Yes, we handle personal injury cases including car accidents. Would you like to schedule a free consultation to discuss your situation?
                    </p>
                    <p className="text-xs text-ink-400 mt-2">Source: Practice Areas page</p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-ink-100">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Type a message..."
                      className="flex-1 px-4 py-2 text-sm bg-cream-50 border border-ink-200 rounded-pill focus:outline-none focus:border-ink-400"
                      disabled
                    />
                    <button className="p-2 bg-ink-900 text-cream-50 rounded-full" disabled>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Decorative elements */}
              <div className="absolute -z-10 -top-4 -right-4 w-full h-full bg-cream-300 rounded-3xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-white section-padding">
        <div className="container-wide">
          <div className="text-center mb-16">
            <span className="overline">Why Proceedings</span>
            <h2 className="mt-4">
              How It Helps Your Firm
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="card-hover text-center">
                <div className="w-14 h-14 bg-cream-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <benefit.icon className="w-7 h-7 text-ink-700" />
                </div>
                <h3 className="text-xl font-serif mb-3">
                  {benefit.title}
                </h3>
                <p className="text-ink-600 leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What It Is / What It Is Not */}
      <section className="bg-cream-100 section-padding">
        <div className="container-wide">
          <div className="text-center mb-16">
            <span className="overline">Clear Boundaries</span>
            <h2 className="mt-4">
              Built with Guardrails
            </h2>
            <p className="mt-4 text-lg text-ink-600 max-w-2xl mx-auto">
              Our intake assistant is designed with strict guardrails to protect your firm and your clients.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="card bg-white">
              <div className="flex items-center gap-3 mb-6">
                <span className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <Check className="w-5 h-5 text-green-700" />
                </span>
                <h3 className="text-xl">What It Is</h3>
              </div>
              <ul className="space-y-4">
                {whatItIs.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-ink-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card bg-white">
              <div className="flex items-center gap-3 mb-6">
                <span className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <X className="w-5 h-5 text-red-700" />
                </span>
                <h3 className="text-xl">What It Is Not</h3>
              </div>
              <ul className="space-y-4">
                {whatItIsNot.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <X className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <span className="text-ink-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo" className="bg-white section-padding">
        <div className="container-narrow">
          <div className="text-center mb-12">
            <span className="overline">See It In Action</span>
            <h2 className="mt-4">
              Watch a Demo
            </h2>
            <p className="mt-4 text-lg text-ink-600 max-w-2xl mx-auto">
              See how the intake assistant handles common inquiries while maintaining appropriate boundaries.
            </p>
          </div>

          <div className="aspect-video bg-cream-200 rounded-3xl flex items-center justify-center border border-ink-100">
            <div className="text-center p-8">
              <div className="w-20 h-20 bg-ink-900 rounded-full flex items-center justify-center mx-auto mb-4 cursor-pointer hover:bg-ink-800 transition-colors">
                <svg className="w-8 h-8 text-cream-50 ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <p className="text-ink-600">Demo video coming soon</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="bg-cream-100 section-padding">
        <div className="container-wide">
          <div className="text-center mb-16">
            <span className="overline">Client Testimonials</span>
            <h2 className="mt-4">
              What Firms Are Saying
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="card bg-white">
              <blockquote className="text-ink-700 italic leading-relaxed">
                "Testimonial placeholder. We've been able to capture leads that would have otherwise been lost to after-hours voicemail."
              </blockquote>
              <div className="mt-6 pt-6 border-t border-ink-100 flex items-center gap-4">
                <div className="w-12 h-12 bg-cream-200 rounded-full" />
                <div>
                  <p className="font-medium text-ink-900">[Name]</p>
                  <p className="text-sm text-ink-500">[Title], [Firm Name]</p>
                </div>
              </div>
            </div>

            <div className="card bg-white">
              <blockquote className="text-ink-700 italic leading-relaxed">
                "Testimonial placeholder. The clear boundaries give us confidence that prospective clients receive appropriate information."
              </blockquote>
              <div className="mt-6 pt-6 border-t border-ink-100 flex items-center gap-4">
                <div className="w-12 h-12 bg-cream-200 rounded-full" />
                <div>
                  <p className="font-medium text-ink-900">[Name]</p>
                  <p className="text-sm text-ink-500">[Title], [Firm Name]</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-white section-padding">
        <div className="container-narrow">
          <div className="text-center mb-16">
            <span className="overline">Questions</span>
            <h2 className="mt-4">
              Frequently Asked
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="card">
                <h3 className="text-lg font-medium text-ink-900 mb-3">
                  {faq.question}
                </h3>
                <p className="text-ink-600 leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="book-demo" className="bg-ink-900 section-padding">
        <div className="container-narrow text-center">
          <span className="text-xs font-medium uppercase tracking-widest text-cream-500">Get Started</span>
          <h2 className="mt-4 text-cream-50">
            Ready to Improve Your Intake?
          </h2>
          <p className="mt-4 text-lg text-cream-300 max-w-2xl mx-auto">
            Schedule a 30-minute demo to see how Proceedings can work for your firm.
          </p>

          <div className="mt-10">
            <div className="bg-cream-50 rounded-3xl p-8 max-w-md mx-auto">
              <p className="text-ink-600 mb-4">Calendly widget placeholder</p>
              <a
                href="https://calendly.com/your-link"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
              >
                Schedule on Calendly
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
