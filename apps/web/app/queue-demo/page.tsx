/**
 * Queue System Dashboard Example Page
 * 
 * Demonstrates job enqueueing, status tracking, and monitoring.
 * Add this at: app/queue-demo/page.tsx
 */

'use client';

import { useState } from 'react';
import { useJobStatus, getJobStatusDisplay } from '@/hooks/useJobStatus';

export default function QueueDemoPage() {
  const [activeTab, setActiveTab] = useState<'enqueue' | 'monitor'>('enqueue');
  const [jobId, setJobId] = useState<string | null>(null);
  const [email, setEmail] = useState('demo@example.com');
  const [submitting, setSubmitting] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);

  const { status: jobStatus, loading: jobLoading } = useJobStatus(jobId);

  const handleEnqueueEmail = async () => {
    setSubmitting(true);
    try {
      const response = await fetch('/api/jobs/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobType: 'email',
          data: {
            to: email,
            subject: 'Test Email from Queue Demo',
            templateId: 'demo',
            variables: { timestamp: new Date().toISOString() },
          },
        }),
      });

      if (!response.ok) throw new Error('Failed to enqueue');
      const data = await response.json();
      setJobId(data.jobId);
    } catch (error) {
      console.error('Failed to enqueue:', error);
      alert('Failed to enqueue job');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFetchMetrics = async () => {
    try {
      const response = await fetch('/api/queue/metrics');
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
  };

  const handleFetchHealth = async () => {
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      setHealth(data);
    } catch (error) {
      console.error('Failed to fetch health:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Queue System Demo</h1>

        {/* Tabs */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setActiveTab('enqueue')}
            className={`px-4 py-2 rounded font-medium ${
              activeTab === 'enqueue'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 border border-gray-300'
            }`}
          >
            Enqueue Job
          </button>
          <button
            onClick={() => setActiveTab('monitor')}
            className={`px-4 py-2 rounded font-medium ${
              activeTab === 'monitor'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 border border-gray-300'
            }`}
          >
            Monitor
          </button>
        </div>

        {/* Enqueue Tab */}
        {activeTab === 'enqueue' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Enqueue Form */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold mb-4">Send Email Job</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Recipient Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                </div>

                <button
                  onClick={handleEnqueueEmail}
                  disabled={submitting}
                  className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                >
                  {submitting ? 'Enqueueing...' : 'Enqueue Email Job'}
                </button>
              </div>
            </div>

            {/* Job Status */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold mb-4">Job Status</h2>

              {jobId ? (
                <div className="space-y-4">
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="text-sm font-mono break-all">{jobId}</p>
                  </div>

                  {jobStatus && (
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-600">Status</p>
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-3 h-3 rounded-full ${
                              jobStatus.job.status === 'completed'
                                ? 'bg-green-500'
                                : jobStatus.job.status === 'failed'
                                  ? 'bg-red-500'
                                  : jobStatus.job.status === 'processing'
                                    ? 'bg-blue-500'
                                    : 'bg-yellow-500'
                            }`}
                          />
                          <p className="font-medium">
                            {jobStatus.job.status.toUpperCase()}
                          </p>
                        </div>
                      </div>

                      {jobStatus.job.result && (
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Result</p>
                          <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto">
                            {JSON.stringify(jobStatus.job.result, null, 2)}
                          </pre>
                        </div>
                      )}

                      {jobStatus.events.length > 0 && (
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Events</p>
                          <ul className="space-y-1 text-sm">
                            {jobStatus.events.map((event, i) => (
                              <li key={i} className="text-gray-700">
                                • {event.event_type}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500">Enqueue a job to see status</p>
              )}
            </div>
          </div>
        )}

        {/* Monitor Tab */}
        {activeTab === 'monitor' && (
          <div className="space-y-6">
            <div className="flex gap-4">
              <button
                onClick={handleFetchHealth}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Check Health
              </button>
              <button
                onClick={handleFetchMetrics}
                className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
              >
                Fetch Metrics
              </button>
            </div>

            {/* Health Status */}
            {health && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-bold mb-4">System Health</h2>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600">Overall Status</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          health.status === 'healthy'
                            ? 'bg-green-500'
                            : health.status === 'degraded'
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                        }`}
                      />
                      <p className="font-medium text-lg">
                        {health.status.toUpperCase()}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 mb-2">Redis</p>
                    <div className="bg-gray-50 p-3 rounded text-sm space-y-1">
                      <p>
                        Status:{' '}
                        <span
                          className={
                            health.redis.status === 'connected'
                              ? 'text-green-600 font-medium'
                              : 'text-red-600 font-medium'
                          }
                        >
                          {health.redis.status}
                        </span>
                      </p>
                      {health.redis.latency !== undefined && (
                        <p>Latency: {health.redis.latency}ms</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 mb-2">Queues</p>
                    <div className="space-y-2">
                      {Object.entries(health.queues).map(
                        ([name, queue]: [string, any]) => (
                          <div
                            key={name}
                            className="bg-gray-50 p-3 rounded text-sm"
                          >
                            <p className="font-medium">{name}</p>
                            <div className="grid grid-cols-2 gap-2 mt-1 text-xs">
                              <p>
                                Depth: <span className="font-mono">{queue.depth}</span>
                              </p>
                              <p>
                                Active: <span className="font-mono">{queue.active}</span>
                              </p>
                              <p>
                                Delayed: <span className="font-mono">{queue.delayed}</span>
                              </p>
                              <p>
                                Failed: <span className="font-mono">{queue.failed}</span>
                              </p>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Metrics */}
            {metrics && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-bold mb-4">Queue Metrics</h2>

                <div className="space-y-4">
                  {Object.entries(metrics.queues).map(
                    ([name, queue]: [string, any]) => (
                      <div key={name} className="border rounded-lg p-4">
                        <h3 className="font-bold mb-2">{name}</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600">Depth</p>
                            <p className="text-2xl font-bold">{queue.depth}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Active</p>
                            <p className="text-2xl font-bold">{queue.active}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Delayed</p>
                            <p className="text-2xl font-bold">{queue.delayed}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Failed</p>
                            <p className="text-2xl font-bold text-red-600">
                              {queue.failed}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  )}

                  {metrics.processing && (
                    <div className="border rounded-lg p-4 bg-blue-50">
                      <h3 className="font-bold mb-2">Processing Stats</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Average</p>
                          <p className="text-xl font-bold">
                            {metrics.processing.averageTime}ms
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">P50</p>
                          <p className="text-xl font-bold">
                            {metrics.processing.p50}ms
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">P95</p>
                          <p className="text-xl font-bold">
                            {metrics.processing.p95}ms
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">P99</p>
                          <p className="text-xl font-bold">
                            {metrics.processing.p99}ms
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
