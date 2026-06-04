'use client'

import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'

// Map Markdown elements to the design system's Tailwind classes so we don't
// depend on the typography plugin. rehype-sanitize keeps rendering safe.
const components: Components = {
  p: ({ children }) => <p className="text-body-md text-on-surface mb-3 leading-relaxed">{children}</p>,
  h1: ({ children }) => <h1 className="text-headline-md text-on-surface font-semibold mt-4 mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-headline-md text-on-surface font-semibold mt-4 mb-2">{children}</h2>,
  h3: ({ children }) => <h3 className="text-label-md text-on-surface font-semibold mt-3 mb-1">{children}</h3>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1 text-on-surface">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1 text-on-surface">{children}</ol>,
  li: ({ children }) => <li className="text-body-md text-on-surface">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-on-surface">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline">
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-outline-variant pl-3 italic text-on-surface-variant my-2">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="bg-surface-container px-1 py-0.5 rounded text-caption font-mono">{children}</code>
  ),
  hr: () => <hr className="border-outline-variant my-4" />,
}

export default function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={components}>
      {children}
    </ReactMarkdown>
  )
}
