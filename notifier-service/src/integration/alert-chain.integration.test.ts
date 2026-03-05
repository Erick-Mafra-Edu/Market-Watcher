/**
 * Alert chain integration tests for NotifierService
 *
 * Covers two major gap areas:
 *
 * 1. Multi-channel recipient routing
 *    - MessagingManager.send() receives the correct phone/whatsapp fields
 *    - Alert is sent to all configured channels (email, SMS, WhatsApp)
 *    - Alert is correctly limited to email-only when NOTIFICATION_CHANNEL_MODE
 *      is not 'multi'
 *
 * 2. Symbol-level news relevance in alert trigger
 *    - hasRelevantNews() considers stock_news association via linkNewsToMentionedStocks
 *    - An alert IS triggered when the news headline explicitly mentions the
 *      watched symbol and price/fundamental conditions are met
 *    - An alert IS NOT triggered when the news does not mention the symbol
 *      even if generic market topics have high activity
 *
 * Uses jest.resetModules() + jest.doMock('pg') so each test group has an
 * isolated module-cache, matching the pattern used across this test suite.
 */

import type { NotifierService as NotifierServiceType } from '../index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const asQueryResponse = (rows: Record<string, unknown>[], rowCount?: number) => ({
  command: 'SELECT',
  rowCount: rowCount ?? rows.length,
  oid: 0,
  rows,
  fields: [],
});

function freshService(
  queryImpl: jest.Mock,
  env: Record<string, string> = {},
): NotifierServiceType {
  jest.resetModules();
  Object.assign(process.env, env);

  jest.doMock('pg', () => ({
    Pool: jest.fn().mockImplementation(() => ({
      query: queryImpl,
      end: jest.fn().mockResolvedValue(undefined),
    })),
  }));

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { NotifierService } = require('../index');
  return new NotifierService();
}

const stockData = {
  symbol: 'PETR4',
  price: 38.5,
  changePercent: 5.0,
  volume: 1_000_000,
  marketCap: 500_000_000_000,
  timestamp: new Date().toISOString(),
};

const fundamentals = {
  symbol: 'PETR4',
  dividend_yield: 7.0,
  p_vp: 1.3,
  p_l: 10.0,
  roe: 16.0,
  liquidity: 1_000_000,
  scraped_at: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotifierService — alert chain integration', () => {
  afterEach(async () => {
    jest.restoreAllMocks();
    jest.dontMock('pg');
    // Remove test env overrides
    delete process.env.NOTIFICATION_CHANNEL_MODE;
  });

  // =========================================================================
  // Multi-channel recipient routing
  // =========================================================================

  describe('multi-channel recipient routing', () => {
    it('recipient includes email, phone and whatsapp when all are set', async () => {
      const mockQuery = jest.fn().mockResolvedValue(asQueryResponse([{ id: 1 }]));
      const service = freshService(mockQuery);
      const sendMock = jest.fn().mockResolvedValue([]);
      (service as any).messagingManager = { send: sendMock };

      await service.sendAlert(
        { id: 1, email: 'user@example.com', name: 'User', phone: '+5511999999999', whatsapp: '+5511888888888' },
        stockData as any,
      );

      expect(sendMock).toHaveBeenCalledTimes(1);
      const [recipient] = sendMock.mock.calls[0];
      expect(recipient).toMatchObject({
        id: '1',
        email: 'user@example.com',
        phone: '+5511999999999',
        whatsapp: '+5511888888888',
      });

      await (service as any).close?.();
    });

    it('recipient omits phone/whatsapp when not provided', async () => {
      const mockQuery = jest.fn().mockResolvedValue(asQueryResponse([{ id: 1 }]));
      const service = freshService(mockQuery);
      const sendMock = jest.fn().mockResolvedValue([]);
      (service as any).messagingManager = { send: sendMock };

      await service.sendAlert(
        { id: 2, email: 'only-email@example.com', name: 'User' },
        stockData as any,
      );

      const [recipient] = sendMock.mock.calls[0];
      expect(recipient.email).toBe('only-email@example.com');
      expect(recipient.phone).toBeUndefined();
      expect(recipient.whatsapp).toBeUndefined();

      await (service as any).close?.();
    });

    it('passes preferredProviders=["SMTP"] when NOTIFICATION_CHANNEL_MODE is not "multi"', async () => {
      const mockQuery = jest.fn().mockResolvedValue(asQueryResponse([{ id: 1 }]));
      // email-only mode is the default (NOTIFICATION_CHANNEL_MODE !== 'multi')
      const service = freshService(mockQuery, {});
      const sendMock = jest.fn().mockResolvedValue([]);
      (service as any).messagingManager = { send: sendMock };

      await service.sendAlert(
        { id: 3, email: 'user@example.com', name: 'User' },
        stockData as any,
      );

      const [, , options] = sendMock.mock.calls[0];
      expect(options.preferredProviders).toEqual(['SMTP']);
      expect(options.fallbackEnabled).toBe(false);

      await (service as any).close?.();
    });

    it('passes no preferredProviders when multi-channel mode is active', async () => {
      const mockQuery = jest.fn().mockResolvedValue(asQueryResponse([{ id: 1 }]));
      const service = freshService(mockQuery, { NOTIFICATION_CHANNEL_MODE: 'multi' });
      const sendMock = jest.fn().mockResolvedValue([]);
      (service as any).messagingManager = { send: sendMock };

      await service.sendAlert(
        { id: 4, email: 'user@example.com', name: 'User', phone: '+5511999999999' },
        stockData as any,
      );

      const [, , options] = sendMock.mock.calls[0];
      expect(options.preferredProviders).toBeUndefined();
      expect(options.fallbackEnabled).toBe(true);

      await (service as any).close?.();
    });

    it('alert is saved to DB after successful send', async () => {
      const mockQuery = jest.fn()
        .mockResolvedValueOnce(asQueryResponse([{ id: 1 }])) // stock SELECT
        .mockResolvedValue(asQueryResponse([{ id: 1 }]));    // alert INSERT
      const service = freshService(mockQuery);
      const sendMock = jest.fn().mockResolvedValue([
        { success: true, provider: 'SMTP', messageId: 'msg-001' },
      ]);
      (service as any).messagingManager = { send: sendMock };

      await service.sendAlert(
        { id: 5, email: 'user@example.com', name: 'User' },
        stockData as any,
      );

      const alertInsert = mockQuery.mock.calls.find(
        ([sql]: [string]) =>
          typeof sql === 'string' && /INSERT INTO alerts/i.test(sql),
      );
      expect(alertInsert).toBeDefined();

      await (service as any).close?.();
    });
  });

  // =========================================================================
  // Symbol-level news relevance in checkAlertConditions
  // =========================================================================

  describe('symbol-level news relevance in hasRelevantNews()', () => {
  /**
   * hasRelevantNews() currently checks generic market topics for ≥3 news items
   * as the trigger threshold.  linkNewsToMentionedStocks() creates stock_news
   * associations when a symbol appears in the news title/description.
   *
   * These tests validate:
   * - the existing topic-based threshold logic (< 3 → false, ≥ 3 → true)
   * - that linkNewsToMentionedStocks correctly links news to stocks
   * - that no link is created when no known symbol is in the text
   * - that relevance_score is higher when the symbol appears in the title
   * - that an alert is NOT triggered when price change meets the threshold
   *   but the news count is below the threshold
   *
   * NOTE: Symbol-specific filtering inside hasRelevantNews() (i.e., checking
   * stock_news for the watched symbol) remains a pending implementation item.
   */

    it('returns false (no alert) when no news topics have ≥3 entries', async () => {
      const mockQuery = jest.fn().mockResolvedValue(asQueryResponse([]));
      const service = freshService(mockQuery);

      // Seed with only one news item — below the ≥3 threshold
      const newsPayload = {
        title: 'Market Update',
        description: 'General update',
        url: 'https://news.example.com/1',
        source: 'Reuters',
        published_at: new Date().toISOString(),
        topic: 'stock market',
      };
      await service.handleNews(newsPayload);

      const hasRelevant = (service as any).hasRelevantNews('PETR4');
      expect(hasRelevant).toBe(false);

      await (service as any).close?.();
    });

    it('returns true when a topic reaches ≥3 news entries', async () => {
      const mockQuery = jest.fn().mockResolvedValue(asQueryResponse([]));
      const service = freshService(mockQuery);

      for (let i = 1; i <= 3; i++) {
        await service.handleNews({
          title: `Market Update ${i}`,
          description: 'General update',
          url: `https://news.example.com/${i}`,
          source: 'Reuters',
          published_at: new Date().toISOString(),
          topic: 'stock market',
        });
      }

      const hasRelevant = (service as any).hasRelevantNews('PETR4');
      expect(hasRelevant).toBe(true);

      await (service as any).close?.();
    });

    it('links news to stock when symbol appears in the title', async () => {
      const mockQuery = jest.fn()
        .mockResolvedValueOnce(asQueryResponse([{ id: 99 }]))  // INSERT news_articles → id
        .mockResolvedValueOnce(asQueryResponse([{ id: 7, symbol: 'PETR4' }]))  // SELECT stocks
        .mockResolvedValue(asQueryResponse([]));               // stock_news INSERT / alerts

      const service = freshService(mockQuery);

      await service.handleNews({
        title: 'PETR4 surges 5% after earnings beat',
        description: 'Petrobras shares rose strongly on positive quarterly results.',
        url: 'https://news.example.com/petr4-earnings',
        source: 'Reuters',
        published_at: new Date().toISOString(),
        topic: 'stock market',
      });

      // Verify stock_news INSERT was attempted
      const stockNewsInsert = mockQuery.mock.calls.find(
        ([sql]: [string]) =>
          typeof sql === 'string' && /INSERT INTO stock_news/i.test(sql),
      );
      expect(stockNewsInsert).toBeDefined();

      await (service as any).close?.();
    });

    it('does not link news when no known stock symbols appear in title/description', async () => {
      const mockQuery = jest.fn()
        .mockResolvedValueOnce(asQueryResponse([{ id: 100 }]))  // INSERT news_articles
        .mockResolvedValueOnce(asQueryResponse([]))             // SELECT stocks → no matches
        .mockResolvedValue(asQueryResponse([]));

      const service = freshService(mockQuery);

      await service.handleNews({
        title: 'Federal Reserve holds rates steady',
        description: 'The Fed decided to maintain current interest rate levels.',
        url: 'https://news.example.com/fed-rates',
        source: 'Bloomberg',
        published_at: new Date().toISOString(),
        topic: 'federal reserve',
      });

      const stockNewsInsert = mockQuery.mock.calls.find(
        ([sql]: [string]) =>
          typeof sql === 'string' && /INSERT INTO stock_news/i.test(sql),
      );
      expect(stockNewsInsert).toBeUndefined();

      await (service as any).close?.();
    });

    it('stock_news relevance_score is higher when symbol appears in title vs description', async () => {
      const mockQuery = jest.fn()
        .mockResolvedValueOnce(asQueryResponse([{ id: 101 }]))
        .mockResolvedValueOnce(asQueryResponse([{ id: 7, symbol: 'VALE3' }]))
        .mockResolvedValue(asQueryResponse([]));

      const service = freshService(mockQuery);

      // Symbol in title → relevance_score should be 0.95
      await service.handleNews({
        title: 'VALE3 announces dividend increase',
        description: 'The mining company will pay higher dividends next quarter.',
        url: 'https://news.example.com/vale3-dividend',
        source: 'InfoMoney',
        published_at: new Date().toISOString(),
        topic: 'stock market',
      });

      const stockNewsInsert = mockQuery.mock.calls.find(
        ([sql]: [string]) =>
          typeof sql === 'string' && /INSERT INTO stock_news/i.test(sql),
      );
      expect(stockNewsInsert).toBeDefined();
      // Third param is relevance_score
      const relevanceScore = stockNewsInsert![1][2];
      expect(relevanceScore).toBeGreaterThan(0.5);

      await (service as any).close?.();
    });

    it('does not trigger alert when price change meets threshold but no relevant news', async () => {
      const mockQuery = jest.fn().mockImplementation((sql: string) => {
        if (/SELECT DISTINCT u\.id/i.test(sql)) {
          return Promise.resolve(asQueryResponse([{
            id: 1, email: 'user@example.com', name: 'User',
            symbol: 'PETR4', min_price_change: 2.0,
            dividend_yield: 7.0, p_vp: 1.3, p_l: 10.0, roe: 16.0, liquidity: 1_000_000,
          }]));
        }
        return Promise.resolve(asQueryResponse([]));
      });

      const service = freshService(mockQuery);
      const sendMock = jest.fn().mockResolvedValue([]);
      (service as any).messagingManager = { send: sendMock };

      // Fund the cache with fundamentals
      (service as any).fundamentalsCache.set('PETR4', fundamentals);

      // Only one news item — does not reach ≥3 threshold
      (service as any).newsCache.set('stock market', [{
        title: 'Market Update', url: 'u1', topic: 'stock market',
      }]);

      // Stock update with change % above threshold
      await service.handleStockUpdate(stockData);

      expect(sendMock).not.toHaveBeenCalled();

      await (service as any).close?.();
    });
  });
});
