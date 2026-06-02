'use client'

import Link from 'next/link'

const caseData = {
  id: '1',
  title: 'I-485 RFE Response on Misplaced Birth Certificate Evidence',
  status: 'Resolved',
  description: 'Successfully navigated an RFE for birth certificate discrepancy through alternative documentation.',
  attorney: {
    name: 'Sarah Chen, Esq.',
    credentials: 'Immigration Attorney, NY Bar',
    firm: 'Chen Immigration Law',
  },
  whatWorked: {
    insight: 'The key was providing a combination of secondary evidence with a detailed affidavit explaining the circumstances.',
    evidence: [
      'Notarized affidavit from both parents',
      'School records showing date of birth',
      'Baptismal certificate',
      'Census records',
    ],
  },
  timeline: [
    { step: 1, title: 'RFE Received', description: 'Received RFE requesting birth certificate clarification', date: 'Jan 15, 2024' },
    { step: 2, title: 'Evidence Gathered', description: 'Collected secondary evidence over 3 weeks', date: 'Feb 5, 2024' },
    { step: 3, title: 'Response Submitted', description: 'Submitted comprehensive RFE response package', date: 'Feb 12, 2024', completed: true },
  ],
  sources: [
    { title: 'USCIS Policy Manual - Secondary Evidence', url: 'https://www.uscis.gov' },
    { title: 'I-485 Instructions', url: 'https://www.uscis.gov/i-485' },
  ],
  stats: { upvotes: 47, comments: 12 },
}

export default function CaseDetailsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 md:px-margin-desktop py-8">
      {/* Back Button */}
      <Link
        href="/search"
        className="inline-flex items-center gap-1 text-label-md text-on-surface-variant hover:text-primary mb-6 transition-colors"
      >
        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        Back to Search
      </Link>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Main Content */}
        <div className="flex-1 space-y-6">
          {/* Header */}
          <div>
            <span className="badge-success mb-3 inline-block">{caseData.status}</span>
            <h1 className="text-headline-lg text-on-surface mb-2">{caseData.title}</h1>
            <p className="text-body-md text-on-surface-variant">{caseData.description}</p>
          </div>

          {/* Attorney Card */}
          <div className="bg-primary-container rounded-xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-on-primary">person</span>
              </div>
              <div>
                <p className="text-label-md font-semibold text-on-primary-container">{caseData.attorney.name}</p>
                <p className="text-caption text-on-primary-container opacity-80">{caseData.attorney.credentials}</p>
                <p className="text-caption text-on-primary-container opacity-80">{caseData.attorney.firm}</p>
              </div>
              <button className="ml-auto btn-secondary text-sm">View Bio</button>
            </div>
          </div>

          {/* What Worked */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-secondary">check_circle</span>
              <h2 className="text-headline-md text-on-surface">What Worked</h2>
            </div>
            <p className="text-body-md text-on-surface mb-4">{caseData.whatWorked.insight}</p>
            <ul className="space-y-2">
              {caseData.whatWorked.evidence.map((item, idx) => (
                <li key={idx} className="flex items-center gap-2 text-body-md text-on-surface-variant">
                  <span className="material-symbols-outlined text-secondary text-[18px]">check</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Timeline */}
          <div className="card">
            <h2 className="text-headline-md text-on-surface mb-6">Resolution Timeline</h2>
            <div className="space-y-4">
              {caseData.timeline.map((item, idx) => (
                <div key={item.step} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      item.completed ? 'bg-secondary text-on-secondary' : 'bg-primary text-on-primary'
                    }`}>
                      {item.completed ? (
                        <span className="material-symbols-outlined text-[18px]">done</span>
                      ) : (
                        <span className="text-label-md">{item.step}</span>
                      )}
                    </div>
                    {idx < caseData.timeline.length - 1 && (
                      <div className="w-0.5 h-12 bg-outline-variant mt-2" />
                    )}
                  </div>
                  <div>
                    <p className="text-label-md font-semibold text-on-surface">{item.title}</p>
                    <p className="text-body-md text-on-surface-variant">{item.description}</p>
                    <p className="text-caption text-outline mt-1">{item.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="lg:w-80 space-y-6">
          {/* Sources */}
          <div className="card">
            <h3 className="text-label-md font-semibold text-on-surface mb-3">Official Sources & Links</h3>
            <div className="space-y-2">
              {caseData.sources.map((source) => (
                <a
                  key={source.title}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-body-md text-secondary hover:underline"
                >
                  <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                  {source.title}
                </a>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <span className="text-label-md text-on-surface-variant">Helpfulness</span>
              <div className="flex items-center gap-3 text-body-md text-on-surface">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[18px]">thumb_up</span>
                  {caseData.stats.upvotes}
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[18px]">comment</span>
                  {caseData.stats.comments}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 btn-secondary text-sm flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-[18px]">sentiment_satisfied</span>
                Helpful
              </button>
              <button className="flex-1 btn-secondary text-sm flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-[18px]">sentiment_dissatisfied</span>
                Not Helpful
              </button>
            </div>
          </div>

          {/* CTA */}
          <div className="bg-gradient-to-br from-primary to-primary-container rounded-xl p-6 text-center">
            <h3 className="text-headline-md text-on-primary mb-2">Need Expert Help?</h3>
            <p className="text-body-md text-on-primary opacity-90 mb-4">
              Get personalized guidance from a verified immigration attorney.
            </p>
            <Link href="/pro" className="btn-primary bg-white text-primary hover:bg-surface">
              Consult an Attorney
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
