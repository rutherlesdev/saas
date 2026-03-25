/**
 * Supabase Schema for Job Queue
 * 
 * Run these SQL statements in your Supabase dashboard or
 * use the migration system in your database.
 * 
 * Tables:
 * - jobs: Core job records
 * - job_events: Audit trail of job lifecycle events
 * - processing_results: Results and metadata from completed jobs
 */

-- Jobs table: Core job tracking
CREATE TABLE IF NOT EXISTS public.jobs (
  id text PRIMARY KEY,
  queue_name text NOT NULL,
  job_type text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued',
  data jsonb NOT NULL,
  result jsonb,
  error jsonb,
  idempotency_key text,
  correlation_id text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT job_status_check CHECK (
    status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')
  )
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_jobs_queue_name ON public.jobs(queue_name);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON public.jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_correlation_id ON public.jobs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_jobs_idempotency_key ON public.jobs(idempotency_key, queue_name);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON public.jobs(created_at DESC);

-- Job events table: Complete audit trail
CREATE TABLE IF NOT EXISTS public.job_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id text NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  data jsonb,
  correlation_id text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for job events
CREATE INDEX IF NOT EXISTS idx_job_events_job_id ON public.job_events(job_id);
CREATE INDEX IF NOT EXISTS idx_job_events_event_type ON public.job_events(event_type);
CREATE INDEX IF NOT EXISTS idx_job_events_correlation_id ON public.job_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_job_events_created_at ON public.job_events(created_at DESC);

-- Processing results table: Detailed results from completed jobs
CREATE TABLE IF NOT EXISTS public.processing_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id text NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  result_type text NOT NULL,
  data jsonb NOT NULL,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(job_id)
);

-- Index for results lookup
CREATE INDEX IF NOT EXISTS idx_processing_results_user_id ON public.processing_results(user_id);
CREATE INDEX IF NOT EXISTS idx_processing_results_result_type ON public.processing_results(result_type);

-- Enable RLS policies
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies for jobs
CREATE POLICY "Users can view their own jobs" ON public.jobs
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.role = 'authenticated'
    )
  );

CREATE POLICY "Service role can manage all jobs" ON public.jobs
  USING (auth.role() = 'service_role');

-- RLS Policies for job_events
CREATE POLICY "Users can view events for their jobs" ON public.job_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = job_events.job_id
      AND jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all events" ON public.job_events
  USING (auth.role() = 'service_role');

-- RLS Policies for processing_results
CREATE POLICY "Users can view their results" ON public.processing_results
  FOR SELECT USING (
    user_id = auth.uid() OR
    auth.role() = 'service_role'
  );

CREATE POLICY "Service role can manage results" ON public.processing_results
  USING (auth.role() = 'service_role');

-- View for job statistics
CREATE OR REPLACE VIEW public.job_statistics AS
SELECT
  queue_name,
  job_type,
  status,
  COUNT(*) as count,
  ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - started_at))))::integer as avg_processing_time_seconds,
  MAX(created_at) as last_created,
  MAX(updated_at) as last_updated
FROM public.jobs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY queue_name, job_type, status;

-- Cleanup function to archive old jobs (optional)
CREATE OR REPLACE FUNCTION archive_old_jobs()
RETURNS void AS $$
BEGIN
  DELETE FROM public.jobs
  WHERE status = 'completed'
  AND completed_at < NOW() - INTERVAL '90 days'
  AND id NOT IN (
    SELECT job_id FROM public.processing_results
  );
END;
$$ LANGUAGE plpgsql;
