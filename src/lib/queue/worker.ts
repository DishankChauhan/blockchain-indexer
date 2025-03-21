import Bull from 'bull';
import { DatabaseService } from '../services/databaseService';
import { HeliusService } from '../services/heliusService';
import serverLogger from '../utils/serverLogger';
import { Job } from 'bull';

interface WebhookJobData {
  webhookId: string;
  payload: any;
  userId: string;
}

const indexingQueue = new Bull('indexing', {
  redis: {
    port: 6379,
    host: 'localhost',
  },
});

serverLogger.info('Blockchain Indexer Worker initialized', {
  component: 'Worker',
  action: 'Initialize',
  message: '🚀 Blockchain Indexer Worker started and ready to process jobs'
});

// Process jobs
indexingQueue.process('start-indexing', async (job) => {
  serverLogger.info('Processing indexing job', {
    component: 'Worker',
    action: 'ProcessJob',
    jobId: job.id,
    data: job.data
  });
  
  try {
    const { jobId, config, dbConnection, userId } = job.data;
    
    // Initialize services
    const dbService = DatabaseService.getInstance();
    const heliusService = HeliusService.getInstance(userId);

    // Check if job was cancelled
    const jobData = await indexingQueue.getJob(job.id);
    if (!jobData) {
      serverLogger.warn('Job cancelled - job not found', {
        component: 'Worker',
        action: 'CheckJobStatus',
        jobId: job.id
      });
      return;
    }
    const jobState = await jobData.getState();
    if (jobState === 'failed') {
      serverLogger.warn('Job cancelled - job failed', {
        component: 'Worker',
        action: 'CheckJobStatus',
        jobId: job.id,
        state: jobState
      });
      return;
    }

    // Set up database tables
    await dbService.initializeTables(dbConnection, config.categories);
    
    // Check if job was cancelled
    if (!await indexingQueue.getJob(job.id)) {
      serverLogger.warn('Job cancelled during table initialization', {
        component: 'Worker',
        action: 'CheckJobStatus',
        jobId: job.id
      });
      return;
    }
    
    // Start indexing
    let webhook;
    if (config.webhook?.enabled) {
      webhook = await heliusService.createWebhook({
        accountAddresses: config.filters?.accounts || [],
        programIds: config.filters?.programIds || [],
        webhookURL: config.webhook.url,
        webhookSecret: config.webhook.secret
      });

      serverLogger.info('Webhook created for job', {
        component: 'Worker',
        action: 'CreateWebhook',
        jobId,
        webhookId: webhook.webhookId
      });
    } else {
      serverLogger.info('Starting direct data fetching', {
        component: 'Worker',
        action: 'ProcessJob',
        jobId
      });

      // Create a database pool for data insertion
      const pool = await dbService.getPoolForApi(dbConnection);

      try {
        // Start fetching and processing data
        await heliusService.startDataFetching(jobId, config, pool);

        serverLogger.info('Data fetching completed', {
          component: 'Worker',
          action: 'ProcessJob',
          jobId
        });
      } finally {
        // Close the database pool
        await pool.end();
      }
    }

    // Update progress
    await job.progress(100);
    
    return { status: 'success', webhook };
  } catch (error) {
    serverLogger.error('Failed to process indexing job', error as Error, {
      component: 'Worker',
      action: 'ProcessJob',
      jobId: job.id
    });
    throw error;
  }
});

// Log job events
indexingQueue.on('completed', (job) => {
  serverLogger.info('Job completed', {
    component: 'Worker',
    action: 'JobCompleted',
    jobId: job.id
  });
});

indexingQueue.on('failed', (job, error) => {
  serverLogger.error('Job failed', error as Error, {
    component: 'Worker',
    action: 'JobFailed',
    jobId: job.id
  });
});

indexingQueue.on('progress', (job, progress) => {
  serverLogger.info('Job progress updated', {
    component: 'Worker',
    action: 'JobProgress',
    jobId: job.id,
    progress: `${progress}%`
  });
});

// Handle job removal
indexingQueue.on('removed', (job) => {
  serverLogger.info('Job removed', {
    component: 'Worker',
    action: 'JobRemoved',
    jobId: job.id
  });
});

export default indexingQueue;

export async function processWebhookJob(job: Job<WebhookJobData>) {
  try {
    const { webhookId, userId, payload } = job.data;

    // Validate job data
    if (!webhookId || !userId || !payload) {
      throw new Error('Invalid job data');
    }

    serverLogger.info('Processing webhook job', {
      component: 'Worker',
      action: 'ProcessWebhookJob',
      jobId: job.id,
      webhookId,
      userId
    });

    const heliusService = HeliusService.getInstance(userId);
    const result = await heliusService.handleWebhookData(webhookId, userId, [payload]);

    if (!result.success) {
      serverLogger.warn('Webhook processing completed with errors', {
        component: 'Worker',
        action: 'ProcessWebhookJob',
        jobId: job.id,
        webhookId,
        errors: result.errors
      });
    } else {
      serverLogger.info('Webhook processing completed successfully', {
        component: 'Worker',
        action: 'ProcessWebhookJob',
        jobId: job.id,
        webhookId,
        transactionsProcessed: result.transactionsProcessed
      });
    }

    return result;
  } catch (error) {
    serverLogger.error('Failed to process webhook job', error as Error, {
      component: 'Worker',
      action: 'ProcessWebhookJob',
      jobId: job.id,
      webhookId: job.data.webhookId
    });
    throw error;
  }
} 