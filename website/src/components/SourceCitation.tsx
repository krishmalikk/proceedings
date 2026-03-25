interface SourceCitationProps {
  source: string
}

export default function SourceCitation({ source }: SourceCitationProps) {
  // Clean up source filename for display
  const displayName = source
    .replace('.md', '')
    .replace('.json', '')
    .replace(/-/g, ' ')
    .replace(/_\d+$/, '')

  return (
    <span className="pill text-xs">
      {displayName}
    </span>
  )
}
