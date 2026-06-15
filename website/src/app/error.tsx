'use client'

import { useEffect } from 'react'

// Root error boundary. Shows a friendly message instead of an unstyled crash;
// never surfaces the raw error/stack to the user.
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Keep diagnostics server-side / in the console, not on screen.
    // eslint-disable-next-line no-console
    console.error('Unhandled UI error')
  }, [])

  return (
    <div className="container-narrow section-padding flex flex-col items-center text-center">
      <p className="overline mb-2">Something went wrong</p>
      <h1 className="text-headline-lg text-on-surface mb-2">We hit a snag</h1>
      <p className="text-body-md text-on-surface-variant mb-6 max-w-md">
        An unexpected error occurred. Please try again.
      </p>
      <button onClick={reset} className="btn-primary">Try again</button>
    </div>
  )
}
