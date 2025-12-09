/**
 * News Controller
 * Handles news fetching and sentiment analysis
 */
import { Request, Response } from 'express';
import { Pool } from 'pg';

export class NewsController {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Get recent news articles with sentiment
   */
  async getNews(req: Request, res: Response): Promise<void> {
    try {
      const { limit = 50, topic, sentiment } = req.query;
      
      let query = `
        SELECT 
          na.id,
          na.title,
          na.description,
          na.url,
          na.source,
          na.published_at,
          na.sentiment_score,
          CASE 
            WHEN na.sentiment_score > 0.2 THEN 'positive'
            WHEN na.sentiment_score < -0.2 THEN 'negative'
            ELSE 'neutral'
          END as sentiment,
          array_agg(DISTINCT s.symbol) FILTER (WHERE s.symbol IS NOT NULL) as related_stocks
        FROM news_articles na
        LEFT JOIN stock_news sn ON na.id = sn.news_id
        LEFT JOIN stocks s ON sn.stock_id = s.id
        WHERE 1=1
      `;

      const params: any[] = [];
      let paramCount = 1;

      if (topic) {
        query += ` AND na.title ILIKE $${paramCount}`;
        params.push(`%${topic}%`);
        paramCount++;
      }

      if (sentiment) {
        if (sentiment === 'positive') {
          query += ` AND na.sentiment_score > 0.2`;
        } else if (sentiment === 'negative') {
          query += ` AND na.sentiment_score < -0.2`;
        } else if (sentiment === 'neutral') {
          query += ` AND na.sentiment_score BETWEEN -0.2 AND 0.2`;
        }
      }

      query += `
        GROUP BY na.id, na.title, na.description, na.url, na.source, na.published_at, na.sentiment_score
        ORDER BY na.published_at DESC
        LIMIT $${paramCount}
      `;
      params.push(limit);

      const result = await this.pool.query(query, params);

      res.json({
        success: true,
        count: result.rows.length,
        news: result.rows,
      });
    } catch (error: any) {
      console.error('Error fetching news:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch news articles',
      });
    }
  }

  /**
   * Get news for a specific stock
   */
  async getStockNews(req: Request, res: Response): Promise<void> {
    try {
      const { symbol } = req.params;
      const { limit = 20 } = req.query;

      const query = `
        SELECT 
          na.id,
          na.title,
          na.description,
          na.url,
          na.source,
          na.published_at,
          na.sentiment_score,
          CASE 
            WHEN na.sentiment_score > 0.2 THEN 'positive'
            WHEN na.sentiment_score < -0.2 THEN 'negative'
            ELSE 'neutral'
          END as sentiment,
          sn.relevance_score
        FROM news_articles na
        INNER JOIN stock_news sn ON na.id = sn.news_id
        INNER JOIN stocks s ON sn.stock_id = s.id
        WHERE s.symbol = $1
        ORDER BY na.published_at DESC
        LIMIT $2
      `;

      const result = await this.pool.query(query, [symbol, limit]);

      res.json({
        success: true,
        symbol,
        count: result.rows.length,
        news: result.rows,
      });
    } catch (error: any) {
      console.error('Error fetching stock news:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch stock news',
      });
    }
  }

  /**
   * Get sentiment statistics
   */
  async getSentimentStats(req: Request, res: Response): Promise<void> {
    try {
      const query = `
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE sentiment_score > 0.2) as positive,
          COUNT(*) FILTER (WHERE sentiment_score < -0.2) as negative,
          COUNT(*) FILTER (WHERE sentiment_score BETWEEN -0.2 AND 0.2) as neutral,
          AVG(sentiment_score) as avg_sentiment
        FROM news_articles
        WHERE published_at > NOW() - INTERVAL '7 days'
      `;

      const result = await this.pool.query(query);
      const stats = result.rows[0];

      res.json({
        success: true,
        stats: {
          total: parseInt(stats.total),
          positive: parseInt(stats.positive),
          negative: parseInt(stats.negative),
          neutral: parseInt(stats.neutral),
          avgSentiment: parseFloat(stats.avg_sentiment) || 0,
          positivePercent: ((parseInt(stats.positive) / parseInt(stats.total)) * 100).toFixed(1),
          negativePercent: ((parseInt(stats.negative) / parseInt(stats.total)) * 100).toFixed(1),
          neutralPercent: ((parseInt(stats.neutral) / parseInt(stats.total)) * 100).toFixed(1),
        },
      });
    } catch (error: any) {
      console.error('Error fetching sentiment stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch sentiment statistics',
      });
    }
  }
}
