/**
 * Assets Controller
 * Manages the list of tracked assets used for dynamic news fetching
 */
import { Request, Response } from 'express';
import { Pool } from 'pg';

const DEFAULT_ASSET_TYPE = 'stock';
const SYMBOL_PATTERN = /^[A-Z0-9.\-]{1,20}$/i;

export class AssetsController {
  constructor(private pool: Pool) {}

  /**
   * List all tracked assets
   */
  async getAssets(req: Request, res: Response): Promise<void> {
    try {
      const activeOnly = req.query.active !== 'false';
      const query = activeOnly
        ? 'SELECT id, symbol, name, asset_type, active, created_at, updated_at FROM tracked_assets WHERE active = TRUE ORDER BY symbol ASC'
        : 'SELECT id, symbol, name, asset_type, active, created_at, updated_at FROM tracked_assets ORDER BY symbol ASC';

      const result = await this.pool.query(query);
      res.json({ success: true, count: result.rows.length, assets: result.rows });
    } catch (error) {
      console.error('Error fetching tracked assets:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch tracked assets' });
    }
  }

  /**
   * Add a new tracked asset
   */
  async addAsset(req: Request, res: Response): Promise<void> {
    try {
      const { symbol, name, asset_type } = req.body;

      if (!symbol || typeof symbol !== 'string' || !symbol.trim()) {
        res.status(400).json({ success: false, error: 'symbol is required' });
        return;
      }

      const normalizedSymbol = symbol.trim().toUpperCase();

      if (!SYMBOL_PATTERN.test(normalizedSymbol)) {
        res.status(400).json({ success: false, error: 'symbol contains invalid characters' });
        return;
      }

      const result = await this.pool.query(
        `INSERT INTO tracked_assets (symbol, name, asset_type)
         VALUES ($1, $2, $3)
         ON CONFLICT (symbol) DO UPDATE
           SET name = COALESCE(EXCLUDED.name, tracked_assets.name),
               asset_type = COALESCE(EXCLUDED.asset_type, tracked_assets.asset_type),
               active = TRUE,
               updated_at = CURRENT_TIMESTAMP
         RETURNING id, symbol, name, asset_type, active, created_at, updated_at`,
        [normalizedSymbol, name?.trim() || normalizedSymbol, asset_type?.trim() || DEFAULT_ASSET_TYPE]
      );

      res.status(201).json({ success: true, asset: result.rows[0] });
    } catch (error) {
      console.error('Error adding tracked asset:', error);
      res.status(500).json({ success: false, error: 'Failed to add tracked asset' });
    }
  }

  /**
   * Remove a tracked asset (soft-delete by setting active = FALSE)
   */
  async removeAsset(req: Request, res: Response): Promise<void> {
    try {
      const { symbol } = req.params;

      const result = await this.pool.query(
        `UPDATE tracked_assets SET active = FALSE, updated_at = CURRENT_TIMESTAMP
         WHERE UPPER(symbol) = UPPER($1)
         RETURNING id, symbol`,
        [symbol]
      );

      if (result.rowCount === 0) {
        res.status(404).json({ success: false, error: 'Asset not found' });
        return;
      }

      res.json({ success: true, message: `Asset ${symbol.toUpperCase()} deactivated` });
    } catch (error) {
      console.error('Error removing tracked asset:', error);
      res.status(500).json({ success: false, error: 'Failed to remove tracked asset' });
    }
  }
}
