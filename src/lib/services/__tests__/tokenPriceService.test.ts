import { TokenPriceService } from '../tokenPriceService';
import {
  mockPool,
  mockClient,
  mockTransaction,
  mockRaydiumPoolData,
  mockOrcaPoolData,
  mockJupiterSwapData,
  mockSerumMarketData,
  clearMocks,
  setupSuccessfulQueries,
  setupFailedQueries
} from './testUtils';

jest.mock('@/lib/utils/logger');

describe('TokenPriceService', () => {
  let service: TokenPriceService;

  beforeEach(() => {
    clearMocks();
    service = TokenPriceService.getInstance();
  });

  describe('processPriceEvent', () => {
    it('should process Raydium pool updates', async () => {
      setupSuccessfulQueries();
      const transaction = mockTransaction({
        accountData: [mockRaydiumPoolData]
      });

      await service.processPriceEvent(transaction, mockPool);

      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringMatching(/SELECT id FROM token_platforms/),
        ['675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8']
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringMatching(/INSERT INTO token_pairs/),
        expect.any(Array)
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringMatching(/INSERT INTO token_prices/),
        expect.any(Array)
      );
    });

    it('should process Orca whirlpool updates', async () => {
      setupSuccessfulQueries();
      const transaction = mockTransaction({
        accountData: [mockOrcaPoolData]
      });

      await service.processPriceEvent(transaction, mockPool);

      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringMatching(/SELECT id FROM token_platforms/),
        ['9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP']
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringMatching(/INSERT INTO token_pairs/),
        expect.any(Array)
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringMatching(/INSERT INTO token_prices/),
        expect.any(Array)
      );
    });

    it('should process Jupiter swap events', async () => {
      setupSuccessfulQueries();
      const transaction = mockTransaction({
        accountData: [mockJupiterSwapData]
      });

      await service.processPriceEvent(transaction, mockPool);

      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringMatching(/SELECT id FROM token_platforms/),
        ['JUP6i4ozu5ydDCnLiMogSckDPpbtr7BJ4FtzYWkb5Rk']
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringMatching(/INSERT INTO token_pairs/),
        expect.any(Array)
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringMatching(/INSERT INTO token_prices/),
        expect.any(Array)
      );
    });

    it('should process Serum market updates', async () => {
      setupSuccessfulQueries();
      const transaction = mockTransaction({
        accountData: [mockSerumMarketData]
      });

      await service.processPriceEvent(transaction, mockPool);

      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringMatching(/SELECT id FROM token_platforms/),
        ['srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX']
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringMatching(/INSERT INTO token_pairs/),
        expect.any(Array)
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringMatching(/INSERT INTO token_prices/),
        expect.any(Array)
      );
    });

    it('should handle database errors gracefully', async () => {
      setupFailedQueries();
      const transaction = mockTransaction({
        accountData: [mockRaydiumPoolData]
      });

      await expect(service.processPriceEvent(transaction, mockPool))
        .rejects
        .toThrow('Database error');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should ignore non-DEX transactions', async () => {
      setupSuccessfulQueries();
      const transaction = mockTransaction({
        accountData: [{
          account: 'unknown',
          program: 'unknown',
          type: 'unknown',
          data: {}
        }]
      });

      await service.processPriceEvent(transaction, mockPool);

      expect(mockClient.query).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentPrices', () => {
    it('should return current prices with filters', async () => {
      const mockPrices = [{
        base_mint: 'SOL',
        quote_mint: 'USDC',
        platform_name: 'Raydium',
        platform_type: 'dex',
        pool_address: 'pool123',
        price: '20.5',
        volume_24h: '1000000',
        liquidity: '5000000',
        last_updated: new Date()
      }];

      mockPool.query.mockResolvedValueOnce({ rows: mockPrices });

      const result = await service.getCurrentPrices(mockPool, {
        baseMint: 'SOL',
        quoteMint: 'USDC',
        platform: 'Raydium',
        minLiquidity: 1000000
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        baseMint: 'SOL',
        quoteMint: 'USDC',
        platformName: 'Raydium',
        price: 20.5
      });
    });

    it('should handle database errors in getCurrentPrices', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(service.getCurrentPrices(mockPool))
        .rejects
        .toThrow('Failed to get current token prices');
    });
  });

  describe('getAggregatedPrices', () => {
    it('should return aggregated prices with filters', async () => {
      const mockAggregated = [{
        base_mint: 'SOL',
        quote_mint: 'USDC',
        platform_count: '3',
        min_price: '20.4',
        max_price: '20.6',
        avg_price: '20.5',
        total_volume_24h: '2300000',
        total_liquidity: '9000000',
        platforms: JSON.stringify([
          {
            platform: 'Raydium',
            type: 'dex',
            price: 20.5,
            volume: 1000000
          }
        ])
      }];

      mockPool.query.mockResolvedValueOnce({ rows: mockAggregated });

      const result = await service.getAggregatedPrices(mockPool, {
        baseMint: 'SOL',
        minLiquidity: 1000000
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        baseMint: 'SOL',
        quoteMint: 'USDC',
        platformCount: 3,
        minPrice: 20.4
      });
    });

    it('should handle database errors in getAggregatedPrices', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(service.getAggregatedPrices(mockPool))
        .rejects
        .toThrow('Failed to get aggregated token prices');
    });
  });
}); 