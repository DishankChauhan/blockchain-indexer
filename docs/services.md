# Blockchain Indexer Services Documentation

## HeliusService

The `HeliusService` is responsible for managing interactions with the Helius API and processing blockchain data. It handles webhook creation, transaction processing, and indexing configuration.

### Methods

#### `getInstance(userId: string): HeliusService`
Creates or returns a singleton instance of the HeliusService.
- **Parameters:**
  - `userId`: The ID of the user making the request
- **Returns:** HeliusService instance
- **Throws:** Error if userId is empty

#### `createWebhook(params: WebhookParams): Promise<{ webhookId: string }>`
Creates a new webhook in Helius for receiving blockchain data.
- **Parameters:**
  - `params.accountAddresses`: Array of account addresses to monitor
  - `params.programIds`: Array of program IDs to monitor
  - `params.webhookURL`: URL where webhook events will be sent
  - `params.webhookSecret`: Secret for webhook signature verification
- **Returns:** Object containing the created webhook ID
- **Throws:** 
  - `AppError` if webhook URL is invalid
  - `AppError` if webhook creation fails

#### `handleWebhookData(webhookId: string, userId: string, transactions: HeliusWebhookData[]): Promise<WebhookResult>`
Processes incoming webhook data and stores it in the database.
- **Parameters:**
  - `webhookId`: ID of the webhook that received the data
  - `userId`: ID of the user who owns the webhook
  - `transactions`: Array of transaction data from Helius
- **Returns:** Object containing success status and processing results
- **Throws:** `AppError` if processing fails

#### `setupIndexing(job: IndexingJob, pool: Pool): Promise<void>`
Sets up indexing configuration for a new job.
- **Parameters:**
  - `job`: Indexing job configuration
  - `pool`: Database connection pool
- **Returns:** void
- **Throws:** `AppError` if setup fails

## WebhookService

The `WebhookService` manages webhook configurations, event handling, and delivery.

### Methods

#### `getInstance(userId: string): WebhookService`
Creates or returns a singleton instance of the WebhookService.
- **Parameters:**
  - `userId`: The ID of the user making the request
- **Returns:** WebhookService instance
- **Throws:** Error if userId is empty

#### `createWebhook(userId: string, jobId: string, config: WebhookConfig): Promise<Webhook>`
Creates a new webhook configuration.
- **Parameters:**
  - `userId`: ID of the user creating the webhook
  - `jobId`: ID of the associated indexing job
  - `config`: Webhook configuration options
- **Returns:** Created webhook object
- **Throws:** `AppError` if creation fails

#### `handleWebhookEvent(webhookId: string, payload: any, signature: string): Promise<void>`
Processes and forwards webhook events to the configured endpoint.
- **Parameters:**
  - `webhookId`: ID of the webhook
  - `payload`: Event data
  - `signature`: Webhook signature for verification
- **Returns:** void
- **Throws:**
  - `AppError` if signature is invalid
  - `AppError` if rate limit is exceeded
  - `AppError` if delivery fails

#### `getWebhookLogs(webhookId: string, options?: { limit?: number; offset?: number }): Promise<WebhookLog[]>`
Retrieves logs for a specific webhook.
- **Parameters:**
  - `webhookId`: ID of the webhook
  - `options.limit`: Maximum number of logs to return
  - `options.offset`: Number of logs to skip
- **Returns:** Array of webhook logs
- **Throws:** `AppError` if retrieval fails

## Worker Queue

The worker queue processes indexing and webhook jobs asynchronously.

### Methods

#### `processWebhookJob(job: Job<WebhookJobData>): Promise<WebhookResult>`
Processes incoming webhook data jobs.
- **Parameters:**
  - `job`: Bull job containing webhook data
- **Returns:** Object containing processing results
- **Throws:** Error if processing fails

### Job Types

#### Start Indexing Job
Processes indexing setup and configuration:
- Creates necessary database tables
- Sets up Helius webhook
- Configures filters and categories
- Updates job progress

#### Webhook Job
Processes incoming webhook data:
- Validates webhook signature
- Processes transactions
- Updates database
- Handles errors and retries

### Error Handling

All services implement comprehensive error handling:
- Input validation
- Rate limiting
- Circuit breaking
- Retry mechanisms
- Structured logging
- Transaction management

### Best Practices

1. **Rate Limiting**
   - Use the RateLimiter service for API calls
   - Configure appropriate limits per endpoint
   - Handle rate limit errors gracefully

2. **Error Handling**
   - Use AppError for application-specific errors
   - Include error context in logs
   - Implement proper error recovery

3. **Database Operations**
   - Use transactions for atomic operations
   - Handle connection pooling efficiently
   - Implement proper cleanup

4. **Logging**
   - Use structured logging with AppLogger
   - Include relevant context in log messages
   - Log appropriate error details

5. **Security**
   - Validate webhook signatures
   - Secure API keys and secrets
   - Implement proper access control 