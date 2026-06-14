/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // emit .next/standalone (minimal node server) for the Cloud Run image
  // NOTE: the old permanent /profile -> /onboarding redirect was removed when the
  // read-only /profile view page landed (it links to /onboarding for editing).
  // Permanent (308) redirects get cached by browsers — returning visitors may
  // still be bounced to /onboarding until their cache expires.
}

module.exports = nextConfig
