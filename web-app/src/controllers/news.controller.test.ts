/**
 * Tests for News Controller
 */
import { Request, Response } from 'express';
import { Pool } from 'pg';
import { NewsController } from '../controllers/news.controller';

describe('NewsController', () => {
  let newsController: NewsController;
  let mockPool: jest.Mocked<Pool>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    // Mock Pool
    mockPool = {
      query: jest.fn(),
    } as any;

    newsController = new NewsController(mockPool);

    // Mock Express request and response
    mockRequest = {
      query: {},
      params: {},
    };

    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
  });

  describe('getNews', () => {
    it('should return news articles successfully', async () => {
      const mockNews = [
        {
          id: 1,
          title: 'Test News',
          description: 'Test Description',
          url: 'https://test.com',
          source: 'Test Source',
          published_at: new Date(),
          sentiment_score: 0.5,
          sentiment: 'positive',
          related_stocks: ['AAPL', 'GOOGL'],
        },
      ];

      (mockPool.query as jest.Mock).mockResolvedValue({ rows: mockNews });

      await newsController.getNews(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        news: mockNews,
      });
    });

    it('should handle errors gracefully', async () => {
      (mockPool.query as jest.Mock).mockRejectedValue(new Error('Database error'));

      await newsController.getNews(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to fetch news articles',
      });
    });

    it('should filter by sentiment', async () => {
      mockRequest.query = { sentiment: 'positive' };
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

      await newsController.getNews(mockRequest as Request, mockResponse as Response);

      expect(mockPool.query).toHaveBeenCalled();
      const queryCall = (mockPool.query as jest.Mock).mock.calls[0];
      expect(queryCall[0]).toContain('sentiment_score > 0.2');
    });
  });

  describe('getStockNews', () => {
    it('should return news for a specific stock', async () => {
      mockRequest.params = { symbol: 'AAPL' };
      const mockNews = [
        {
          id: 1,
          title: 'Apple News',
          sentiment: 'positive',
        },
      ];

      (mockPool.query as jest.Mock).mockResolvedValue({ rows: mockNews });

      await newsController.getStockNews(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        symbol: 'AAPL',
        count: 1,
        news: mockNews,
      });
    });
  });

  describe('getSentimentStats', () => {
    it('should return sentiment statistics', async () => {
      const mockStats = {
        total: '100',
        positive: '60',
        negative: '20',
        neutral: '20',
        avg_sentiment: '0.3',
      };

      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [mockStats] });

      await newsController.getSentimentStats(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        stats: expect.objectContaining({
          total: 100,
          positive: 60,
          negative: 20,
          neutral: 20,
          positivePercent: '60.0',
          negativePercent: '20.0',
          neutralPercent: '20.0',
        }),
      });
    });
  });
});
