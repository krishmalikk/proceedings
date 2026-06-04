import { redirect } from 'next/navigation'

// /ask is consolidated into the unified search interface (AI answer + results).
export default function AskPage() {
  redirect('/search')
}
