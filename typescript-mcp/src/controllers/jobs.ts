import { FastifyRequest, FastifyReply } from 'fastify';
import { Logger } from '../services/logger';

const logger = new Logger('JobsController');

export interface JobRequest {
  codebase_id: string;
  job_type: 'full_index' | 'incremental_update' | 'reindex' | 'analyze';
  priority?: number;
  configuration?: Record<string, any>;
}

export interface JobResponse {
  success: boolean;
  job?: {
    id: string;
    codebase_id: string;
    job_type: string;
    status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
    priority: number;
    created_at: string;
    started_at?: string;
    completed_at?: string;
    error_message?: string;
    files_processed: number;
    files_total: number;
    progress_percentage: number;
    result?: any;
  };
  error?: string;
}

export interface JobListResponse {
  success: boolean;
  jobs: Array<{
    id: string;
    codebase_id: string;
    job_type: string;
    status: string;
    priority: number;
    created_at: string;
    started_at?: string;
    completed_at?: string;
    progress_percentage: number;
    files_processed: number;
    files_total: number;
  }>;
  pagination?: {
    limit: number;
    offset: number;
    total: number;
    has_more: boolean;
  };
  error?: string;
}

// Mock job storage (in production, this would be a database)
const jobStore = new Map<string, any>();
const jobCounter = { value: 1 };

export class JobsController {
  async createJob(request: FastifyRequest<{ Body: JobRequest }>, reply: FastifyReply) {
    try {
      const { codebase_id, job_type, priority = 5, configuration } = request.body;

      if (!codebase_id) {
        return reply.status(400).send({
          success: false,
          error: 'codebase_id is required'
        } as JobResponse);
      }

      const jobId = `job-${jobCounter.value++}`;
      const now = new Date().toISOString();

      const job = {
        id: jobId,
        codebase_id,
        job_type,
        status: 'queued' as const,
        priority,
        created_at: now,
        started_at: null,
        completed_at: null,
        error_message: null,
        files_processed: 0,
        files_total: 0,
        progress_percentage: 0,
        configuration: configuration || {},
        result: null
      };

      jobStore.set(jobId, job);

      // Simulate job processing (in production, this would be handled by a job queue)
      this.processJobAsync(jobId);

      logger.info('Job created', { jobId, codebase_id, job_type, priority });

      const response: JobResponse = {
        success: true,
        job
      };

      return reply.status(201).send(response);
    } catch (error) {
      logger.error('Failed to create job', { error: error.message });
      return reply.status(500).send({
        success: false,
        error: 'Failed to create job'
      } as JobResponse);
    }
  }

  async getJobs(request: FastifyRequest, reply: FastifyReply) {
    try {
      const {
        status,
        type,
        limit = 20,
        offset = 0,
        codebase_id
      } = request.query as {
        status?: string;
        type?: string;
        limit?: string;
        offset?: string;
        codebase_id?: string;
      };

      const limitNum: number = limit ? Number(parseInt(limit, 10)) || 20 : 20;
      const offsetNum: number = offset ? Number(parseInt(offset, 10)) || 0 : 0;

      let jobs = Array.from(jobStore.values());

      // Apply filters
      if (status) {
        jobs = jobs.filter(job => job.status === status);
      }
      if (type) {
        jobs = jobs.filter(job => job.job_type === type);
      }
      if (codebase_id) {
        jobs = jobs.filter(job => job.codebase_id === codebase_id);
      }

      // Sort by created_at descending
      jobs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Apply pagination
      const total = jobs.length;
      const startIndex = Math.max(0, offsetNum);
      const endIndex = Math.min(total, offsetNum + limitNum);
      const paginatedJobs = jobs.slice(startIndex, endIndex);

      const response: JobListResponse = {
        success: true,
        jobs: paginatedJobs.map(job => ({
          id: job.id,
          codebase_id: job.codebase_id,
          job_type: job.job_type,
          status: job.status,
          priority: job.priority,
          created_at: job.created_at,
          started_at: job.started_at,
          completed_at: job.completed_at,
          progress_percentage: job.progress_percentage,
          files_processed: job.files_processed,
          files_total: job.files_total
        })),
        pagination: {
          limit: limitNum,
          offset: offsetNum,
          total,
          has_more: offsetNum + limitNum < total
        }
      };

      return reply.send(response);
    } catch (error) {
      logger.error('Failed to get jobs', { error: error.message });
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve jobs'
      } as JobListResponse);
    }
  }

  async getJob(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };

      if (!id) {
        return reply.status(400).send({
          success: false,
          error: 'Job ID is required'
        } as JobResponse);
      }

      const job = jobStore.get(id);

      if (!job) {
        return reply.status(404).send({
          success: false,
          error: 'Job not found'
        } as JobResponse);
      }

      const response: JobResponse = {
        success: true,
        job
      };

      return reply.send(response);
    } catch (error) {
      logger.error('Failed to get job', { error: error.message });
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve job'
      } as JobResponse);
    }
  }

  async cancelJob(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };

      if (!id) {
        return reply.status(400).send({
          success: false,
          error: 'Job ID is required'
        } as JobResponse);
      }

      const job = jobStore.get(id);

      if (!job) {
        return reply.status(404).send({
          success: false,
          error: 'Job not found'
        } as JobResponse);
      }

      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        return reply.status(400).send({
          success: false,
          error: `Cannot cancel job in status: ${job.status}`
        } as JobResponse);
      }

      job.status = 'cancelled';
      job.completed_at = new Date().toISOString();

      logger.info('Job cancelled', { jobId: id });

      const response: JobResponse = {
        success: true,
        job
      };

      return reply.send(response);
    } catch (error) {
      logger.error('Failed to cancel job', { error: error.message });
      return reply.status(500).send({
        success: false,
        error: 'Failed to cancel job'
      } as JobResponse);
    }
  }

  async retryJob(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };

      if (!id) {
        return reply.status(400).send({
          success: false,
          error: 'Job ID is required'
        } as JobResponse);
      }

      const job = jobStore.get(id);

      if (!job) {
        return reply.status(404).send({
          success: false,
          error: 'Job not found'
        } as JobResponse);
      }

      if (job.status !== 'failed' && job.status !== 'cancelled') {
        return reply.status(400).send({
          success: false,
          error: `Cannot retry job in status: ${job.status}`
        } as JobResponse);
      }

      // Reset job for retry
      job.status = 'queued';
      job.started_at = null;
      job.completed_at = null;
      job.error_message = null;
      job.files_processed = 0;
      job.progress_percentage = 0;
      job.result = null;

      // Process job again
      this.processJobAsync(id);

      logger.info('Job retried', { jobId: id });

      const response: JobResponse = {
        success: true,
        job
      };

      return reply.send(response);
    } catch (error) {
      logger.error('Failed to retry job', { error: error.message });
      return reply.status(500).send({
        success: false,
        error: 'Failed to retry job'
      } as JobResponse);
    }
  }

  // Simulated async job processing (in production, this would be handled by a job queue system)
  private async processJobAsync(jobId: string) {
    const job = jobStore.get(jobId);
    if (!job) {
      return;
    }

    try {
      // Simulate job start
      setTimeout(() => {
        job.status = 'running';
        job.started_at = new Date().toISOString();
        job.files_total = this.getEstimatedFilesForJob(job.job_type);
        logger.info('Job started', { jobId, jobType: job.job_type });
      }, 1000);

      // Simulate job progress
      const progressInterval = setInterval(() => {
        const currentJob = jobStore.get(jobId);
        if (!currentJob || currentJob.status !== 'running') {
          clearInterval(progressInterval);
          return;
        }

        const increment = Math.floor(Math.random() * 10) + 5;
        currentJob.files_processed = Math.min(currentJob.files_processed + increment, currentJob.files_total);
        currentJob.progress_percentage = currentJob.files_total > 0
          ? Math.floor((currentJob.files_processed / currentJob.files_total) * 100)
          : 0;

        if (currentJob.files_processed >= currentJob.files_total) {
          clearInterval(progressInterval);
          this.completeJob(jobId);
        }
      }, 500);

    } catch (error) {
      logger.error('Job processing failed', { jobId, error: error.message });
      job.status = 'failed';
      job.error_message = error.message;
      job.completed_at = new Date().toISOString();
    }
  }

  private completeJob(jobId: string) {
    const job = jobStore.get(jobId);
    if (!job) {
      return;
    }

    job.status = 'completed';
    job.progress_percentage = 100;
    job.files_processed = job.files_total;
    job.completed_at = new Date().toISOString();
    job.result = {
      files_indexed: job.files_total,
      entities_found: Math.floor(job.files_total * 8), // Simulated entity count
      processing_time: job.completed_at
    };

    logger.info('Job completed', {
      jobId,
      filesProcessed: job.files_processed,
      processingTime: new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()
    });
  }

  private getEstimatedFilesForJob(jobType: string): number {
    // Simulated file counts based on job type
    const estimates = {
      'full_index': 150,
      'incremental_update': 25,
      'reindex': 150,
      'analyze': 75
    };
    return estimates[jobType] || 50;
  }
}

// Factory function for dependency injection
export function createJobsController(): JobsController {
  return new JobsController();
}