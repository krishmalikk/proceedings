import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms governing your use of usajourney.ai (usajourney.ai) and our mobile app.',
}

const LAST_UPDATED = 'June 14, 2026'
const SUPPORT_EMAIL = 'support@usajourney.ai'

// SCAFFOLD — standard boilerplate. NOT legal advice; counsel MUST review and
// tailor (entity name, governing law/venue, arbitration, liability caps) before
// public launch.
const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: '1. Acceptance of These Terms',
    body: [
      'These Terms of Service (“Terms”) govern your access to and use of usajourney.ai (the “Service,” at usajourney.ai and via our mobile app). By accessing or using the Service, you agree to be bound by these Terms and by our Privacy Policy and Legal Disclaimer. If you do not agree, do not use the Service.',
    ],
  },
  {
    heading: '2. Eligibility',
    body: [
      'You must be at least 13 years old (or the minimum age in your jurisdiction) and able to form a binding contract to use the Service.',
    ],
  },
  {
    heading: '3. The Service — Information Only, Not Legal Advice',
    body: [
      'The Service provides general informational and community features about U.S. immigration. It is not a law firm and does not provide legal advice, and no attorney–client relationship is created. See our Legal Disclaimer. Always consult a licensed attorney for your specific situation.',
    ],
  },
  {
    heading: '4. Accounts',
    body: [
      'You are responsible for the activity under your account and for keeping your credentials secure. Provide accurate information and notify us of any unauthorized use. We may suspend or terminate accounts that violate these Terms.',
    ],
  },
  {
    heading: '5. User Content',
    body: [
      'You retain ownership of the content you submit (postings, replies, messages, profile). You grant us a worldwide, non-exclusive, royalty-free license to host, store, reproduce, and display that content as needed to operate and improve the Service.',
      'You are responsible for your content and represent that you have the rights to share it and that it does not violate any law or third-party right. Content is shown to others under an anonymous handle.',
    ],
  },
  {
    heading: '6. Acceptable Use',
    body: [
      'You agree not to: break the law; post unlawful, harmful, harassing, or misleading content; impersonate others; attempt to de-anonymize, scrape, or harvest users or data; probe, disrupt, or circumvent the Service’s security or rate limits; or use the Service to provide unauthorized legal services.',
    ],
  },
  {
    heading: '7. Third-Party Content & Links',
    body: [
      'The Service may surface third-party content (including community postings and external references). We do not endorse or guarantee any third-party content, professional, or resource; your dealings with them are at your own risk.',
    ],
  },
  {
    heading: '8. Intellectual Property',
    body: [
      'The Service, including its software, design, and trademarks, is owned by us or our licensors and protected by law. Except for your own content, you may not copy, modify, distribute, or create derivative works without permission.',
    ],
  },
  {
    heading: '9. Disclaimers',
    body: [
      'The Service is provided “as is” and “as available,” without warranties of any kind, express or implied, including accuracy, completeness, fitness for a particular purpose, or non-infringement. We do not warrant that information is current or applicable to your situation.',
    ],
  },
  {
    heading: '10. Limitation of Liability',
    body: [
      'To the fullest extent permitted by law, we and our owners, operators, employees, and contributors will not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss arising from your use of or reliance on the Service. Your use is at your own risk.',
    ],
  },
  {
    heading: '11. Indemnification',
    body: [
      'You agree to indemnify and hold us harmless from claims, losses, and expenses (including reasonable legal fees) arising from your content, your use of the Service, or your violation of these Terms or any law or third-party right.',
    ],
  },
  {
    heading: '12. Termination',
    body: [
      'You may stop using the Service at any time and delete your account. We may suspend or terminate access if you violate these Terms or to protect the Service. Provisions that by their nature should survive termination will survive.',
    ],
  },
  {
    heading: '13. Governing Law & Disputes',
    body: [
      'These Terms are governed by the laws of the United States and the state specified by us, without regard to conflict-of-law rules. [Governing law, venue, and any arbitration/class-action-waiver terms to be finalized by counsel.]',
    ],
  },
  {
    heading: '14. Changes to These Terms',
    body: [
      'We may update these Terms from time to time. Changes are effective when posted, with the “Last updated” date revised. Continued use of the Service after changes constitutes acceptance.',
    ],
  },
]

export default function TermsPage() {
  return (
    <div className="container-narrow section-padding-sm">
      <div className="max-w-3xl mx-auto">
        <p className="overline mb-2">Legal</p>
        <h1 className="text-headline-lg text-on-surface mb-1">Terms of Service</h1>
        <p className="text-caption text-on-surface-variant mb-6">Last updated: {LAST_UPDATED}</p>

        <div className="space-y-6 text-body-md text-on-surface-variant leading-relaxed">
          {SECTIONS.map((s) => (
            <section key={s.heading}>
              <h2 className="text-headline-md text-on-surface mb-2">{s.heading}</h2>
              {s.body.map((p, i) => (
                <p key={i} className={i > 0 ? 'mt-2' : undefined}>{p}</p>
              ))}
            </section>
          ))}

          <div className="divider pt-6">
            <p className="text-caption text-on-surface-variant">
              Questions about these Terms? Contact us at{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
