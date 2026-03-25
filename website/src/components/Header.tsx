'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'

const navigation = [
  { name: 'Home', href: '/' },
  { name: 'Ask', href: '/ask' },
  { name: 'How It Works', href: '/how-it-works' },
  { name: 'Safety & Privacy', href: '/safety-privacy' },
  { name: 'Pricing', href: '/pricing' },
]

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="bg-cream-100">
      <nav className="container-wide py-4" aria-label="Global">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-ink-900 rounded-full flex items-center justify-center">
                <span className="text-cream-50 text-sm font-medium">P</span>
              </div>
              <span className="font-serif text-xl text-ink-900">
                Proceedings
              </span>
            </Link>
          </div>

          {/* Desktop Navigation - Pill style */}
          <div className="hidden lg:flex items-center gap-1 border border-ink-200 rounded-pill p-1 bg-white/50">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="nav-link"
              >
                {item.name}
              </Link>
            ))}
          </div>

          {/* CTA Button */}
          <div className="hidden lg:flex items-center gap-4">
            <Link href="/contact" className="nav-link">
              Contact
            </Link>
            <a href="#book-demo" className="btn-primary">
              Book a Demo
            </a>
          </div>

          {/* Mobile menu button */}
          <div className="flex lg:hidden">
            <button
              type="button"
              className="p-2 rounded-pill border border-ink-200 text-ink-700"
              onClick={() => setMobileMenuOpen(true)}
            >
              <span className="sr-only">Open main menu</span>
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="fixed inset-0 bg-ink-900/20 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-cream-50 px-6 py-6 sm:max-w-sm">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                <div className="w-8 h-8 bg-ink-900 rounded-full flex items-center justify-center">
                  <span className="text-cream-50 text-sm font-medium">P</span>
                </div>
                <span className="font-serif text-xl text-ink-900">
                  Proceedings
                </span>
              </Link>
              <button
                type="button"
                className="p-2 rounded-pill border border-ink-200 text-ink-700"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="sr-only">Close menu</span>
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-8 flow-root">
              <div className="space-y-2">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="block px-4 py-3 text-base font-medium text-ink-700 hover:text-ink-900 hover:bg-cream-200 rounded-xl transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.name}
                  </Link>
                ))}
                <Link
                  href="/contact"
                  className="block px-4 py-3 text-base font-medium text-ink-700 hover:text-ink-900 hover:bg-cream-200 rounded-xl transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Contact
                </Link>
              </div>
              <div className="mt-6 pt-6 border-t border-ink-200">
                <a
                  href="#book-demo"
                  className="btn-primary w-full text-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Book a Demo
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
