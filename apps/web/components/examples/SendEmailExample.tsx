/**
 * Example: Send Email Component
 * 
 * Shows how to integrate job enqueueing from React components
 * via API calls and track job status.
 */

'use client';

import { useState } from 'react';

interface JobResponse {
  jobId: string;
  correlationId: string;
  status: string;
}

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

export function SendEmailExample() {
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');

  const handleSendEmail = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/jobs/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobType: 'email',
          data: {
            to: email,
            subject: 'Welcome to our app!',
            templateId: 'welcome',
            variables: { name: 'User' },
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to enqueue email');
      }

      const data: JobResponse = await response.json();
      setJobId(data.jobId);
      
      // Immediately check status
      checkJobStatus(data.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const checkJobStatus = async (jobIdToCheck: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobIdToCheck}/status`);
      if (!response.ok) throw new Error('Failed to fetch status');
      const status: JobStatus = await response.json();
      setJobStatus(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check status');
    }
  };

  const handleCheckStatus = () => {
    if (jobId) {
      checkJobStatus(jobId);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4">Send Email Example</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded"
          />
        </div>

        <button
          onClick={handleSendEmail}
          disabled={loading || !email}
          className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Sending...' : 'Send Email'}
        </button>

        {jobId && (
          <>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm font-mono">Job ID: {jobId}</p>
            </div>

            <button
              onClick={handleCheckStatus}
              className="w-full px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Check Status
            </button>
          </>
        )}

        {jobStatus && (
          <div className="mt-4 p-4 bg-gray-50 rounded">
            <h3 className="font-bold mb-2">Job Status</h3>
            <dl className="text-sm space-y-1">
              <div>
                <dt className="font-semibold">Status:</dt>
                <dd>{jobStatus.job.status}</dd>
              </div>
              <div>
                <dt className="font-semibold">Created:</dt>
                <dd>{new Date(jobStatus.job.created_at).toLocaleString()}</dd>
              </div>
              {jobStatus.job.completed_at && (
                <div>
                  <dt className="font-semibold">Completed:</dt>
                  <dd>{new Date(jobStatus.job.completed_at).toLocaleString()}</dd>
                </div>
              )}
              {jobStatus.job.result && (
                <div>
                  <dt className="font-semibold">Result:</dt>
                  <dd>
                    <pre className="bg-white p-2 rounded overflow-auto text-xs">
                      {JSON.stringify(jobStatus.job.result, null, 2)}
                    </pre>
                  </dd>
                </div>
              )}
              {jobStatus.job.error && (
                <div>
                  <dt className="font-semibold text-red-600">Error:</dt>
                  <dd className="text-red-600">{jobStatus.job.error.message}</dd>
                </div>
              )}
            </dl>

            {jobStatus.events.length > 0 && (
              <div className="mt-3 pt-3 border-t">
                <dt className="font-semibold mb-2">Events</dt>
                <ul className="space-y-1 text-xs">
                  {jobStatus.events.map((event, i) => (
                    <li key={i}>
                      {event.event_type} -{' '}
                      {new Date(event.created_at).toLocaleTimeString()}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
