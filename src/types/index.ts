export enum IndexingCategory {
  NFT_BIDS = 'nft_bids',
  NFT_PRICES = 'nft_prices',
  TOKEN_BORROWING = 'token_borrowing',
  TOKEN_PRICES = 'token_prices',
}

export interface DatabaseCredentials {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface IndexingConfig {
  nftBids?: {
    marketplace: string;
    collection: string;
    updateFrequency: number;
    minPrice?: number;
  };
  nftPrices?: {
    collection: string;
    marketplaces: string[];
    updateFrequency: number;
  };
  tokenBorrowing?: {
    protocol: string;
    tokens: string[];
    updateFrequency: number;
  };
  tokenPrices?: {
    tokens: string[];
    platforms: string[];
    updateFrequency: number;
  };
}

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
  category: IndexingCategory;
  config: IndexingConfig;
  status: 'pending' | 'active' | 'paused' | 'error';
  lastIndexedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
} 