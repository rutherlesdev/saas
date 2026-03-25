import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui"],
};

const sentryWebpackPluginOptions = {
  // Suppresses source map uploading logs during build
  silent: !process.env.CI,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Upload source maps only in CI/production
  widenClientFileUpload: true,
  // Hide source maps from browser bundle
  hideSourceMaps: true,
  // Disable Sentry SDK logger (reduces bundle size)
  disableLogger: true,
};

// Only wrap with Sentry when DSN is configured
export default process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;

