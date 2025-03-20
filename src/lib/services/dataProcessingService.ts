import { PrismaClient } from '@prisma/client';
import { Connection } from '@solana/web3.js';
import { AppError } from '@/lib/utils/errorHandling';
import { logError, logWarn } from '@/lib/utils/serverLogger';

export interface DataTransformation {
  type: 'map' | 'filter' | 'reduce' | 'custom';
  field?: keyof ProcessedTransaction;
  operation?: string;
  config?: Record<string, any>;
}

export interface DataAggregation {
  type: 'count' | 'sum' | 'average' | 'custom';
  field: keyof ProcessedTransaction;
  timeWindow?: {
    unit: 'minute' | 'hour' | 'day';
    value: number;
  };
  config?: {
    type: 'volumeByProgram' | 'timeSeriesAnalysis' | 'accountActivity';
    [key: string]: any;
  };
}

export interface IndexingStrategy {
  type: 'realtime' | 'historical' | 'hybrid';
  filters?: {
    programId?: string;
    account?: string;
    transactionType?: string;
  };
  batchSize?: number;
  startBlock?: number;
  endBlock?: number;
  transformations?: DataTransformation[];
  aggregations?: DataAggregation[];
}

export interface ProcessedTransaction {
  signature: string;
  id: string;
  blockTime: number | null;
  slot: number;
  accounts: string[];
  programId: string;
  success: boolean;
  fee: number;
  [key: string]: any; // Allow dynamic field access
}

export class DataProcessingService {
  private static instance: DataProcessingService;
  private prisma: PrismaClient;
  private activeJobs: Map<string, boolean>;
  private connection: Connection;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second

  private constructor() {
    this.prisma = new PrismaClient();
    this.activeJobs = new Map();
    this.connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
  }

  public static getInstance(): DataProcessingService {
    if (!DataProcessingService.instance) {
      DataProcessingService.instance = new DataProcessingService();
    }
    return DataProcessingService.instance;
  }

  async startIndexing(jobId: string, strategy: IndexingStrategy): Promise<void> {
    if (this.activeJobs.get(jobId)) {
      throw new AppError('Indexing job already running');
    }

    this.activeJobs.set(jobId, true);

    try {
      switch (strategy.type) {
        case 'realtime':
          await this.handleRealtimeIndexing(jobId, strategy);
          break;
        case 'historical':
          await this.handleHistoricalIndexing(jobId, strategy);
          break;
        case 'hybrid':
          await Promise.all([
            this.handleHistoricalIndexing(jobId, strategy),
            this.handleRealtimeIndexing(jobId, strategy)
          ]);
          break;
        default:
          throw new AppError('Invalid indexing strategy type');
      }
    } catch (error) {
      this.activeJobs.delete(jobId);
      throw error;
    }
  }

  async stopIndexing(jobId: string): Promise<void> {
    this.activeJobs.delete(jobId);
    await this.prisma.indexingJob.update({
      where: { id: jobId },
      data: { status: 'stopped' }
    });
  }

  private async handleRealtimeIndexing(jobId: string, strategy: IndexingStrategy): Promise<void> {
    while (this.activeJobs.get(jobId)) {
      try {
        // Fetch new blockchain data
        const newData = await this.fetchLatestData(strategy.filters);
        
        // Apply transformations
        const transformedData = await this.applyTransformations(newData, strategy.transformations);
        
        // Apply aggregations
        if (strategy.aggregations) {
          await this.applyAggregations(transformedData, strategy.aggregations);
        }

        // Store processed data
        await this.storeProcessedData(jobId, transformedData);

        // Wait for next cycle
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        await logError('Failed to process realtime indexing', error as Error, {
          component: 'DataProcessingService',
          action: 'handleRealtimeIndexing',
          jobId,
          strategyType: strategy.type,
          filters: strategy.filters
        });
        // Log error but continue processing
      }
    }
  }

  private async handleHistoricalIndexing(jobId: string, strategy: IndexingStrategy): Promise<void> {
    const { startBlock = 0, endBlock, batchSize = 100 } = strategy;
    let currentBlock = startBlock;

    while (this.activeJobs.get(jobId) && (!endBlock || currentBlock <= endBlock)) {
      try {
        // Fetch historical data in batches
        const batchData = await this.fetchHistoricalData(currentBlock, batchSize, strategy.filters);
        
        // Apply transformations
        const transformedData = await this.applyTransformations(batchData, strategy.transformations);
        
        // Apply aggregations
        if (strategy.aggregations) {
          await this.applyAggregations(transformedData, strategy.aggregations);
        }

        // Store processed data
        await this.storeProcessedData(jobId, transformedData);

        // Update progress
        currentBlock += batchSize;
        await this.updateIndexingProgress(jobId, currentBlock);
      } catch (error) {
        await logError('Failed to process historical indexing', error as Error, {
          component: 'DataProcessingService',
          action: 'handleHistoricalIndexing',
          jobId,
          currentBlock,
          batchSize,
          strategyType: strategy.type,
          filters: strategy.filters
        });
        // Log error but continue processing
      }
    }
  }

  private async fetchLatestData(filters?: IndexingStrategy['filters']): Promise<ProcessedTransaction[]> {
    try {
      // Get the latest block height
      const slot = await this.connection.getSlot();
      const block = await this.connection.getParsedBlock(slot, {
        maxSupportedTransactionVersion: 0,
      });

      if (!block) {
        throw new AppError('Failed to fetch latest block');
      }

      // Filter and process transactions based on filters
      const transactions = block.transactions.filter((tx) => {
        if (!filters) return true;

        const accountKeys = tx.transaction.accountKeys.map((key) => key.pubkey.toString());

        // Apply program ID filter
        if (filters.programId && !accountKeys.includes(filters.programId)) {
          return false;
        }

        // Apply account filter
        if (filters.account && !accountKeys.includes(filters.account)) {
          return false;
        }

        // Apply transaction type filter
        if (filters.transactionType) {
          const programId = accountKeys[0];
          return programId === filters.transactionType;
        }

        return true;
      });

      // Transform transactions into structured data
      return transactions.map((tx): ProcessedTransaction => ({
        signature: tx.transaction.signatures[0],
        blockTime: block.blockTime,
        slot: slot,
        accounts: tx.transaction.accountKeys.map((key) => key.pubkey.toString()),
        programId: tx.transaction.accountKeys[0].pubkey.toString(),
        success: tx.meta?.err === null,
        fee: tx.meta?.fee || 0,
        id: ''
      }));
    } catch (error) {
      await logError('Failed to fetch latest blockchain data', error as Error, {
        filters,
      });
      throw new AppError('Failed to fetch latest blockchain data');
    }
  }

  private async fetchHistoricalData(
    startBlock: number,
    batchSize: number,
    filters?: IndexingStrategy['filters']
  ): Promise<ProcessedTransaction[]> {
    try {
      const endBlock = startBlock + batchSize;
      const transactions: ProcessedTransaction[] = [];

      // Process blocks in parallel batches
      const blockPromises = [];
      for (let slot = startBlock; slot < endBlock; slot++) {
        blockPromises.push(
          this.connection.getParsedBlock(slot, {
            maxSupportedTransactionVersion: 0,
          })
        );
      }

      const blocks = await Promise.allSettled(blockPromises);

      // Process each block's transactions
      blocks.forEach(async (result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          const block = result.value;
          const slot = startBlock + index;

          const filteredTxs = block.transactions.filter((tx) => {
            if (!filters) return true;

            const accountKeys = tx.transaction.accountKeys.map((key) => key.pubkey.toString());

            // Apply program ID filter
            if (filters.programId && !accountKeys.includes(filters.programId)) {
              return false;
            }

            // Apply account filter
            if (filters.account && !accountKeys.includes(filters.account)) {
              return false;
            }

            // Apply transaction type filter
            if (filters.transactionType) {
              const programId = accountKeys[0];
              return programId === filters.transactionType;
            }

            return true;
          });

          // Transform transactions into structured data
          const processedTxs = filteredTxs.map((tx): ProcessedTransaction => ({
            signature: tx.transaction.signatures[0],
            blockTime: block.blockTime,
            slot: slot,
            accounts: tx.transaction.accountKeys.map((key) => key.pubkey.toString()),
            programId: tx.transaction.accountKeys[0].pubkey.toString(),
            success: tx.meta?.err === null,
            fee: tx.meta?.fee || 0,
            id: ''
          }));

          transactions.push(...processedTxs);
        } else if (result.status === 'rejected') {
          await logWarn('Failed to fetch block', {
            slot: startBlock + index,
            error: result.reason,
          });
        }
      });

      return transactions;
    } catch (error) {
      await logError('Failed to fetch historical blockchain data', error as Error, {
        startBlock,
        batchSize,
        filters,
      });
      throw new AppError('Failed to fetch historical blockchain data');
    }
  }

  private async applyTransformations(data: any[], transformations?: DataTransformation[]): Promise<any[]> {
    if (!transformations) return data;

    let transformedData = [...data];

    for (const transformation of transformations) {
      transformedData = await this.applyTransformation(transformedData, transformation);
    }

    return transformedData;
  }

  private async applyTransformation(data: any[], transformation: DataTransformation): Promise<any[]> {
    try {
      switch (transformation.type) {
        case 'map':
          if (!transformation.field) {
            throw new AppError('Field is required for map transformation');
          }
          return data.map(item => item[transformation.field as string]);

        case 'filter':
          if (!transformation.field || !transformation.operation) {
            throw new AppError('Field and operation are required for filter transformation');
          }
          return data.filter(item => {
            const value = item[transformation.field as string];
            const config = transformation.config || {};

            switch (transformation.operation) {
              case 'equals':
                return value === config.value;
              case 'contains':
                return value.includes(config.value);
              case 'greaterThan':
                return value > config.value;
              case 'lessThan':
                return value < config.value;
              default:
                return true;
            }
          });

        case 'reduce':
          if (!transformation.field || !transformation.operation) {
            throw new AppError('Field and operation are required for reduce transformation');
          }
          return data.reduce((acc, item) => {
            const value = item[transformation.field as string];
            switch (transformation.operation) {
              case 'sum':
                return acc + value;
              case 'concat':
                return acc.concat(value);
              default:
                return acc;
            }
          }, transformation.operation === 'sum' ? 0 : []);

        case 'custom':
          return this.executeCustomTransformation(data, transformation);

        default:
          throw new AppError(`Unsupported transformation type: ${transformation.type}`);
      }
    } catch (error) {
      await logError('Failed to execute transformation', error as Error, {
        transformationType: transformation.type,
        field: transformation.field,
        operation: transformation.operation,
      });
      throw new AppError('Failed to execute transformation');
    }
  }

  private async executeCustomTransformation(data: any[], transformation: DataTransformation): Promise<any[]> {
    try {
      const config = transformation.config || {};
      
      switch (config.type) {
        case 'tokenBalance':
          // Calculate token balances for accounts
          return data.map(tx => ({
            account: tx.accounts[0],
            balance: this.calculateTokenBalance(tx),
            timestamp: tx.blockTime,
          }));

        case 'nftMetadata':
          // Fetch and attach NFT metadata
          return Promise.all(data.map(async tx => ({
            ...tx,
            metadata: await this.fetchNFTMetadata(tx.accounts[0]),
          })));

        case 'programInteraction':
          // Analyze program interactions
          return data.map(tx => ({
            program: tx.programId,
            interactionType: this.analyzeProgramInteraction(tx),
            timestamp: tx.blockTime,
          }));

        default:
          throw new AppError(`Unsupported custom transformation type: ${config.type}`);
      }
    } catch (error) {
      await logError('Failed to execute custom transformation', error as Error, {
        config: transformation.config,
      });
      throw new AppError('Failed to execute custom transformation');
    }
  }

  private calculateTokenBalance(transaction: ProcessedTransaction): number {
    // Implement token balance calculation logic
    return 0;
  }

  private async fetchNFTMetadata(mintAddress: string): Promise<any> {
    // Implement NFT metadata fetching logic
    return {};
  }

  private analyzeProgramInteraction(transaction: ProcessedTransaction): string {
    // Implement program interaction analysis logic
    return 'unknown';
  }

  private async applyAggregations(data: any[], aggregations: DataAggregation[]): Promise<void> {
    for (const aggregation of aggregations) {
      const result = await this.calculateAggregation(data, aggregation);
      await this.storeAggregation(result, aggregation);
    }
  }

  private async calculateAggregation(data: any[], aggregation: DataAggregation): Promise<any> {
    switch (aggregation.type) {
      case 'count':
        return data.length;
      
      case 'sum':
        return data.reduce((sum, item) => sum + (item[aggregation.field] || 0), 0);
      
      case 'average':
        const sum = data.reduce((acc, item) => acc + (item[aggregation.field] || 0), 0);
        return sum / data.length;
      
      case 'custom':
        return this.executeCustomAggregation(data, aggregation);
      
      default:
        throw new AppError(`Unsupported aggregation type: ${aggregation.type}`);
    }
  }

  private async executeCustomAggregation(data: ProcessedTransaction[], aggregation: DataAggregation): Promise<Record<string, any>> {
    try {
      const config = aggregation.config ?? { type: 'volumeByProgram' as const };
      const field = aggregation.field;

      switch (config.type) {
        case 'volumeByProgram': {
          const result: Record<string, { volume: number; count: number }> = {};
          data.forEach(tx => {
            const program = tx.programId;
            result[program] = result[program] || { volume: 0, count: 0 };
            result[program].volume += Number(tx[field] as string | number) || 0;
            result[program].count += 1;
          });
          return result;
        }

        case 'accountActivity': {
          const result: Record<string, { interactions: number; volume: number }> = {};
          data.forEach(tx => {
            tx.accounts.forEach((account: string) => {
              result[account] = result[account] || { interactions: 0, volume: 0 };
              result[account].interactions += 1;
              result[account].volume += Number(tx[field] as string | number) || 0;
            });
          });
          return result;
        }

        case 'timeSeriesAnalysis': {
          const timeWindow = aggregation.timeWindow || { unit: 'hour' as const, value: 1 };
          return this.aggregateByTimeWindow(data, field as string, timeWindow);
        }

        default:
          throw new AppError(`Unsupported custom aggregation type: ${config.type}`);
      }
    } catch (error) {
      await logError('Failed to execute custom aggregation', error as Error, {
        aggregationType: aggregation.type,
        field: aggregation.field,
        timeWindow: aggregation.timeWindow,
      });
      throw new AppError('Failed to execute custom aggregation');
    }
  }

  private aggregateByTimeWindow(
    data: ProcessedTransaction[],
    field: string,
    timeWindow: Required<DataAggregation>['timeWindow']
  ): Record<string, any> {
    const result: Record<string, { sum: number; count: number; avg: number }> = {};
    const intervalMs = this.getTimeWindowMs(timeWindow);

    data.forEach(tx => {
      if (tx.blockTime === null) return;

      const timestamp = tx.blockTime * 1000; // Convert to milliseconds
      const interval = Math.floor(timestamp / intervalMs) * intervalMs;
      const key = new Date(interval).toISOString();

      if (!result[key]) {
        result[key] = { sum: 0, count: 0, avg: 0 };
      }

      const value = tx[field] || 0;
      result[key].sum += value;
      result[key].count += 1;
      result[key].avg = result[key].sum / result[key].count;
    });

    return result;
  }

  private getTimeWindowMs(timeWindow: Required<DataAggregation>['timeWindow']): number {
    const { unit, value } = timeWindow;
    switch (unit) {
      case 'minute':
        return value * 60 * 1000;
      case 'hour':
        return value * 60 * 60 * 1000;
      case 'day':
        return value * 24 * 60 * 60 * 1000;
      default:
        throw new AppError(`Unsupported time window unit: ${unit}`);
    }
  }

  private async storeProcessedData(jobId: string, data: any[]): Promise<void> {
    // Implement data storage logic
    await this.prisma.processedData.createMany({
      data: data.map(item => ({
        jobId,
        data: item,
        timestamp: new Date()
      }))
    });
  }

  private async storeAggregation(result: any, aggregation: DataAggregation): Promise<void> {
    // Implement aggregation storage logic
    await this.prisma.aggregation.create({
      data: {
        type: aggregation.type,
        field: aggregation.field as string,
        value: result,
        timestamp: new Date()
      }
    });
  }

  private async updateIndexingProgress(jobId: string, currentBlock: number): Promise<void> {
    await this.prisma.indexingJob.update({
      where: { id: jobId },
      data: {
        progress: currentBlock,
        updatedAt: new Date()
      }
    });
  }
} 