/**
 * Stock provider abstraction.
 * Allows multiple data sources (BRAPI, Yahoo Finance, etc.) to be used interchangeably.
 */

export interface StockQuote {
  symbol: string;
  price: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  name?: string;
}

export interface HistoricalDataPoint {
  date: string;
  open?: number;
  high?: number;
  low?: number;
  close: number;
  volume?: number;
}

export interface StockProvider {
  fetchQuote(symbol: string): Promise<StockQuote>;
  fetchHistory(symbol: string, period1: string, period2: string): Promise<HistoricalDataPoint[]>;
}
