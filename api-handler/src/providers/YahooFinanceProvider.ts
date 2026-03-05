/**
 * Yahoo Finance provider via the yahoo-finance2 library.
 * Used as fallback when BRAPI does not support the requested symbol
 * (e.g. US stocks, crypto, ETFs not listed on B3).
 */
import { StockProvider, StockQuote, HistoricalDataPoint } from './StockProvider';

interface YahooFinanceClient {
  quote(symbol: string): Promise<any>;
  historical?: (symbol: string, options: { period1: string; period2: string }) => Promise<YahooHistoricalPoint[]>;
}

let yahooFinanceClientPromise: Promise<YahooFinanceClient> | null = null;

async function getYahooFinanceClient(): Promise<YahooFinanceClient> {
  if (!yahooFinanceClientPromise) {
    // Keep native ESM import at runtime even though this project compiles to CommonJS.
    yahooFinanceClientPromise = (new Function('return import("yahoo-finance2")')() as Promise<any>)
      .then((mod) => {
        const YahooFinanceCtor = mod.default ?? mod;
        return new YahooFinanceCtor() as YahooFinanceClient;
      });
  }

  return yahooFinanceClientPromise;
}

interface YahooHistoricalPoint {
  date: Date | string;
  open?: number;
  high?: number;
  low?: number;
  close: number;
  volume?: number;
}

export class YahooFinanceProvider implements StockProvider {
  async fetchQuote(symbol: string): Promise<StockQuote> {
    const yahooFinance = await getYahooFinanceClient();
    const quote = await yahooFinance.quote(symbol);
    return {
      symbol: quote.symbol,
      price: quote.regularMarketPrice ?? 0,
      changePercent: quote.regularMarketChangePercent ?? 0,
      volume: quote.regularMarketVolume ?? 0,
      marketCap: quote.marketCap ?? 0,
      name: quote.longName || quote.shortName,
    };
  }

  async fetchHistory(symbol: string, period1: string, period2: string): Promise<HistoricalDataPoint[]> {
    const yahooFinance = await getYahooFinanceClient();
    if (typeof yahooFinance.historical !== 'function') {
      throw new Error('Yahoo Finance historical data is unavailable in the current library version');
    }

    const history = await yahooFinance.historical(symbol, { period1, period2 });
    return history.map((point: YahooHistoricalPoint) => ({
      date: point.date instanceof Date
        ? point.date.toISOString().split('T')[0]
        : String(point.date),
      open: point.open,
      high: point.high,
      low: point.low,
      close: point.close,
      volume: point.volume,
    }));
  }
}
