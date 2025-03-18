import axios, { AxiosInstance, AxiosError } from 'axios';
import { AppError, ErrorCodes } from '../utils/errorHandling';
import axiosRetry from 'axios-retry';

export class ApiClient {
  private static instance: ApiClient;
  private client: AxiosInstance;
  private retryCount: number = 3;
  private retryDelay: number = 1000;

  private constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Configure retry behavior
    axiosRetry(this.client, {
      retries: this.retryCount,
      retryDelay: (retryCount) => {
        return this.retryDelay * Math.pow(2, retryCount - 1);
      },
      retryCondition: (error: AxiosError) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          error.response?.status === 429;
      },
    });

    // Add request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add auth token if available
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (!error.response) {
          throw new AppError(
            'Network error occurred',
            ErrorCodes.NETWORK_ERROR,
            0,
            true
          );
        }

        switch (error.response.status) {
          case 401:
            throw new AppError(
              'Unauthorized access',
              ErrorCodes.UNAUTHORIZED,
              401,
              true
            );
          case 403:
            throw new AppError(
              'Access forbidden',
              ErrorCodes.FORBIDDEN,
              403,
              true
            );
          case 404:
            throw new AppError(
              'Resource not found',
              ErrorCodes.NOT_FOUND,
              404,
              true
            );
          case 422:
            throw new AppError(
              (error.response.data as { message?: string })?.message || 'Validation error',
              ErrorCodes.VALIDATION_ERROR,
              422,
              true
            );
          default:
            throw new AppError(
              'An unexpected error occurred',
              ErrorCodes.INTERNAL_SERVER_ERROR,
              error.response.status,
              false
            );
        }
      }
    );
  }

  public static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  public async get<T>(url: string, config = {}): Promise<T> {
    try {
      const response = await this.client.get<T>(url, config);
      return response.data;
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  public async post<T>(url: string, data = {}, config = {}): Promise<T> {
    try {
      const response = await this.client.post<T>(url, data, config);
      return response.data;
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  public async put<T>(url: string, data = {}, config = {}): Promise<T> {
    try {
      const response = await this.client.put<T>(url, data, config);
      return response.data;
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  public async delete<T>(url: string, config = {}): Promise<T> {
    try {
      const response = await this.client.delete<T>(url, config);
      return response.data;
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  private handleApiError(error: unknown): never {
    if (error instanceof AppError) {
      throw error;
    }
    
    if (axios.isAxiosError(error)) {
      // This error was already handled by the interceptor
      throw error;
    }
    
    throw new AppError(
      'An unexpected error occurred',
      ErrorCodes.INTERNAL_SERVER_ERROR,
      500,
      false
    );
  }
} 