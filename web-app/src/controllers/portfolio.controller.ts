/**
 * Portfolio Controller
 * Handles user portfolio management and dividend tracking
 */
import { Request, Response } from 'express';
import { Pool } from 'pg';
import axios from 'axios';
import { AuthRequest } from '../middleware/auth.middleware';

const API_HANDLER_URL = process.env.API_HANDLER_URL || 'http://api-handler:3001';

export class PortfolioController {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  private async fetchLiveQuote(symbol: string): Promise<{ price: number; changePercent: number } | null> {
    try {
      const response = await axios.get(`${API_HANDLER_URL}/api/stock/${symbol}`, {
        timeout: 4000,
      });

      const price = Number(response.data?.price);
      const changePercent = Number(response.data?.changePercent ?? 0);

      if (!Number.isFinite(price) || price <= 0) {
        return null;
      }

      return {
        price,
        changePercent: Number.isFinite(changePercent) ? changePercent : 0,
      };
    } catch (error) {
      return null;
    }
  }

  private hasValidTransactionInput(payload: {
    symbol?: string;
    quantity?: number;
    price?: number;
    date?: string;
  }): boolean {
    return Boolean(
      payload.symbol &&
      payload.date &&
      Number(payload.quantity) > 0 &&
      Number(payload.price) > 0
    );
  }

  private normalizeTransactionType(type?: string): 'BUY' | 'SELL' {
    return (type || 'BUY').toUpperCase() === 'SELL' ? 'SELL' : 'BUY';
  }

  /**
   * Get user's portfolio positions
   */
  async getPortfolio(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;

      const query = `
        SELECT 
          s.symbol,
          s.name,
          SUM(CASE WHEN up.transaction_type = 'BUY' THEN up.quantity ELSE -up.quantity END) as total_quantity,
          (SUM(CASE WHEN up.transaction_type = 'BUY' THEN (up.quantity * up.purchase_price) ELSE 0 END) /
           NULLIF(SUM(CASE WHEN up.transaction_type = 'BUY' THEN up.quantity ELSE 0 END), 0)) as avg_purchase_price,
          (SUM(CASE WHEN up.transaction_type = 'SELL' THEN (up.quantity * up.purchase_price) ELSE 0 END) /
           NULLIF(SUM(CASE WHEN up.transaction_type = 'SELL' THEN up.quantity ELSE 0 END), 0)) as avg_sell_price,
          MIN(up.purchase_date) as first_purchase_date,
          MAX(CASE WHEN up.transaction_type = 'BUY' THEN up.purchase_date ELSE NULL END) as last_purchase_date,
          MAX(CASE WHEN up.transaction_type = 'SELL' THEN COALESCE(up.sale_date, up.purchase_date) ELSE NULL END) as last_sell_date,
          SUM(CASE WHEN up.transaction_type = 'SELL' THEN up.quantity ELSE 0 END) as total_sold_quantity,
          (
            SUM(CASE WHEN up.transaction_type = 'SELL' THEN (up.quantity * up.purchase_price) ELSE 0 END)
            -
            (
              SUM(CASE WHEN up.transaction_type = 'SELL' THEN up.quantity ELSE 0 END)
              *
              (
                SUM(CASE WHEN up.transaction_type = 'BUY' THEN (up.quantity * up.purchase_price) ELSE 0 END)
                /
                NULLIF(SUM(CASE WHEN up.transaction_type = 'BUY' THEN up.quantity ELSE 0 END), 0)
              )
            )
          ) as realized_profit,
          sp.price as current_price,
          sp.change_percent as daily_change,
          (sp.price * SUM(CASE WHEN up.transaction_type = 'BUY' THEN up.quantity ELSE -up.quantity END)) as current_value,
          (
            (
              SUM(CASE WHEN up.transaction_type = 'BUY' THEN (up.quantity * up.purchase_price) ELSE 0 END) /
              NULLIF(SUM(CASE WHEN up.transaction_type = 'BUY' THEN up.quantity ELSE 0 END), 0)
            )
            * SUM(CASE WHEN up.transaction_type = 'BUY' THEN up.quantity ELSE -up.quantity END)
          ) as invested_value,
          sid.dividend_yield
        FROM user_portfolio up
        INNER JOIN stocks s ON up.stock_id = s.id
        LEFT JOIN LATERAL (
          SELECT price, change_percent
          FROM stock_prices
          WHERE stock_id = s.id
          ORDER BY recorded_at DESC
          LIMIT 1
        ) sp ON true
        LEFT JOIN LATERAL (
          SELECT dividend_yield
          FROM status_invest_data
          WHERE stock_id = s.id
          ORDER BY updated_at DESC
          LIMIT 1
        ) sid ON true
        WHERE up.user_id = $1
        GROUP BY s.id, s.symbol, s.name, sp.price, sp.change_percent, sid.dividend_yield
        HAVING SUM(CASE WHEN up.transaction_type = 'BUY' THEN up.quantity ELSE -up.quantity END) > 0
        ORDER BY current_value DESC
      `;

      const result = await this.pool.query(query, [userId]);

      const basePositions = result.rows.map(row => {
        const avgPurchasePrice = parseFloat(row.avg_purchase_price) || 0;
        const dbCurrentPrice = parseFloat(row.current_price) || 0;

        return {
          symbol: row.symbol,
          name: row.name,
          quantity: parseFloat(row.total_quantity),
          avgPurchasePrice,
          avgSellPrice: parseFloat(row.avg_sell_price) || 0,
          currentPrice: dbCurrentPrice > 0 ? dbCurrentPrice : avgPurchasePrice,
          dailyChange: parseFloat(row.daily_change) || 0,
          dividendYield: parseFloat(row.dividend_yield) || 0,
          firstPurchaseDate: row.first_purchase_date,
          lastPurchaseDate: row.last_purchase_date,
          lastSellDate: row.last_sell_date,
          totalSoldQuantity: parseFloat(row.total_sold_quantity) || 0,
          realizedProfit: parseFloat(row.realized_profit) || 0,
        };
      });

      const positions = await Promise.all(basePositions.map(async (position) => {
        const liveQuote = await this.fetchLiveQuote(position.symbol);
        const currentPrice = liveQuote?.price ?? position.currentPrice;
        const dailyChange = liveQuote?.changePercent ?? position.dailyChange;
        const investedValue = position.avgPurchasePrice * position.quantity;
        const currentValue = currentPrice * position.quantity;
        const profitLoss = currentValue - investedValue;
        const profitLossPercent = investedValue > 0
          ? ((profitLoss / investedValue) * 100).toFixed(2)
          : '0.00';

        return {
          ...position,
          currentPrice,
          dailyChange,
          currentValue,
          investedValue,
          profitLoss,
          profitLossPercent,
        };
      }));

      const totalInvested = positions.reduce((sum, p) => sum + p.investedValue, 0);
      const totalCurrent = positions.reduce((sum, p) => sum + p.currentValue, 0);
      const totalProfitLoss = totalCurrent - totalInvested;
      const totalRealizedProfit = positions.reduce((sum, p) => sum + p.realizedProfit, 0);
      
      // Calculate total return percentage
      const totalProfitLossPercent = totalInvested > 0
        ? ((totalProfitLoss / totalInvested) * 100).toFixed(2)
        : '0.00';

      res.json({
        success: true,
        portfolio: {
          positions,
          summary: {
            totalInvested,
            totalCurrent,
            totalProfitLoss,
            totalProfitLossPercent,
            totalRealizedProfit,
            totalCombinedProfit: totalProfitLoss + totalRealizedProfit,
            positionsCount: positions.length,
          },
        },
      });
    } catch (error: any) {
      console.error('Error fetching portfolio:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch portfolio',
      });
    }
  }

  /**
   * Add transaction to portfolio
   */
  async addTransaction(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;
      const { symbol, quantity, price, date, purchaseDate, saleDate, type, notes } = req.body;
      const normalizedType = this.normalizeTransactionType(type);
      const transactionDate = normalizedType === 'SELL'
        ? (saleDate || date)
        : (purchaseDate || date);

      if (!this.hasValidTransactionInput({ symbol, quantity, price, date: transactionDate })) {
        res.status(400).json({
          success: false,
          error: 'Missing or invalid fields: symbol, quantity, price, and purchaseDate/saleDate',
        });
        return;
      }

      // Get or create stock
      let stockResult = await this.pool.query(
        'SELECT id FROM stocks WHERE symbol = $1',
        [symbol.toUpperCase()]
      );

      let stockId;
      if (stockResult.rows.length === 0) {
        const insertResult = await this.pool.query(
          'INSERT INTO stocks (symbol, name) VALUES ($1, $2) RETURNING id',
          [symbol.toUpperCase(), symbol.toUpperCase()]
        );
        stockId = insertResult.rows[0].id;
      } else {
        stockId = stockResult.rows[0].id;
      }

      // Insert transaction
      await this.pool.query(
        `INSERT INTO user_portfolio 
         (user_id, stock_id, quantity, purchase_price, purchase_date, sale_date, transaction_type, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          userId,
          stockId,
          quantity,
          price,
          transactionDate,
          normalizedType === 'SELL' ? transactionDate : null,
          normalizedType,
          notes,
        ]
      );

      res.json({
        success: true,
        message: 'Transaction added successfully',
      });
    } catch (error: any) {
      console.error('Error adding transaction:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add transaction',
      });
    }
  }

  /**
   * Get transaction history
   */
  async getTransactions(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;
      const { symbol } = req.query;

      let query = `
        SELECT 
          up.id,
          s.symbol,
          s.name,
          up.quantity,
          up.purchase_price,
          up.purchase_date,
          up.sale_date,
          COALESCE(up.sale_date, up.purchase_date) as transaction_date,
          up.transaction_type,
          up.notes,
          up.created_at
        FROM user_portfolio up
        INNER JOIN stocks s ON up.stock_id = s.id
        WHERE up.user_id = $1
      `;

      const params: any[] = [userId];

      if (symbol) {
        query += ' AND s.symbol = $2';
        params.push(symbol);
      }

      query += ' ORDER BY COALESCE(up.sale_date, up.purchase_date) DESC';

      const result = await this.pool.query(query, params);

      res.json({
        success: true,
        transactions: result.rows,
      });
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch transactions',
      });
    }
  }

  /**
   * Update an existing portfolio transaction
   */
  async updateTransaction(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;
      const transactionId = parseInt(req.params.transactionId, 10);
      const { symbol, quantity, price, date, purchaseDate, saleDate, type, notes } = req.body;
      const normalizedType = this.normalizeTransactionType(type);
      const transactionDate = normalizedType === 'SELL'
        ? (saleDate || date)
        : (purchaseDate || date);

      if (!Number.isInteger(transactionId) || transactionId <= 0) {
        res.status(400).json({
          success: false,
          error: 'Invalid transaction id',
        });
        return;
      }

      if (!this.hasValidTransactionInput({ symbol, quantity, price, date: transactionDate })) {
        res.status(400).json({
          success: false,
          error: 'Missing or invalid fields: symbol, quantity, price, and purchaseDate/saleDate',
        });
        return;
      }

      const stockResult = await this.pool.query(
        'SELECT id FROM stocks WHERE symbol = $1',
        [symbol.toUpperCase()]
      );

      let stockId: number;
      if (stockResult.rows.length === 0) {
        const inserted = await this.pool.query(
          'INSERT INTO stocks (symbol, name) VALUES ($1, $2) RETURNING id',
          [symbol.toUpperCase(), symbol.toUpperCase()]
        );
        stockId = inserted.rows[0].id;
      } else {
        stockId = stockResult.rows[0].id;
      }

      const result = await this.pool.query(
        `UPDATE user_portfolio
         SET stock_id = $1,
             quantity = $2,
             purchase_price = $3,
             purchase_date = $4,
             sale_date = $5,
             transaction_type = $6,
             notes = $7
         WHERE id = $8 AND user_id = $9
         RETURNING id`,
        [
          stockId,
          quantity,
          price,
          transactionDate,
          normalizedType === 'SELL' ? transactionDate : null,
          normalizedType,
          notes || null,
          transactionId,
          userId,
        ]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Transaction not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Transaction updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating transaction:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update transaction',
      });
    }
  }

  /**
   * Remove a portfolio transaction (useful for correcting wrong entries)
   */
  async deleteTransaction(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;
      const transactionId = parseInt(req.params.transactionId, 10);

      if (!Number.isInteger(transactionId) || transactionId <= 0) {
        res.status(400).json({
          success: false,
          error: 'Invalid transaction id',
        });
        return;
      }

      const result = await this.pool.query(
        `DELETE FROM user_portfolio
         WHERE id = $1 AND user_id = $2
         RETURNING id`,
        [transactionId, userId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Transaction not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Transaction removed successfully',
      });
    } catch (error: any) {
      console.error('Error removing transaction:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to remove transaction',
      });
    }
  }

  /**
   * Remove all transactions for a symbol from user portfolio
   */
  async deletePosition(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;
      const symbol = (req.params.symbol || '').toUpperCase();

      if (!symbol) {
        res.status(400).json({
          success: false,
          error: 'Symbol is required',
        });
        return;
      }

      const result = await this.pool.query(
        `DELETE FROM user_portfolio up
         USING stocks s
         WHERE up.stock_id = s.id
           AND up.user_id = $1
           AND s.symbol = $2
         RETURNING up.id`,
        [userId, symbol]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'No position found for this symbol',
        });
        return;
      }

      res.json({
        success: true,
        message: `Position ${symbol} removed successfully`,
        removedTransactions: result.rows.length,
      });
    } catch (error: any) {
      console.error('Error removing position:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to remove position',
      });
    }
  }

  /**
   * Get daily portfolio performance series (value vs invested)
   */
  async getPerformance(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;
      const rawDays = Number(req.query.days || 90);
      const days = Math.max(7, Math.min(365, Number.isFinite(rawDays) ? rawDays : 90));

      const query = `
        WITH days AS (
          SELECT generate_series(
            CURRENT_DATE - (($2::int - 1) * INTERVAL '1 day'),
            CURRENT_DATE,
            INTERVAL '1 day'
          )::date AS day
        ),
        user_stocks AS (
          SELECT DISTINCT stock_id
          FROM user_portfolio
          WHERE user_id = $1
        ),
        daily_positions AS (
          SELECT
            d.day,
            us.stock_id,
            COALESCE(SUM(CASE WHEN up.transaction_type = 'BUY' THEN up.quantity ELSE -up.quantity END), 0) AS quantity,
            COALESCE(SUM(CASE WHEN up.transaction_type = 'BUY' THEN (up.quantity * up.purchase_price) ELSE 0 END), 0) AS buy_cost,
            COALESCE(SUM(CASE WHEN up.transaction_type = 'BUY' THEN up.quantity ELSE 0 END), 0) AS buy_qty
          FROM days d
          CROSS JOIN user_stocks us
          LEFT JOIN user_portfolio up
            ON up.user_id = $1
           AND up.stock_id = us.stock_id
           AND up.purchase_date::date <= d.day
          GROUP BY d.day, us.stock_id
        ),
        priced_positions AS (
          SELECT
            dp.day,
            dp.stock_id,
            dp.quantity,
            CASE WHEN dp.buy_qty > 0 THEN dp.buy_cost / dp.buy_qty ELSE 0 END AS avg_buy_price,
            COALESCE(
              (
                SELECT sp.price
                FROM stock_prices sp
                WHERE sp.stock_id = dp.stock_id
                  AND sp.recorded_at::date <= dp.day
                ORDER BY sp.recorded_at DESC
                LIMIT 1
              ),
              CASE WHEN dp.buy_qty > 0 THEN dp.buy_cost / dp.buy_qty ELSE 0 END
            ) AS effective_price
          FROM daily_positions dp
          WHERE dp.quantity > 0
        ),
        daily_totals AS (
          SELECT
            day,
            SUM(quantity * effective_price) AS total_value,
            SUM(quantity * avg_buy_price) AS invested_value
          FROM priced_positions
          GROUP BY day
        )
        SELECT
          d.day,
          COALESCE(dt.total_value, 0) AS total_value,
          COALESCE(dt.invested_value, 0) AS invested_value,
          COALESCE(dt.total_value, 0) - COALESCE(dt.invested_value, 0) AS profit_loss
        FROM days d
        LEFT JOIN daily_totals dt ON dt.day = d.day
        ORDER BY d.day ASC
      `;

      const result = await this.pool.query(query, [userId, days]);

      res.json({
        success: true,
        days,
        series: result.rows,
      });
    } catch (error: any) {
      console.error('Error fetching portfolio performance:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch portfolio performance',
      });
    }
  }

  /**
   * Get dividend information for portfolio stocks
   */
  async getDividends(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;

      const query = `
        SELECT 
          s.symbol,
          s.name,
          dh.dividend_amount,
          dh.ex_date,
          dh.payment_date,
          dh.dividend_type,
          sid.dividend_yield,
          SUM(CASE WHEN up.transaction_type = 'BUY' THEN up.quantity ELSE -up.quantity END) as quantity,
          (dh.dividend_amount * SUM(CASE WHEN up.transaction_type = 'BUY' THEN up.quantity ELSE -up.quantity END)) as estimated_payment
        FROM user_portfolio up
        INNER JOIN stocks s ON up.stock_id = s.id
        LEFT JOIN dividend_history dh ON s.id = dh.stock_id
        LEFT JOIN LATERAL (
          SELECT dividend_yield
          FROM status_invest_data
          WHERE stock_id = s.id
          ORDER BY updated_at DESC
          LIMIT 1
        ) sid ON true
        WHERE up.user_id = $1
        AND dh.ex_date IS NOT NULL
        GROUP BY s.id, s.symbol, s.name, dh.id, dh.dividend_amount, dh.ex_date, dh.payment_date, dh.dividend_type, sid.dividend_yield
        HAVING SUM(CASE WHEN up.transaction_type = 'BUY' THEN up.quantity ELSE -up.quantity END) > 0
        ORDER BY dh.ex_date DESC
        LIMIT 50
      `;

      const result = await this.pool.query(query, [userId]);

      res.json({
        success: true,
        dividends: result.rows,
      });
    } catch (error: any) {
      console.error('Error fetching dividends:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dividend information',
      });
    }
  }
}
