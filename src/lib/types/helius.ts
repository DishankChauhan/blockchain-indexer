export interface HeliusTransaction {
  signature: string;
  type: string;
  timestamp: number;
  slot: number;
  fee: number;
  nativeTransfers: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }>;
  tokenTransfers: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    mint: string;
    amount: number;
  }>;
  accountData: Array<{
    account: string;
    program: string;
    type: string;
    data: Record<string, unknown>;
  }>;
  raw: Record<string, unknown>;
}

export interface HeliusWebhookData {
  accountData: Array<{
    account: string;
    program: string;
    type: string;
    data: Record<string, unknown>;
  }>;
  signature: string;
  events: Array<{
    type: string;
    source: string;
    data: Record<string, unknown>;
  }>;
  timestamp: number;
  type: string;
  fee: number;
  slot: number;
  nativeTransfers: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }>;
  sourceAddress: string;
  status: 'success' | 'failed';
  nft?: {
    mint: string;
    name?: string;
    collection?: string;
  };
  amount?: number;
  seller?: string;
  buyer?: string;
  raw: Record<string, unknown>;
}

export interface HeliusWebhookRequest {
  accountAddresses: string[];
  programIds: string[];
  webhookURL: string;
  webhookType: 'enhanced';
  authHeader: string;
  txnType: string[];
}

export interface HeliusWebhookResponse {
  webhookId: string;
}

export interface HeliusErrorResponse {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

export interface HeliusProcessingResult {
  success: boolean;
  transactionsProcessed: number;
  errors?: Array<{
    signature: string;
    error: string;
  }>;
} 