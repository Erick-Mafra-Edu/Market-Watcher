/**
 * Communication contract tests for NotifierService (consumer side)
 *
 * Validates:
 * - RabbitMQ payload shape contracts for market_news, stock_prices, fundamental_data
 * - Queue consumer ack/nack behaviour for news_queue, price_updates, fundamentals_queue
 */

// Hoist pg mock so the module-level pool in index.ts uses it.
// Default: queries that look up or insert rows (e.g. getOrCreateStockId) receive
// a row with id=1 so the code path does not throw on undefined access.
// checkAlertConditions iterates result.rows but the stockCache is empty so no
// alerts are triggered even when rows are returned.
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 }),
    end: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { NotifierService } from './index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockChannel() {
  return {
    assertQueue: jest.fn().mockResolvedValue(undefined),
    consume: jest.fn().mockResolvedValue(undefined),
    ack: jest.fn(),
    nack: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  };
}

/** Create a fake RabbitMQ Message with JSON-serialised content. */
function makeMsg(payload: unknown): { content: Buffer } {
  return { content: Buffer.from(JSON.stringify(payload)) };
}

/** Create a fake RabbitMQ Message with non-JSON content. */
function makeMalformedMsg(): { content: Buffer } {
  return { content: Buffer.from('not valid json {{{') };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotifierService — communication contract tests', () => {
  let service: NotifierService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotifierService();
  });

  afterEach(async () => {
    await service.close();
    jest.restoreAllMocks();
  });

  // =========================================================================
  // Payload contracts
  // =========================================================================

  describe('fundamental_data payload contract', () => {
    it('accepts a valid fundamental_data payload', async () => {
      const valid = {
        symbol: 'PETR4',
        dividend_yield: 7.1,
        p_vp: 1.35,
        p_l: 10.42,
        roe: 15.9,
        liquidity: 1_200_000,
        scraped_at: new Date().toISOString(),
      };
      await expect(service.handleFundamentalsUpdate(valid)).resolves.not.toThrow();
    });

    it('accepts fundamental_data with null indicator values', async () => {
      const valid = {
        symbol: 'VALE3',
        dividend_yield: null,
        p_vp: null,
        p_l: null,
        roe: null,
        liquidity: null,
        scraped_at: new Date().toISOString(),
      };
      await expect(service.handleFundamentalsUpdate(valid)).resolves.not.toThrow();
    });

    it('rejects fundamental_data missing symbol', async () => {
      const invalid = {
        dividend_yield: 7.1,
        p_vp: 1.35,
        p_l: 10.42,
        roe: 15.9,
        liquidity: 1_200_000,
        scraped_at: new Date().toISOString(),
      } as any;
      await expect(service.handleFundamentalsUpdate(invalid)).rejects.toThrow(
        'Invalid fundamentals payload: symbol is required',
      );
    });

    it('rejects fundamental_data with non-string symbol', async () => {
      const invalid = {
        symbol: 123 as any,
        dividend_yield: 7.1,
        p_vp: 1.35,
        p_l: 10.42,
        roe: 15.9,
        liquidity: 1_200_000,
        scraped_at: new Date().toISOString(),
      };
      await expect(service.handleFundamentalsUpdate(invalid)).rejects.toThrow(
        'Invalid fundamentals payload: symbol is required',
      );
    });

    it('contract includes all required fields', () => {
      const requiredFields: string[] = [
        'symbol',
        'dividend_yield',
        'p_vp',
        'p_l',
        'roe',
        'liquidity',
        'scraped_at',
      ];
      const sample = {
        symbol: 'WEGE3',
        dividend_yield: 2.5,
        p_vp: 4.0,
        p_l: 20.0,
        roe: 30.0,
        liquidity: 800_000,
        scraped_at: new Date().toISOString(),
      };
      for (const field of requiredFields) {
        expect(sample).toHaveProperty(field);
      }
    });
  });

  describe('dividend_events payload contract', () => {
    it('accepts a valid dividend event payload', async () => {
      const valid = {
        symbol: 'PETR4',
        dividend_amount: 0.85,
        ex_date: '2026-03-15',
        payment_date: '2026-03-30',
        dividend_type: 'DIVIDEND',
        source: 'statusinvest',
        scraped_at: new Date().toISOString(),
      };
      await expect(service.handleDividendUpdate(valid as any)).resolves.not.toThrow();
    });

    it('rejects dividend event missing symbol', async () => {
      const invalid = {
        dividend_amount: 0.85,
        ex_date: '2026-03-15',
      } as any;
      await expect(service.handleDividendUpdate(invalid)).rejects.toThrow(
        'Invalid dividend payload: symbol is required',
      );
    });

    it('rejects dividend event with invalid amount', async () => {
      const invalid = {
        symbol: 'PETR4',
        dividend_amount: -1,
        ex_date: '2026-03-15',
      } as any;
      await expect(service.handleDividendUpdate(invalid)).rejects.toThrow(
        'Invalid dividend payload: dividend_amount must be a positive number',
      );
    });

    it('rejects dividend event missing ex_date', async () => {
      const invalid = {
        symbol: 'PETR4',
        dividend_amount: 0.85,
      } as any;
      await expect(service.handleDividendUpdate(invalid)).rejects.toThrow(
        'Invalid dividend payload: ex_date is required',
      );
    });
  });

  describe('market_news payload contract', () => {
    it('accepts a valid market_news payload', async () => {
      const valid = {
        title: 'Market Rally Today',
        description: 'Markets surged in morning trading',
        url: 'https://news.example.com/market-rally',
        source: 'Reuters',
        published_at: new Date().toISOString(),
        topic: 'stock market',
      };
      await expect(service.handleNews(valid)).resolves.not.toThrow();
    });

    it('contract includes all required fields', () => {
      const requiredFields: string[] = [
        'title',
        'description',
        'url',
        'source',
        'published_at',
        'topic',
      ];
      const sample = {
        title: 'Market Update',
        description: 'Some description',
        url: 'https://example.com/news',
        source: 'Bloomberg',
        published_at: new Date().toISOString(),
        topic: 'nasdaq',
      };
      for (const field of requiredFields) {
        expect(sample).toHaveProperty(field);
      }
    });
  });

  describe('stock_prices payload contract', () => {
    it('accepts a valid stock_prices payload', async () => {
      const valid = {
        symbol: 'PETR4',
        price: 33.4,
        changePercent: 4.8,
        volume: 120_000,
        marketCap: 35_000_000_000,
        timestamp: new Date().toISOString(),
      };
      await expect(service.handleStockUpdate(valid)).resolves.not.toThrow();
    });

    it('contract includes all required fields', () => {
      const requiredFields: string[] = [
        'symbol',
        'price',
        'changePercent',
        'volume',
        'marketCap',
        'timestamp',
      ];
      const sample = {
        symbol: 'VALE3',
        price: 65.5,
        changePercent: 2.1,
        volume: 500_000,
        marketCap: 100_000_000_000,
        timestamp: new Date().toISOString(),
      };
      for (const field of requiredFields) {
        expect(sample).toHaveProperty(field);
      }
    });
  });

  // =========================================================================
  // Ack / nack: news_queue
  // =========================================================================

  describe('news_queue — ack/nack behaviour', () => {
    let channel: ReturnType<typeof makeMockChannel>;
    let newsCallback: (msg: any) => Promise<void>;

    beforeEach(async () => {
      channel = makeMockChannel();
      (service as any).channel = channel;
      await service.setupQueues();
      // news_queue is registered in the first channel.consume call
      newsCallback = channel.consume.mock.calls[0][1];
    });

    it('acks when a valid payload is processed successfully', async () => {
      jest.spyOn(service, 'handleNews').mockResolvedValue(undefined);
      const msg = makeMsg({
        title: 'Test',
        description: 'Test description',
        url: 'https://example.com',
        source: 'Reuters',
        published_at: new Date().toISOString(),
        topic: 'stock market',
      });

      await newsCallback(msg);

      expect(channel.ack).toHaveBeenCalledTimes(1);
      expect(channel.ack).toHaveBeenCalledWith(msg);
      expect(channel.nack).not.toHaveBeenCalled();
    });

    it('nacks (no requeue) when the handler throws', async () => {
      jest.spyOn(service, 'handleNews').mockRejectedValue(new Error('handler error'));
      const msg = makeMsg({ title: 'Test', topic: 'stock market' });

      await newsCallback(msg);

      expect(channel.nack).toHaveBeenCalledTimes(1);
      expect(channel.nack).toHaveBeenCalledWith(msg, false, false);
      expect(channel.ack).not.toHaveBeenCalled();
    });

    it('nacks (no requeue) on malformed JSON', async () => {
      const msg = makeMalformedMsg();

      await newsCallback(msg);

      expect(channel.nack).toHaveBeenCalledTimes(1);
      expect(channel.nack).toHaveBeenCalledWith(msg, false, false);
      expect(channel.ack).not.toHaveBeenCalled();
    });

    it('does nothing when msg is null', async () => {
      await newsCallback(null);

      expect(channel.ack).not.toHaveBeenCalled();
      expect(channel.nack).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Ack / nack: price_updates
  // =========================================================================

  describe('price_updates — ack/nack behaviour', () => {
    let channel: ReturnType<typeof makeMockChannel>;
    let priceCallback: (msg: any) => Promise<void>;

    beforeEach(async () => {
      channel = makeMockChannel();
      (service as any).channel = channel;
      await service.setupQueues();
      // price_updates is registered in the second channel.consume call
      priceCallback = channel.consume.mock.calls[1][1];
    });

    it('acks when a valid payload is processed successfully', async () => {
      jest.spyOn(service, 'handleStockUpdate').mockResolvedValue(undefined);
      const msg = makeMsg({
        symbol: 'PETR4',
        price: 33.4,
        changePercent: 4.8,
        volume: 120_000,
        marketCap: 35_000_000_000,
        timestamp: new Date().toISOString(),
      });

      await priceCallback(msg);

      expect(channel.ack).toHaveBeenCalledTimes(1);
      expect(channel.ack).toHaveBeenCalledWith(msg);
      expect(channel.nack).not.toHaveBeenCalled();
    });

    it('nacks (no requeue) when the handler throws', async () => {
      jest.spyOn(service, 'handleStockUpdate').mockRejectedValue(new Error('db error'));
      const msg = makeMsg({ symbol: 'PETR4', price: 33.4 });

      await priceCallback(msg);

      expect(channel.nack).toHaveBeenCalledTimes(1);
      expect(channel.nack).toHaveBeenCalledWith(msg, false, false);
      expect(channel.ack).not.toHaveBeenCalled();
    });

    it('nacks (no requeue) on malformed JSON', async () => {
      const msg = makeMalformedMsg();

      await priceCallback(msg);

      expect(channel.nack).toHaveBeenCalledTimes(1);
      expect(channel.nack).toHaveBeenCalledWith(msg, false, false);
      expect(channel.ack).not.toHaveBeenCalled();
    });

    it('does nothing when msg is null', async () => {
      await priceCallback(null);

      expect(channel.ack).not.toHaveBeenCalled();
      expect(channel.nack).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Ack / nack: fundamentals_queue
  // =========================================================================

  describe('fundamentals_queue — ack/nack behaviour', () => {
    let channel: ReturnType<typeof makeMockChannel>;
    let fundamentalsCallback: (msg: any) => Promise<void>;

    beforeEach(async () => {
      channel = makeMockChannel();
      (service as any).channel = channel;
      await service.setupQueues();
      // fundamentals_queue is registered in the third channel.consume call
      fundamentalsCallback = channel.consume.mock.calls[2][1];
    });

    it('acks when a valid payload is processed successfully', async () => {
      jest.spyOn(service, 'handleFundamentalsUpdate').mockResolvedValue(undefined);
      const msg = makeMsg({
        symbol: 'VALE3',
        dividend_yield: 5.5,
        p_vp: 1.2,
        p_l: 8.0,
        roe: 20.0,
        liquidity: 500_000,
        scraped_at: new Date().toISOString(),
      });

      await fundamentalsCallback(msg);

      expect(channel.ack).toHaveBeenCalledTimes(1);
      expect(channel.ack).toHaveBeenCalledWith(msg);
      expect(channel.nack).not.toHaveBeenCalled();
    });

    it('nacks (no requeue) when payload is missing symbol', async () => {
      const msg = makeMsg({
        dividend_yield: 5.5,
        p_vp: 1.2,
        p_l: 8.0,
        roe: 20.0,
        liquidity: 500_000,
        scraped_at: new Date().toISOString(),
      });

      await fundamentalsCallback(msg);

      expect(channel.nack).toHaveBeenCalledTimes(1);
      expect(channel.nack).toHaveBeenCalledWith(msg, false, false);
      expect(channel.ack).not.toHaveBeenCalled();
    });

    it('nacks (no requeue) when the handler throws', async () => {
      jest.spyOn(service, 'handleFundamentalsUpdate').mockRejectedValue(
        new Error('handler error'),
      );
      const msg = makeMsg({
        symbol: 'VALE3',
        scraped_at: new Date().toISOString(),
      });

      await fundamentalsCallback(msg);

      expect(channel.nack).toHaveBeenCalledTimes(1);
      expect(channel.nack).toHaveBeenCalledWith(msg, false, false);
      expect(channel.ack).not.toHaveBeenCalled();
    });

    it('nacks (no requeue) on malformed JSON', async () => {
      const msg = makeMalformedMsg();

      await fundamentalsCallback(msg);

      expect(channel.nack).toHaveBeenCalledTimes(1);
      expect(channel.nack).toHaveBeenCalledWith(msg, false, false);
      expect(channel.ack).not.toHaveBeenCalled();
    });

    it('does nothing when msg is null', async () => {
      await fundamentalsCallback(null);

      expect(channel.ack).not.toHaveBeenCalled();
      expect(channel.nack).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Ack / nack: dividends_queue
  // =========================================================================

  describe('dividends_queue — ack/nack behaviour', () => {
    let channel: ReturnType<typeof makeMockChannel>;
    let dividendsCallback: (msg: any) => Promise<void>;

    beforeEach(async () => {
      channel = makeMockChannel();
      (service as any).channel = channel;
      await service.setupQueues();
      // dividends_queue is registered in the fourth channel.consume call
      dividendsCallback = channel.consume.mock.calls[3][1];
    });

    it('acks when a valid payload is processed successfully', async () => {
      jest.spyOn(service, 'handleDividendUpdate').mockResolvedValue(undefined as any);
      const msg = makeMsg({
        symbol: 'VALE3',
        dividend_amount: 1.25,
        ex_date: '2026-03-10',
        payment_date: '2026-03-25',
        dividend_type: 'DIVIDEND',
        source: 'statusinvest',
      });

      await dividendsCallback(msg);

      expect(channel.ack).toHaveBeenCalledTimes(1);
      expect(channel.ack).toHaveBeenCalledWith(msg);
      expect(channel.nack).not.toHaveBeenCalled();
    });

    it('nacks (no requeue) when payload is missing symbol', async () => {
      const msg = makeMsg({
        dividend_amount: 1.25,
        ex_date: '2026-03-10',
      });

      await dividendsCallback(msg);

      expect(channel.nack).toHaveBeenCalledTimes(1);
      expect(channel.nack).toHaveBeenCalledWith(msg, false, false);
      expect(channel.ack).not.toHaveBeenCalled();
    });

    it('nacks (no requeue) on malformed JSON', async () => {
      const msg = makeMalformedMsg();

      await dividendsCallback(msg);

      expect(channel.nack).toHaveBeenCalledTimes(1);
      expect(channel.nack).toHaveBeenCalledWith(msg, false, false);
      expect(channel.ack).not.toHaveBeenCalled();
    });
  });
});

// =============================================================================
// connectRabbitMQ — retry / reconnect behaviour
// =============================================================================

// amqplib must be mocked at the module level for the retry suite.
// The rest of the file already hoisted 'pg'; we add 'amqplib' here.
jest.mock('amqplib');

import amqp from 'amqplib';

const mockedAmqp = amqp as jest.Mocked<typeof amqp>;

describe('NotifierService — connectRabbitMQ retry behaviour', () => {
  let service: NotifierService;
  let timeoutSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // Make retry delays instant so tests don't wait 5 s each
    timeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((fn: any) => {
      fn();
      return 0 as any;
    });
    service = new NotifierService();
  });

  afterEach(async () => {
    timeoutSpy.mockRestore();
    await service.close();
  });

  it('throws after exhausting all 5 retry attempts', async () => {
    const connectError = new Error('broker unavailable');
    (mockedAmqp.connect as jest.Mock).mockRejectedValue(connectError);

    await expect(service.connectRabbitMQ()).rejects.toThrow('broker unavailable');
  });

  it('calls amqp.connect exactly 5 times when all attempts fail', async () => {
    (mockedAmqp.connect as jest.Mock).mockRejectedValue(new Error('refused'));

    try {
      await service.connectRabbitMQ();
    } catch {
      // expected
    }

    expect(mockedAmqp.connect).toHaveBeenCalledTimes(5);
  });

  it('succeeds without retrying when first attempt works', async () => {
    const mockChannel = {
      assertQueue: jest.fn().mockResolvedValue(undefined),
      consume: jest.fn().mockResolvedValue(undefined),
      ack: jest.fn(),
      nack: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const mockConnection = {
      createChannel: jest.fn().mockResolvedValue(mockChannel),
      close: jest.fn().mockResolvedValue(undefined),
    };
    (mockedAmqp.connect as jest.Mock).mockResolvedValueOnce(mockConnection);

    await service.connectRabbitMQ();

    expect(mockedAmqp.connect).toHaveBeenCalledTimes(1);
  });

  it('succeeds on the third attempt after two failures', async () => {
    const mockChannel = {
      assertQueue: jest.fn().mockResolvedValue(undefined),
      consume: jest.fn().mockResolvedValue(undefined),
      ack: jest.fn(),
      nack: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const mockConnection = {
      createChannel: jest.fn().mockResolvedValue(mockChannel),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const connectError = new Error('transient');
    (mockedAmqp.connect as jest.Mock)
      .mockRejectedValueOnce(connectError)
      .mockRejectedValueOnce(connectError)
      .mockResolvedValueOnce(mockConnection);

    await service.connectRabbitMQ();

    expect(mockedAmqp.connect).toHaveBeenCalledTimes(3);
  });
});
