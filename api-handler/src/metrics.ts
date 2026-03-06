/**
 * Prometheus metrics for api-handler
 */
import client from 'prom-client';

// Create a Registry to register the metrics
export const register = new client.Registry();

// Add default metrics
client.collectDefaultMetrics({ register });

// Custom metrics
export const stockQuoteRequests = new client.Counter({
  name: 'stock_quote_requests_total',
  help: 'Total number of stock quote requests',
  labelNames: ['symbol', 'provider', 'status'], // provider: brapi/yahoo, status: success/failure
  registers: [register],
});

export const stockHistoryRequests = new client.Counter({
  name: 'stock_history_requests_total',
  help: 'Total number of stock history requests',
  labelNames: ['symbol', 'provider', 'status'],
  registers: [register],
});

export const providerResponseTime = new client.Histogram({
  name: 'provider_response_time_seconds',
  help: 'Response time from stock data providers',
  labelNames: ['provider'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const providerErrors = new client.Counter({
  name: 'provider_errors_total',
  help: 'Total number of errors from stock data providers',
  labelNames: ['provider', 'error_type'],
  registers: [register],
});
