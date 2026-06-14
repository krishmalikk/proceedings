import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import TopAppBar from '@/components/TopAppBar'
import MobileBottomNav from '@/components/MobileBottomNav'
import { Providers } from '@/components/Providers'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://proceedings.ai'),
  title: {
    default: 'Proceedings | Your Immigration Assistant',
    template: '%s | Proceedings',
  },
  description: 'AI-powered immigration guidance with official citations. Get answers to your US immigration questions with confidence.',
  keywords: ['immigration', 'visa', 'green card', 'H-1B', 'immigration lawyer', 'USCIS', 'immigration assistant'],
  authors: [{ name: 'Proceedings' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://proceedings.ai',
    siteName: 'Proceedings',
    title: 'Proceedings | Your Immigration Assistant',
    description: 'AI-powered immigration guidance with official citations.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Proceedings',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Proceedings | Your Immigration Assistant',
    description: 'AI-powered immigration guidance with official citations.',
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* Material Symbols for icons */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans min-h-screen flex flex-col bg-surface text-on-surface">
        <Providers>
          <TopAppBar />
          <main className="flex-grow pb-16 md:pb-0">
            {children}
          </main>
          <MobileBottomNav />
          {/* Footer - shown on desktop, hidden on mobile due to bottom nav */}
          <footer className="hidden md:block w-full py-5 px-margin-desktop bg-surface-container-low border-t border-outline-variant">
            <div className="max-w-7xl mx-auto text-center space-y-3">
              <div className="text-label-md font-semibold text-on-surface">Proceedings</div>
              <p className="text-caption text-on-surface-variant max-w-lg mx-auto">
                © 2024 Proceedings Inc. Not legal advice. Proceedings is not a law firm or government agency.
              </p>
              <div className="flex justify-center gap-6">
                <a href="/disclaimer" className="text-caption text-on-surface-variant hover:text-primary transition-colors">
                  Legal Disclaimer
                </a>
                <a href="#" className="text-caption text-on-surface-variant hover:text-primary transition-colors">
                  Terms of Service
                </a>
                <a href="#" className="text-caption text-on-surface-variant hover:text-primary transition-colors">
                  Privacy Policy
                </a>
                <a href="#" className="text-caption text-on-surface-variant hover:text-primary transition-colors">
                  Contact Support
                </a>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  )
}
