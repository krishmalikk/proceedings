'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { DEMO_PICKER_ENABLED } from '@/lib/activeUser'

/**
 * Route guard for pages that require an identity. In **production** it redirects
 * to `/login` once auth settles if there's no Firebase session. In **dev/test**
 * it's a no-op — the demo-user picker supplies identity there (DEMO_PICKER_ENABLED),
 * so guarding would fight the picker's timing and break the suites.
 */
export function useRequireUser(): void {
  const router = useRouter()
  const { user, loading } = useAuth()
  useEffect(() => {
    if (DEMO_PICKER_ENABLED || loading) return
    if (!user) router.replace('/login')
  }, [user, loading, router])
}
