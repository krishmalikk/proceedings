import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How usajourney.ai (usajourney.ai) collects, uses, shares, and protects your information.',
}

const LAST_UPDATED = 'June 14, 2026'
const SUPPORT_EMAIL = 'support@usajourney.ai'

// SCAFFOLD — standard boilerplate. NOT legal advice; counsel MUST review and
// tailor (entity name, jurisdiction, data-processor list, retention periods,
// CCPA/GDPR specifics, age threshold) before public launch.
const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: '1. Introduction',
    body: [
      'This Privacy Policy explains how usajourney.ai (the “Service,” accessible at usajourney.ai and via our mobile app) collects, uses, discloses, and safeguards your information. By using the Service you agree to this policy. If you do not agree, do not use the Service.',
    ],
  },
  {
    heading: '2. Information We Collect',
    body: [
      'Account information: when you sign in (e.g. via Google/Firebase Authentication), we receive identifiers such as your name, email address, and a unique user ID.',
      'Profile and content you provide: your immigration profile (visa categories, consulates, timelines), postings, replies, and group messages. Free-text content is automatically scrubbed for common direct identifiers (email addresses, phone numbers, A-numbers) before it is stored or shown to others.',
      'Usage and device data: log data, app/page interactions, approximate location derived from IP, and device/browser metadata, used to operate and improve the Service.',
    ],
  },
  {
    heading: '3. How We Use Information',
    body: [
      'To provide and personalize the Service (search, AI-assisted guidance, matching, and community features); to authenticate you; to maintain safety and prevent abuse; to communicate with you (including support at the address below); and to comply with legal obligations.',
    ],
  },
  {
    heading: '4. How We Share Information',
    body: [
      'We do not sell your personal information. We share it with service providers who process data on our behalf (e.g. Google Cloud Platform / Firebase for hosting, authentication, storage, and AI processing), strictly to operate the Service.',
      'Community visibility: content you post is visible to other users by your anonymous handle — never your real name or email. We may disclose information if required by law or to protect rights, safety, and the integrity of the Service.',
    ],
  },
  {
    heading: '5. Data Retention',
    body: [
      'We retain information for as long as your account is active or as needed to provide the Service and meet legal obligations. You may request deletion of your account and associated data (see “Your Rights”).',
    ],
  },
  {
    heading: '6. Your Rights & Choices',
    body: [
      'Subject to applicable law, you may request to access, correct, or delete your personal information, and may delete your account from within the app or by contacting us. We will respond consistent with applicable privacy laws (which may include the GDPR and CCPA/CPRA).',
    ],
  },
  {
    heading: '7. Security',
    body: [
      'We use administrative, technical, and organizational measures designed to protect your information, including PII scrubbing of user-generated content and access controls. No method of transmission or storage is 100% secure, and we cannot guarantee absolute security.',
    ],
  },
  {
    heading: '8. Children’s Privacy',
    body: [
      'The Service is not directed to children under 13 (or the minimum age required in your jurisdiction), and we do not knowingly collect their personal information. If you believe a child has provided us information, contact us and we will delete it.',
    ],
  },
  {
    heading: '9. International Users',
    body: [
      'The Service is operated from the United States and your information may be processed there. By using the Service you consent to processing in the United States, which may have different data-protection rules than your jurisdiction.',
    ],
  },
  {
    heading: '10. Changes to This Policy',
    body: [
      'We may update this policy from time to time. Changes are effective when posted, with the “Last updated” date revised. Continued use of the Service after changes constitutes acceptance.',
    ],
  },
]

export default function PrivacyPage() {
  return (
    <div className="container-narrow section-padding-sm">
      <div className="max-w-3xl mx-auto">
        <p className="overline mb-2">Legal</p>
        <h1 className="text-headline-lg text-on-surface mb-1">Privacy Policy</h1>
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
              Questions about this policy or your data? Contact us at{' '}
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
