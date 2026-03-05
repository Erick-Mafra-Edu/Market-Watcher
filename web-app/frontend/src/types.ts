export type TabKey = 'dashboard' | 'news' | 'portfolio' | 'watchlist' | 'charts' | 'alerts';

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
  related_stocks?: string[];
}

export interface PortfolioPosition {
  symbol: string;
  name?: string;
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
