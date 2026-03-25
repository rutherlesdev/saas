import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui"],
};

const hasSentryRuntimeConfig = Boolean(
  process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
);
const hasSentrySourceMapUploadConfig = Boolean(
  process.env.SENTRY_AUTH_TOKEN &&
    process.env.SENTRY_ORG &&
    process.env.SENTRY_PROJECT
);

const sentryWebpackPluginOptions = {
  // Suppresses source map uploading logs during build
  silent: !process.env.CI,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Keep runtime instrumentation active even when upload credentials are missing.
  disable: !hasSentrySourceMapUploadConfig,
  widenClientFileUpload: true,
  tunnelRoute: '/monitoring',
  hideSourceMaps: true,
  disableLogger: true,
};

export default hasSentryRuntimeConfig
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;
