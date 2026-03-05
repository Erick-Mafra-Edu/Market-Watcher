import request from 'supertest';

// yahoo-finance2 is an ESM-only package; mock it to prevent CJS resolution errors
jest.mock('yahoo-finance2', () => ({ quote: jest.fn(), historical: jest.fn() }), { virtual: true });
jest.mock('./providers/BrapiProvider');
jest.mock('./providers/YahooFinanceProvider');

import { ApiHandler } from './index';
import { BrapiProvider } from './providers/BrapiProvider';
import { YahooFinanceProvider } from './providers/YahooFinanceProvider';

const mockBrapiInstance = {
  fetchQuote: jest.fn(),
  fetchHistory: jest.fn(),
};

const mockYahooInstance = {
  fetchQuote: jest.fn(),
  fetchHistory: jest.fn(),
};

(BrapiProvider as jest.Mock).mockImplementation(() => mockBrapiInstance);
(YahooFinanceProvider as jest.Mock).mockImplementation(() => mockYahooInstance);

describe('ApiHandler', () => {
  beforeEach(() => {
    mockBrapiInstance.fetchQuote.mockReset();
    mockBrapiInstance.fetchHistory.mockReset();
    mockYahooInstance.fetchQuote.mockReset();
    mockYahooInstance.fetchHistory.mockReset();
  });

  it('should return health status on /health', async () => {
    const handler = new ApiHandler();
    const app = handler.getApp();

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', service: 'api-handler' });
  });

  it('should return stock quote from BRAPI on /api/stock/:symbol', async () => {
    mockBrapiInstance.fetchQuote.mockResolvedValue({
      symbol: 'PETR4',
      price: 38.5,
      changePercent: 1.32,
      volume: 12345678,
      marketCap: 500000000000,
      name: 'PETRÓLEO BRASILEIRO S.A. - PETROBRAS',
      currency: 'BRL',
    });

    const handler = new ApiHandler();
    const app = handler.getApp();

    const response = await request(app).get('/api/stock/PETR4');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      symbol: 'PETR4',
      price: 38.5,
      changePercent: 1.32,
      volume: 12345678,
      marketCap: 500000000000,
      name: 'PETRÓLEO BRASILEIRO S.A. - PETROBRAS',
      currency: 'BRL',
    });
    expect(mockBrapiInstance.fetchQuote).toHaveBeenCalledWith('PETR4');
    expect(mockYahooInstance.fetchQuote).not.toHaveBeenCalled();
  });

  it('should fall back to Yahoo Finance when BRAPI fails on /api/stock/:symbol', async () => {
    mockBrapiInstance.fetchQuote.mockRejectedValue(new Error('BRAPI: No data found for symbol: AAPL'));
    mockYahooInstance.fetchQuote.mockResolvedValue({
      symbol: 'AAPL',
      price: 185.5,
      changePercent: 1.2,
      volume: 1000,
      marketCap: 123456789,
      name: 'Apple Inc.',
      currency: 'USD',
    });

    const handler = new ApiHandler();
    const app = handler.getApp();

    const response = await request(app).get('/api/stock/AAPL');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      symbol: 'AAPL',
      price: 185.5,
      changePercent: 1.2,
      volume: 1000,
      marketCap: 123456789,
      name: 'Apple Inc.',
      currency: 'USD',
    });
    expect(mockBrapiInstance.fetchQuote).toHaveBeenCalledWith('AAPL');
    expect(mockYahooInstance.fetchQuote).toHaveBeenCalledWith('AAPL');
  });

  it('should return 500 when both providers fail on /api/stock/:symbol', async () => {
    mockBrapiInstance.fetchQuote.mockRejectedValue(new Error('BRAPI error'));
    mockYahooInstance.fetchQuote.mockRejectedValue(new Error('Yahoo error'));

    const handler = new ApiHandler();
    const app = handler.getApp();

    const response = await request(app).get('/api/stock/INVALID');

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('error');
  });

  it('should return historical data from BRAPI on /api/stock/:symbol/history', async () => {
    const historicalRows = [
      { date: '2026-01-01', open: 27.0, high: 27.68, low: 26.76, close: 27.56, volume: 42985800 },
      { date: '2026-01-02', open: 27.56, high: 28.0, low: 27.2, close: 27.9, volume: 38000000 },
    ];
    mockBrapiInstance.fetchHistory.mockResolvedValue(historicalRows);

    const handler = new ApiHandler();
    const app = handler.getApp();

    const response = await request(app)
      .get('/api/stock/PETR4/history')
      .query({ period1: '2026-01-01', period2: '2026-01-31' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(historicalRows);
    expect(mockBrapiInstance.fetchHistory).toHaveBeenCalledWith('PETR4', '2026-01-01', '2026-01-31');
    expect(mockYahooInstance.fetchHistory).not.toHaveBeenCalled();
  });

  it('should fall back to Yahoo Finance when BRAPI history fails on /api/stock/:symbol/history', async () => {
    const historicalRows = [
      { date: '2026-01-01', close: 180 },
      { date: '2026-01-02', close: 181 },
    ];
    mockBrapiInstance.fetchHistory.mockRejectedValue(new Error('BRAPI: No historical data found'));
    mockYahooInstance.fetchHistory.mockResolvedValue(historicalRows);

    const handler = new ApiHandler();
    const app = handler.getApp();

    const response = await request(app)
      .get('/api/stock/AAPL/history')
      .query({ period1: '2026-01-01', period2: '2026-01-31' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(historicalRows);
    expect(mockBrapiInstance.fetchHistory).toHaveBeenCalled();
    expect(mockYahooInstance.fetchHistory).toHaveBeenCalledWith('AAPL', '2026-01-01', '2026-01-31');
  });

  it('should return 503 when upstream returns invalid JSON (SyntaxError)', async () => {
    mockBrapiInstance.fetchQuote.mockRejectedValue(new Error('BRAPI unavailable'));
    mockYahooInstance.fetchQuote.mockRejectedValue(
      new SyntaxError('Unexpected token T in JSON at position 0')
    );

    const handler = new ApiHandler();
    const app = handler.getApp();

    const response = await request(app).get('/api/stock/AAPL');

    expect(response.status).toBe(503);
    expect(response.body.error).toBe('Upstream data source returned an invalid response');
  });

  it('should return 500 for non-upstream errors on /api/stock/:symbol', async () => {
    mockBrapiInstance.fetchQuote.mockRejectedValue(new Error('BRAPI unavailable'));
    mockYahooInstance.fetchQuote.mockRejectedValue(new Error('Internal error'));

    const handler = new ApiHandler();
    const app = handler.getApp();

    const response = await request(app).get('/api/stock/AAPL');

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Internal error');
  });
});

