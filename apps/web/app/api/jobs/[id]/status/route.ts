/**
 * GET /api/jobs/[id]/status
 * 
 * Get job status and metadata from Supabase.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getLogger } from '@/lib/queue/observability/logger';

const logger = getLogger();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id;

    const { data: job, error } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Get related events
    const { data: events } = await supabaseAdmin
      .from('job_events')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });

    return NextResponse.json({
      job,
      events: events || [],
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage, jobId: params.id }, 'Failed to get job status');

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
