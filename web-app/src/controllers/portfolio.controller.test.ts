/**
 * Tests for Portfolio Controller
 */
import { Request, Response } from 'express';
import { Pool } from 'pg';
import { PortfolioController } from '../controllers/portfolio.controller';

interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
  };
}

describe('PortfolioController', () => {
  let portfolioController: PortfolioController;
  let mockPool: jest.Mocked<Pool>;
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    // Mock Pool
    mockPool = {
      query: jest.fn(),
    } as any;

    portfolioController = new PortfolioController(mockPool);

    // Mock Express request and response with user
    mockRequest = {
      user: { id: 1, email: 'test@example.com' },
      query: {},
      params: {},
      body: {},
    };

    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
  });

  describe('getPortfolio', () => {
    it('should return user portfolio successfully', async () => {
      const mockPositions = [
        {
          symbol: 'AAPL',
          name: 'Apple Inc.',
          total_quantity: '10',
          avg_purchase_price: '150.00',
          current_price: '175.00',
          change_percent: '2.5',
          current_value: '1750.00',
          invested_value: '1500.00',
          dividend_yield: '0.5',
        },
      ];

      (mockPool.query as jest.Mock).mockResolvedValue({ rows: mockPositions });

      await portfolioController.getPortfolio(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        portfolio: expect.objectContaining({
          positions: expect.arrayContaining([
            expect.objectContaining({
              symbol: 'AAPL',
              quantity: 10,
              profitLoss: 250,
            }),
          ]),
          summary: expect.objectContaining({
            totalInvested: expect.any(Number),
            totalCurrent: expect.any(Number),
          }),
        }),
      });
    });

    it('should handle errors gracefully', async () => {
      (mockPool.query as jest.Mock).mockRejectedValue(new Error('Database error'));

      await portfolioController.getPortfolio(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to fetch portfolio',
      });
    });
  });

  describe('addTransaction', () => {
    it('should add a transaction successfully', async () => {
      mockRequest.body = {
        symbol: 'AAPL',
        quantity: 10,
        price: 150,
        date: '2024-01-01',
        type: 'BUY',
      };

      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Stock lookup
        .mockResolvedValueOnce({ rows: [] }); // Insert transaction

      await portfolioController.addTransaction(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Transaction added successfully',
      });
    });

    it('should return error for missing fields', async () => {
      mockRequest.body = { symbol: 'AAPL' }; // Missing required fields

      await portfolioController.addTransaction(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: expect.stringContaining('Missing required fields'),
      });
    });

    it('should create stock if it does not exist', async () => {
      mockRequest.body = {
        symbol: 'NEWSTOCK',
        quantity: 5,
        price: 100,
        date: '2024-01-01',
      };

      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // Stock not found
        .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // Insert new stock
        .mockResolvedValueOnce({ rows: [] }); // Insert transaction

      await portfolioController.addTransaction(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockPool.query).toHaveBeenCalledTimes(3);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Transaction added successfully',
      });
    });
  });

  describe('getTransactions', () => {
    it('should return transaction history', async () => {
      const mockTransactions = [
        {
          id: 1,
          symbol: 'AAPL',
          name: 'Apple Inc.',
          quantity: '10',
          purchase_price: '150.00',
          purchase_date: new Date('2024-01-01'),
          transaction_type: 'BUY',
          notes: 'Test purchase',
          created_at: new Date(),
        },
      ];

      (mockPool.query as jest.Mock).mockResolvedValue({ rows: mockTransactions });

      await portfolioController.getTransactions(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        transactions: mockTransactions,
      });
    });

    it('should filter transactions by symbol', async () => {
      mockRequest.query = { symbol: 'AAPL' };
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

      await portfolioController.getTransactions(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockPool.query).toHaveBeenCalled();
      const queryCall = (mockPool.query as jest.Mock).mock.calls[0];
      expect(queryCall[0]).toContain('s.symbol = $2');
      expect(queryCall[1]).toContain('AAPL');
    });
  });

  describe('getDividends', () => {
    it('should return dividend information', async () => {
      const mockDividends = [
        {
          symbol: 'AAPL',
          name: 'Apple Inc.',
          dividend_amount: '0.25',
          ex_date: new Date('2024-02-01'),
          payment_date: new Date('2024-02-15'),
          dividend_type: 'Regular',
          dividend_yield: '0.5',
          quantity: '10',
          estimated_payment: '2.50',
        },
      ];

      (mockPool.query as jest.Mock).mockResolvedValue({ rows: mockDividends });

      await portfolioController.getDividends(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        dividends: mockDividends,
      });
    });
  });
});
