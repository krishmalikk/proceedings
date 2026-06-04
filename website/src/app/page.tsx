import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Proceedings | AI-Powered Immigration Assistant',
  description: 'Navigate your immigration journey with AI-powered guidance, real case insights, and expert support.',
}

const features = [
  {
    icon: 'search',
    title: 'Search & AI',
    description: 'Search real immigration experiences, then switch to AI mode for grounded, citation-backed answers.',
    href: '/search',
    color: 'bg-primary-container',
    iconColor: 'text-primary',
  },
  {
    icon: 'auto_awesome',
    title: 'AI Mode',
    description: 'Ask anything about your immigration situation and get answers grounded in real postings.',
    href: '/search',
    color: 'bg-secondary-container',
    iconColor: 'text-secondary',
  },
  {
    icon: 'forum',
    title: 'Community Forum',
    description: 'Connect with others on the same path. Share experiences and get peer support.',
    href: '/community',
    color: 'bg-tertiary-container',
    iconColor: 'text-tertiary',
  },
  {
    icon: 'newspaper',
    title: 'Tailored News',
    description: 'Stay updated with immigration news and policy changes relevant to your profile.',
    href: '/news',
    color: 'bg-primary-fixed',
    iconColor: 'text-on-primary-fixed',
  },
]

const stats = [
  { value: '50K+', label: 'Cases Analyzed' },
  { value: '95%', label: 'Accuracy Rate' },
  { value: '24/7', label: 'AI Availability' },
  { value: '100+', label: 'Countries Covered' },
]

const steps = [
  {
    number: '01',
    title: 'Tell Us Your Situation',
    description: 'Share your immigration pathway, current stage, and timeline through our simple onboarding.',
  },
  {
    number: '02',
    title: 'Get Personalized Guidance',
    description: 'Receive AI-powered answers tailored to your specific situation with source citations.',
  },
  {
    number: '03',
    title: 'Learn from Similar Cases',
    description: 'Explore cases similar to yours and understand what strategies worked.',
  },
  {
    number: '04',
    title: 'Connect with Experts',
    description: 'When you need professional help, connect directly with verified immigration attorneys.',
  },
]

const trustedFeatures = [
  {
    icon: 'verified',
    title: 'Citation-Backed Answers',
    description: 'Every response includes sources from official USCIS guidelines and documentation.',
  },
  {
    icon: 'shield',
    title: 'Privacy Protected',
    description: 'Your information is encrypted and never shared. We comply with data protection regulations.',
  },
  {
    icon: 'gavel',
    title: 'Not Legal Advice',
    description: 'Proceedings provides information only. For legal advice, consult with a licensed attorney.',
  },
]

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary to-primary-container py-16 md:py-24 px-4 md:px-margin-desktop">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-white/20 text-on-primary rounded-full px-4 py-2 mb-6">
                <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                <span className="text-label-md">AI-Powered Immigration Guidance</span>
              </div>

              <h1 className="text-display-lg text-on-primary mb-6">
                Navigate Your Immigration Journey with Confidence
              </h1>

              <p className="text-body-lg text-on-primary/80 mb-8 max-w-xl mx-auto lg:mx-0">
                Get instant answers, explore real case outcomes, and connect with experts.
                Proceedings helps you understand your options at every step.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link href="/onboarding" className="btn-primary bg-white text-primary hover:bg-surface-container-low">
                  Get Started Free
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </Link>
                <Link href="/search" className="btn-secondary border-white/30 text-on-primary hover:bg-white/10">
                  Try AI Assistant
                </Link>
              </div>
            </div>

            {/* Hero Chat Preview */}
            <div className="relative hidden lg:block">
              <div className="bg-white rounded-2xl shadow-xl p-6">
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-outline-variant">
                  <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-on-primary text-[20px]">smart_toy</span>
                  </div>
                  <div>
                    <p className="text-label-md font-semibold text-on-surface">Proceedings AI</p>
                    <p className="text-caption text-on-surface-variant">Online now</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="message-ai">
                    <p className="text-body-md">
                      Hello! I can help you understand your immigration options. What would you like to know?
                    </p>
                  </div>

                  <div className="message-user">
                    <p className="text-body-md">
                      I'm on H-1B and want to apply for a green card. What are my options?
                    </p>
                  </div>

                  <div className="message-ai">
                    <p className="text-body-md mb-2">
                      As an H-1B holder, you have several employment-based green card pathways:
                    </p>
                    <ul className="text-body-md space-y-1 ml-4">
                      <li>• <strong>EB-2</strong> - For advanced degree professionals</li>
                      <li>• <strong>EB-3</strong> - For skilled workers</li>
                      <li>• <strong>EB-1</strong> - For extraordinary ability</li>
                    </ul>
                    <p className="text-caption text-on-surface-variant mt-3 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">link</span>
                      Source: USCIS Employment-Based Immigration
                    </p>
                  </div>
                </div>
              </div>
              <div className="absolute -z-10 top-4 left-4 w-full h-full bg-secondary/20 rounded-2xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-surface-container py-12 px-4 md:px-margin-desktop">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-headline-lg text-primary font-bold">{stat.value}</p>
                <p className="text-label-md text-on-surface-variant">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-surface py-16 md:py-24 px-4 md:px-margin-desktop">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <span className="badge-primary mb-4">Features</span>
            <h2 className="text-headline-lg text-on-surface mb-4">
              Everything You Need for Your Immigration Journey
            </h2>
            <p className="text-body-lg text-on-surface-variant max-w-2xl mx-auto">
              From AI-powered guidance to real case insights and expert connections,
              Proceedings provides comprehensive support at every step.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <Link
                key={feature.title}
                href={feature.href}
                className="card-hover group"
              >
                <div className={`w-14 h-14 ${feature.color} rounded-xl flex items-center justify-center mb-4`}>
                  <span className={`material-symbols-outlined text-[28px] ${feature.iconColor}`}>
                    {feature.icon}
                  </span>
                </div>
                <h3 className="text-body-lg font-semibold text-on-surface mb-2 group-hover:text-primary transition-colors">
                  {feature.title}
                </h3>
                <p className="text-body-md text-on-surface-variant">
                  {feature.description}
                </p>
                <div className="flex items-center gap-1 mt-4 text-primary text-label-md opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>Explore</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="bg-surface-container py-16 md:py-24 px-4 md:px-margin-desktop">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <span className="badge-primary mb-4">How It Works</span>
            <h2 className="text-headline-lg text-on-surface mb-4">
              Your Path to Immigration Clarity
            </h2>
            <p className="text-body-lg text-on-surface-variant max-w-2xl mx-auto">
              Getting started is simple. In just a few steps, you'll have personalized
              guidance for your immigration journey.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div key={step.number} className="relative">
                <div className="card bg-surface h-full">
                  <span className="text-display-lg text-primary/20 font-bold">{step.number}</span>
                  <h3 className="text-body-lg font-semibold text-on-surface mt-2 mb-3">
                    {step.title}
                  </h3>
                  <p className="text-body-md text-on-surface-variant">
                    {step.description}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                    <span className="material-symbols-outlined text-outline-variant text-[24px]">
                      arrow_forward
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link href="/onboarding" className="btn-primary">
              Start Your Journey
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="bg-surface py-16 md:py-24 px-4 md:px-margin-desktop">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="badge-secondary mb-4">Trust & Safety</span>
            <h2 className="text-headline-lg text-on-surface mb-4">
              Built with Your Trust in Mind
            </h2>
            <p className="text-body-lg text-on-surface-variant max-w-2xl mx-auto">
              We prioritize accuracy, privacy, and transparency in everything we do.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {trustedFeatures.map((feature) => (
              <div key={feature.title} className="card text-center">
                <div className="w-14 h-14 bg-secondary-container rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-secondary text-[28px]">
                    {feature.icon}
                  </span>
                </div>
                <h3 className="text-body-lg font-semibold text-on-surface mb-2">
                  {feature.title}
                </h3>
                <p className="text-body-md text-on-surface-variant">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ask a Pro Section */}
      <section className="bg-primary-container py-16 md:py-24 px-4 md:px-margin-desktop">
        <div className="max-w-4xl mx-auto text-center">
          <span className="material-symbols-outlined text-[48px] text-on-primary-container mb-4">
            support_agent
          </span>
          <h2 className="text-headline-lg text-on-primary-container mb-4">
            Need Professional Help?
          </h2>
          <p className="text-body-lg text-on-primary-container/80 mb-8 max-w-2xl mx-auto">
            Connect with verified immigration attorneys and consultants who can
            provide personalized legal advice for your specific situation.
          </p>
          <Link href="/pro" className="btn-primary bg-primary text-on-primary">
            Ask an Immigration Pro
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </Link>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-surface py-16 md:py-24 px-4 md:px-margin-desktop">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-primary to-primary-container rounded-2xl p-8 md:p-12 text-center">
            <h2 className="text-headline-lg text-on-primary mb-4">
              Start Your Immigration Journey Today
            </h2>
            <p className="text-body-lg text-on-primary/80 mb-8 max-w-xl mx-auto">
              Join thousands who have found clarity in their immigration process
              with Proceedings's AI-powered guidance.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/onboarding" className="btn-primary bg-white text-primary hover:bg-surface-container-low">
                Get Started Free
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </Link>
              <Link href="/search" className="btn-secondary border-white/30 text-on-primary hover:bg-white/10">
                Try AI First
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
