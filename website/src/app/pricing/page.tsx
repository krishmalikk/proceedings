import { Metadata } from 'next'
import { Check, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Transparent pricing for legal intake assistant services. Start with a pilot to evaluate the service before committing to ongoing support.',
  openGraph: {
    title: 'Pricing | Proceedings',
    description: 'Transparent pricing for legal intake assistant services.',
  },
}

const pilotFeatures = [
  'Intake assistant trained on your firm\'s content',
  'General information responses with citations',
  'Lead capture and routing',
  'Consultation booking integration',
  'Guardrails and refusal logic',
  'Light tuning during pilot period',
  'Test environment before go-live',
]

const ongoingFeatures = [
  'Everything in the pilot',
  'Ongoing content updates',
  'Monthly performance review',
  'Priority support',
  'Conversation analytics',
  'Continued tuning and optimization',
]

const includedFeatures = [
  {
    title: 'Full Setup',
    description: 'We handle all configuration, content processing, and deployment. No technical work required from your team.',
  },
  {
    title: 'Testing Period',
    description: 'Review and approve the assistant\'s behavior in a test environment before it goes live.',
  },
  {
    title: 'Lead Access',
    description: 'Access all captured leads and conversation summaries through a simple dashboard or email delivery.',
  },
  {
    title: 'Support',
    description: 'Email support for questions and content updates. We respond within one business day.',
  },
]

export default function PricingPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-cream-100 section-padding">
        <div className="container-narrow text-center">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="accent-line" />
            <span className="overline">Investment</span>
            <div className="accent-line" />
          </div>
          <h1>Pricing</h1>
          <p className="mt-6 text-xl text-ink-600 max-w-2xl mx-auto">
            Start with a 30-day pilot to evaluate the service. No long-term commitment required.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="bg-white section-padding">
        <div className="container-wide">
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Pilot */}
            <div className="card border-2 border-ink-900">
              <div className="text-center pb-8 border-b border-ink-100">
                <span className="pill-active">Recommended</span>
                <h2 className="text-2xl font-serif mt-4">30-Day Pilot</h2>
                <p className="text-ink-600 mt-2">Evaluate before you commit</p>
                <div className="mt-6">
                  <span className="text-5xl font-serif text-ink-900">$750</span>
                  <span className="text-ink-500 ml-2">one-time</span>
                </div>
              </div>
              <div className="pt-8">
                <ul className="space-y-4">
                  {pilotFeatures.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-ink-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <a href="/#book-demo" className="btn-primary w-full text-center">
                    Start Pilot
                  </a>
                </div>
                <p className="mt-4 text-sm text-ink-500 text-center">
                  Pilot fee credited toward ongoing service if you continue
                </p>
              </div>
            </div>

            {/* Ongoing */}
            <div className="card">
              <div className="text-center pb-8 border-b border-ink-100">
                <span className="pill">After pilot</span>
                <h2 className="text-2xl font-serif mt-4">Ongoing Service</h2>
                <p className="text-ink-600 mt-2">After successful pilot</p>
                <div className="mt-6">
                  <span className="text-5xl font-serif text-ink-900">$300–$500</span>
                  <span className="text-ink-500 ml-2">/month</span>
                </div>
              </div>
              <div className="pt-8">
                <ul className="space-y-4">
                  {ongoingFeatures.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-ink-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <Link href="/contact" className="btn-secondary w-full text-center">
                    Contact Us
                  </Link>
                </div>
                <p className="mt-4 text-sm text-ink-500 text-center">
                  Pricing varies based on conversation volume
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What's Included */}
      <section className="bg-cream-100 section-padding">
        <div className="container-narrow">
          <div className="text-center mb-16">
            <span className="overline">Included</span>
            <h2 className="mt-4">What's In Every Plan</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {includedFeatures.map((feature) => (
              <div key={feature.title} className="card bg-white">
                <h3 className="font-serif text-lg mb-2">{feature.title}</h3>
                <p className="text-ink-600 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white section-padding">
        <div className="container-narrow">
          <div className="text-center mb-16">
            <span className="overline">Questions</span>
            <h2 className="mt-4">Pricing FAQ</h2>
          </div>
          <div className="space-y-4">
            <div className="card">
              <h3 className="font-serif text-lg mb-2">
                What determines the monthly price after the pilot?
              </h3>
              <p className="text-ink-600 leading-relaxed">
                Monthly pricing is based on expected conversation volume and the complexity of your content. Most firms fall within the $300–$500 range. We'll provide a specific quote after the pilot.
              </p>
            </div>
            <div className="card">
              <h3 className="font-serif text-lg mb-2">
                Is there a long-term contract?
              </h3>
              <p className="text-ink-600 leading-relaxed">
                No. After the pilot, ongoing service is month-to-month. You can cancel with 30 days notice.
              </p>
            </div>
            <div className="card">
              <h3 className="font-serif text-lg mb-2">
                What if the pilot doesn't work for us?
              </h3>
              <p className="text-ink-600 leading-relaxed">
                If you decide not to continue after the pilot, there's no further obligation. We'll provide a summary of what we learned and any recommendations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-ink-900 section-padding">
        <div className="container-narrow text-center">
          <span className="text-xs font-medium uppercase tracking-widest text-cream-500">Get Started</span>
          <h2 className="mt-4 text-cream-50">Ready to Start?</h2>
          <p className="mt-4 text-lg text-cream-300 max-w-2xl mx-auto">
            Schedule a demo to discuss your firm's needs and begin the pilot process.
          </p>
          <div className="mt-8">
            <a href="/#book-demo" className="inline-flex items-center gap-2 px-6 py-3 rounded-pill bg-cream-50 text-ink-900 font-medium hover:bg-white transition-colors">
              Book a Demo
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
