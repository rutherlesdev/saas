/**
 * useJobStatus Hook
 * 
 * React hook for tracking job status and polling for updates.
 * Automatically updates when job completes.
 */

import { useEffect, useState, useCallback } from 'react';

interface JobStatus {
  job: {
    id: string;
    status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
    created_at: string;
    completed_at?: string;
    result?: Record<string, any>;
    error?: Record<string, any>;
  };
  events: Array<{
    event_type: string;
    data: Record<string, any>;
    created_at: string;
  }>;
}

export interface UseJobStatusOptions {
  pollInterval?: number; // ms between polls
  maxAttempts?: number;
}

/**
 * Track job status with automatic polling
 */
export function useJobStatus(
  jobId: string | null,
  options: UseJobStatusOptions = {}
) {
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollInterval = options.pollInterval ?? 1000; // 1 second
  const maxAttempts = options.maxAttempts ?? 60; // 1 minute

  const fetchStatus = useCallback(async () => {
    if (!jobId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/jobs/${jobId}/status`);

      if (!response.ok) {
        throw new Error(`Failed to fetch job status: ${response.status}`);
      }

      const data: JobStatus = await response.json();
      setStatus(data);

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;

    let pollCount = 0;
    let pollTimeout: NodeJS.Timeout;

    const startPolling = async () => {
      const result = await fetchStatus();
      pollCount++;

      // Stop polling if job is completed/failed or max attempts reached
      if (
        result?.job.status === 'completed' ||
        result?.job.status === 'failed' ||
        result?.job.status === 'cancelled' ||
        pollCount >= maxAttempts
      ) {
        return;
      }

      // Schedule next poll
      pollTimeout = setTimeout(startPolling, pollInterval);
    };

    startPolling();

    return () => {
      if (pollTimeout) clearTimeout(pollTimeout);
    };
  }, [jobId, fetchStatus, pollInterval, maxAttempts]);

  return {
    status,
    loading,
    error,
    refetch: () => fetchStatus(),
  };
}

/**
 * Get readable status display
 */
export function getJobStatusDisplay(
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
) {
  const displays = {
    queued: { label: 'Queued', color: 'yellow' },
    processing: { label: 'Processing', color: 'blue' },
    completed: { label: 'Completed', color: 'green' },
    failed: { label: 'Failed', color: 'red' },
    cancelled: { label: 'Cancelled', color: 'gray' },
  };

  return displays[status];
}
