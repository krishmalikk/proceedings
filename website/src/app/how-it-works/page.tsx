import { Metadata } from 'next'
import { FileText, Settings, TestTube, Rocket, RefreshCw, ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'How It Works',
  description: 'Learn how our legal intake assistant is set up, trained on your firm\'s content, and deployed to support your intake process.',
  openGraph: {
    title: 'How It Works | Proceedings',
    description: 'Learn how our legal intake assistant is set up and deployed to support your intake process.',
  },
}

const steps = [
  {
    icon: FileText,
    number: '01',
    title: 'Content Collection',
    description: 'We gather your firm\'s approved materials: website content, FAQs, practice area descriptions, and any other documents you want the assistant to reference. You control exactly what information is available.',
  },
  {
    icon: Settings,
    number: '02',
    title: 'Configuration',
    description: 'We configure the assistant with your intake preferences: scheduling links, lead routing rules, escalation keywords, office hours, and brand voice. You define the boundaries and behaviors.',
  },
  {
    icon: TestTube,
    number: '03',
    title: 'Testing',
    description: 'We provide a test environment where you can interact with the assistant and verify it responds appropriately. You approve the assistant\'s behavior before it goes live.',
  },
  {
    icon: Rocket,
    number: '04',
    title: 'Deployment',
    description: 'Once approved, the assistant is deployed to your website or made available through a dedicated link. Your team receives documentation on how to access conversation logs and lead data.',
  },
  {
    icon: RefreshCw,
    number: '05',
    title: 'Ongoing Support',
    description: 'We monitor performance and provide regular tuning based on conversation data. You can update approved content at any time, and we adjust the assistant accordingly.',
  },
]

const integrations = [
  {
    title: 'Website Embed',
    description: 'Add the assistant to your website with a simple code snippet. It appears as a chat widget that visitors can use to ask questions and start the intake process.',
  },
  {
    title: 'Dedicated Link',
    description: 'Share a standalone link in emails, ads, or social media. Prospective clients can access the assistant directly without visiting your website.',
  },
  {
    title: 'Scheduling Integration',
    description: 'Connect with Calendly, Acuity, or other scheduling tools to let the assistant book consultations directly during the conversation.',
  },
  {
    title: 'CRM Integration',
    description: 'Route lead data to your CRM via webhook. Capture contact information, case details, and conversation summaries automatically.',
  },
]

export default function HowItWorksPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-cream-100 section-padding">
        <div className="container-narrow text-center">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="accent-line" />
            <span className="overline">The Process</span>
            <div className="accent-line" />
          </div>
          <h1>How It Works</h1>
          <p className="mt-6 text-xl text-ink-600 max-w-2xl mx-auto">
            A structured process to configure, test, and deploy an intake assistant tailored to your firm.
          </p>
        </div>
      </section>

      {/* Process Steps */}
      <section className="bg-white section-padding">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto">
            {steps.map((step, index) => (
              <div key={step.number} className="relative pb-16 last:pb-0">
                {index < steps.length - 1 && (
                  <div className="absolute left-6 top-16 bottom-0 w-px bg-ink-200" />
                )}
                <div className="flex gap-8">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-ink-900 rounded-full flex items-center justify-center relative z-10">
                      <step.icon className="w-5 h-5 text-cream-50" />
                    </div>
                  </div>
                  <div className="flex-grow pt-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-medium text-ink-400">Step {step.number}</span>
                    </div>
                    <h3 className="text-2xl font-serif mb-3">
                      {step.title}
                    </h3>
                    <p className="text-ink-600 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integration Options */}
      <section className="bg-cream-100 section-padding">
        <div className="container-wide">
          <div className="text-center mb-16">
            <span className="overline">Deployment</span>
            <h2 className="mt-4">Integration Options</h2>
            <p className="mt-4 text-lg text-ink-600 max-w-2xl mx-auto">
              Deploy the assistant in the way that works best for your firm.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {integrations.map((integration) => (
              <div key={integration.title} className="card bg-white">
                <h3 className="text-xl font-serif mb-3">
                  {integration.title}
                </h3>
                <p className="text-ink-600 leading-relaxed">
                  {integration.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="bg-white section-padding">
        <div className="container-narrow">
          <div className="text-center mb-16">
            <span className="overline">Timeline</span>
            <h2 className="mt-4">Typical Setup Process</h2>
          </div>
          <div className="card">
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div className="p-4">
                <div className="text-3xl font-serif text-ink-900 mb-3">Week 1</div>
                <p className="text-ink-600">Content collection and initial configuration</p>
              </div>
              <div className="p-4 border-y md:border-y-0 md:border-x border-ink-100">
                <div className="text-3xl font-serif text-ink-900 mb-3">Week 2</div>
                <p className="text-ink-600">Testing and refinement with your team</p>
              </div>
              <div className="p-4">
                <div className="text-3xl font-serif text-ink-900 mb-3">Week 3+</div>
                <p className="text-ink-600">Go-live and ongoing support</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-ink-900 section-padding">
        <div className="container-narrow text-center">
          <span className="text-xs font-medium uppercase tracking-widest text-cream-500">Next Step</span>
          <h2 className="mt-4 text-cream-50">Ready to Get Started?</h2>
          <p className="mt-4 text-lg text-cream-300 max-w-2xl mx-auto">
            Schedule a demo to discuss your firm's needs and see the intake assistant in action.
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
