/**
 * Communication contract tests for ApiHandler (producer side)
 *
 * Validates that publishStockData emits a payload conforming to the
 * stock_prices contract:  symbol, price, changePercent, volume, marketCap, timestamp
 */

// yahoo-finance2 is ESM-only; keep the existing virtual mock
jest.mock('yahoo-finance2', () => ({ quote: jest.fn(), historical: jest.fn() }), { virtual: true });
jest.mock('./providers/BrapiProvider');
jest.mock('./providers/YahooFinanceProvider');

import { ApiHandler } from './index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REQUIRED_STOCK_PRICE_FIELDS = [
  'symbol',
  'price',
  'changePercent',
  'volume',
  'marketCap',
  'timestamp',
] as const;

type StockPricePayload = {
  symbol: string;
  price: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  timestamp: string;
};

function validStockPayload(overrides: Partial<StockPricePayload> = {}): StockPricePayload {
  return {
    symbol: 'PETR4',
    price: 38.5,
    changePercent: 2.1,
    volume: 1_000_000,
    marketCap: 500_000_000_000,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ApiHandler — stock_prices producer contract', () => {
  let handler: ApiHandler;
  let mockChannel: { publish: jest.Mock; assertExchange: jest.Mock; assertQueue: jest.Mock; bindQueue: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new ApiHandler();

    mockChannel = {
      publish: jest.fn(),
      assertExchange: jest.fn().mockResolvedValue(undefined),
      assertQueue: jest.fn().mockResolvedValue(undefined),
      bindQueue: jest.fn().mockResolvedValue(undefined),
    };
    (handler as any).channel = mockChannel;
  });

  // =========================================================================
  // Contract shape
  // =========================================================================

  describe('payload shape', () => {
    it('publishes a payload that contains all required stock_prices fields', async () => {
      const payload = validStockPayload();

      await handler.publishStockData(payload);

      expect(mockChannel.publish).toHaveBeenCalledTimes(1);
      const [, , buffer] = mockChannel.publish.mock.calls[0];
      const published = JSON.parse((buffer as Buffer).toString());

      for (const field of REQUIRED_STOCK_PRICE_FIELDS) {
        expect(published).toHaveProperty(field);
      }
    });

    it('symbol in payload matches the input symbol', async () => {
      const payload = validStockPayload({ symbol: 'VALE3' });

      await handler.publishStockData(payload);

      const [, , buffer] = mockChannel.publish.mock.calls[0];
      const published = JSON.parse((buffer as Buffer).toString());
      expect(published.symbol).toBe('VALE3');
    });

    it('price is a finite number', async () => {
      const payload = validStockPayload({ price: 65.5 });

      await handler.publishStockData(payload);

      const [, , buffer] = mockChannel.publish.mock.calls[0];
      const published = JSON.parse((buffer as Buffer).toString());
      expect(typeof published.price).toBe('number');
      expect(Number.isFinite(published.price)).toBe(true);
    });

    it('timestamp is an ISO-8601 string', async () => {
      const payload = validStockPayload();

      await handler.publishStockData(payload);

      const [, , buffer] = mockChannel.publish.mock.calls[0];
      const published = JSON.parse((buffer as Buffer).toString());
      expect(typeof published.timestamp).toBe('string');
      expect(new Date(published.timestamp).toString()).not.toBe('Invalid Date');
    });

    it('payload is published as JSON to the stock_prices exchange', async () => {
      const payload = validStockPayload();

      await handler.publishStockData(payload);

      const [exchange] = mockChannel.publish.mock.calls[0];
      expect(exchange).toBe('stock_prices');

      const [, , buffer, options] = mockChannel.publish.mock.calls[0];
      const parsed = JSON.parse((buffer as Buffer).toString());
      expect(parsed).toMatchObject(payload);
      expect(options).toMatchObject({ contentType: 'application/json', persistent: true });
    });

    it('does not publish when channel is not available', async () => {
      (handler as any).channel = null;
      const payload = validStockPayload();

      await handler.publishStockData(payload);

      expect(mockChannel.publish).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Invalid / edge-case payloads
  // =========================================================================

  describe('payload edge cases', () => {
    it('still publishes payload with zero price (falsy but valid)', async () => {
      const payload = validStockPayload({ price: 0 });

      await handler.publishStockData(payload);

      const [, , buffer] = mockChannel.publish.mock.calls[0];
      const published = JSON.parse((buffer as Buffer).toString());
      expect(published.price).toBe(0);
    });

    it('preserves negative changePercent', async () => {
      const payload = validStockPayload({ changePercent: -3.7 });

      await handler.publishStockData(payload);

      const [, , buffer] = mockChannel.publish.mock.calls[0];
      const published = JSON.parse((buffer as Buffer).toString());
      expect(published.changePercent).toBe(-3.7);
    });
  });
});
