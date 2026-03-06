import { Request, Response } from 'express';
import { Pool } from 'pg';

export class StatsController {
  constructor(private pool: Pool) {}

  /**
   * Get application statistics
   * GET /api/stats
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      // Aggregate various stats from the database
      const [
        userStats,
        watchlistStats,
        alertStats,
        newsStats,
        portfolioStats,
        dividendStats,
      ] = await Promise.all([
        this.getUserStats(),
        this.getWatchlistStats(),
        this.getAlertStats(),
        this.getNewsStats(),
        this.getPortfolioStats(),
        this.getDividendStats(),
      ]);

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        stats: {
          users: userStats,
          watchlist: watchlistStats,
          alerts: alertStats,
          news: newsStats,
          portfolio: portfolioStats,
          dividends: dividendStats,
        },
      });
    } catch (error: any) {
      console.error('Error fetching stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch statistics',
      });
    }
  }

  private async getUserStats() {
    const result = await this.pool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as new_users_7d,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as new_users_30d
      FROM users
    `);
    return result.rows[0];
  }

  private async getWatchlistStats() {
    const result = await this.pool.query(`
      SELECT 
        COUNT(*) as total_items,
        COUNT(DISTINCT user_id) as users_with_watchlist,
        AVG(items_per_user) as avg_items_per_user
      FROM (
        SELECT user_id, COUNT(*) as items_per_user
        FROM user_watchlist
        GROUP BY user_id
      ) subq
    `);
    const topStocks = await this.pool.query(`
      SELECT symbol, COUNT(*) as watchers
      FROM user_watchlist
      GROUP BY symbol
      ORDER BY watchers DESC
      LIMIT 10
    `);
    return {
      ...result.rows[0],
      avg_items_per_user: parseFloat(result.rows[0].avg_items_per_user || 0).toFixed(2),
      top_watched_stocks: topStocks.rows,
    };
  }

  private async getAlertStats() {
    const result = await this.pool.query(`
      SELECT 
        COUNT(*) as total_alerts,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as alerts_24h,
        COUNT(*) FILTER (WHERE is_read = false) as unread_alerts,
        COUNT(DISTINCT user_id) as users_with_alerts
      FROM alerts
    `);
    return result.rows[0];
  }

  private async getNewsStats() {
    const result = await this.pool.query(`
      SELECT 
        COUNT(*) as total_articles,
        COUNT(*) FILTER (WHERE published_at > NOW() - INTERVAL '24 hours') as articles_24h,
        COUNT(*) FILTER (WHERE sentiment = 'positive') as positive_sentiment,
        COUNT(*) FILTER (WHERE sentiment = 'negative') as negative_sentiment,
        COUNT(*) FILTER (WHERE sentiment = 'neutral') as neutral_sentiment,
        AVG(sentiment_score) as avg_sentiment_score
      FROM news_articles
    `);
    return {
      ...result.rows[0],
      avg_sentiment_score: parseFloat(result.rows[0].avg_sentiment_score || 0).toFixed(4),
    };
  }

  private async getPortfolioStats() {
    const result = await this.pool.query(`
      SELECT 
        COUNT(DISTINCT portfolio_id) as total_portfolios,
        COUNT(*) as total_transactions,
        COUNT(*) FILTER (WHERE type = 'buy') as buy_transactions,
        COUNT(*) FILTER (WHERE type = 'sell') as sell_transactions,
        COUNT(*) FILTER (WHERE type = 'dividend') as dividend_transactions,
        SUM(total_amount) FILTER (WHERE type = 'buy') as total_invested,
        SUM(total_amount) FILTER (WHERE type = 'sell') as total_divested
      FROM portfolio_transactions
    `);
    return result.rows[0];
  }

  private async getDividendStats() {
    const result = await this.pool.query(`
      SELECT 
        COUNT(*) as total_dividend_records,
        COUNT(DISTINCT stock_id) as stocks_with_dividends,
        SUM(dividend_amount) as total_dividends_value,
        AVG(dividend_amount) as avg_dividend_amount,
        COUNT(*) FILTER (WHERE ex_date > NOW()) as upcoming_dividends,
        COUNT(*) FILTER (WHERE ex_date > NOW() - INTERVAL '30 days' AND ex_date <= NOW()) as dividends_last_30d
      FROM dividend_history
    `);
    return {
      ...result.rows[0],
      total_dividends_value: parseFloat(result.rows[0].total_dividends_value || 0).toFixed(2),
      avg_dividend_amount: parseFloat(result.rows[0].avg_dividend_amount || 0).toFixed(2),
    };
  }
}
