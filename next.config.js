/** @type {import('next').NextConfig} */
const createNextIntlPlugin = require('next-intl/plugin')
const withNextIntl = createNextIntlPlugin()
const nextConfig = {
  reactStrictMode: false,
  images: {
    dangerouslyAllowSVG: true,
    domains: ['img.shields.io', 'upload.wikimedia.org'],
  },
  env: {
    SKIP_LOADING_ANIMATION: process.env.SKIP_LOADING_ANIMATION,
    SKIP_TITLE_ANIMATION: process.env.SKIP_TITLE_ANIMATION,
  },
}

module.exports = withNextIntl(nextConfig)
