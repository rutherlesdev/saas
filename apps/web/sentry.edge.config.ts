import * as Sentry from '@sentry/nextjs';

import {
  getServerSentryDsn,
  getServerSentryEnvironment,
  getServerSentryTraceSampleRate,
} from './lib/observability/sentry-config';

Sentry.init({
  dsn: getServerSentryDsn(),
  sendDefaultPii: true,
  tracesSampleRate: getServerSentryTraceSampleRate(),
  environment: getServerSentryEnvironment(),
  enabled: Boolean(getServerSentryDsn()),
  enableLogs: true,
});
