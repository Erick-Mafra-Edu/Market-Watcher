/**
 * Portfolio Controller
 * Handles user portfolio management and dividend tracking
 */
import { Request, Response } from 'express';
import { Pool } from 'pg';

interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
  };
}

export class PortfolioController {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Get user's portfolio positions
   */
  async getPortfolio(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      const query = `
        SELECT 
          s.symbol,
          s.name,
          SUM(CASE WHEN up.transaction_type = 'BUY' THEN up.quantity ELSE -up.quantity END) as total_quantity,
          AVG(CASE WHEN up.transaction_type = 'BUY' THEN up.purchase_price ELSE NULL END) as avg_purchase_price,
          MIN(up.purchase_date) as first_purchase_date,
          sp.price as current_price,
          sp.change_percent as daily_change,
          (sp.price * SUM(CASE WHEN up.transaction_type = 'BUY' THEN up.quantity ELSE -up.quantity END)) as current_value,
          (AVG(CASE WHEN up.transaction_type = 'BUY' THEN up.purchase_price ELSE NULL END) * 
           SUM(CASE WHEN up.transaction_type = 'BUY' THEN up.quantity ELSE -up.quantity END)) as invested_value,
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

      const positions = result.rows.map(row => {
        const currentValue = parseFloat(row.current_value) || 0;
        const investedValue = parseFloat(row.invested_value) || 0;
        const profitLoss = currentValue - investedValue;
        
        // Calculate profit/loss percentage
        const profitLossPercent = investedValue > 0
          ? ((profitLoss / investedValue) * 100).toFixed(2)
          : '0.00';

        return {
          symbol: row.symbol,
          name: row.name,
          quantity: parseFloat(row.total_quantity),
          avgPurchasePrice: parseFloat(row.avg_purchase_price) || 0,
          currentPrice: parseFloat(row.current_price) || 0,
          dailyChange: parseFloat(row.daily_change) || 0,
          currentValue,
          investedValue,
          profitLoss,
          profitLossPercent,
          dividendYield: parseFloat(row.dividend_yield) || 0,
          firstPurchaseDate: row.first_purchase_date,
        };
      });

      const totalInvested = positions.reduce((sum, p) => sum + p.investedValue, 0);
      const totalCurrent = positions.reduce((sum, p) => sum + p.currentValue, 0);
      const totalProfitLoss = totalCurrent - totalInvested;
      
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
      const userId = req.user?.id;
      const { symbol, quantity, price, date, type, notes } = req.body;

      if (!symbol || !quantity || !price || !date) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: symbol, quantity, price, date',
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
         (user_id, stock_id, quantity, purchase_price, purchase_date, transaction_type, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, stockId, quantity, price, date, type || 'BUY', notes]
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
      const userId = req.user?.id;
      const { symbol } = req.query;

      let query = `
        SELECT 
          up.id,
          s.symbol,
          s.name,
          up.quantity,
          up.purchase_price,
          up.purchase_date,
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

      query += ' ORDER BY up.purchase_date DESC';

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
   * Get dividend information for portfolio stocks
   */
  async getDividends(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

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
