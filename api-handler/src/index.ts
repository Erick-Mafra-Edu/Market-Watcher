/**
 * API Handler - Yahoo Finance integration service
 * Monitors stock prices and publishes data to RabbitMQ
 */
import express from 'express';
import yahooFinance from 'yahoo-finance2';
import amqp, { Channel, Connection } from 'amqplib';
import { Pool } from 'pg';

// Configuration
const RABBITMQ_HOST = process.env.RABBITMQ_HOST || 'rabbitmq';
const RABBITMQ_USER = process.env.RABBITMQ_USER || 'admin';
const RABBITMQ_PASS = process.env.RABBITMQ_PASS || 'admin';
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL || '300') * 1000;
const PORT = 3001;

// Database connection
const pool = new Pool({
  host: process.env.DATABASE_HOST || 'database',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME || 'market_watcher',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
});

interface StockData {
  symbol: string;
  price: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  timestamp: string;
}

class ApiHandler {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private app: express.Application;

  constructor() {
    this.app = express();
    this.app.use(express.json());
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', service: 'api-handler' });
    });

    // Endpoint to get stock quote
    this.app.get('/api/stock/:symbol', async (req, res) => {
      try {
        const { symbol } = req.params;
        const quote = await this.fetchStockQuote(symbol);
        res.json(quote);
      } catch (error: any) {
        console.error('Error fetching stock:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Endpoint to get historical data
    this.app.get('/api/stock/:symbol/history', async (req, res) => {
      try {
        const { symbol } = req.params;
        const period1 = req.query.period1 as string;
        const period2 = req.query.period2 as string;
        
        const history = await yahooFinance.historical(symbol, {
          period1: period1 || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          period2: period2 || new Date().toISOString().split('T')[0],
        });
        
        res.json(history);
      } catch (error: any) {
        console.error('Error fetching history:', error);
        res.status(500).json({ error: error.message });
      }
    });
  }

  async connectRabbitMQ(): Promise<void> {
    const maxRetries = 5;
    const retryDelay = 5000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const url = `amqp://${RABBITMQ_USER}:${RABBITMQ_PASS}@${RABBITMQ_HOST}:5672`;
        this.connection = await amqp.connect(url);
        this.channel = await this.connection.createChannel();

        // Declare exchanges and queues
        await this.channel.assertExchange('stock_prices', 'fanout', { durable: true });
        await this.channel.assertQueue('price_updates', { durable: true });
        await this.channel.bindQueue('price_updates', 'stock_prices', '');

        console.log('Successfully connected to RabbitMQ');
        return;
      } catch (error) {
        console.error(`Failed to connect to RabbitMQ (attempt ${attempt + 1}/${maxRetries}):`, error);
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          throw error;
        }
      }
    }
  }

  async fetchStockQuote(symbol: string): Promise<any> {
    try {
      const quote = await yahooFinance.quote(symbol);
      return {
        symbol: quote.symbol,
        price: quote.regularMarketPrice,
        changePercent: quote.regularMarketChangePercent,
        volume: quote.regularMarketVolume,
        marketCap: quote.marketCap,
        name: quote.longName || quote.shortName,
      };
    } catch (error) {
      console.error(`Error fetching quote for ${symbol}:`, error);
      throw error;
    }
  }

  async publishStockData(data: StockData): Promise<void> {
    if (!this.channel) {
      console.error('RabbitMQ channel not available');
      return;
    }

    try {
      const message = JSON.stringify(data);
      this.channel.publish('stock_prices', '', Buffer.from(message), {
        persistent: true,
        contentType: 'application/json',
      });
      console.log(`Published stock data for ${data.symbol}`);
    } catch (error) {
      console.error('Error publishing stock data:', error);
    }
  }

  async saveStockPrice(data: StockData): Promise<void> {
    try {
      // First, ensure stock exists
      const stockResult = await pool.query(
        'INSERT INTO stocks (symbol, name) VALUES ($1, $2) ON CONFLICT (symbol) DO UPDATE SET updated_at = CURRENT_TIMESTAMP RETURNING id',
        [data.symbol, data.symbol]
      );
      const stockId = stockResult.rows[0].id;

      // Save price data
      await pool.query(
        'INSERT INTO stock_prices (stock_id, price, change_percent, volume, market_cap) VALUES ($1, $2, $3, $4, $5)',
        [stockId, data.price, data.changePercent, data.volume, data.marketCap]
      );

      console.log(`Saved stock price for ${data.symbol} to database`);
    } catch (error) {
      console.error('Error saving stock price to database:', error);
    }
  }

  async getWatchedStocks(): Promise<string[]> {
    try {
      const result = await pool.query(
        'SELECT DISTINCT s.symbol FROM stocks s INNER JOIN user_watchlist uw ON s.id = uw.stock_id'
      );
      return result.rows.map(row => row.symbol);
    } catch (error) {
      console.error('Error getting watched stocks:', error);
      return [];
    }
  }

  async monitorStocks(): Promise<void> {
    console.log('Starting stock monitoring...');

    while (true) {
      try {
        const watchedStocks = await this.getWatchedStocks();
        
        // Default stocks if no watchlist exists
        const stocksToMonitor = watchedStocks.length > 0 
          ? watchedStocks 
          : ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'BTC-USD', 'ETH-USD'];

        console.log(`Monitoring ${stocksToMonitor.length} stocks:`, stocksToMonitor.join(', '));

        for (const symbol of stocksToMonitor) {
          try {
            const quote = await this.fetchStockQuote(symbol);
            
            const stockData: StockData = {
              symbol: quote.symbol,
              price: quote.price || 0,
              changePercent: quote.changePercent || 0,
              volume: quote.volume || 0,
              marketCap: quote.marketCap || 0,
              timestamp: new Date().toISOString(),
            };

            // Save to database
            await this.saveStockPrice(stockData);

            // Publish to RabbitMQ
            await this.publishStockData(stockData);

            // Small delay between API calls
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (error) {
            console.error(`Error processing ${symbol}:`, error);
          }
        }

        console.log(`Stock check cycle completed. Sleeping for ${CHECK_INTERVAL / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL));
      } catch (error) {
        console.error('Error in monitoring loop:', error);
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }
  }

  async start(): Promise<void> {
    try {
      // Connect to RabbitMQ
      await this.connectRabbitMQ();

      // Start Express server
      this.app.listen(PORT, () => {
        console.log(`API Handler listening on port ${PORT}`);
      });

      // Start monitoring stocks
      await this.monitorStocks();
    } catch (error) {
      console.error('Failed to start API Handler:', error);
      process.exit(1);
    }
  }

  async close(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
    await pool.end();
    console.log('API Handler closed');
  }
}

// Start the service
const handler = new ApiHandler();

process.on('SIGINT', async () => {
  console.log('Shutting down API Handler...');
  await handler.close();
  process.exit(0);
});

handler.start();
