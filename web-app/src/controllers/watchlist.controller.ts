/**
 * Watchlist Controller
 */
import { Response } from 'express';
import { Pool } from 'pg';
import { AuthRequest } from '../middleware/auth.middleware';

export class WatchlistController {
  constructor(private pool: Pool) {}

  async getWatchlist(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;

      const result = await this.pool.query(
        `SELECT s.id, s.symbol, s.name, uw.min_price_change, uw.created_at
         FROM user_watchlist uw
         INNER JOIN stocks s ON uw.stock_id = s.id
         WHERE uw.user_id = $1
         ORDER BY uw.created_at DESC`,
        [userId]
      );

      res.json({ watchlist: result.rows });
    } catch (error) {
      console.error('Get watchlist error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async addToWatchlist(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;
      const { symbol, minPriceChange } = req.body;

      if (!symbol) {
        res.status(400).json({ error: 'Symbol is required' });
        return;
      }

      // Ensure stock exists
      let stockResult = await this.pool.query(
        'SELECT id FROM stocks WHERE symbol = $1',
        [symbol.toUpperCase()]
      );

      let stockId: number;
      if (stockResult.rows.length === 0) {
        // Create stock
        const insertResult = await this.pool.query(
          'INSERT INTO stocks (symbol, name) VALUES ($1, $2) RETURNING id',
          [symbol.toUpperCase(), symbol.toUpperCase()]
        );
        stockId = insertResult.rows[0].id;
      } else {
        stockId = stockResult.rows[0].id;
      }

      // Add to watchlist
      await this.pool.query(
        'INSERT INTO user_watchlist (user_id, stock_id, min_price_change) VALUES ($1, $2, $3) ON CONFLICT (user_id, stock_id) DO UPDATE SET min_price_change = $3',
        [userId, stockId, minPriceChange || 5.0]
      );

      res.status(201).json({ message: 'Added to watchlist successfully' });
    } catch (error) {
      console.error('Add to watchlist error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async removeFromWatchlist(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;
      const { symbol } = req.params;

      const result = await this.pool.query(
        `DELETE FROM user_watchlist 
         WHERE user_id = $1 AND stock_id = (SELECT id FROM stocks WHERE symbol = $2)`,
        [userId, symbol.toUpperCase()]
      );

      if (result.rowCount === 0) {
        res.status(404).json({ error: 'Stock not in watchlist' });
        return;
      }

      res.json({ message: 'Removed from watchlist successfully' });
    } catch (error) {
      console.error('Remove from watchlist error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
