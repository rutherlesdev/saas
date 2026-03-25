import { afterEach, describe, expect, it } from 'vitest';

import {
  getClientSentryDsn,
  getClientSentryEnvironment,
  getClientSentryReplayOnErrorSampleRate,
  getClientSentryReplaySessionSampleRate,
  getClientSentryTraceSampleRate,
  getServerSentryDsn,
  getServerSentryEnvironment,
  getServerSentryTraceSampleRate,
} from '@/lib/observability/sentry-config';

const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
  NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
  NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE:
    process.env.NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
  NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE:
    process.env.NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
  SENTRY_DSN: process.env.SENTRY_DSN,
  SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT,
  SENTRY_TRACES_SAMPLE_RATE: process.env.SENTRY_TRACES_SAMPLE_RATE,
};

const ENV = process.env as Record<string, string | undefined>;

function resetSentryEnv() {
  for (const key of Object.keys(ORIGINAL_ENV)) {
    const value = ORIGINAL_ENV[key as keyof typeof ORIGINAL_ENV];

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

afterEach(() => {
  resetSentryEnv();
});

describe('sentry-config', () => {
  it('prefers public client values and parses sample rates', () => {
    ENV.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://public@sentry.example/1';
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT = 'preview';
    process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE = '0.25';
    process.env.NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE = '0.05';
    process.env.NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE = '1';

    expect(getClientSentryDsn()).toBe('https://public@sentry.example/1');
    expect(getClientSentryEnvironment()).toBe('preview');
    expect(getClientSentryTraceSampleRate()).toBe(0.25);
    expect(getClientSentryReplaySessionSampleRate()).toBe(0.05);
    expect(getClientSentryReplayOnErrorSampleRate()).toBe(1);
  });

  it('falls back to sane defaults when sample rates are invalid', () => {
    ENV.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE = '2';
    process.env.NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE = '-1';
    process.env.NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE = 'invalid';

    expect(getClientSentryTraceSampleRate()).toBe(0.1);
    expect(getClientSentryReplaySessionSampleRate()).toBe(0.1);
    expect(getClientSentryReplayOnErrorSampleRate()).toBe(1);
  });

  it('allows the server to fall back to the public DSN when needed', () => {
    ENV.NODE_ENV = 'development';
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://public@sentry.example/1';
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT = 'local';
    process.env.SENTRY_TRACES_SAMPLE_RATE = '0.75';

    expect(getServerSentryDsn()).toBe('https://public@sentry.example/1');
    expect(getServerSentryEnvironment()).toBe('local');
    expect(getServerSentryTraceSampleRate()).toBe(0.75);
  });
});
