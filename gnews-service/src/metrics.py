"""
Prometheus metrics for gnews-service
"""
from prometheus_client import Counter, Gauge, Histogram, CollectorRegistry

# Create a registry
registry = CollectorRegistry()

# Custom metrics
news_articles_fetched = Counter(
    'news_articles_fetched_total',
    'Total number of news articles fetched',
    ['status'],  # success/failure
    registry=registry
)

news_articles_published = Counter(
    'news_articles_published_total',
    'Total number of news articles published to RabbitMQ',
    registry=registry
)

news_fetch_duration = Histogram(
    'news_fetch_duration_seconds',
    'Time taken to fetch news from GNews API',
    buckets=[0.5, 1, 2, 5, 10, 30],
    registry=registry
)

news_api_errors = Counter(
    'news_api_errors_total',
    'Total number of errors from GNews API',
    ['error_type'],
    registry=registry
)

news_articles_in_db = Gauge(
    'news_articles_in_db',
    'Number of news articles currently in database',
    registry=registry
)
