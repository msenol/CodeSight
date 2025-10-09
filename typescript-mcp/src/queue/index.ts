/**
 * Message queue implementation using BullMQ
 * Handles background job processing for indexing and analysis tasks
 */

import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { Logger } from '../services/logger';

const logger = new Logger('MessageQueue');

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
};

// Create Redis connection
const connection = new Redis(redisConfig);

// Queue names
export const QUEUE_NAMES = {
  INDEXING: 'indexing',
  ANALYSIS: 'analysis',
  EMBEDDING: 'embedding',
  CLEANUP: 'cleanup',
} as const;

// Job types
export interface IndexingJobData {
  codebaseId: string;
  filePaths: string[];
  jobType: 'full' | 'incremental' | 'reindex';
  priority: number;
}

export interface AnalysisJobData {
  codebaseId: string;
  entityId: string;
  analysisType: 'complexity' | 'security' | 'dependencies' | 'metrics';
  priority: number;
}

export interface EmbeddingJobData {
  codebaseId: string;
  entityId: string;
  content: string;
  modelName: string;
  priority: number;
}

export interface CleanupJobData {
  codebaseId: string;
  cleanupType: 'cache' | 'temp_files' | 'orphaned_records';
  olderThan: Date;
}

// Create queues
export const indexingQueue = new Queue<IndexingJobData>(QUEUE_NAMES.INDEXING, {
  connection,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 20,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

export const analysisQueue = new Queue<AnalysisJobData>(QUEUE_NAMES.ANALYSIS, {
  connection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});

export const embeddingQueue = new Queue<EmbeddingJobData>(QUEUE_NAMES.EMBEDDING, {
  connection,
  defaultJobOptions: {
    removeOnComplete: 200,
    removeOnFail: 100,
    attempts: 1,
  },
});

export const cleanupQueue = new Queue<CleanupJobData>(QUEUE_NAMES.CLEANUP, {
  connection,
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 1,
  },
});

// Queue utilities
export class MessageQueueService {
  /**
   * Add indexing job to queue
   */
  async addIndexingJob(data: IndexingJobData, options?: { delay?: number; jobId?: string }) {
    logger.info('Adding indexing job', {
      codebaseId: data.codebaseId,
      filePathsCount: data.filePaths.length,
      jobType: data.jobType,
      priority: data.priority,
    });

    return await indexingQueue.add('index', data, {
      priority: data.priority,
      delay: options?.delay,
      jobId: options?.jobId,
    });
  }

  /**
   * Add analysis job to queue
   */
  async addAnalysisJob(data: AnalysisJobData, options?: { delay?: number; jobId?: string }) {
    logger.info('Adding analysis job', {
      codebaseId: data.codebaseId,
      entityId: data.entityId,
      analysisType: data.analysisType,
      priority: data.priority,
    });

    return await analysisQueue.add('analyze', data, {
      priority: data.priority,
      delay: options?.delay,
      jobId: options?.jobId,
    });
  }

  /**
   * Add embedding job to queue
   */
  async addEmbeddingJob(data: EmbeddingJobData, options?: { delay?: number; jobId?: string }) {
    logger.info('Adding embedding job', {
      codebaseId: data.codebaseId,
      entityId: data.entityId,
      modelName: data.modelName,
      priority: data.priority,
    });

    return await embeddingQueue.add('embed', data, {
      priority: data.priority,
      delay: options?.delay,
      jobId: options?.jobId,
    });
  }

  /**
   * Add cleanup job to queue
   */
  async addCleanupJob(data: CleanupJobData, options?: { delay?: number; jobId?: string }) {
    logger.info('Adding cleanup job', {
      codebaseId: data.codebaseId,
      cleanupType: data.cleanupType,
      olderThan: data.olderThan,
    });

    return await cleanupQueue.add('cleanup', data, {
      priority: 1, // Low priority for cleanup
      delay: options?.delay,
      jobId: options?.jobId,
    });
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const [indexingStats, analysisStats, embeddingStats, cleanupStats] = await Promise.all([
      indexingQueue.getJobCounts(),
      analysisQueue.getJobCounts(),
      embeddingQueue.getJobCounts(),
      cleanupQueue.getJobCounts(),
    ]);

    return {
      indexing: indexingStats,
      analysis: analysisStats,
      embedding: embeddingStats,
      cleanup: cleanupStats,
    };
  }

  /**
   * Pause all queues
   */
  async pauseQueues() {
    await Promise.all([
      indexingQueue.pause(),
      analysisQueue.pause(),
      embeddingQueue.pause(),
      cleanupQueue.pause(),
    ]);
    logger.info('All queues paused');
  }

  /**
   * Resume all queues
   */
  async resumeQueues() {
    await Promise.all([
      indexingQueue.resume(),
      analysisQueue.resume(),
      embeddingQueue.resume(),
      cleanupQueue.resume(),
    ]);
    logger.info('All queues resumed');
  }

  /**
   * Clear all queues
   */
  async clearQueues() {
    await Promise.all([
      indexingQueue.clean(0, 0, 'completed'),
      indexingQueue.clean(0, 0, 'failed'),
      analysisQueue.clean(0, 0, 'completed'),
      analysisQueue.clean(0, 0, 'failed'),
      embeddingQueue.clean(0, 0, 'completed'),
      embeddingQueue.clean(0, 0, 'failed'),
      cleanupQueue.clean(0, 0, 'completed'),
      cleanupQueue.clean(0, 0, 'failed'),
    ]);
    logger.info('All queues cleared');
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    await this.pauseQueues();
    await this.clearQueues();

    await Promise.all([
      indexingQueue.close(),
      analysisQueue.close(),
      embeddingQueue.close(),
      cleanupQueue.close(),
    ]);

    await connection.quit();
    logger.info('Message queue service shutdown complete');
  }
}

// Export singleton instance
export const messageQueueService = new MessageQueueService();

// Error handling
connection.on('error', (error) => {
  logger.error('Redis connection error', error);
});

connection.on('connect', () => {
  logger.info('Redis connected successfully');
});

// Graceful shutdown handling
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down message queue gracefully');
  await messageQueueService.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down message queue gracefully');
  await messageQueueService.shutdown();
  process.exit(0);
});

export default messageQueueService;