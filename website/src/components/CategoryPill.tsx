const LABEL_DISPLAY: Record<string, string> = {
  // Immigration
  'h1b-visa': 'H-1B Visa',
  'family-based-immigration': 'Family Immigration',
  'asylum-refugees': 'Asylum & Refugees',
  'naturalization-citizenship': 'Citizenship',
  'daca': 'DACA',
  'employment-green-cards': 'Employment Green Card',
  'eb5-investor-visa': 'EB-5 Investor',
  'student-visas': 'Student Visa',
  'temporary-work-visas': 'Work Visa',
  'diversity-visa-lottery': 'Diversity Visa',
  'deportation-defense': 'Deportation Defense',
  'humanitarian-parole': 'Humanitarian Parole',
  'tps': 'TPS',
  'visa-fees-filing': 'Fees & Filing',
  'consular-processing': 'Consular Processing',
  'adjustment-of-status': 'Adjustment of Status',
  'travel-documents': 'Travel Documents',
  'work-authorization': 'Work Authorization',
  'immigration-court': 'Immigration Court',
  'general-immigration-info': 'Immigration Info',
  // Broad US law
  'personal-injury': 'Personal Injury',
  'family-law': 'Family Law',
  'criminal-law': 'Criminal Law',
  'criminal-defense': 'Criminal Defense',
  'business-law': 'Business Law',
  'corporate-law': 'Corporate Law',
  'bankruptcy-law': 'Bankruptcy',
  'real-estate-law': 'Real Estate',
  'estate-planning': 'Estate Planning',
  'trusts-estates': 'Trusts & Estates',
  'intellectual-property': 'IP Law',
  'labor-employment': 'Employment Law',
  'tax-law': 'Tax Law',
  'health-law': 'Health Law',
  'medical-malpractice': 'Medical Malpractice',
  'environmental-law': 'Environmental Law',
  'dui-law': 'DUI Law',
  'elder-law': 'Elder Law',
  'education-law': 'Education Law',
  'entertainment-law': 'Entertainment Law',
  'cybersecurity-law': 'Cybersecurity Law',
  'administrative-law': 'Administrative Law',
  'commercial-law': 'Commercial Law',
  'litigation': 'Litigation',
  'international-law': 'International Law',
  'traffic-law': 'Traffic Law',
  'general-legal-info': 'Legal Info',
}

const IMMIGRATION_LABELS = new Set([
  'h1b-visa', 'family-based-immigration', 'asylum-refugees', 'naturalization-citizenship',
  'daca', 'employment-green-cards', 'eb5-investor-visa', 'student-visas',
  'temporary-work-visas', 'diversity-visa-lottery', 'deportation-defense',
  'humanitarian-parole', 'tps', 'visa-fees-filing', 'consular-processing',
  'adjustment-of-status', 'travel-documents', 'work-authorization',
  'immigration-court', 'general-immigration-info',
])

interface CategoryPillProps {
  label: string
  onClick?: () => void
  active?: boolean
  size?: 'sm' | 'md'
}

export default function CategoryPill({ label, onClick, active, size = 'sm' }: CategoryPillProps) {
  const displayName = LABEL_DISPLAY[label] || label.replace(/-/g, ' ')
  const isImmigration = IMMIGRATION_LABELS.has(label)

  const baseClasses = size === 'sm'
    ? 'inline-flex items-center px-2.5 py-1 text-xs rounded-pill border transition-colors'
    : 'inline-flex items-center px-4 py-2 text-sm rounded-pill border transition-colors'

  const colorClasses = active
    ? 'border-ink-900 bg-ink-900 text-cream-50'
    : isImmigration
      ? 'border-cream-400 bg-cream-200 text-ink-700 hover:border-cream-500'
      : 'border-ink-200 bg-ink-50 text-ink-600 hover:border-ink-300'

  const cursorClass = onClick ? 'cursor-pointer' : ''

  return (
    <span
      className={`${baseClasses} ${colorClasses} ${cursorClass}`}
      onClick={onClick}
    >
      {displayName}
    </span>
  )
}

export { LABEL_DISPLAY, IMMIGRATION_LABELS }
