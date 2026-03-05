/**
 * Assets API integration tests
 *
 * Validates the three asset-management routes end-to-end:
 *   GET    /api/assets            — list tracked assets
 *   POST   /api/assets            — add / re-activate an asset
 *   DELETE /api/assets/:symbol    — soft-deactivate an asset
 *
 * Uses supertest + mocked Pool (same pattern as watchlist.integration.test.ts).
 * No live database or rate-limiting is involved.
 */
import express from 'express';
import request from 'supertest';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const asQueryResponse = (rows: Array<Record<string, unknown>>, rowCount?: number): unknown => ({
  command: 'SELECT',
  rowCount: rowCount ?? rows.length,
  oid: 0,
  rows,
  fields: [],
});

function makeToken(userId = 1): string {
  return jwt.sign({ userId, email: 'user@test.com' }, 'test-secret');
}

function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('Assets API integration', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  // =========================================================================
  // GET /api/assets
  // =========================================================================

  describe('GET /api/assets', () => {
    it('blocks unauthenticated requests with 401', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { authMiddleware } = require('../middleware/auth.middleware');
      const { AssetsController } = await import('../controllers/assets.controller');
      const pool = new Pool();
      const controller = new AssetsController(pool);

      const app = express();
      app.use(express.json());
      app.get('/api/assets', authMiddleware, (req, res) => controller.getAssets(req, res));

      const response = await request(app).get('/api/assets');

      expect(response.status).toBe(401);
      await pool.end();
    });

    it('returns active assets for an authenticated user', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { authMiddleware } = require('../middleware/auth.middleware');
      const { AssetsController } = await import('../controllers/assets.controller');
      const pool = new Pool();
      const querySpy = jest.spyOn(pool, 'query');

      const mockAssets = [
        { id: 1, symbol: 'PETR4', name: 'Petrobras PN', asset_type: 'stock', active: true, created_at: new Date(), updated_at: new Date() },
        { id: 2, symbol: 'VALE3', name: 'Vale ON', asset_type: 'stock', active: true, created_at: new Date(), updated_at: new Date() },
      ];
      querySpy.mockResolvedValueOnce(asQueryResponse(mockAssets) as never);

      const controller = new AssetsController(pool);
      const app = express();
      app.use(express.json());
      app.get('/api/assets', authMiddleware, (req, res) => controller.getAssets(req, res));

      const token = makeToken();
      const response = await request(app)
        .get('/api/assets')
        .set(authHeader(token));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(2);
      expect(response.body.assets).toHaveLength(2);
      expect(response.body.assets[0].symbol).toBe('PETR4');
      expect(response.body.assets[1].symbol).toBe('VALE3');
      // All returned assets must be active
      response.body.assets.forEach((asset: any) => expect(asset.active).toBe(true));

      const sql: string = (querySpy.mock.calls[0] as any[])[0];
      expect(sql).toMatch(/WHERE active = TRUE/i);

      querySpy.mockRestore();
      await pool.end();
    });

    it('returns all assets (including inactive) when active=false query param is supplied', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { authMiddleware } = require('../middleware/auth.middleware');
      const { AssetsController } = await import('../controllers/assets.controller');
      const pool = new Pool();
      const querySpy = jest.spyOn(pool, 'query');

      querySpy.mockResolvedValueOnce(asQueryResponse([
        { id: 1, symbol: 'PETR4', active: true },
        { id: 3, symbol: 'MGLU3', active: false },
      ]) as never);

      const controller = new AssetsController(pool);
      const app = express();
      app.use(express.json());
      app.get('/api/assets', authMiddleware, (req, res) => controller.getAssets(req, res));

      const token = makeToken();
      const response = await request(app)
        .get('/api/assets?active=false')
        .set(authHeader(token));

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(2);

      const sql: string = (querySpy.mock.calls[0] as any[])[0];
      expect(sql).not.toMatch(/WHERE active = TRUE/i);

      querySpy.mockRestore();
      await pool.end();
    });
  });

  // =========================================================================
  // POST /api/assets
  // =========================================================================

  describe('POST /api/assets', () => {
    it('blocks unauthenticated requests with 401', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { authMiddleware } = require('../middleware/auth.middleware');
      const { AssetsController } = await import('../controllers/assets.controller');
      const pool = new Pool();
      const controller = new AssetsController(pool);

      const app = express();
      app.use(express.json());
      app.post('/api/assets', authMiddleware, (req, res) => controller.addAsset(req, res));

      const response = await request(app)
        .post('/api/assets')
        .send({ symbol: 'NVDA', name: 'Nvidia' });

      expect(response.status).toBe(401);
      await pool.end();
    });

    it('returns 201 and the new asset when a valid symbol is provided', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { authMiddleware } = require('../middleware/auth.middleware');
      const { AssetsController } = await import('../controllers/assets.controller');
      const pool = new Pool();
      const querySpy = jest.spyOn(pool, 'query');

      const inserted = { id: 11, symbol: 'NVDA', name: 'Nvidia', asset_type: 'stock', active: true, created_at: new Date(), updated_at: new Date() };
      querySpy.mockResolvedValueOnce(asQueryResponse([inserted]) as never);

      const controller = new AssetsController(pool);
      const app = express();
      app.use(express.json());
      app.post('/api/assets', authMiddleware, (req, res) => controller.addAsset(req, res));

      const token = makeToken();
      const response = await request(app)
        .post('/api/assets')
        .set(authHeader(token))
        .send({ symbol: 'nvda', name: 'Nvidia', asset_type: 'stock' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.asset.symbol).toBe('NVDA');

      // Confirm the symbol was uppercased in the DB call
      const params: unknown[] = (querySpy.mock.calls[0] as any[])[1];
      expect(params[0]).toBe('NVDA');

      querySpy.mockRestore();
      await pool.end();
    });

    it('returns 400 when symbol is missing', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { authMiddleware } = require('../middleware/auth.middleware');
      const { AssetsController } = await import('../controllers/assets.controller');
      const pool = new Pool();
      const querySpy = jest.spyOn(pool, 'query');

      const controller = new AssetsController(pool);
      const app = express();
      app.use(express.json());
      app.post('/api/assets', authMiddleware, (req, res) => controller.addAsset(req, res));

      const token = makeToken();
      const response = await request(app)
        .post('/api/assets')
        .set(authHeader(token))
        .send({ name: 'No Symbol' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('symbol is required');
      expect(querySpy).not.toHaveBeenCalled();

      querySpy.mockRestore();
      await pool.end();
    });

    it('returns 400 when symbol contains invalid characters', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { authMiddleware } = require('../middleware/auth.middleware');
      const { AssetsController } = await import('../controllers/assets.controller');
      const pool = new Pool();
      const querySpy = jest.spyOn(pool, 'query');

      const controller = new AssetsController(pool);
      const app = express();
      app.use(express.json());
      app.post('/api/assets', authMiddleware, (req, res) => controller.addAsset(req, res));

      const token = makeToken();
      const response = await request(app)
        .post('/api/assets')
        .set(authHeader(token))
        .send({ symbol: 'BAD/SYMBOL' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('symbol contains invalid characters');
      expect(querySpy).not.toHaveBeenCalled();

      querySpy.mockRestore();
      await pool.end();
    });
  });

  // =========================================================================
  // DELETE /api/assets/:symbol
  // =========================================================================

  describe('DELETE /api/assets/:symbol', () => {
    it('blocks unauthenticated requests with 401', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { authMiddleware } = require('../middleware/auth.middleware');
      const { AssetsController } = await import('../controllers/assets.controller');
      const pool = new Pool();
      const controller = new AssetsController(pool);

      const app = express();
      app.use(express.json());
      app.delete('/api/assets/:symbol', authMiddleware, (req, res) => controller.removeAsset(req, res));

      const response = await request(app).delete('/api/assets/PETR4');

      expect(response.status).toBe(401);
      await pool.end();
    });

    it('soft-deactivates an existing asset and returns 200', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { authMiddleware } = require('../middleware/auth.middleware');
      const { AssetsController } = await import('../controllers/assets.controller');
      const pool = new Pool();
      const querySpy = jest.spyOn(pool, 'query');

      querySpy.mockResolvedValueOnce(asQueryResponse([{ id: 1, symbol: 'PETR4' }], 1) as never);

      const controller = new AssetsController(pool);
      const app = express();
      app.use(express.json());
      app.delete('/api/assets/:symbol', authMiddleware, (req, res) => controller.removeAsset(req, res));

      const token = makeToken();
      const response = await request(app)
        .delete('/api/assets/PETR4')
        .set(authHeader(token));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Asset PETR4 deactivated');

      // Verify the UPDATE query used UPPER() comparison
      const sql: string = (querySpy.mock.calls[0] as any[])[0];
      expect(sql).toMatch(/UPDATE tracked_assets/i);
      expect(sql).toMatch(/active = FALSE/i);

      querySpy.mockRestore();
      await pool.end();
    });

    it('returns 404 when the asset does not exist', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { authMiddleware } = require('../middleware/auth.middleware');
      const { AssetsController } = await import('../controllers/assets.controller');
      const pool = new Pool();
      const querySpy = jest.spyOn(pool, 'query');

      querySpy.mockResolvedValueOnce(asQueryResponse([], 0) as never);

      const controller = new AssetsController(pool);
      const app = express();
      app.use(express.json());
      app.delete('/api/assets/:symbol', authMiddleware, (req, res) => controller.removeAsset(req, res));

      const token = makeToken();
      const response = await request(app)
        .delete('/api/assets/UNKNOWN')
        .set(authHeader(token));

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Asset not found');

      querySpy.mockRestore();
      await pool.end();
    });
  });
});
