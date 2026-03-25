/**
 * Next.js Instrumentation
 *
 * Initializes OpenTelemetry (Node.js runtime) and Sentry (server/edge runtimes).
 * Called once at server startup by the Next.js runtime.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

import { getServerSentryDsn } from './lib/observability/sentry-config';

let otelStarted = false;

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (getServerSentryDsn()) {
      await import('./sentry.server.config');
    }

    if (otelStarted) {
      return;
    }

    const { NodeSDK } = await import('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } = await import(
      '@opentelemetry/auto-instrumentations-node'
    );
    const { OTLPTraceExporter } = await import(
      '@opentelemetry/exporter-trace-otlp-http'
    );
    const { resourceFromAttributes } = await import('@opentelemetry/resources');
    const {
      SEMRESATTRS_SERVICE_NAME,
      SEMRESATTRS_SERVICE_VERSION,
    } = await import('@opentelemetry/semantic-conventions');

    const sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [SEMRESATTRS_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'saas-app',
        [SEMRESATTRS_SERVICE_VERSION]: process.env.npm_package_version ?? '0.0.1',
      }),
      // Only export traces when an endpoint is configured
      traceExporter: process.env.OTEL_EXPORTER_OTLP_ENDPOINT
        ? new OTLPTraceExporter({
            url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
          })
        : undefined,
      instrumentations: [
        getNodeAutoInstrumentations({
          // Disable noisy FS instrumentation
          '@opentelemetry/instrumentation-fs': { enabled: false },
          '@opentelemetry/instrumentation-http': { enabled: true },
          '@opentelemetry/instrumentation-pg': { enabled: true },
          '@opentelemetry/instrumentation-ioredis': { enabled: true },
        }),
      ],
    });

    await sdk.start();
    otelStarted = true;
    return;
  }

  if (process.env.NEXT_RUNTIME === 'edge' && getServerSentryDsn()) {
    await import('./sentry.edge.config');
  }
}

// Capture unhandled server errors and send them to Sentry
export async function onRequestError(
  err: unknown,
  request: { path: string; method: string; headers: Record<string, string | string[] | undefined> },
  context: { routerKind: string; routePath: string; routeType: string }
) {
  if (!getServerSentryDsn()) {
    return;
  }

  const Sentry = await import('@sentry/nextjs');
  Sentry.captureRequestError(err, request, context);
}
