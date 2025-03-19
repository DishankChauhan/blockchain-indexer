import { HeliusWebhookData } from '@/lib/types/helius';
import { Pool, PoolClient } from 'pg';

type MockFunction = jest.Mock & { mockClear: () => void; mockResolvedValue: (value: any) => void; mockRejectedValue: (error: Error) => void };

export const mockPool = {
  query: jest.fn() as MockFunction,
  connect: jest.fn() as MockFunction,
  end: jest.fn() as MockFunction,
  totalCount: 0,
  idleCount: 0,
  waitingCount: 0,
  expiredCount: 0,
  status: 'ready',
  options: {},
  on: jest.fn(),
  removeListener: jest.fn(),
  addListener: jest.fn(),
  once: jest.fn(),
  removeAllListeners: jest.fn(),
  listeners: jest.fn(),
  listenerCount: jest.fn(),
  eventNames: jest.fn(),
  emit: jest.fn(),
  prependListener: jest.fn(),
  prependOnceListener: jest.fn(),
  rawListeners: jest.fn(),
  getMaxListeners: jest.fn(),
  setMaxListeners: jest.fn(),
  off: jest.fn()
} as unknown as Pool & { query: MockFunction; connect: MockFunction; end: MockFunction };

export const mockClient = {
  query: jest.fn() as MockFunction,
  release: jest.fn() as MockFunction
} as unknown as PoolClient & { query: MockFunction; release: MockFunction };

export const mockTransaction = (overrides: Partial<HeliusWebhookData> = {}): HeliusWebhookData => ({
  accountData: [] as Array<{
    account: string;
    program: string;
    type: string;
    data: Record<string, unknown>;
  }>,
  signature: '5KtPn3DXBZqHJqkQHxkX9YFjGZVEAiV6zzEBvBvCj5TFGwuiVYwHtVxzWSxwaXzYQqgHfZGmBqPxUHkGFJLGgPvY',
  events: [] as Array<{
    type: string;
    source: string;
    data: Record<string, unknown>;
  }>,
  timestamp: Date.now(),
  type: 'UNKNOWN',
  fee: 5000,
  slot: 1234567,
  nativeTransfers: [] as Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }>,
  sourceAddress: '',
  status: 'success' as const,
  ...overrides
});

export const mockRaydiumPoolData = {
  type: 'pool',
  program: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  account: 'pool123',
  data: {
    baseMint: 'SOL9wgmRQGMDPHsByR5X2YxgYpveBTPYH8FdwP1PXiuP',
    quoteMint: 'USDC9wgmRQGMDPHsByR5X2YxgYpveBTPYH8FdwP1PXiuP',
    price: 20.5,
    volume24h: 1000000,
    liquidity: 5000000
  }
};

export const mockOrcaPoolData = {
  type: 'whirlpool',
  program: '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP',
  account: 'whirlpool123',
  data: {
    tokenVaultA: 'vaultA',
    tokenVaultB: 'vaultB',
    tokenMintA: 'SOL9wgmRQGMDPHsByR5X2YxgYpveBTPYH8FdwP1PXiuP',
    tokenMintB: 'USDC9wgmRQGMDPHsByR5X2YxgYpveBTPYH8FdwP1PXiuP',
    sqrtPrice: '1157920892373161954235709850086879078532699846656405640394575840079131296',
    liquidity: '1000000000',
    volume24h: '500000000',
    tokenADecimals: 9,
    tokenBDecimals: 6
  }
};

export const mockJupiterSwapData = {
  type: 'swap',
  program: 'JUP6i4ozu5ydDCnLiMogSckDPpbtr7BJ4FtzYWkb5Rk',
  account: 'swap123',
  data: {
    inputMint: 'SOL9wgmRQGMDPHsByR5X2YxgYpveBTPYH8FdwP1PXiuP',
    outputMint: 'USDC9wgmRQGMDPHsByR5X2YxgYpveBTPYH8FdwP1PXiuP',
    amountIn: '1000000000',
    amountOut: '20500000000',
    totalLiquidity: '10000000000',
    volume24h: '1000000000',
    routeType: 'split',
    slippage: 0.1,
    priceImpact: 0.05
  }
};

export const mockSerumMarketData = {
  type: 'market',
  program: 'srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX',
  account: 'market123',
  data: {
    baseMint: 'SOL9wgmRQGMDPHsByR5X2YxgYpveBTPYH8FdwP1PXiuP',
    quoteMint: 'USDC9wgmRQGMDPHsByR5X2YxgYpveBTPYH8FdwP1PXiuP',
    bestBid: 20.4,
    bestAsk: 20.6,
    volume24h: 800000,
    liquidity: 4000000,
    baseDecimals: 9,
    quoteDecimals: 6
  }
};

export const mockDatabaseError = new Error('Database error');

export const clearMocks = () => {
  (mockPool.query as MockFunction).mockClear();
  (mockPool.connect as MockFunction).mockClear();
  (mockPool.end as MockFunction).mockClear();
  (mockClient.query as MockFunction).mockClear();
  (mockClient.release as MockFunction).mockClear();
};

export const setupSuccessfulQueries = () => {
  (mockPool.connect as MockFunction).mockResolvedValue(mockClient);
  (mockClient.query as MockFunction).mockResolvedValue({ rows: [], rowCount: 0 });
};

export const setupFailedQueries = () => {
  (mockPool.connect as MockFunction).mockResolvedValue(mockClient);
  (mockClient.query as MockFunction).mockRejectedValue(mockDatabaseError);
}; 