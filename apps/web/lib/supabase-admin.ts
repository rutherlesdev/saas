/**
 * Supabase Admin Client
 * 
 * Server-side Supabase client with service role key for administrative
 * operations like job tracking, metrics, and audit logs.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
}

if (!supabaseServiceKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY - required for job tracking');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Database type definitions
 */
export interface JobRecord {
  id: string;
  queue_name: string;
  job_type: string;
  user_id?: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  data: Record<string, any>;
  result?: Record<string, any>;
  error?: Record<string, any>;
  idempotency_key?: string;
  attempt_count: number;
  max_attempts: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  correlation_id: string;
}

export interface JobEvent {
  id: string;
  job_id: string;
  event_type: string;
  data: Record<string, any>;
  correlation_id: string;
  created_at: string;
}

export interface ProcessingResult {
  id: string;
  job_id: string;
  user_id?: string;
  result_type: string;
  data: Record<string, any>;
  metadata: Record<string, any>;
  created_at: string;
}
