import { Metadata } from 'next'
import { Mail, Clock, MapPin, ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch to learn more about our legal intake assistant services or to schedule a demo.',
  openGraph: {
    title: 'Contact | Proceedings',
    description: 'Get in touch to learn more about our legal intake assistant services.',
  },
}

export default function ContactPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-cream-100 section-padding">
        <div className="container-narrow text-center">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="accent-line" />
            <span className="overline">Get In Touch</span>
            <div className="accent-line" />
          </div>
          <h1>Contact Us</h1>
          <p className="mt-6 text-xl text-ink-600 max-w-2xl mx-auto">
            Have questions about our intake assistant services? We're here to help.
          </p>
        </div>
      </section>

      {/* Contact Options */}
      <section className="bg-white section-padding">
        <div className="container-wide">
          <div className="grid md:grid-cols-2 gap-12 lg:gap-16 max-w-5xl mx-auto">
            {/* Contact Info */}
            <div>
              <h2 className="text-2xl font-serif mb-8">
                Reach Out
              </h2>

              <div className="space-y-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-cream-200 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <Mail className="w-6 h-6 text-ink-700" />
                  </div>
                  <div>
                    <h3 className="font-medium text-ink-900 mb-1">Email</h3>
                    <a
                      href="mailto:hello@proceedings.io"
                      className="text-ink-600 hover:text-ink-900 transition-colors"
                    >
                      hello@proceedings.io
                    </a>
                    <p className="text-sm text-ink-500 mt-1">
                      We respond within one business day
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-cream-200 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <Clock className="w-6 h-6 text-ink-700" />
                  </div>
                  <div>
                    <h3 className="font-medium text-ink-900 mb-1">Business Hours</h3>
                    <p className="text-ink-600">Monday – Friday</p>
                    <p className="text-ink-600">9:00 AM – 5:00 PM EST</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-cream-200 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-ink-700" />
                  </div>
                  <div>
                    <h3 className="font-medium text-ink-900 mb-1">Location</h3>
                    <p className="text-ink-600">Remote services available nationwide</p>
                  </div>
                </div>
              </div>

              <div className="mt-10 p-6 bg-cream-100 rounded-2xl">
                <h3 className="font-serif text-lg mb-2">
                  Prefer to Schedule a Call?
                </h3>
                <p className="text-ink-600 text-sm mb-4">
                  Book a 30-minute demo to see the intake assistant in action and discuss your firm's needs.
                </p>
                <a href="/#book-demo" className="inline-flex items-center gap-2 text-sm font-medium text-ink-900 hover:text-ink-700">
                  Book a Demo
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Contact Form */}
            <div>
              <h2 className="text-2xl font-serif mb-8">
                Send a Message
              </h2>

              <form className="space-y-5">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-ink-700 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    className="w-full px-4 py-3 bg-cream-50 border border-ink-200 rounded-xl focus:ring-2 focus:ring-ink-900 focus:border-ink-900 transition-colors"
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-ink-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    className="w-full px-4 py-3 bg-cream-50 border border-ink-200 rounded-xl focus:ring-2 focus:ring-ink-900 focus:border-ink-900 transition-colors"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label htmlFor="firm" className="block text-sm font-medium text-ink-700 mb-2">
                    Firm Name
                  </label>
                  <input
                    type="text"
                    id="firm"
                    name="firm"
                    className="w-full px-4 py-3 bg-cream-50 border border-ink-200 rounded-xl focus:ring-2 focus:ring-ink-900 focus:border-ink-900 transition-colors"
                    placeholder="Your firm"
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-ink-700 mb-2">
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={4}
                    className="w-full px-4 py-3 bg-cream-50 border border-ink-200 rounded-xl focus:ring-2 focus:ring-ink-900 focus:border-ink-900 transition-colors resize-none"
                    placeholder="Tell us about your intake needs..."
                  />
                </div>

                <div>
                  <button type="submit" className="btn-primary w-full">
                    Send Message
                  </button>
                </div>

                <p className="text-xs text-ink-500 text-center">
                  By submitting this form, you agree to receive a response via email.
                  We do not share your information with third parties.
                </p>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Additional Info */}
      <section className="bg-cream-100 section-padding">
        <div className="container-narrow text-center">
          <span className="overline">What Happens Next</span>
          <h2 className="mt-4">What to Expect</h2>
          <p className="mt-4 text-lg text-ink-600 max-w-2xl mx-auto">
            After you reach out, we'll schedule a brief call to understand your firm's intake process and goals.
            If our service is a good fit, we'll walk you through a demo and discuss next steps for a pilot.
          </p>
        </div>
      </section>
    </>
  )
}
