import { redirect } from 'next/navigation'

// /ask is consolidated into the unified search interface (AI mode).
export default function AskPage() {
  redirect('/search?mode=ai')
}
