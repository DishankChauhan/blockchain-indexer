import { AppError } from '../utils/errorHandling';
import clientLogger from '../utils/clientLogger';

type RetryConfig = {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
};

type RateLimitConfig = {
  maxRequests: number;
  windowMs: number;
};

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export class ApiClient {
  private static instance: ApiClient;
  private baseUrl: string;
  private retryConfig: RetryConfig;
  private rateLimitConfig: RateLimitConfig;
  private requestCounts: Map<string, { count: number; resetTime: number }>;

  private constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 5000,
    };
    this.rateLimitConfig = {
      maxRequests: 50,
      windowMs: 60000, // 1 minute
    };
    this.requestCounts = new Map();
  }

  public static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  private checkRateLimit(endpoint: string): void {
    const now = Date.now();
    const requestInfo = this.requestCounts.get(endpoint);

    if (requestInfo) {
      if (now > requestInfo.resetTime) {
        // Reset counter if window has passed
        this.requestCounts.set(endpoint, {
          count: 1,
          resetTime: now + this.rateLimitConfig.windowMs,
        });
      } else if (requestInfo.count >= this.rateLimitConfig.maxRequests) {
        throw new AppError(
          'Rate limit exceeded'
        );
      } else {
        // Increment counter
        requestInfo.count++;
      }
    } else {
      // First request for this endpoint
      this.requestCounts.set(endpoint, {
        count: 1,
        resetTime: now + this.rateLimitConfig.windowMs,
      });
    }
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    endpoint: string,
    retryCount = 0
  ): Promise<T> {
    try {
      this.checkRateLimit(endpoint);
      return await operation();
    } catch (error) {
      if (
        error instanceof AppError &&
        !error.isOperational &&
        retryCount < this.retryConfig.maxRetries
      ) {
        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(2, retryCount),
          this.retryConfig.maxDelay
        );
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.retryWithBackoff(operation, endpoint, retryCount + 1);
      }
      throw error;
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'An error occurred' }));
      throw new AppError(
        error.message || 'API request failed',
        true
      );
    }
    return response.json();
  }

  public async get<T>(endpoint: string): Promise<T> {
    return this.retryWithBackoff(
      async () => {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });
        return this.handleResponse<T>(response);
      },
      endpoint
    );
  }

  public async post<T>(endpoint: string, data: unknown): Promise<T> {
    return this.retryWithBackoff(
      async () => {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(data),
        });
        return this.handleResponse<T>(response);
      },
      endpoint
    );
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    const response = await fetch(endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data: ApiResponse<T> = await response.json();

    if (!response.ok) {
      throw new AppError(
        data.error || `API request failed with status ${response.status}`,
        response.status
      );
    }

    return data.data as T;
  } catch (error) {
    clientLogger.error('API request failed', error as Error, {
      endpoint,
      method: options.method || 'GET'
    });
    throw error;
  }
} 