import express from 'express';
import request from 'supertest';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const asQueryResponse = (rows: Array<Record<string, unknown>>, rowCount?: number): unknown => {
  return {
    command: 'SELECT',
    rowCount: rowCount ?? rows.length,
    oid: 0,
    rows,
    fields: [],
  };
};

describe('Watchlist integration', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  it('should block access without token', async () => {
    const { authMiddleware } = await import('../middleware/auth.middleware');
    const { WatchlistController } = await import('../controllers/watchlist.controller');

    const pool = new Pool();
    const controller = new WatchlistController(pool);

    const app = express();
    app.use(express.json());
    app.get('/api/watchlist', authMiddleware, (req, res) => controller.getWatchlist(req, res));

    const response = await request(app).get('/api/watchlist');

    expect(response.status).toBe(401);

    await pool.end();
  });

  it('should return watchlist with valid JWT', async () => {
    const { authMiddleware } = await import('../middleware/auth.middleware');
    const { WatchlistController } = await import('../controllers/watchlist.controller');

    const pool = new Pool();
    const querySpy = jest.spyOn(pool, 'query');
    querySpy.mockResolvedValueOnce(
      asQueryResponse([
        { id: 10, symbol: 'AAPL', name: 'Apple Inc.', min_price_change: 5, created_at: new Date() },
      ]) as never
    );

    const app = express();
    app.use(express.json());
    const controller = new WatchlistController(pool);
    app.get('/api/watchlist', authMiddleware, (req, res) => controller.getWatchlist(req, res));

    const token = jwt.sign({ userId: 1, email: 'user@test.com' }, 'test-secret');

    const response = await request(app)
      .get('/api/watchlist')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.watchlist).toHaveLength(1);
    expect(response.body.watchlist[0].symbol).toBe('AAPL');

    querySpy.mockRestore();
    await pool.end();
  });
});
