import { Metadata } from 'next'
import { Shield, Lock, Eye, Server, UserX, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Safety & Privacy',
  description: 'Learn about our data handling practices, security measures, and the guardrails that keep your firm and clients protected.',
  openGraph: {
    title: 'Safety & Privacy | Proceedings',
    description: 'Our data handling practices, security measures, and protective guardrails.',
  },
}

const securityFeatures = [
  {
    icon: Lock,
    title: 'Data Encryption',
    description: 'All data is encrypted in transit (TLS 1.3) and at rest (AES-256). Conversation data and lead information are protected at every stage.',
  },
  {
    icon: Server,
    title: 'Firm Data Isolation',
    description: 'Each firm\'s data is logically isolated. Your content, conversations, and lead data are never mixed with other firms\' information.',
  },
  {
    icon: Eye,
    title: 'Access Controls',
    description: 'Only authorized personnel at your firm can access conversation logs and lead data. We provide audit logs of all access.',
  },
  {
    icon: UserX,
    title: 'No Model Training',
    description: 'We do not use your firm\'s data or client conversations to train any models. Your data remains yours.',
  },
]

const guardrails = [
  {
    title: 'No Legal Advice',
    description: 'The assistant is configured to never provide legal advice, opinions, or interpretations. It responds only with general information from firm-approved sources.',
  },
  {
    title: 'No Eligibility Determinations',
    description: 'The assistant will not assess whether someone has a valid case or qualifies for services. These questions are routed to an attorney.',
  },
  {
    title: 'No Strategy or Outcomes',
    description: 'The assistant does not discuss legal strategy, predict outcomes, or estimate timelines. It encourages consultation for case-specific questions.',
  },
  {
    title: 'Escalation Triggers',
    description: 'Specific keywords and question patterns automatically trigger a response directing the user to speak with an attorney.',
  },
  {
    title: 'Source Citations',
    description: 'Every informational response includes a citation to the approved source material, maintaining transparency about where information comes from.',
  },
  {
    title: 'Refusal Logging',
    description: 'When the assistant refuses to answer a question, the refusal is logged so you can review what types of questions are being asked.',
  },
]

const piiHandling = [
  {
    category: 'Collected (with consent)',
    items: ['Name', 'Email address', 'Phone number', 'General description of legal matter'],
  },
  {
    category: 'Not Collected',
    items: ['Social Security Numbers', 'Financial account numbers', 'Detailed case documents', 'Medical records', 'Immigration status details'],
  },
]

export default function SafetyPrivacyPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-cream-100 section-padding">
        <div className="container-narrow text-center">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="accent-line" />
            <span className="overline">Trust & Security</span>
            <div className="accent-line" />
          </div>
          <h1>Safety & Privacy</h1>
          <p className="mt-6 text-xl text-ink-600 max-w-2xl mx-auto">
            Protecting your firm and your clients is our priority. Learn about our security practices and the guardrails built into every assistant.
          </p>
        </div>
      </section>

      {/* Security Features */}
      <section className="bg-white section-padding">
        <div className="container-wide">
          <div className="text-center mb-16">
            <span className="overline">Infrastructure</span>
            <h2 className="mt-4">Security Measures</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {securityFeatures.map((feature) => (
              <div key={feature.title} className="card">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-cream-200 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <feature.icon className="w-6 h-6 text-ink-700" />
                  </div>
                  <div>
                    <h3 className="text-lg font-serif mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-ink-600 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Guardrails */}
      <section className="bg-cream-100 section-padding">
        <div className="container-wide">
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-ink-900 rounded-full mb-6">
              <Shield className="w-8 h-8 text-cream-50" />
            </div>
            <h2>Built-In Guardrails</h2>
            <p className="mt-4 text-lg text-ink-600 max-w-2xl mx-auto">
              Every assistant includes strict boundaries to ensure appropriate responses.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {guardrails.map((guardrail) => (
              <div key={guardrail.title} className="card bg-white">
                <h3 className="text-lg font-serif mb-2">
                  {guardrail.title}
                </h3>
                <p className="text-ink-600 text-sm leading-relaxed">
                  {guardrail.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PII Handling */}
      <section className="bg-white section-padding">
        <div className="container-narrow">
          <div className="text-center mb-16">
            <span className="overline">Data Handling</span>
            <h2 className="mt-4">Personal Information</h2>
            <p className="mt-4 text-lg text-ink-600 max-w-2xl mx-auto">
              We collect only the information necessary for intake while avoiding sensitive data.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {piiHandling.map((category) => (
              <div key={category.category} className="card">
                <h3 className="text-lg font-serif mb-4">
                  {category.category}
                </h3>
                <ul className="space-y-3">
                  {category.items.map((item) => (
                    <li key={item} className="flex items-center text-ink-600">
                      <span className="w-1.5 h-1.5 bg-ink-400 rounded-full mr-3" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance Notice */}
      <section className="bg-ink-900 section-padding-sm">
        <div className="container-narrow">
          <div className="flex items-start gap-4 text-cream-100">
            <AlertTriangle className="w-8 h-8 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-xl font-serif mb-2 text-cream-50">Important Notice</h3>
              <p className="text-cream-300 leading-relaxed">
                While we implement robust security measures and guardrails, you remain responsible for ensuring the intake assistant is configured appropriately for your jurisdiction and practice areas. We recommend reviewing all approved content and testing the assistant thoroughly before deployment.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-cream-100 section-padding">
        <div className="container-narrow text-center">
          <span className="overline">Questions?</span>
          <h2 className="mt-4">Want to Learn More?</h2>
          <p className="mt-4 text-lg text-ink-600 max-w-2xl mx-auto">
            We're happy to discuss our security practices in detail during a demo.
          </p>
          <div className="mt-8">
            <Link href="/contact" className="btn-primary">
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
