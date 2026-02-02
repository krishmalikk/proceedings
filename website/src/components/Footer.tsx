import Link from 'next/link'

const navigation = {
  main: [
    { name: 'Home', href: '/' },
    { name: 'How It Works', href: '/how-it-works' },
    { name: 'Safety & Privacy', href: '/safety-privacy' },
    { name: 'Pricing', href: '/pricing' },
    { name: 'Contact', href: '/contact' },
  ],
  legal: [
    { name: 'Privacy Policy', href: '/privacy-policy' },
    { name: 'Terms of Service', href: '/terms-of-service' },
  ],
}

export default function Footer() {
  return (
    <footer className="bg-ink-900 text-cream-100">
      <div className="container-wide py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
          {/* Brand Column */}
          <div className="md:col-span-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-cream-100 rounded-full flex items-center justify-center">
                <span className="text-ink-900 text-sm font-medium">P</span>
              </div>
              <span className="font-serif text-xl text-cream-100">
                Proceedings
              </span>
            </div>
            <p className="text-cream-400 text-sm leading-relaxed max-w-sm">
              Professional intake and information assistant services for law firms. Respond to every prospective client, around the clock.
            </p>
            <p className="mt-6 text-sm text-cream-400">
              <a href="mailto:hello@proceedings.io" className="hover:text-cream-100 transition-colors">
                hello@proceedings.io
              </a>
            </p>
          </div>

          {/* Navigation */}
          <div className="md:col-span-3">
            <h3 className="text-xs font-medium uppercase tracking-widest text-cream-500 mb-4">
              Navigation
            </h3>
            <ul className="space-y-3">
              {navigation.main.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-sm text-cream-300 hover:text-cream-100 transition-colors"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div className="md:col-span-2">
            <h3 className="text-xs font-medium uppercase tracking-widest text-cream-500 mb-4">
              Legal
            </h3>
            <ul className="space-y-3">
              {navigation.legal.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-sm text-cream-300 hover:text-cream-100 transition-colors"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          <div className="md:col-span-2">
            <h3 className="text-xs font-medium uppercase tracking-widest text-cream-500 mb-4">
              Get Started
            </h3>
            <a
              href="#book-demo"
              className="inline-flex items-center px-4 py-2 text-sm rounded-pill border border-cream-700 text-cream-100 hover:bg-cream-100 hover:text-ink-900 transition-all"
            >
              Book a Demo
            </a>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-ink-800">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-xs text-cream-500">
              &copy; {new Date().getFullYear()} Proceedings. All rights reserved.
            </p>
            <p className="text-xs text-cream-600 text-center sm:text-right max-w-md">
              This service provides intake support and general information only. It is not a law firm and does not provide legal advice.
            </p>
          </div>
        </div>
      </div>

      {/* Large background text */}
      <div className="overflow-hidden border-t border-ink-800">
        <div className="container-wide py-8">
          <p className="font-serif text-6xl sm:text-8xl lg:text-9xl text-ink-800 select-none">
            Proceedings
          </p>
        </div>
      </div>
    </footer>
  )
}
