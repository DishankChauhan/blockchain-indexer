import { logError, logInfo, logWarn } from './serverLogger';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter {
  private static instance: RateLimiter;
  private buckets: Map<string, TokenBucket> = new Map();
  private configs: Map<string, RateLimitConfig> = new Map();

  private constructor() {
    // Default configurations for different services
    this.configs.set('helius', {
      maxRequests: 10, // 10 requests
      windowMs: 1000   // per second
    });
  }

  public static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  public setConfig(service: string, config: RateLimitConfig): void {
    this.configs.set(service, config);
  }

  private refillTokens(bucket: TokenBucket, config: RateLimitConfig): void {
    const now = Date.now();
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(timePassed / config.windowMs) * config.maxRequests;
    
    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(config.maxRequests, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }
  }

  public async checkLimit(service: string): Promise<boolean> {
    const config = this.configs.get(service);
    if (!config) {
      logWarn('No rate limit configuration found for service', {
        component: 'RateLimiter',
        action: 'checkLimit',
        service
      });
      return true; // Allow if no config is set
    }

    let bucket = this.buckets.get(service);
    if (!bucket) {
      bucket = {
        tokens: config.maxRequests,
        lastRefill: Date.now()
      };
      this.buckets.set(service, bucket);
    }

    this.refillTokens(bucket, config);

    if (bucket.tokens > 0) {
      bucket.tokens--;
      return true;
    }

    logWarn('Rate limit exceeded', {
      component: 'RateLimiter',
      action: 'checkLimit',
      service,
      nextRefillIn: `${config.windowMs - (Date.now() - bucket.lastRefill)}ms`
    });
    return false;
  }

  public async waitForToken(service: string, maxWaitMs: number = 5000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
      if (await this.checkLimit(service)) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms before next check
    }

    return false;
  }
} 