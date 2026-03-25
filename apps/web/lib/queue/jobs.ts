/**
 * Job Type Definitions
 * 
 * Strongly typed job definitions with validation using Zod.
 * Each job type includes its data shape, result shape, and metadata.
 */

import { z } from 'zod';

const JobCorrelationSchema = z.object({
  correlationId: z.string().optional(),
});

/**
 * Email Job - for sending transactional emails
 */
export const EmailJobDataSchema = JobCorrelationSchema.extend({
  to: z.string().email('Invalid email address'),
  subject: z.string().min(1),
  templateId: z.string(),
  variables: z.record(z.string(), z.any()).optional(),
  userId: z.string().optional(),
  priority: z.enum(['high', 'normal', 'low']).optional().default('normal'),
});

export type EmailJobData = z.input<typeof EmailJobDataSchema>;

export interface EmailJobResult {
  messageId: string;
  sentAt: number;
  attemptCount: number;
}

/**
 * File Processing Job - for async file uploads/processing
 */
export const FileProcessingJobDataSchema = JobCorrelationSchema.extend({
  fileId: z.string(),
  userId: z.string(),
  bucket: z.string(),
  path: z.string(),
  mimeType: z.string(),
  processType: z.enum(['extract', 'convert', 'validate', 'analyze']),
  options: z.record(z.any()).optional(),
});

export type FileProcessingJobData = z.input<
  typeof FileProcessingJobDataSchema
>;

export interface FileProcessingJobResult {
  fileId: string;
  processedPath?: string;
  metadata: Record<string, any>;
  processedAt: number;
}

/**
 * Data Export Job - for generating reports/exports
 */
export const DataExportJobDataSchema = JobCorrelationSchema.extend({
  userId: z.string(),
  exportType: z.enum(['csv', 'pdf', 'json']),
  dataType: z.string(),
  filter: z.record(z.any()).optional(),
  batchSize: z.number().optional().default(1000),
});

export type DataExportJobData = z.input<typeof DataExportJobDataSchema>;

export interface DataExportJobResult {
  exportId: string;
  fileUrl: string;
  rowCount: number;
  completedAt: number;
}

/**
 * Webhook Job - for reliable webhook deliveries with retries
 */
export const WebhookJobDataSchema = JobCorrelationSchema.extend({
  webhookId: z.string(),
  url: z.string().url(),
  event: z.string(),
  payload: z.record(z.any()),
  userId: z.string(),
  timeout: z.number().optional().default(30000),
});

export type WebhookJobData = z.input<typeof WebhookJobDataSchema>;

export interface WebhookJobResult {
  webhookId: string;
  statusCode: number;
  responseTime: number;
  attempt: number;
}

/**
 * Cleanup Job - for periodic maintenance tasks
 */
export const CleanupJobDataSchema = JobCorrelationSchema.extend({
  cleanupType: z.enum(['expired_sessions', 'old_logs', 'temp_files']),
  retentionDays: z.number().optional().default(30),
  dryRun: z.boolean().optional().default(false),
});

export type CleanupJobData = z.input<typeof CleanupJobDataSchema>;

export interface CleanupJobResult {
  cleanupType: string;
  itemsDeleted: number;
  completedAt: number;
}

/**
 * Base job metadata stored in Supabase
 */
export interface JobMetadata {
  jobId: string;
  queueName: string;
  jobType: string;
  userId?: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  data: Record<string, any>;
  result?: Record<string, any>;
  error?: {
    message: string;
    code: string;
    stack?: string;
  };
  idempotencyKey?: string;
  attemptCount: number;
  maxAttempts: number;
  startedAt?: number;
  completedAt?: number;
  createdAt: number;
  updatedAt: number;
  metadata: {
    correlationId: string;
    source?: string;
    userAgent?: string;
    ipAddress?: string;
  };
}

/**
 * Job event enum for audit trail
 */
export enum JobEventType {
  QUEUED = 'job.queued',
  STARTED = 'job.started',
  PROGRESS = 'job.progress',
  COMPLETED = 'job.completed',
  FAILED = 'job.failed',
  RETRYING = 'job.retrying',
  CANCELLED = 'job.cancelled',
  STALLED = 'job.stalled',
}

export interface JobEvent {
  jobId: string;
  eventType: JobEventType;
  timestamp: number;
  data: Record<string, any>;
  correlationId: string;
}

/**
 * Job schema validator factory
 */
export function getJobValidator(jobType: string) {
  const validators: Record<string, z.ZodType<any>> = {
    email: EmailJobDataSchema,
    file_processing: FileProcessingJobDataSchema,
    data_export: DataExportJobDataSchema,
    webhook: WebhookJobDataSchema,
    cleanup: CleanupJobDataSchema,
  };

  return validators[jobType];
}

/**
 * Validate job data against its schema
 */
export function validateJobData(jobType: string, data: unknown): boolean {
  const validator = getJobValidator(jobType);
  if (!validator) return false;

  try {
    validator.parse(data);
    return true;
  } catch {
    return false;
  }
}
