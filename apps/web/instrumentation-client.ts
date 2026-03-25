import * as Sentry from '@sentry/nextjs';

import {
  getClientSentryDsn,
  getClientSentryEnvironment,
  getClientSentryReplayOnErrorSampleRate,
  getClientSentryReplaySessionSampleRate,
  getClientSentryTraceSampleRate,
} from './lib/observability/sentry-config';

Sentry.init({
  dsn: getClientSentryDsn(),
  sendDefaultPii: true,
  tracesSampleRate: getClientSentryTraceSampleRate(),
  environment: getClientSentryEnvironment(),
  enabled: Boolean(getClientSentryDsn()),
  integrations: [Sentry.replayIntegration()],
  replaysSessionSampleRate: getClientSentryReplaySessionSampleRate(),
  replaysOnErrorSampleRate: getClientSentryReplayOnErrorSampleRate(),
  enableLogs: true,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
