/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // emit .next/standalone (minimal node server) for the Cloud Run image
  async redirects() {
    // /profile was consolidated into /onboarding (handles both new + returning users).
    return [{ source: '/profile', destination: '/onboarding', permanent: true }]
  },
}

module.exports = nextConfig
