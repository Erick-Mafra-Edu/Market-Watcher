/**
 * Message idempotency integration tests for NotifierService
 *
 * Verifies that re-delivery of the same message does not create
 * inconsistent state in the database:
 *
 * - news_articles: duplicate URL must use ON CONFLICT upsert (no duplicate rows)
 * - status_invest_data: repeated fundamentals update for the same stock must
 *   not throw and must result in a single valid INSERT call
 *
 * Uses jest.resetModules() + jest.doMock() so each test gets a freshly loaded
 * index.ts with its own pool mock — matching the pattern used by the existing
 * messaging-persistence.integration.test.ts.
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotifierService — message idempotency', () => {
  let service: NotifierServiceType;
  let mockQuery: jest.Mock;

  beforeEach(() => {
    jest.resetModules();

    mockQuery = jest.fn().mockResolvedValue(asQueryResponse([{ id: 1 }]));

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
  // news_articles — duplicate URL idempotency
  // =========================================================================

  describe('handleNews — idempotency for duplicate URLs', () => {
    const newsPayload = {
      title: 'PETR4 Surges 5%',
      description: 'Petrobras shares jumped in early trading',
      url: 'https://news.example.com/petr4-surges',
      source: 'Reuters',
      published_at: '2026-03-05T10:00:00.000Z',
      topic: 'stock market',
    };

    it('does not throw when the same news URL is processed twice', async () => {
      mockQuery.mockResolvedValue(asQueryResponse([{ id: 42 }]));

      await expect(service.handleNews(newsPayload)).resolves.not.toThrow();
      await expect(service.handleNews(newsPayload)).resolves.not.toThrow();
    });

    it('uses ON CONFLICT in the INSERT so duplicate URLs do not error', async () => {
      mockQuery.mockResolvedValue(asQueryResponse([{ id: 42 }]));

      await service.handleNews(newsPayload);

      const insertCall = mockQuery.mock.calls.find(
        ([sql]: [string]) =>
          typeof sql === 'string' && /INSERT INTO news_articles/i.test(sql),
      );
      expect(insertCall).toBeDefined();
      expect(insertCall![0]).toMatch(/ON CONFLICT/i);
    });

    it('second delivery uses the same ON CONFLICT path (no raw duplicate)', async () => {
      mockQuery.mockResolvedValue(asQueryResponse([{ id: 42 }]));

      // First delivery
      await service.handleNews(newsPayload);
      const firstCallCount = mockQuery.mock.calls.filter(([sql]: [string]) =>
        typeof sql === 'string' && /INSERT INTO news_articles/i.test(sql),
      ).length;

      // Second delivery of identical payload
      await service.handleNews(newsPayload);
      const secondCallCount = mockQuery.mock.calls.filter(([sql]: [string]) =>
        typeof sql === 'string' && /INSERT INTO news_articles/i.test(sql),
      ).length;

      // Each delivery issues exactly one INSERT; the DB handles the conflict
      expect(firstCallCount).toBe(1);
      expect(secondCallCount).toBe(2);
    });

    it('processes a third distinct URL without interference', async () => {
      const uniqueNews = { ...newsPayload, url: 'https://news.example.com/unique' };
      mockQuery.mockResolvedValue(asQueryResponse([{ id: 99 }]));

      await service.handleNews(newsPayload);
      await service.handleNews(newsPayload);
      await service.handleNews(uniqueNews);

      const insertCalls = mockQuery.mock.calls.filter(([sql]: [string]) =>
        typeof sql === 'string' && /INSERT INTO news_articles/i.test(sql),
      );
      expect(insertCalls.length).toBe(3);
    });
  });

  // =========================================================================
  // status_invest_data — duplicate fundamentals update idempotency
  // =========================================================================

  describe('handleFundamentalsUpdate — idempotency for repeated symbols', () => {
    const fundamentalsPayload = {
      symbol: 'WEGE3',
      dividend_yield: 2.5,
      p_vp: 4.1,
      p_l: 18.5,
      roe: 28.0,
      liquidity: 900_000,
      scraped_at: '2026-03-05T09:00:00.000Z',
    };

    it('does not throw when the same fundamentals are processed twice', async () => {
      mockQuery.mockResolvedValue(asQueryResponse([{ id: 10 }]));

      await expect(service.handleFundamentalsUpdate(fundamentalsPayload)).resolves.not.toThrow();
      await expect(service.handleFundamentalsUpdate(fundamentalsPayload)).resolves.not.toThrow();
    });

    it('each delivery issues an INSERT INTO status_invest_data', async () => {
      mockQuery.mockResolvedValue(asQueryResponse([{ id: 10 }]));

      await service.handleFundamentalsUpdate(fundamentalsPayload);
      const firstCount = mockQuery.mock.calls.filter(([sql]: [string]) =>
        typeof sql === 'string' && /INSERT INTO status_invest_data/i.test(sql),
      ).length;

      await service.handleFundamentalsUpdate(fundamentalsPayload);
      const secondCount = mockQuery.mock.calls.filter(([sql]: [string]) =>
        typeof sql === 'string' && /INSERT INTO status_invest_data/i.test(sql),
      ).length;

      expect(firstCount).toBe(1);
      expect(secondCount).toBe(2);
    });

    it('null indicators in re-delivery do not throw', async () => {
      const nullPayload = {
        symbol: 'WEGE3',
        dividend_yield: null,
        p_vp: null,
        p_l: null,
        roe: null,
        liquidity: null,
        scraped_at: '2026-03-05T09:00:00.000Z',
      };
      mockQuery.mockResolvedValue(asQueryResponse([{ id: 10 }]));

      await expect(service.handleFundamentalsUpdate(nullPayload)).resolves.not.toThrow();
      await expect(service.handleFundamentalsUpdate(nullPayload)).resolves.not.toThrow();
    });

    it('symbol is normalized to uppercase consistently across re-deliveries', async () => {
      const lowerPayload = { ...fundamentalsPayload, symbol: 'wege3' };
      mockQuery.mockResolvedValue(asQueryResponse([{ id: 10 }]));

      await service.handleFundamentalsUpdate(lowerPayload);
      await service.handleFundamentalsUpdate(lowerPayload);

      const stockLookupCalls = mockQuery.mock.calls.filter(
        ([sql, params]: [string, unknown[]]) =>
          typeof sql === 'string' &&
          /SELECT.*FROM stocks WHERE symbol/i.test(sql) &&
          Array.isArray(params) &&
          params.includes('WEGE3'),
      );
      expect(stockLookupCalls.length).toBeGreaterThanOrEqual(2);
    });

    it('different symbol re-delivered after first symbol does not break state', async () => {
      mockQuery.mockResolvedValue(asQueryResponse([{ id: 10 }]));

      const secondPayload = { ...fundamentalsPayload, symbol: 'ITUB4' };

      await service.handleFundamentalsUpdate(fundamentalsPayload);
      await service.handleFundamentalsUpdate(secondPayload);
      await service.handleFundamentalsUpdate(fundamentalsPayload); // re-deliver first

      const insertCalls = mockQuery.mock.calls.filter(([sql]: [string]) =>
        typeof sql === 'string' && /INSERT INTO status_invest_data/i.test(sql),
      );
      expect(insertCalls.length).toBe(3);
    });
  });
});
