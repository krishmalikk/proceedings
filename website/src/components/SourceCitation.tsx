import { ExternalLink } from 'lucide-react'

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

export default function SourceCitation({ source, url }: SourceCitationProps) {
  const displayName = source
    .replace('.md', '')
    .replace('.json', '')
    .replace(/-/g, ' ')
    .replace(/_\d+$/, '')

  const linkUrl = url || filenameToUrl(source)

  if (linkUrl) {
    return (
      <a
        href={linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="pill text-xs inline-flex items-center gap-1.5 hover:border-ink-400 hover:text-ink-900 transition-colors cursor-pointer"
      >
        {displayName}
        <ExternalLink className="w-3 h-3" />
      </a>
    )
  }

  return (
    <span className="pill text-xs">
      {displayName}
    </span>
  )
}
