import Bull from 'bull';
import { DatabaseService } from '../services/databaseService';
import { HeliusService } from '../services/heliusService';

const indexingQueue = new Bull('indexing', {
  redis: {
    port: 6379,
    host: 'localhost',
  },
});

console.log('🚀 Blockchain Indexer Worker started and ready to process jobs...');

// Process jobs
indexingQueue.process('start-indexing', async (job) => {
  console.log(`Processing job ${job.id}`, job.data);
  
  try {
    const { jobId, config, dbConnection } = job.data;
    
    // Initialize services
    const dbService = DatabaseService.getInstance();
    const heliusService = HeliusService.getInstance();

    // Check if job was cancelled
    const jobData = await indexingQueue.getJob(job.id);
    if (!jobData) {
      console.log(`Job ${job.id} was cancelled, stopping processing`);
      return;
    }
    const jobState = await jobData.getState();
    if (jobState === 'failed') {
      console.log(`Job ${job.id} was cancelled, stopping processing`);
      return;
    }

    // Set up database tables
    await dbService.initializeTables(dbConnection, config.categories);
    
    // Check if job was cancelled
    if (!await indexingQueue.getJob(job.id)) {
      console.log(`Job ${job.id} was cancelled, stopping processing`);
      return;
    }
    
    // Start indexing
    const webhook = await heliusService.createWebhook({
      accountAddresses: config.filters.accounts || [],
      programIds: config.filters.programIds || [],
      webhookURL: config.webhook.url,
      webhookSecret: config.webhook.secret
    });

    console.log(`Webhook created for job ${jobId}:`, webhook);

    // Update progress
    await job.progress(100);
    
    return { status: 'success', webhook };
  } catch (error) {
    console.error('Failed to initialize tables:', error);
    throw error;
  }
});

// Log job events
indexingQueue.on('completed', (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

indexingQueue.on('failed', (job, error) => {
  console.error(`Job ${job.id} failed:`, error);
});

indexingQueue.on('progress', (job, progress) => {
  console.log(`Job ${job.id} progress: ${progress}%`);
});

// Handle job removal
indexingQueue.on('removed', (job) => {
  console.log(`Job ${job.id} was removed`);
});

export default indexingQueue; 