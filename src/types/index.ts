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
  metadata: {};
  id: string;
  userId: string;
  dbConnectionId: string;
  category: string;
  config: IndexingConfig;
  status: 'pending' | 'active' | 'paused' | 'error';
  lastIndexedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IndexingConfig {
  categories: {
    transactions: boolean;
    nftEvents: boolean;
    tokenTransfers: boolean;
    accountActivity: boolean;
    programInteractions: boolean;
    defiTransactions: boolean;
    governance: boolean;
  };
  filters: {
    programIds?: string[];
    accounts?: string[];
    startSlot?: number;
    includeMints: boolean;
    includeMetadata: boolean;
  };
  webhook: {
    enabled: boolean;
    url?: string;
    secret?: string;
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
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
} 