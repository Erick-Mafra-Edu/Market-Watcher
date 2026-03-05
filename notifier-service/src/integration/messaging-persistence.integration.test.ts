/**
 * Messaging → persistence integration tests for NotifierService
 *
 * Verifies that incoming queue messages are correctly persisted to the
 * expected database tables without relying on a live database or broker.
 *
 * Uses jest.resetModules() + jest.doMock() so each test receives a freshly
 * loaded index.ts with its own pool mock — avoiding module-cache collisions
 * with other test files that also mock 'pg'.
 *
 * Covered paths:
 * - market_news  →  news_articles  (handleNews)
 * - market_news with related_stock  →  stock_news  (handleNews + related_stock)
 * - fundamental_data  →  status_invest_data  (handleFundamentalsUpdate)
 */

// Type-only import so the class type is available without loading the module.
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotifierService — messaging → persistence integration', () => {
  let service: NotifierServiceType;
  let mockQuery: jest.Mock;

  beforeEach(() => {
    jest.resetModules();

    mockQuery = jest.fn().mockResolvedValue(asQueryResponse([{ id: 1 }]));

    // Use doMock (not hoisted) after resetModules so the fresh module load
    // picks up the new mock pool with our captured mockQuery reference.
    jest.doMock('pg', () => ({
      Pool: jest.fn().mockImplementation(() => ({
        query: mockQuery,
        end: jest.fn().mockResolvedValue(undefined),
      })),
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { NotifierService } = require('../index');
    service = new NotifierService();
  });

  afterEach(async () => {
    if (service) await (service as any).close?.();
    jest.restoreAllMocks();
    jest.dontMock('pg');
  });

  // =========================================================================
  // market_news → news_articles
  // =========================================================================

  describe('handleNews persists to news_articles', () => {
    const newsPayload = {
      title: 'PETR4 Surges 5%',
      description: 'Petrobras shares jumped in early trading',
      url: 'https://news.example.com/petr4-surges',
      source: 'Reuters',
      published_at: '2026-03-05T10:00:00.000Z',
      topic: 'stock market',
    };

    it('inserts or updates a row in news_articles with the correct fields', async () => {
      mockQuery
        .mockResolvedValueOnce(asQueryResponse([{ id: 42 }])) // INSERT news_articles RETURNING id
        .mockResolvedValue(asQueryResponse([]));               // subsequent queries

      await service.handleNews(newsPayload);

      const firstCall = mockQuery.mock.calls[0];
      const sql: string = firstCall[0];
      const params: unknown[] = firstCall[1];

      expect(sql).toMatch(/INSERT INTO news_articles/i);
      expect(params).toContain(newsPayload.title);
      expect(params).toContain(newsPayload.description);
      expect(params).toContain(newsPayload.url);
      expect(params).toContain(newsPayload.source);
      expect(params).toContain(newsPayload.published_at);
    });

    it('includes a sentiment_score in the news_articles insert', async () => {
      mockQuery
        .mockResolvedValueOnce(asQueryResponse([{ id: 1 }]))
        .mockResolvedValue(asQueryResponse([]));

      await service.handleNews(newsPayload);

      const firstCall = mockQuery.mock.calls[0];
      expect(firstCall[0]).toMatch(/sentiment_score/i);
    });

    it('uses ON CONFLICT to avoid duplicate news entries by url', async () => {
      mockQuery
        .mockResolvedValueOnce(asQueryResponse([{ id: 5 }]))
        .mockResolvedValue(asQueryResponse([]));

      await service.handleNews(newsPayload);

      const firstCall = mockQuery.mock.calls[0];
      expect(firstCall[0]).toMatch(/ON CONFLICT/i);
    });
  });

  // =========================================================================
  // market_news with related_stock → stock_news
  // =========================================================================

  describe('handleNews with related_stock persists to stock_news', () => {
    const newsWithRelatedStock = {
      title: 'PETR4 surges after oil rally',
      description: 'Petrobras shares rose sharply.',
      url: 'https://news.example.com/petr4-oil-rally',
      source: 'Bloomberg',
      published_at: '2026-03-05T10:00:00.000Z',
      topic: 'PETR4',
      related_stock: 'PETR4',
    };

    it('inserts a row in stock_news with relevance_score 1.0 when related_stock is supplied', async () => {
      mockQuery
        .mockResolvedValueOnce(asQueryResponse([{ id: 99 }]))  // INSERT news_articles → id=99
        .mockResolvedValueOnce(asQueryResponse([{ id: 7 }]))   // getOrCreateStockId SELECT → id=7
        .mockResolvedValue(asQueryResponse([]));                // subsequent queries

      await service.handleNews(newsWithRelatedStock);

      const stockNewsCall = mockQuery.mock.calls.find(
        ([sql]: [string]) =>
          typeof sql === 'string' && /INSERT INTO stock_news/i.test(sql),
      );

      expect(stockNewsCall).toBeDefined();
      const params: unknown[] = stockNewsCall![1];
      // params: stock_id, news_id, relevance_score
      expect(params[0]).toBe(7);   // stock_id from getOrCreateStockId
      expect(params[1]).toBe(99);  // news_id from INSERT news_articles
      expect(params[2]).toBe(1.0); // high-confidence direct link
    });

    it('uses ON CONFLICT to upsert the stock_news link', async () => {
      mockQuery
        .mockResolvedValueOnce(asQueryResponse([{ id: 50 }])) // INSERT news_articles
        .mockResolvedValueOnce(asQueryResponse([{ id: 8 }]))  // getOrCreateStockId
        .mockResolvedValue(asQueryResponse([]));

      await service.handleNews(newsWithRelatedStock);

      const stockNewsCall = mockQuery.mock.calls.find(
        ([sql]: [string]) =>
          typeof sql === 'string' && /INSERT INTO stock_news/i.test(sql),
      );

      expect(stockNewsCall![0]).toMatch(/ON CONFLICT/i);
    });

    it('creates or reuses the stock record for the related_stock symbol', async () => {
      mockQuery
        .mockResolvedValueOnce(asQueryResponse([{ id: 60 }])) // INSERT news_articles
        .mockResolvedValueOnce(asQueryResponse([{ id: 12 }])) // getOrCreateStockId SELECT
        .mockResolvedValue(asQueryResponse([]));

      await service.handleNews(newsWithRelatedStock);

      // The first query after the news_articles INSERT should look up the stock
      const stockLookup = mockQuery.mock.calls[1];
      expect(stockLookup[0]).toMatch(/stocks/i);
      expect(stockLookup[1]).toContain('PETR4');
    });

    it('does NOT insert a stock_news row when related_stock is absent', async () => {
      const newsWithoutRelatedStock = {
        title: 'General market update',
        description: 'Markets rallied today.',
        url: 'https://news.example.com/market-update',
        source: 'AP',
        published_at: '2026-03-05T12:00:00.000Z',
        topic: 'stock market',
        // no related_stock
      };

      mockQuery
        .mockResolvedValueOnce(asQueryResponse([{ id: 70 }])) // INSERT news_articles
        .mockResolvedValue(asQueryResponse([]));

      await service.handleNews(newsWithoutRelatedStock);

      const stockNewsCall = mockQuery.mock.calls.find(
        ([sql]: [string]) =>
          typeof sql === 'string' && /INSERT INTO stock_news/i.test(sql),
      );
      // Without related_stock, stock_news insertions only occur through
      // text-based symbol matching. Since this payload contains no stock
      // symbols in the text, no insertion is expected.
      expect(stockNewsCall).toBeUndefined();
    });

    it('does not throw even if the stock_news insert fails', async () => {
      mockQuery
        .mockResolvedValueOnce(asQueryResponse([{ id: 80 }]))  // INSERT news_articles
        .mockResolvedValueOnce(asQueryResponse([{ id: 9 }]))   // getOrCreateStockId SELECT
        .mockRejectedValueOnce(new Error('DB constraint error')) // INSERT stock_news fails
        .mockResolvedValue(asQueryResponse([]));               // remaining queries

      await expect(service.handleNews(newsWithRelatedStock)).resolves.not.toThrow();
    });
  });

  // =========================================================================
  // fundamental_data → status_invest_data
  // =========================================================================

  describe('handleFundamentalsUpdate persists to status_invest_data', () => {
    const fundamentalsPayload = {
      symbol: 'WEGE3',
      dividend_yield: 2.5,
      p_vp: 4.1,
      p_l: 18.5,
      roe: 28.0,
      liquidity: 900_000,
      scraped_at: '2026-03-05T09:00:00.000Z',
    };

    it('inserts a row in status_invest_data with the correct fields', async () => {
      mockQuery
        .mockResolvedValueOnce(asQueryResponse([{ id: 10 }])) // getOrCreateStockId SELECT
        .mockResolvedValue(asQueryResponse([]));               // remaining queries

      await service.handleFundamentalsUpdate(fundamentalsPayload);

      const insertCall = mockQuery.mock.calls.find(
        ([sql]: [string]) =>
          typeof sql === 'string' && /INSERT INTO status_invest_data/i.test(sql),
      );

      expect(insertCall).toBeDefined();
      const params: unknown[] = insertCall![1];

      // params order: stock_id, dividend_yield, p_vp, p_l, roe, liquidity, scraped_at
      expect(params[0]).toBe(10);
      expect(params[1]).toBe(fundamentalsPayload.dividend_yield);
      expect(params[2]).toBe(fundamentalsPayload.p_vp);
      expect(params[3]).toBe(fundamentalsPayload.p_l);
      expect(params[4]).toBe(fundamentalsPayload.roe);
      expect(params[5]).toBe(fundamentalsPayload.liquidity);
    });

    it('normalises the symbol to uppercase before persisting', async () => {
      const lowerSymbol = { ...fundamentalsPayload, symbol: 'wege3' };

      mockQuery
        .mockResolvedValueOnce(asQueryResponse([{ id: 11 }]))
        .mockResolvedValue(asQueryResponse([]));

      await service.handleFundamentalsUpdate(lowerSymbol);

      const firstCall = mockQuery.mock.calls[0];
      expect(firstCall[1]).toContain('WEGE3');
    });

    it('handles null indicator values without throwing', async () => {
      const nullPayload = {
        symbol: 'BBDC4',
        dividend_yield: null,
        p_vp: null,
        p_l: null,
        roe: null,
        liquidity: null,
        scraped_at: '2026-03-05T09:00:00.000Z',
      };

      mockQuery.mockResolvedValue(asQueryResponse([{ id: 20 }]));

      await expect(service.handleFundamentalsUpdate(nullPayload)).resolves.not.toThrow();

      const insertCall = mockQuery.mock.calls.find(
        ([sql]: [string]) =>
          typeof sql === 'string' && /INSERT INTO status_invest_data/i.test(sql),
      );
      expect(insertCall).toBeDefined();
    });
  });

  // =========================================================================
  // dividend_events → dividend_history
  // =========================================================================

  describe('handleDividendUpdate persists to dividend_history', () => {
    const dividendPayload = {
      symbol: 'ITUB4',
      dividend_amount: 0.72,
      ex_date: '2026-03-20',
      payment_date: '2026-03-31',
      dividend_type: 'DIVIDEND',
      source: 'statusinvest',
      scraped_at: '2026-03-05T09:00:00.000Z',
    };

    it('upserts a row in dividend_history with the correct fields', async () => {
      mockQuery
        .mockResolvedValueOnce(asQueryResponse([{ id: 15 }])) // getOrCreateStockId SELECT
        .mockResolvedValue(asQueryResponse([]));               // remaining queries

      await service.handleDividendUpdate(dividendPayload as any);

      const upsertCall = mockQuery.mock.calls.find(
        ([sql]: [string]) =>
          typeof sql === 'string' && /INSERT INTO dividend_history/i.test(sql),
      );

      expect(upsertCall).toBeDefined();
      expect(upsertCall![0]).toMatch(/ON CONFLICT/i);
      const params: unknown[] = upsertCall![1];

      expect(params[0]).toBe(15);
      expect(params[1]).toBe(dividendPayload.dividend_amount);
      expect(params[2]).toBe(dividendPayload.ex_date);
      expect(params[3]).toBe(dividendPayload.payment_date);
      expect(params[4]).toBe(dividendPayload.dividend_type);
      expect(params[5]).toBe(dividendPayload.source);
    });

    it('normalises the symbol to uppercase before persisting', async () => {
      const lowerSymbolPayload = { ...dividendPayload, symbol: 'itub4' };

      mockQuery
        .mockResolvedValueOnce(asQueryResponse([{ id: 16 }]))
        .mockResolvedValue(asQueryResponse([]));

      await service.handleDividendUpdate(lowerSymbolPayload as any);

      const firstCall = mockQuery.mock.calls[0];
      expect(firstCall[1]).toContain('ITUB4');
    });
  });
});
