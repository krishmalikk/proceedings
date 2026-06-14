import { redirect } from 'next/navigation'

// The search-first experience is the landing page: root canonically redirects
// to /search (the UnifiedSearch interface).
export default function RootPage() {
  redirect('/search')
}
