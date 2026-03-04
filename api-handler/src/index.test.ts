import request from 'supertest';

jest.mock('yahoo-finance2', () => ({
  quote: jest.fn(),
  historical: jest.fn(),
}), { virtual: true });

import { ApiHandler } from './index';
import yahooFinance from 'yahoo-finance2';

type YahooMock = {
  quote: jest.Mock;
  historical: jest.Mock;
};

const mockedYahoo = yahooFinance as unknown as YahooMock;

describe('ApiHandler', () => {
  beforeEach(() => {
    mockedYahoo.quote.mockReset();
    mockedYahoo.historical.mockReset();
  });

  it('should return health status on /health', async () => {
    const handler = new ApiHandler();
    const app = handler.getApp();

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', service: 'api-handler' });
  });

  it('should return stock quote on /api/stock/:symbol', async () => {
    mockedYahoo.quote.mockResolvedValue({
      symbol: 'AAPL',
      regularMarketPrice: 185.5,
      regularMarketChangePercent: 1.2,
      regularMarketVolume: 1000,
      marketCap: 123456789,
      longName: 'Apple Inc.',
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
    });
  });

  it('should return historical data on /api/stock/:symbol/history', async () => {
    const historicalRows = [
      { date: '2026-01-01', close: 180 },
      { date: '2026-01-02', close: 181 },
    ];
    mockedYahoo.historical.mockResolvedValue(historicalRows);

    const handler = new ApiHandler();
    const app = handler.getApp();

    const response = await request(app)
      .get('/api/stock/AAPL/history')
      .query({ period1: '2026-01-01', period2: '2026-01-31' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(historicalRows);
  });
});
