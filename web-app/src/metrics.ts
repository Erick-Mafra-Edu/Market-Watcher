/**
 * Prometheus metrics for web-app
 */
import client from 'prom-client';

// Create a Registry to register the metrics
export const register = new client.Registry();

// Add default metrics (CPU, memory, etc)
client.collectDefaultMetrics({ register });

// Custom metrics
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const authAttempts = new client.Counter({
  name: 'auth_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['type', 'status'], // type: login/register, status: success/failure
  registers: [register],
});

export const activeUsers = new client.Gauge({
  name: 'active_users_total',
  help: 'Number of active users',
  registers: [register],
});

export const watchlistSize = new client.Gauge({
  name: 'watchlist_items_total',
  help: 'Total number of watchlist items across all users',
  registers: [register],
});

export const alertsGenerated = new client.Counter({
  name: 'alerts_generated_total',
  help: 'Total number of alerts generated',
  labelNames: ['type'],
  registers: [register],
});

export const portfolioTransactions = new client.Counter({
  name: 'portfolio_transactions_total',
  help: 'Total number of portfolio transactions',
  labelNames: ['type'], // buy, sell, dividend
  registers: [register],
});
