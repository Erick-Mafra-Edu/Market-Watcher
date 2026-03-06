/**
 * Prometheus metrics for notifier-service
 */
import client from 'prom-client';

// Create a Registry to register the metrics
export const register = new client.Registry();

// Add default metrics
client.collectDefaultMetrics({ register });

// Custom metrics
export const notificationsSent = new client.Counter({
  name: 'notifications_sent_total',
  help: 'Total number of notifications sent',
  labelNames: ['channel', 'status'], // channel: email/sms/whatsapp, status: success/failure
  registers: [register],
});

export const messagesConsumed = new client.Counter({
  name: 'rabbitmq_messages_consumed_total',
  help: 'Total number of messages consumed from RabbitMQ',
  labelNames: ['queue'],
  registers: [register],
});

export const sentimentAnalysisTotal = new client.Counter({
  name: 'sentiment_analysis_total',
  help: 'Total number of sentiment analysis performed',
  labelNames: ['sentiment'], // positive/negative/neutral
  registers: [register],
});

export const alertsTriggerTime = new client.Histogram({
  name: 'alerts_trigger_time_seconds',
  help: 'Time taken to trigger an alert',
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register],
});
