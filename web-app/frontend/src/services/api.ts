import { AlertItem, NewsItem, PortfolioPosition, PortfolioSummary, User, WatchlistItem } from '../types';

const jsonHeaders = {
  'Content-Type': 'application/json',
};

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || jsonHeaders['Content-Type'];
  }

  if (token) {
    headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }

  const res = await fetch(path, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || data.message || `Request failed with status ${res.status}`);
  }

  return data as T;
}

export async function login(email: string, password: string): Promise<{ token: string; user: User }> {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function register(name: string, email: string, password: string): Promise<{ message: string }> {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
}

export async function getWatchlist(token: string): Promise<WatchlistItem[]> {
  const data = await request<{ watchlist: WatchlistItem[] }>('/api/watchlist', { method: 'GET' }, token);
  return data.watchlist || [];
}

export async function addToWatchlist(token: string, symbol: string, minPriceChange: number): Promise<void> {
  await request('/api/watchlist', {
    method: 'POST',
    body: JSON.stringify({ symbol, minPriceChange }),
  }, token);
}

export async function removeFromWatchlist(token: string, symbol: string): Promise<void> {
  await request(`/api/watchlist/${encodeURIComponent(symbol)}`, { method: 'DELETE' }, token);
}

export async function getAlerts(token: string): Promise<AlertItem[]> {
  const data = await request<{ alerts: AlertItem[] }>('/api/alerts', { method: 'GET' }, token);
  return data.alerts || [];
}

export async function markAlertRead(token: string, id: number): Promise<void> {
  await request(`/api/alerts/${id}/read`, { method: 'PATCH' }, token);
}

export async function getNews(token: string, limit = 50): Promise<NewsItem[]> {
  const data = await request<{ success: boolean; news: NewsItem[] }>(`/api/news?limit=${limit}`, { method: 'GET' }, token);
  return data.news || [];
}

export async function getPortfolio(token: string): Promise<{ positions: PortfolioPosition[]; summary: PortfolioSummary }> {
  const data = await request<{
    success: boolean;
    portfolio: { positions: PortfolioPosition[]; summary: PortfolioSummary };
  }>('/api/portfolio', { method: 'GET' }, token);

  return data.portfolio;
}

export async function addTransaction(
  token: string,
  payload: { symbol: string; quantity: number; price: number; type: 'BUY' | 'SELL'; date: string; notes?: string }
): Promise<void> {
  await request('/api/portfolio/transaction', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
}

export async function getStockHistory(
  token: string,
  symbol: string,
  period1: string,
  period2: string
): Promise<any[]> {
  const query = `period1=${encodeURIComponent(period1)}&period2=${encodeURIComponent(period2)}`;
  const data = await request<any>(`/api/stocks/${encodeURIComponent(symbol)}/history?${query}`, { method: 'GET' }, token);
  return Array.isArray(data) ? data : [];
}
