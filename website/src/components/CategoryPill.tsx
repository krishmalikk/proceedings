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
}


interface CategoryPillProps {
  label: string
  onClick?: () => void
  active?: boolean
  size?: 'sm' | 'md'
}

export default function CategoryPill({ label, onClick, active, size = 'sm' }: CategoryPillProps) {
  const displayName = LABEL_DISPLAY[label] || label.replace(/-/g, ' ')

  const baseClasses = size === 'sm'
    ? 'inline-flex items-center px-2.5 py-1 text-xs rounded-pill border transition-colors'
    : 'inline-flex items-center px-4 py-2 text-sm rounded-pill border transition-colors'

  const colorClasses = active
    ? 'border-ink-900 bg-ink-900 text-cream-50'
    : 'border-cream-400 bg-cream-200 text-ink-700 hover:border-cream-500'

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

export { LABEL_DISPLAY }
