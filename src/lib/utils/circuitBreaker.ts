import { logError, logInfo, logWarn } from './serverLogger';
import { AppError } from './errorHandling';

interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;
}

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitStats {
  failures: number;
  lastFailure: number;
  totalCalls: number;
  successfulCalls: number;
}

export class CircuitBreaker {
  private static instance: CircuitBreaker;
  private circuits: Map<string, CircuitState> = new Map();
  private stats: Map<string, CircuitStats> = new Map();
  private configs: Map<string, CircuitBreakerConfig> = new Map();

  private constructor() {
    // Default configuration for services
    this.configs.set('helius', {
      failureThreshold: 5,    // Open after 5 failures
      resetTimeoutMs: 60000,  // Try to reset after 1 minute
      maxRetries: 3,          // Maximum number of retries
      retryDelayMs: 1000     // Wait 1 second between retries
    });
  }

  public static getInstance(): CircuitBreaker {
    if (!CircuitBreaker.instance) {
      CircuitBreaker.instance = new CircuitBreaker();
    }
    return CircuitBreaker.instance;
  }

  public setConfig(service: string, config: CircuitBreakerConfig): void {
    this.configs.set(service, config);
  }

  private getStats(service: string): CircuitStats {
    if (!this.stats.has(service)) {
      this.stats.set(service, {
        failures: 0,
        lastFailure: 0,
        totalCalls: 0,
        successfulCalls: 0
      });
    }
    return this.stats.get(service)!;
  }

  private getState(service: string): CircuitState {
    return this.circuits.get(service) || 'CLOSED';
  }

  private async shouldReset(service: string): Promise<boolean> {
    const state = this.getState(service);
    const stats = this.getStats(service);
    const config = this.configs.get(service);

    if (!config) return true;

    if (state === 'OPEN') {
      const timePassedSinceLastFailure = Date.now() - stats.lastFailure;
      if (timePassedSinceLastFailure >= config.resetTimeoutMs) {
        this.circuits.set(service, 'HALF_OPEN');
        return true;
      }
    }

    return state === 'HALF_OPEN';
  }

  private recordSuccess(service: string): void {
    const stats = this.getStats(service);
    stats.successfulCalls++;
    stats.totalCalls++;
    stats.failures = 0;

    if (this.getState(service) === 'HALF_OPEN') {
      this.circuits.set(service, 'CLOSED');
      logInfo('Circuit closed after successful recovery', {
        component: 'CircuitBreaker',
        action: 'recordSuccess',
        service
      });
    }
  }

  private recordFailure(service: string): void {
    const stats = this.getStats(service);
    const config = this.configs.get(service);

    stats.failures++;
    stats.totalCalls++;
    stats.lastFailure = Date.now();

    if (config && stats.failures >= config.failureThreshold) {
      this.circuits.set(service, 'OPEN');
      logWarn('Circuit opened due to failures', {
        component: 'CircuitBreaker',
        action: 'recordFailure',
        service,
        failures: stats.failures,
        totalCalls: stats.totalCalls
      });
    }
  }

  public async executeWithRetry<T>(
    service: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const config = this.configs.get(service);
    if (!config) {
      return operation();
    }

    const state = this.getState(service);
    if (state === 'OPEN' && !(await this.shouldReset(service))) {
      throw new AppError(`Service ${service} is unavailable (Circuit OPEN)`);
    }

    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      try {
        const result = await operation();
        this.recordSuccess(service);
        return result;
      } catch (error) {
        lastError = error as Error;
        this.recordFailure(service);

        logWarn('Operation failed, retrying', {
          component: 'CircuitBreaker',
          action: 'executeWithRetry',
          service,
          attempt,
          maxRetries: config.maxRetries,
          error: lastError.message
        });

        if (attempt < config.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, config.retryDelayMs));
        }
      }
    }

    throw lastError || new AppError(`All retries failed for service ${service}`);
  }

  public getServiceStats(service: string): CircuitStats {
    return this.getStats(service);
  }
} 