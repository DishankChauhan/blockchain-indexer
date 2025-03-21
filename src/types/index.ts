export interface User {
  id: string;
  name?: string | null;
  email: string;
  emailVerified?: Date | null;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatabaseConnection {
  id: string;
  userId: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  status: 'pending' | 'active' | 'error';
  lastConnectedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IndexingJob {
  id: string;
  userId: string;
  dbConnectionId: string;
  type: string;
  config: IndexingConfig;
  status: string;
  progress: number;
  lastRunAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IndexingConfig {
  type: string;
  filters?: {
    accounts?: string[];
    programIds?: string[];
    mintAddresses?: string[];
  };
  webhook?: {
    enabled: boolean;
    url?: string;
    secret?: string;
  };
  categories: {
    transactions: boolean;
    nftEvents: boolean;
    tokenTransfers: boolean;
    programInteractions: boolean;
  };
  options?: {
    batchSize?: number;
    retryAttempts?: number;
    retryDelay?: number;
  };
}

export interface ErrorResponse {
  error: {
    id: string;
    type: string;
    message: string;
    timestamp: string;
  };
}

export interface NotificationWebhook {
  id: string;
  userId: string;
  url: string;
  secret: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Notification {
  id: string;
  userId?: string;
  type: 'error' | 'warning' | 'info' | 'success';
  message: string;
  priority: 'low' | 'medium' | 'high';
  channel: ('email' | 'webhook' | 'database')[];
  metadata?: Record<string, any>;
  status: 'read' | 'unread';
  createdAt: Date;
  updatedAt: Date;
}

export interface DatabaseCredentials {
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
} 