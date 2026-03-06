"""
Prometheus metrics for scraping-worker
"""
from prometheus_client import Counter, Gauge, Histogram, CollectorRegistry

# Create a registry
registry = CollectorRegistry()

# Custom metrics
scraping_requests = Counter(
    'scraping_requests_total',
    'Total number of scraping requests',
    ['status'],  # success/failure
    registry=registry
)

dividends_found = Counter(
    'dividends_found_total',
    'Total number of dividends found during scraping',
    ['symbol'],
    registry=registry
)

fundamental_data_scraped = Counter(
    'fundamental_data_scraped_total',
    'Total number of fundamental data records scraped',
    ['symbol', 'status'],
    registry=registry
)

scraping_duration = Histogram(
    'scraping_duration_seconds',
    'Time taken to scrape a single symbol',
    ['symbol'],
    buckets=[1, 2, 5, 10, 30, 60],
    registry=registry
)

scraping_errors = Counter(
    'scraping_errors_total',
    'Total number of scraping errors',
    ['error_type'],
    registry=registry
)

status_invest_requests = Counter(
    'status_invest_requests_total',
    'Total requests made to StatusInvest',
    ['status'],
    registry=registry
)
