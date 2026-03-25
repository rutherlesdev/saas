/**
 * Metrics Collection
 * 
 * Tracks queue metrics: depth, processing time, success/failure rates,
 * retry counts, and latency percentiles. Can be exposed via metrics API
 * and extended with OpenTelemetry.
 */

export interface QueueMetrics {
  queueName: string;
  depth: number; // jobs waiting
  active: number; // currently processing
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

export interface JobMetrics {
  totalJobs: number;
  successfulJobs: number;
  failedJobs: number;
  cancelledJobs: number;
  retriedJobs: number;
  averageProcessingTime: number; // milliseconds
  p50ProcessingTime: number;
  p95ProcessingTime: number;
  p99ProcessingTime: number;
  successRate: number; // 0-1
  retryRate: number; // 0-1
}

interface TimingRecord {
  jobId: string;
  duration: number;
  timestamp: number;
}

export class MetricsCollector {
  private processingTimes: TimingRecord[] = [];
  private readonly maxRecords = 10000; // Keep last 10k records

  recordJobProcessingTime(jobId: string, durationMs: number) {
    this.processingTimes.push({
      jobId,
      duration: durationMs,
      timestamp: Date.now(),
    });

    // Keep only recent records to prevent memory bloat
    if (this.processingTimes.length > this.maxRecords) {
      this.processingTimes = this.processingTimes.slice(-this.maxRecords);
    }
  }

  calculatePercentile(percentile: number): number {
    if (this.processingTimes.length === 0) return 0;

    const sorted = [...this.processingTimes]
      .sort((a, b) => a.duration - b.duration);
    
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)]?.duration ?? 0;
  }

  getMetrics() {
    return {
      totalRecords: this.processingTimes.length,
      averageTime: this.calculateAverage(),
      p50: this.calculatePercentile(50),
      p95: this.calculatePercentile(95),
      p99: this.calculatePercentile(99),
    };
  }

  private calculateAverage(): number {
    if (this.processingTimes.length === 0) return 0;
    const sum = this.processingTimes.reduce((acc, r) => acc + r.duration, 0);
    return sum / this.processingTimes.length;
  }

  reset() {
    this.processingTimes = [];
  }
}

// Global metrics instance
let metricsCollector: MetricsCollector | null = null;

export function getMetricsCollector(): MetricsCollector {
  if (!metricsCollector) {
    metricsCollector = new MetricsCollector();
  }
  return metricsCollector;
}

/**
 * OpenTelemetry integration points (for future use)
 */
export function recordJobMetricOpenTelemetry(
  jobType: string,
  status: 'success' | 'failure' | 'retry' | 'cancel',
  durationMs: number,
  attributes?: Record<string, any>
) {
  // This is where you'd integrate with OpenTelemetry
  // Example:
  // meter.createHistogram('job.duration').record(durationMs, {
  //   'job.type': jobType,
  //   'job.status': status,
  //   ...attributes,
  // });
  
  console.debug('Job metric:', { jobType, status, durationMs, attributes });
}
