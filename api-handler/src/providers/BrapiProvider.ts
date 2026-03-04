/**
 * BRAPI provider for Brazilian (B3) stock market data.
 * Official API: https://brapi.dev
 * Supports Brazilian stocks, FIIs, indexes and also some US/crypto assets.
 */
import axios from 'axios';
import { StockProvider, StockQuote, HistoricalDataPoint } from './StockProvider';

const BRAPI_BASE_URL = 'https://brapi.dev/api';

// Maps an approximate number of days to the closest BRAPI range value
function calculateRange(period1: string, period2: string): string {
  const start = new Date(period1);
  const end = new Date(period2);
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 5) return '5d';
  if (diffDays <= 30) return '1mo';
  if (diffDays <= 90) return '3mo';
  if (diffDays <= 180) return '6mo';
  if (diffDays <= 365) return '1y';
  if (diffDays <= 730) return '2y';
  return '5y';
}

interface BrapiHistoricalPoint {
  date: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjustedClose?: number;
}

export class BrapiProvider implements StockProvider {
  private token: string | undefined;

  constructor(token?: string) {
    this.token = token;
  }

  async fetchQuote(symbol: string): Promise<StockQuote> {
    const params: Record<string, string> = {};
    if (this.token) params.token = this.token;

    const response = await axios.get(`${BRAPI_BASE_URL}/quote/${symbol}`, { params });
    const result = response.data?.results?.[0];

    if (!result) {
      throw new Error(`BRAPI: No data found for symbol: ${symbol}`);
    }

    return {
      symbol: result.symbol,
      price: result.regularMarketPrice ?? 0,
      changePercent: result.regularMarketChangePercent ?? 0,
      volume: result.regularMarketVolume ?? 0,
      marketCap: result.marketCap ?? 0,
      name: result.longName || result.shortName,
    };
  }

  async fetchHistory(symbol: string, period1: string, period2: string): Promise<HistoricalDataPoint[]> {
    const range = calculateRange(period1, period2);
    const params: Record<string, string> = { range, interval: '1d' };
    if (this.token) params.token = this.token;

    const response = await axios.get(`${BRAPI_BASE_URL}/quote/${symbol}`, { params });
    const result = response.data?.results?.[0];

    if (!result || !result.historicalDataPrice) {
      throw new Error(`BRAPI: No historical data found for symbol: ${symbol}`);
    }

    const start = new Date(period1).getTime();
    const end = new Date(period2).getTime();

    return result.historicalDataPrice
      .map((point: BrapiHistoricalPoint) => ({
        date: new Date(point.date * 1000).toISOString().split('T')[0],
        open: point.open,
        high: point.high,
        low: point.low,
        close: point.close,
        volume: point.volume,
      }))
      .filter((point: HistoricalDataPoint) => {
        const t = new Date(point.date).getTime();
        return t >= start && t <= end;
      });
  }
}
