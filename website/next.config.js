/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // emit .next/standalone (minimal node server) for the Cloud Run image
  // NOTE: the old permanent /profile -> /onboarding redirect was removed when the
  // read-only /profile view page landed (it links to /onboarding for editing).
  // Permanent (308) redirects get cached by browsers — returning visitors may
  // still be bounced to /onboarding until their cache expires.

  // Baseline security headers for all routes. A strict Content-Security-Policy is
  // deliberately deferred (needs careful allow-listing of Google Fonts / Material
  // Symbols / Firebase before it can ship without breaking the app).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
