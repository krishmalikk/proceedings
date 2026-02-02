import type { Metadata } from 'next'
import { Inter, Source_Serif_4 } from 'next/font/google'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import DisclaimerBanner from '@/components/DisclaimerBanner'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-source-serif',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Proceedings | Intake Assistant for Law Firms',
    template: '%s | Proceedings',
  },
  description: 'Professional intake and information assistant services for law firms. Respond to prospective clients around the clock with firm-approved information and seamless consultation booking.',
  keywords: ['legal intake', 'law firm intake', 'client intake', 'legal answering service', 'law firm automation'],
  authors: [{ name: 'Proceedings' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://proceedings.io',
    siteName: 'Proceedings',
    title: 'Proceedings | Intake Assistant for Law Firms',
    description: 'Professional intake and information assistant services for law firms. Respond to prospective clients around the clock.',
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
    title: 'Proceedings | Intake Assistant for Law Firms',
    description: 'Professional intake and information assistant services for law firms.',
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
    <html lang="en" className={`${inter.variable} ${sourceSerif.variable}`}>
      <body className="font-sans min-h-screen flex flex-col">
        <DisclaimerBanner />
        <Header />
        <main className="flex-grow">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
