/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // emit .next/standalone (minimal node server) for the Cloud Run image
}

module.exports = nextConfig
