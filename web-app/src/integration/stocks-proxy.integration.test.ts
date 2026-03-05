/**
 * HTTP proxy contract tests: web-app → api-handler
 *
 * Validates the proxy routes that forward stock-data requests
 * from the web-app to the api-handler service:
 *
 *   GET /api/stocks/:symbol          →  api-handler GET /api/stock/:symbol
 *   GET /api/stocks/:symbol/history  →  api-handler GET /api/stock/:symbol/history
 *
 * Uses mocked axios so no live api-handler is required.
 */

import express, { Request, Response } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import axios from 'axios';

// ---------------------------------------------------------------------------
// Mock axios before any app code runs
// ---------------------------------------------------------------------------
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const JWT_SECRET = 'test-secret';
const API_HANDLER_URL = 'http://api-handler:3001';

function makeToken(userId = 1): string {
  return jwt.sign({ userId, email: 'user@test.com' }, JWT_SECRET);
}

function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

/** Build a minimal Express app with only the two proxy routes under test. */
function buildProxyApp(): express.Application {
  const app = express();
  app.use(express.json());

  // Ensure JWT_SECRET is available for the auth middleware before it is loaded.
  // The middleware reads process.env.JWT_SECRET at module load time, so it must
  // be set before the first require() call. Using require() (not import) keeps
  // the same dynamic-loading pattern used by the other integration tests in this
  // project (auth.integration.test.ts, watchlist.integration.test.ts).
  process.env.JWT_SECRET = JWT_SECRET;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { authMiddleware } = require('../middleware/auth.middleware');

  app.get(
    '/api/stocks/:symbol',
    authMiddleware,
    async (req: Request, res: Response) => {
      try {
        const { symbol } = req.params;
        const response = await axios.get(`${API_HANDLER_URL}/api/stock/${symbol}`);
        res.json(response.data);
      } catch (error: any) {
        res
          .status(error.response?.status || 500)
          .json({ error: error.response?.data?.error || 'Failed to fetch stock data' });
      }
    },
  );

  app.get(
    '/api/stocks/:symbol/history',
    authMiddleware,
    async (req: Request, res: Response) => {
      try {
        const { symbol } = req.params;
        const { period1, period2 } = req.query;
        const response = await axios.get(
          `${API_HANDLER_URL}/api/stock/${symbol}/history`,
          { params: { period1, period2 } },
        );
        res.json(response.data);
      } catch (error: any) {
        res
          .status(error.response?.status || 500)
          .json({ error: error.response?.data?.error || 'Failed to fetch stock history' });
      }
    },
  );

  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('web-app → api-handler proxy contract', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // GET /api/stocks/:symbol
  // =========================================================================

  describe('GET /api/stocks/:symbol', () => {
    const stockResponse = {
      symbol: 'PETR4',
      price: 38.5,
      changePercent: 1.32,
      volume: 12_345_678,
      marketCap: 500_000_000_000,
      name: 'PETRÓLEO BRASILEIRO S.A. - PETROBRAS',
    };

    it('returns 401 when no token is provided', async () => {
      const app = buildProxyApp();
      const res = await request(app).get('/api/stocks/PETR4');
      expect(res.status).toBe(401);
    });

    it('returns 200 with upstream data on success', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: stockResponse });

      const app = buildProxyApp();
      const res = await request(app)
        .get('/api/stocks/PETR4')
        .set(authHeader(makeToken()));

      expect(res.status).toBe(200);
      expect(res.body).toEqual(stockResponse);
    });

    it('forwards the symbol correctly to the api-handler URL', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: stockResponse });

      const app = buildProxyApp();
      await request(app)
        .get('/api/stocks/VALE3')
        .set(authHeader(makeToken()));

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/stock/VALE3'),
      );
    });

    it('returns upstream status code when api-handler fails with 4xx/5xx', async () => {
      const upstreamError: any = new Error('Not found');
      upstreamError.response = { status: 404, data: { error: 'Symbol not found' } };
      mockedAxios.get.mockRejectedValueOnce(upstreamError);

      const app = buildProxyApp();
      const res = await request(app)
        .get('/api/stocks/INVALID')
        .set(authHeader(makeToken()));

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Symbol not found');
    });

    it('returns 500 when api-handler is unreachable (no response)', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const app = buildProxyApp();
      const res = await request(app)
        .get('/api/stocks/PETR4')
        .set(authHeader(makeToken()));

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });
  });

  // =========================================================================
  // GET /api/stocks/:symbol/history
  // =========================================================================

  describe('GET /api/stocks/:symbol/history', () => {
    const historyResponse = [
      { date: '2026-01-01', open: 27.0, high: 27.68, low: 26.76, close: 27.56, volume: 42_985_800 },
      { date: '2026-01-02', open: 27.56, high: 28.0, low: 27.2, close: 27.9, volume: 38_000_000 },
    ];

    it('returns 401 when no token is provided', async () => {
      const app = buildProxyApp();
      const res = await request(app).get('/api/stocks/PETR4/history');
      expect(res.status).toBe(401);
    });

    it('returns 200 with historical data on success', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: historyResponse });

      const app = buildProxyApp();
      const res = await request(app)
        .get('/api/stocks/PETR4/history')
        .query({ period1: '2026-01-01', period2: '2026-01-31' })
        .set(authHeader(makeToken()));

      expect(res.status).toBe(200);
      expect(res.body).toEqual(historyResponse);
    });

    it('forwards symbol and date range params to the api-handler', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: historyResponse });

      const app = buildProxyApp();
      await request(app)
        .get('/api/stocks/VALE3/history')
        .query({ period1: '2026-01-01', period2: '2026-01-31' })
        .set(authHeader(makeToken()));

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/stock/VALE3/history'),
        expect.objectContaining({
          params: expect.objectContaining({
            period1: '2026-01-01',
            period2: '2026-01-31',
          }),
        }),
      );
    });

    it('returns upstream status code when api-handler fails', async () => {
      const upstreamError: any = new Error('Service unavailable');
      upstreamError.response = { status: 503, data: { error: 'Upstream error' } };
      mockedAxios.get.mockRejectedValueOnce(upstreamError);

      const app = buildProxyApp();
      const res = await request(app)
        .get('/api/stocks/PETR4/history')
        .query({ period1: '2026-01-01', period2: '2026-01-31' })
        .set(authHeader(makeToken()));

      expect(res.status).toBe(503);
      expect(res.body.error).toBe('Upstream error');
    });

    it('returns 500 when api-handler is unreachable', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const app = buildProxyApp();
      const res = await request(app)
        .get('/api/stocks/PETR4/history')
        .query({ period1: '2026-01-01', period2: '2026-01-31' })
        .set(authHeader(makeToken()));

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });
  });
});
