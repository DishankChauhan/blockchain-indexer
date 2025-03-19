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

    // Mock all database queries
    mockClient.query.mockImplementation((query: string, params: any[]) => {
      // Platform ID query
      if (query.includes('SELECT id FROM token_platforms')) {
        const programId = params[0];
        let platformId;
        switch (programId) {
          case '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8':
            platformId = 1; // Raydium
            break;
          case '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP':
            platformId = 2; // Orca
            break;
          case 'JUP6i4ozu5ydDCnLiMogSckDPpbtr7BJ4FtzYWkb5Rk':
            platformId = 3; // Jupiter
            break;
          case 'srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX':
            platformId = 4; // Serum
            break;
          default:
            return { rows: [] };
        }
        return { rows: [{ id: platformId }] };
      }

      // Token pairs insert/update query
      if (query.includes('INSERT INTO token_pairs')) {
        return { rows: [{ id: 1 }] };
      }

      // Token prices insert query
      if (query.includes('INSERT INTO token_prices')) {
        return { rows: [] };
      }

      // Default response for other queries
      return { rows: [] };
    });
  });

  describe('processPriceEvent', () => {
    it('should process Raydium pool updates', async () => {
      const transaction = mockTransaction({
        accountData: [mockRaydiumPoolData]
      });

      await service.processPriceEvent(transaction, mockClient);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO token_pairs'),
        expect.arrayContaining([1, mockRaydiumPoolData.data.baseMint])
      );
    });

    it('should process Orca whirlpool updates', async () => {
      const transaction = mockTransaction({
        accountData: [mockOrcaPoolData]
      });

      await service.processPriceEvent(transaction, mockClient);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO token_pairs'),
        expect.arrayContaining([2, mockOrcaPoolData.data.tokenMintA])
      );
    });

    it('should process Jupiter swap events', async () => {
      const transaction = mockTransaction({
        accountData: [mockJupiterSwapData]
      });

      await service.processPriceEvent(transaction, mockClient);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO token_pairs'),
        expect.arrayContaining([3, mockJupiterSwapData.data.inputMint])
      );
    });

    it('should process Serum market updates', async () => {
      const transaction = mockTransaction({
        accountData: [mockSerumMarketData]
      });

      await service.processPriceEvent(transaction, mockClient);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO token_pairs'),
        expect.arrayContaining([4, mockSerumMarketData.data.baseMint])
      );
    });

    it('should handle database errors gracefully', async () => {
      // Override the mock for this test to simulate a database error
      mockClient.query.mockImplementation(() => {
        throw new Error('Database error');
      });

      const transaction = mockTransaction({
        accountData: [mockRaydiumPoolData]
      });

      await expect(service.processPriceEvent(transaction, mockClient))
        .rejects
        .toThrow('Database error');
    });

    it('should ignore non-DEX transactions', async () => {
      const transaction = mockTransaction({
        accountData: [{
          account: 'unknown',
          program: 'unknown',
          type: 'unknown',
          data: {}
        }]
      });

      await service.processPriceEvent(transaction, mockClient);

      expect(mockClient.query).not.toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO token_pairs'),
        expect.anything()
      );
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

      mockClient.query.mockResolvedValueOnce({ rows: mockPrices });

      const result = await service.getCurrentPrices(mockClient, {
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
      mockClient.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(service.getCurrentPrices(mockClient))
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
        platforms: [{
          platform: 'Raydium',
          type: 'dex',
          pool: 'pool123',
          price: 20.5,
          volume: 1000000,
          liquidity: 5000000,
          timestamp: new Date()
        }]
      }];

      mockClient.query.mockResolvedValueOnce({ rows: mockAggregated });

      const result = await service.getAggregatedPrices(mockClient, {
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
      mockClient.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(service.getAggregatedPrices(mockClient))
        .rejects
        .toThrow('Failed to get aggregated token prices');
    });
  });
}); 