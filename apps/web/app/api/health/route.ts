/**
 * GET /api/health
 * 
 * System health check endpoint for monitoring and load balancers.
 */

import { NextResponse } from 'next/server';
import { getSystemHealth } from '@/lib/queue/health';

export async function GET() {
  try {
    const health = await getSystemHealth();

    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 503 : 500;

    return NextResponse.json(health, { status: statusCode });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
