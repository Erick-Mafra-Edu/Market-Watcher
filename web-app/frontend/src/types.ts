export type TabKey = 'dashboard' | 'news' | 'portfolio' | 'dividends' | 'watchlist' | 'charts' | 'alerts';

export interface User {
  id: number;
  email: string;
  name?: string;
}

export interface WatchlistItem {
  id?: number;
  symbol: string;
  name?: string;
  min_price_change?: number;
  created_at?: string;
}

export interface AlertItem {
  id: number;
  alert_type?: string;
  title: string;
  message: string;
  sent_at: string;
  read_at?: string | null;
  symbol?: string;
}

export interface NewsItem {
  id: number;
  title: string;
  description?: string;
  url?: string;
  source?: string;
  published_at: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  sentiment_score?: number;
  relevance_score?: number;
  related_stocks?: string[];
}

export interface PortfolioPosition {
  symbol: string;
  name?: string;
  currency?: string;
  quantity: number;
  avgPurchasePrice: number;
  currentPrice: number;
  currentValue: number;
  investedValue: number;
  profitLoss: number;
  profitLossPercent: string;
  dailyChange?: number;
  realizedProfit?: number;
}

export interface PortfolioSummary {
  totalInvested: number;
  totalCurrent: number;
  totalProfitLoss: number;
  totalProfitLossPercent: string;
  totalRealizedProfit?: number;
  positionsCount: number;
}

export interface PortfolioTransaction {
  id: number;
  symbol: string;
  name?: string;
  quantity: number;
  purchase_price: number;
  purchase_date?: string;
  sale_date?: string | null;
  transaction_date: string;
  transaction_type: 'BUY' | 'SELL';
  notes?: string | null;
  created_at?: string;
}

export interface PortfolioPerformancePoint {
  day: string;
  total_value: number;
  invested_value: number;
  profit_loss: number;
}

export interface PortfolioDividend {
  symbol: string;
  name?: string;
  dividend_amount: number;
  ex_date?: string;
  payment_date?: string;
  dividend_type?: string;
  dividend_yield?: number;
  quantity?: number;
  estimated_payment?: number;
}

export interface StockNewsFilters {
  limit?: number;
  offset?: number;
  minRelevance?: number;
  since?: string;
  sort?: 'published_at' | 'relevance_score';
  order?: 'asc' | 'desc';
}

export interface PortfolioDividendsFilters {
  onlyUpcoming?: boolean;
  fromDate?: string;
  toDate?: string;
  symbol?: string;
  limit?: number;
  offset?: number;
  sort?: 'ex_date' | 'payment_date';
  order?: 'asc' | 'desc';
}
