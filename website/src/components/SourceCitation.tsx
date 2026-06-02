interface SourceCitationProps {
  source: string
  url?: string
}

function filenameToUrl(source: string): string | null {
  // Strip .md extension
  let name = source.replace('.md', '').replace('.json', '')

  // Known domain mappings
  const domainMappings: [string, string][] = [
    ['uscis-gov-', 'https://www.uscis.gov/'],
    ['travel-state-gov-', 'https://travel.state.gov/'],
    ['dol-gov-', 'https://www.dol.gov/'],
    ['law-cornell-edu-', 'https://www.law.cornell.edu/'],
    ['visaguide-world-', 'https://visaguide.world/'],
    ['nolo-com-', 'https://www.nolo.com/'],
    ['boundless-com-', 'https://www.boundless.com/'],
    ['citizenpath-com-', 'https://citizenpath.com/'],
    ['findlaw-com-', 'https://www.findlaw.com/'],
    ['justia-com-', 'https://www.justia.com/'],
    ['wegreened-com-', 'https://www.wegreened.com/'],
    ['immigrationdirect-com-', 'https://www.immigrationdirect.com/'],
    ['visaplace-com-', 'https://www.visaplace.com/'],
    ['murthy-com-', 'https://www.murthy.com/'],
    ['fragomen-com-', 'https://www.fragomen.com/'],
    ['bal-com-', 'https://www.bal.com/'],
    ['alllaw-com-', 'https://www.alllaw.com/'],
    ['irs-gov-', 'https://www.irs.gov/'],
    ['epa-gov-', 'https://www.epa.gov/'],
    ['eeoc-gov-', 'https://www.eeoc.gov/'],
    ['hud-gov-', 'https://www.hud.gov/'],
    ['sba-gov-', 'https://www.sba.gov/'],
    ['uscourts-gov-', 'https://www.uscourts.gov/'],
    ['uspto-gov-', 'https://www.uspto.gov/'],
    ['ilrc-org-', 'https://www.ilrc.org/'],
  ]

  for (const [prefix, baseUrl] of domainMappings) {
    if (name.startsWith(prefix)) {
      const path = name.slice(prefix.length).replace(/-html$/, '.html').replace(/-/g, '/')
      return baseUrl + path
    }
  }

  return null
}

function getDisplayName(source: string): string {
  const name = source.replace('.md', '').replace('.json', '')

  // Extract domain for cleaner display
  const domainMatch = name.match(/^([a-z]+)-(?:gov|com|org|edu)-/)
  if (domainMatch) {
    const domain = domainMatch[1].toUpperCase()
    if (domain === 'USCIS') return 'USCIS.gov'
    if (domain === 'TRAVEL') return 'State.gov'
    if (domain === 'DOL') return 'DOL.gov'
    if (domain === 'LAW') return 'Cornell Law'
    return `${domain}.gov`
  }

  return name.replace(/-/g, ' ').replace(/_\d+$/, '').slice(0, 20)
}

export default function SourceCitation({ source, url }: SourceCitationProps) {
  const displayName = getDisplayName(source)
  const linkUrl = url || filenameToUrl(source)

  if (linkUrl) {
    return (
      <a
        href={linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-caption text-secondary hover:underline transition-colors"
      >
        <span className="material-symbols-outlined text-[14px]">link</span>
        {displayName}
      </a>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 text-caption text-on-surface-variant">
      <span className="material-symbols-outlined text-[14px]">description</span>
      {displayName}
    </span>
  )
}
