const DEFAULT_PRODUCTION_TRACE_SAMPLE_RATE = 0.1;
const DEFAULT_DEVELOPMENT_TRACE_SAMPLE_RATE = 1.0;
const DEFAULT_PRODUCTION_REPLAY_SESSION_SAMPLE_RATE = 0.1;
const DEFAULT_DEVELOPMENT_REPLAY_SESSION_SAMPLE_RATE = 1.0;
const DEFAULT_REPLAY_ON_ERROR_SAMPLE_RATE = 1.0;

function parseSampleRate(value: string | undefined, fallback: number) {
  if (!value?.trim()) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return fallback;
  }

  return parsed;
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

export function getClientSentryDsn() {
  return process.env.NEXT_PUBLIC_SENTRY_DSN;
}

export function getClientSentryEnvironment() {
  return process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development';
}

export function getClientSentryTraceSampleRate() {
  return parseSampleRate(
    process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
    isProduction() ? DEFAULT_PRODUCTION_TRACE_SAMPLE_RATE : DEFAULT_DEVELOPMENT_TRACE_SAMPLE_RATE
  );
}

export function getClientSentryReplaySessionSampleRate() {
  return parseSampleRate(
    process.env.NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
    isProduction()
      ? DEFAULT_PRODUCTION_REPLAY_SESSION_SAMPLE_RATE
      : DEFAULT_DEVELOPMENT_REPLAY_SESSION_SAMPLE_RATE
  );
}

export function getClientSentryReplayOnErrorSampleRate() {
  return parseSampleRate(
    process.env.NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
    DEFAULT_REPLAY_ON_ERROR_SAMPLE_RATE
  );
}

export function getServerSentryDsn() {
  return process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
}

export function getServerSentryEnvironment() {
  return (
    process.env.SENTRY_ENVIRONMENT ??
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
    process.env.NODE_ENV ??
    'development'
  );
}

export function getServerSentryTraceSampleRate() {
  return parseSampleRate(
    process.env.SENTRY_TRACES_SAMPLE_RATE ?? process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
    isProduction() ? DEFAULT_PRODUCTION_TRACE_SAMPLE_RATE : DEFAULT_DEVELOPMENT_TRACE_SAMPLE_RATE
  );
}
