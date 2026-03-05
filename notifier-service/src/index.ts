/**
 * Notifier Service
 * Multi-channel alert notification service with SMTP, Twilio, and WhatsApp support
 */
import amqp, { Channel, ChannelModel } from 'amqplib';
import { Pool } from 'pg';
import {
  MessagingManager,
  SMTPProvider,
  TwilioProvider,
  WhatsAppProvider,
  MessageContent,
  MessageFormat,
  MessageRecipient,
} from './messaging';
import { SentimentAnalyzer } from './sentiment.service';

// Configuration
const RABBITMQ_HOST = process.env.RABBITMQ_HOST || 'rabbitmq';
const RABBITMQ_USER = process.env.RABBITMQ_USER || 'admin';
const RABBITMQ_PASS = process.env.RABBITMQ_PASS || 'admin';

// Database connection
const pool = new Pool({
  host: process.env.DATABASE_HOST || 'database',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME || 'market_watcher',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
});

interface NewsData {
  title: string;
  description: string;
  url: string;
  source: string;
  published_at: string;
  topic: string;
}

interface StockData {
  symbol: string;
  price: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  timestamp: string;
}

interface FundamentalData {
  symbol: string;
  dividend_yield: number | null;
  p_vp: number | null;
  p_l: number | null;
  roe: number | null;
  liquidity: number | null;
  scraped_at: string;
}

interface DividendEventData {
  symbol: string;
  dividend_amount: number;
  ex_date: string;
  payment_date?: string | null;
  dividend_type?: string | null;
  source?: string | null;
  scraped_at?: string;
}

interface AlertUser {
  id: number;
  email: string;
  name?: string;
  phone?: string;
  whatsapp?: string;
}

export class NotifierService {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private messagingManager: MessagingManager;
  private sentimentAnalyzer: SentimentAnalyzer;
  private newsCache: Map<string, NewsData[]> = new Map();
  private stockCache: Map<string, StockData> = new Map();
  private fundamentalsCache: Map<string, FundamentalData> = new Map();

  private readonly maxPLThreshold = parseFloat(process.env.ALERT_MAX_PL || '35');
  private readonly maxPVpThreshold = parseFloat(process.env.ALERT_MAX_PVP || '6');
  private readonly minRoeThreshold = parseFloat(process.env.ALERT_MIN_ROE || '0');
  private readonly minLiquidityThreshold = parseFloat(process.env.ALERT_MIN_LIQUIDITY || '0');
  private readonly alertCooldownMinutes = parseInt(process.env.ALERT_COOLDOWN_MINUTES || '30');
  private readonly emailOnlyMode = process.env.NOTIFICATION_CHANNEL_MODE !== 'multi';
  private readonly commonTickerStopwords = new Set([
    'A',
    'AN',
    'AND',
    'ARE',
    'AS',
    'AT',
    'BE',
    'BY',
    'CEO',
    'CFO',
    'FOR',
    'FROM',
    'GDP',
    'IN',
    'IS',
    'IT',
    'ITS',
    'OF',
    'ON',
    'OR',
    'THE',
    'TO',
    'US',
    'USA',
    'WITH',
  ]);

  constructor() {
    this.messagingManager = new MessagingManager();
    this.sentimentAnalyzer = new SentimentAnalyzer();
    this.setupMessagingProviders();
  }

  private setupMessagingProviders(): void {
    // Setup SMTP Provider
    if (process.env.SMTP_HOST) {
      const smtpProvider = new SMTPProvider({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER && process.env.SMTP_PASS
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            }
          : undefined,
        from: process.env.SMTP_FROM || 'Market Watcher <noreply@marketwatcher.com>',
      });
      this.messagingManager.registerProvider(smtpProvider);
    }

    // Setup Twilio Provider
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER) {
      const twilioProvider = new TwilioProvider({
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        fromNumber: process.env.TWILIO_FROM_NUMBER,
      });
      this.messagingManager.registerProvider(twilioProvider);
    }

    // Setup WhatsApp Provider (utter-labs/wa-bot-api)
    if (process.env.WHATSAPP_API_URL && process.env.WHATSAPP_INSTANCE_ID) {
      const whatsappProvider = new WhatsAppProvider({
        apiUrl: process.env.WHATSAPP_API_URL,
        apiKey: process.env.WHATSAPP_API_KEY,
        instanceId: process.env.WHATSAPP_INSTANCE_ID,
      });
      this.messagingManager.registerProvider(whatsappProvider);
    }

    console.log(`Messaging providers initialized (mode: ${this.emailOnlyMode ? 'email-only' : 'multi'})`);
  }

  async connectRabbitMQ(): Promise<void> {
    const maxRetries = 5;
    const retryDelay = 5000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const url = `amqp://${RABBITMQ_USER}:${RABBITMQ_PASS}@${RABBITMQ_HOST}:5672`;
        this.connection = await amqp.connect(url);
        this.channel = await this.connection.createChannel();

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

  async setupQueues(): Promise<void> {
    if (!this.channel) return;

    // Subscribe to news queue
    await this.channel.assertQueue('news_queue', { durable: true });
    await this.channel.consume('news_queue', async (msg) => {
      if (msg) {
        try {
          const newsData: NewsData = JSON.parse(msg.content.toString());
          await this.handleNews(newsData);
          this.channel!.ack(msg);
        } catch (error) {
          console.error('Error processing news:', error);
          this.channel!.nack(msg, false, false);
        }
      }
    });

    // Subscribe to stock price updates
    await this.channel.assertQueue('price_updates', { durable: true });
    await this.channel.consume('price_updates', async (msg) => {
      if (msg) {
        try {
          const stockData: StockData = JSON.parse(msg.content.toString());
          await this.handleStockUpdate(stockData);
          this.channel!.ack(msg);
        } catch (error) {
          console.error('Error processing stock update:', error);
          this.channel!.nack(msg, false, false);
        }
      }
    });

    // Subscribe to fundamentals updates
    await this.channel.assertQueue('fundamentals_queue', { durable: true });
    await this.channel.consume('fundamentals_queue', async (msg) => {
      if (msg) {
        try {
          const fundamentalsData: FundamentalData = JSON.parse(msg.content.toString());
          await this.handleFundamentalsUpdate(fundamentalsData);
          this.channel!.ack(msg);
        } catch (error) {
          console.error('Error processing fundamentals update:', error);
          this.channel!.nack(msg, false, false);
        }
      }
    });

    // Subscribe to dividend events updates
    await this.channel.assertQueue('dividends_queue', { durable: true });
    await this.channel.consume('dividends_queue', async (msg) => {
      if (msg) {
        try {
          const dividendData: DividendEventData = JSON.parse(msg.content.toString());
          await this.handleDividendUpdate(dividendData);
          this.channel!.ack(msg);
        } catch (error) {
          console.error('Error processing dividend event:', error);
          this.channel!.nack(msg, false, false);
        }
      }
    });

    console.log('Queue consumers set up');
  }

  private validateFundamentalPayload(data: FundamentalData): void {
    if (!data.symbol || typeof data.symbol !== 'string') {
      throw new Error('Invalid fundamentals payload: symbol is required');
    }
  }

  private validateDividendPayload(data: DividendEventData): void {
    if (!data.symbol || typeof data.symbol !== 'string') {
      throw new Error('Invalid dividend payload: symbol is required');
    }

    const dividendAmount = Number(data.dividend_amount);
    if (!Number.isFinite(dividendAmount) || dividendAmount <= 0) {
      throw new Error('Invalid dividend payload: dividend_amount must be a positive number');
    }

    if (!data.ex_date || typeof data.ex_date !== 'string') {
      throw new Error('Invalid dividend payload: ex_date is required');
    }
  }

  private normalizeDate(value: unknown): string | null {
    if (typeof value !== 'string' || !value.trim()) {
      return null;
    }

    const raw = value.trim();
    const parsedIso = new Date(raw);
    if (!Number.isNaN(parsedIso.getTime())) {
      return parsedIso.toISOString().slice(0, 10);
    }

    const brazilianDateMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!brazilianDateMatch) {
      return null;
    }

    const [, day, month, year] = brazilianDateMatch;
    return `${year}-${month}-${day}`;
  }

  private normalizeTimestamp(value: unknown): string | null {
    if (typeof value !== 'string' || !value.trim()) {
      return null;
    }

    const parsed = new Date(value.trim());
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed.toISOString();
  }

  private normalizeNumeric(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private getSymbolMentionScore(symbol: string, title: string, description: string): number {
    const escapedSymbol = this.escapeRegExp(symbol.toUpperCase());
    const pattern = new RegExp(`(^|[^A-Z0-9.])${escapedSymbol}([^A-Z0-9.]|$)`, 'i');

    if (pattern.test(title)) {
      return 0.95;
    }

    if (pattern.test(description)) {
      return 0.7;
    }

    return 0;
  }

  private extractCandidateSymbols(newsData: NewsData): string[] {
    const rawText = `${newsData.title || ''} ${newsData.description || ''} ${newsData.topic || ''}`.toUpperCase();
    const matches = rawText.match(/\b[A-Z]{2,6}(?:\.[A-Z]{1,3})?\b/g) || [];

    return [...new Set(matches)]
      .filter(symbol => !this.commonTickerStopwords.has(symbol));
  }

  private async linkNewsToMentionedStocks(newsId: number, newsData: NewsData): Promise<void> {
    const title = (newsData.title || '').toUpperCase();
    const description = (newsData.description || '').toUpperCase();
    const candidateSymbols = this.extractCandidateSymbols(newsData);

    if (candidateSymbols.length === 0) {
      return;
    }

    const knownStocks = await pool.query(
      'SELECT id, symbol FROM stocks WHERE symbol = ANY($1::text[])',
      [candidateSymbols]
    );

    for (const stock of knownStocks.rows) {
      const symbol = String(stock.symbol).toUpperCase();
      const relevanceScore = this.getSymbolMentionScore(symbol, title, description);

      if (relevanceScore <= 0) {
        continue;
      }

      await pool.query(
        `INSERT INTO stock_news (stock_id, news_id, relevance_score)
         VALUES ($1, $2, $3)
         ON CONFLICT (stock_id, news_id) DO UPDATE
         SET relevance_score = GREATEST(stock_news.relevance_score, EXCLUDED.relevance_score)`,
        [stock.id, newsId, relevanceScore]
      );
    }
  }

  private async getOrCreateStockId(symbol: string): Promise<number> {
    const normalizedSymbol = symbol.toUpperCase();
    const existingStock = await pool.query(
      'SELECT id FROM stocks WHERE symbol = $1',
      [normalizedSymbol]
    );

    if (existingStock.rows.length > 0) {
      return existingStock.rows[0].id;
    }

    const insertedStock = await pool.query(
      'INSERT INTO stocks (symbol, name) VALUES ($1, $2) RETURNING id',
      [normalizedSymbol, normalizedSymbol]
    );

    return insertedStock.rows[0].id;
  }

  async handleFundamentalsUpdate(fundamentalData: FundamentalData): Promise<void> {
    this.validateFundamentalPayload(fundamentalData);

    const normalizedData: FundamentalData = {
      symbol: fundamentalData.symbol.toUpperCase(),
      dividend_yield: this.normalizeNumeric(fundamentalData.dividend_yield),
      p_vp: this.normalizeNumeric(fundamentalData.p_vp),
      p_l: this.normalizeNumeric(fundamentalData.p_l),
      roe: this.normalizeNumeric(fundamentalData.roe),
      liquidity: this.normalizeNumeric(fundamentalData.liquidity),
      scraped_at: fundamentalData.scraped_at,
    };

    console.log(`Processing fundamentals update: ${normalizedData.symbol}`);

    this.fundamentalsCache.set(normalizedData.symbol, normalizedData);

    const stockId = await this.getOrCreateStockId(normalizedData.symbol);
    await pool.query(
      `INSERT INTO status_invest_data (stock_id, dividend_yield, p_vp, p_l, roe, liquidity, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamp, CURRENT_TIMESTAMP))`,
      [
        stockId,
        normalizedData.dividend_yield,
        normalizedData.p_vp,
        normalizedData.p_l,
        normalizedData.roe,
        normalizedData.liquidity,
        normalizedData.scraped_at || null,
      ]
    );

    await this.checkAlertConditions();
  }

  async handleDividendUpdate(dividendData: DividendEventData): Promise<void> {
    this.validateDividendPayload(dividendData);

    const normalizedSymbol = dividendData.symbol.toUpperCase();
    const exDate = this.normalizeDate(dividendData.ex_date);
    const paymentDate = this.normalizeDate(dividendData.payment_date ?? null);
    const scrapedAt = this.normalizeTimestamp(dividendData.scraped_at ?? null);

    if (!exDate) {
      throw new Error('Invalid dividend payload: ex_date format is invalid');
    }

    const stockId = await this.getOrCreateStockId(normalizedSymbol);
    await pool.query(
      `INSERT INTO dividend_history (stock_id, dividend_amount, ex_date, payment_date, dividend_type, source, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamp, CURRENT_TIMESTAMP))
       ON CONFLICT (stock_id, ex_date) DO UPDATE
       SET dividend_amount = EXCLUDED.dividend_amount,
           payment_date = COALESCE(EXCLUDED.payment_date, dividend_history.payment_date),
           dividend_type = COALESCE(EXCLUDED.dividend_type, dividend_history.dividend_type),
           source = COALESCE(EXCLUDED.source, dividend_history.source),
           updated_at = CURRENT_TIMESTAMP`,
      [
        stockId,
        Number(dividendData.dividend_amount),
        exDate,
        paymentDate,
        dividendData.dividend_type || null,
        dividendData.source || 'statusinvest',
        scrapedAt,
      ]
    );

    console.log(`Processed dividend event: ${normalizedSymbol} @ ${exDate}`);
  }

  async handleNews(newsData: NewsData): Promise<void> {
    console.log(`Processing news: ${newsData.title}`);

    // Analyze sentiment
    const sentiment = this.sentimentAnalyzer.analyzeNews(newsData.title, newsData.description);
    console.log(`Sentiment analysis: ${sentiment.label} (score: ${sentiment.score}, confidence: ${sentiment.confidence})`);

    // Save news to database with sentiment
    try {
      const savedNews = await pool.query(
        `INSERT INTO news_articles (title, description, url, source, published_at, sentiment_score)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (url) DO UPDATE 
         SET sentiment_score = EXCLUDED.sentiment_score
         RETURNING id`,
        [newsData.title, newsData.description, newsData.url, newsData.source, newsData.published_at, sentiment.score]
      );

      if (savedNews.rows.length > 0) {
        await this.linkNewsToMentionedStocks(savedNews.rows[0].id, newsData);
      }
    } catch (error) {
      console.error('Error saving news to database:', error);
    }

    // Store news in cache by topic
    if (!this.newsCache.has(newsData.topic)) {
      this.newsCache.set(newsData.topic, []);
    }
    const topicNews = this.newsCache.get(newsData.topic)!;
    topicNews.push(newsData);

    // Keep only last 10 news per topic
    if (topicNews.length > 10) {
      topicNews.shift();
    }

    // Check if we should trigger alerts
    await this.checkAlertConditions();
  }

  async handleStockUpdate(stockData: StockData): Promise<void> {
    console.log(`Processing stock update: ${stockData.symbol} - $${stockData.price} (${stockData.changePercent}%)`);

    // Update stock cache
    this.stockCache.set(stockData.symbol, stockData);

    // Check if we should trigger alerts
    await this.checkAlertConditions();
  }

  async checkAlertConditions(): Promise<void> {
    // Get users with watchlist
    const result = await pool.query(`
      SELECT DISTINCT u.id, u.email, u.name, u.phone, u.whatsapp, s.symbol, uw.min_price_change,
             sid.dividend_yield, sid.p_vp, sid.p_l, sid.roe, sid.liquidity
      FROM users u
      INNER JOIN user_watchlist uw ON u.id = uw.user_id
      INNER JOIN stocks s ON uw.stock_id = s.id
      LEFT JOIN LATERAL (
        SELECT dividend_yield, p_vp, p_l, roe, liquidity
        FROM status_invest_data
        WHERE stock_id = s.id
        ORDER BY updated_at DESC
        LIMIT 1
      ) sid ON true
    `);

    for (const row of result.rows) {
      const stockData = this.stockCache.get(row.symbol);
      
      // Check if conditions are met: high news activity AND stock is up
      if (stockData && Math.abs(stockData.changePercent) >= row.min_price_change) {
        const hasRelevantNews = this.hasRelevantNews(row.symbol);
        
        const hasValidFundamentals = this.passesFundamentalRules(row);
        const inCooldown = await this.isInCooldown(row.id, row.symbol);

        if (hasRelevantNews && hasValidFundamentals && !inCooldown) {
          await this.sendAlert(row, stockData);
        }
      }
    }
  }

  private passesFundamentalRules(watchlistRow: any): boolean {
    const cached = this.fundamentalsCache.get(watchlistRow.symbol);
    const pL = this.normalizeNumeric(cached?.p_l ?? watchlistRow.p_l);
    const pVp = this.normalizeNumeric(cached?.p_vp ?? watchlistRow.p_vp);
    const roe = this.normalizeNumeric(cached?.roe ?? watchlistRow.roe);
    const liquidity = this.normalizeNumeric(cached?.liquidity ?? watchlistRow.liquidity);

    if (pL === null || pVp === null || roe === null || liquidity === null) {
      return false;
    }

    return pL <= this.maxPLThreshold &&
      pVp <= this.maxPVpThreshold &&
      roe >= this.minRoeThreshold &&
      liquidity >= this.minLiquidityThreshold;
  }

  private async isInCooldown(userId: number, symbol: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT 1
       FROM alerts a
       INNER JOIN stocks s ON a.stock_id = s.id
       WHERE a.user_id = $1
         AND s.symbol = $2
         AND a.sent_at > NOW() - ($3 || ' minutes')::interval
       LIMIT 1`,
      [userId, symbol, this.alertCooldownMinutes]
    );

    return result.rows.length > 0;
  }

  private hasRelevantNews(symbol: string): boolean {
    // Check if there's recent news about market topics
    const relevantTopics = ['stock market', 'nasdaq', 'dow jones', 'S&P 500'];
    
    for (const topic of relevantTopics) {
      const news = this.newsCache.get(topic);
      if (news && news.length >= 3) {
        // High news activity detected
        return true;
      }
    }
    
    return false;
  }

  async sendAlert(user: AlertUser, stockData: StockData): Promise<void> {
    console.log(`Sending alert to user ${user.email} for ${stockData.symbol}`);

    // Create recipient
    const recipient: MessageRecipient = {
      id: user.id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      whatsapp: user.whatsapp,
    };

    // Create HTML content
    const htmlContent = this.createHtmlAlert(user, stockData);
    const textContent = this.createTextAlert(user, stockData);

    // Try to send HTML first (for email), then fallback to text
    const htmlMessage: MessageContent = {
      format: MessageFormat.HTML,
      subject: `Market Alert: ${stockData.symbol} ${stockData.changePercent > 0 ? '📈' : '📉'} ${Math.abs(stockData.changePercent).toFixed(2)}%`,
      body: htmlContent,
    };

    const textMessage: MessageContent = {
      format: MessageFormat.TEXT,
      subject: `Market Alert: ${stockData.symbol} ${stockData.changePercent > 0 ? '↑' : '↓'} ${Math.abs(stockData.changePercent).toFixed(2)}%`,
      body: textContent,
    };

    try {
      // Send via configured channels
      const results = await this.messagingManager.send(recipient, htmlMessage, {
        preferredProviders: this.emailOnlyMode ? ['SMTP'] : undefined,
        fallbackEnabled: !this.emailOnlyMode,
      });

      // Log results
      for (const result of results) {
        if (result.success) {
          console.log(`Alert sent via ${result.provider}: ${result.messageId}`);
          
          // Get stock_id first, then save alert
          try {
            const stockResult = await pool.query(
              'SELECT id FROM stocks WHERE symbol = $1',
              [stockData.symbol]
            );
            
            if (stockResult.rows.length > 0) {
              const stockId = stockResult.rows[0].id;
              await pool.query(
                'INSERT INTO alerts (user_id, stock_id, alert_type, title, message, sent_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)',
                [user.id, stockId, result.provider, htmlMessage.subject, textContent]
              );
            }
          } catch (dbError) {
            console.error('Error saving alert to database:', dbError);
          }
        } else {
          console.error(`Failed to send via ${result.provider}: ${result.error}`);
        }
      }
    } catch (error) {
      console.error('Error sending alert:', error);
    }
  }

  private createHtmlAlert(user: AlertUser, stockData: StockData): string {
    const direction = stockData.changePercent > 0 ? 'UP' : 'DOWN';
    const color = stockData.changePercent > 0 ? '#28a745' : '#dc3545';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: ${color}; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .stock-info { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid ${color}; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Market Alert</h1>
            <h2>${stockData.symbol} is ${direction}</h2>
          </div>
          <div class="content">
            <p>Hello ${user.name || 'Investor'},</p>
            <p>We detected significant market activity for <strong>${stockData.symbol}</strong>:</p>
            <div class="stock-info">
              <h3>${stockData.symbol}</h3>
              <p><strong>Current Price:</strong> $${stockData.price.toFixed(2)}</p>
              <p><strong>Change:</strong> <span style="color: ${color}; font-weight: bold;">${stockData.changePercent.toFixed(2)}%</span></p>
              <p><strong>Volume:</strong> ${stockData.volume.toLocaleString()}</p>
              <p><strong>Market Cap:</strong> $${(stockData.marketCap / 1e9).toFixed(2)}B</p>
            </div>
            <p><strong>News Activity:</strong> High market news activity detected with positive momentum.</p>
            <p>This alert was triggered because the stock meets your watchlist criteria.</p>
          </div>
          <div class="footer">
            <p>This is an automated alert from Market Watcher</p>
            <p>To manage your alerts, visit your dashboard</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private createTextAlert(user: AlertUser, stockData: StockData): string {
    const direction = stockData.changePercent > 0 ? 'UP ↑' : 'DOWN ↓';
    
    return `
Market Alert: ${stockData.symbol} is ${direction}

Hello ${user.name || 'Investor'},

We detected significant market activity for ${stockData.symbol}:

Current Price: $${stockData.price.toFixed(2)}
Change: ${stockData.changePercent.toFixed(2)}%
Volume: ${stockData.volume.toLocaleString()}
Market Cap: $${(stockData.marketCap / 1e9).toFixed(2)}B

News Activity: High market news activity detected with positive momentum.

This alert was triggered because the stock meets your watchlist criteria.

---
Market Watcher - Automated Alert
    `.trim();
  }

  async start(): Promise<void> {
    try {
      console.log('Starting Notifier Service...');
      
      // Connect to RabbitMQ
      await this.connectRabbitMQ();
      
      // Setup queues and consumers
      await this.setupQueues();
      
      console.log('Notifier Service started successfully');
    } catch (error) {
      console.error('Failed to start Notifier Service:', error);
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
    console.log('Notifier Service closed');
  }
}

if (process.env.NODE_ENV !== 'test') {
  const service = new NotifierService();

  process.on('SIGINT', async () => {
    console.log('Shutting down Notifier Service...');
    await service.close();
    process.exit(0);
  });

  service.start();
}
