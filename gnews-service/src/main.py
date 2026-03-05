"""
GNews Service - News scraping service using ranahaani/GNews
Monitors news for market topics and publishes to RabbitMQ.
Assets to monitor are loaded dynamically from the database (tracked_assets table)
and fall back to a hardcoded default list when the database is unavailable.
"""
import os
import time
import json
import logging
from datetime import datetime
from gnews import GNews
import pika

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration from environment
RABBITMQ_HOST = os.getenv('RABBITMQ_HOST', 'rabbitmq')
RABBITMQ_USER = os.getenv('RABBITMQ_USER', 'admin')
RABBITMQ_PASS = os.getenv('RABBITMQ_PASS', 'admin')
GNEWS_API_KEY = os.getenv('GNEWS_API_KEY', '')
CHECK_INTERVAL = int(os.getenv('CHECK_INTERVAL', '300'))

DATABASE_HOST = os.getenv('DATABASE_HOST', 'database')
DATABASE_PORT = int(os.getenv('DATABASE_PORT', '5432'))
DATABASE_NAME = os.getenv('DATABASE_NAME', 'market_watcher')
DATABASE_USER = os.getenv('DATABASE_USER', 'postgres')
DATABASE_PASSWORD = os.getenv('DATABASE_PASSWORD', 'postgres')
DATABASE_CONNECT_TIMEOUT = int(os.getenv('DATABASE_CONNECT_TIMEOUT', '5'))

# How often to refresh the asset list from the database (in seconds)
ASSET_REFRESH_INTERVAL = int(os.getenv('ASSET_REFRESH_INTERVAL', '1800'))

# Fallback market topics used when the database is unreachable
_DEFAULT_MARKET_TOPICS = [
    'stock market',
    'nasdaq',
    'dow jones',
    'S&P 500',
    'cryptocurrency',
    'bitcoin',
    'ethereum',
    'federal reserve',
    'interest rates',
    'inflation',
    'market crash',
    'market rally',
]


def _connect_db():
    """Return a new psycopg2 connection, or None on failure."""
    try:
        import psycopg2
        conn = psycopg2.connect(
            host=DATABASE_HOST,
            port=DATABASE_PORT,
            dbname=DATABASE_NAME,
            user=DATABASE_USER,
            password=DATABASE_PASSWORD,
            connect_timeout=DATABASE_CONNECT_TIMEOUT,
        )
        conn.autocommit = True
        return conn
    except Exception as exc:
        logger.warning("Could not connect to database: %s", exc)
        return None


def fetch_tracked_assets():
    """
    Fetch the list of active tracked assets from the database.

    Returns a list of dicts with keys 'symbol' and 'name'.
    Falls back to an empty list if the DB is unavailable (caller should use
    _DEFAULT_MARKET_TOPICS in that case).
    """
    conn = _connect_db()
    if conn is None:
        return []

    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT symbol, name FROM tracked_assets WHERE active = TRUE ORDER BY symbol"
            )
            rows = cur.fetchall()
            return [{'symbol': row[0], 'name': row[1]} for row in rows]
    except Exception as exc:
        logger.warning("Error querying tracked_assets: %s", exc)
        return []
    finally:
        try:
            conn.close()
        except Exception:
            pass


class GNewsService:
    """Service for fetching and publishing market news"""

    def __init__(self):
        self.gnews = GNews(language='en', max_results=10)
        self.connection = None
        self.channel = None
        self._tracked_assets = []
        self._last_asset_refresh = 0
        self.connect_rabbitmq()

    def connect_rabbitmq(self):
        """Establish connection to RabbitMQ"""
        max_retries = 5
        retry_delay = 5

        for attempt in range(max_retries):
            try:
                credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS)
                parameters = pika.ConnectionParameters(
                    host=RABBITMQ_HOST,
                    credentials=credentials,
                    heartbeat=600,
                    blocked_connection_timeout=300
                )
                self.connection = pika.BlockingConnection(parameters)
                self.channel = self.connection.channel()

                # Declare exchanges and queues
                self.channel.exchange_declare(
                    exchange='market_news',
                    exchange_type='fanout',
                    durable=True
                )

                self.channel.queue_declare(queue='news_queue', durable=True)
                self.channel.queue_bind(
                    exchange='market_news',
                    queue='news_queue'
                )

                logger.info("Successfully connected to RabbitMQ")
                return

            except Exception as e:
                logger.error(f"Failed to connect to RabbitMQ (attempt {attempt + 1}/{max_retries}): {e}")
                if attempt < max_retries - 1:
                    time.sleep(retry_delay)
                else:
                    raise

    def refresh_tracked_assets(self):
        """Reload tracked assets from the database if the refresh interval has elapsed."""
        now = time.time()
        if now - self._last_asset_refresh < ASSET_REFRESH_INTERVAL and self._tracked_assets:
            return

        assets = fetch_tracked_assets()
        if assets:
            self._tracked_assets = assets
            self._last_asset_refresh = now
            logger.info(
                "Loaded %d tracked assets from database: %s",
                len(assets),
                ', '.join(a['symbol'] for a in assets),
            )
        else:
            if not self._tracked_assets:
                logger.warning(
                    "Database unavailable and no cached assets; "
                    "falling back to default market topics."
                )
            # Keep existing cache if any; if empty the caller falls back to defaults.
            self._last_asset_refresh = now

    def get_search_topics(self):
        """
        Return a list of (topic_string, related_stock_symbol_or_None) tuples.

        When tracked assets are available from the database, each asset yields
        two search terms: its ticker symbol and its human-readable name.
        Otherwise the hardcoded default topic list is used (related_stock=None).
        """
        self.refresh_tracked_assets()

        if self._tracked_assets:
            topics = []
            for asset in self._tracked_assets:
                symbol = asset['symbol']
                name = asset.get('name') or symbol
                topics.append((symbol, symbol))
                if name and name.upper() != symbol.upper():
                    topics.append((name, symbol))
            return topics

        # Fallback: generic market topics without a specific related stock
        return [(topic, None) for topic in _DEFAULT_MARKET_TOPICS]

    def fetch_news(self, topic):
        """Fetch news for a specific topic"""
        try:
            logger.info(f"Fetching news for topic: {topic}")
            articles = self.gnews.get_news(topic)
            return articles
        except Exception as e:
            logger.error(f"Error fetching news for {topic}: {e}")
            return []

    def publish_news(self, news_data):
        """Publish news to RabbitMQ"""
        try:
            message = json.dumps(news_data)
            self.channel.basic_publish(
                exchange='market_news',
                routing_key='',
                body=message,
                properties=pika.BasicProperties(
                    delivery_mode=2,  # Make message persistent
                    content_type='application/json'
                )
            )
            logger.info(f"Published news: {news_data.get('title', 'N/A')}")
        except Exception as e:
            logger.error(f"Error publishing news: {e}")
            # Reconnect if connection was lost
            self.connect_rabbitmq()

    def process_article(self, article, topic, related_stock=None):
        """Process and structure article data.

        Args:
            article: Raw article dict from GNews.
            topic: Search topic that produced this article.
            related_stock: Optional stock symbol that this article was found
                           while searching for (used by notifier-service to
                           create a direct stock_news link without regex).
        """
        news_data = {
            'title': article.get('title', ''),
            'description': article.get('description', ''),
            'url': article.get('url', ''),
            'source': article.get('publisher', {}).get('title', 'Unknown'),
            'published_at': article.get('published date', datetime.utcnow().isoformat()),
            'topic': topic,
            'fetched_at': datetime.utcnow().isoformat(),
        }
        if related_stock:
            news_data['related_stock'] = related_stock
        return news_data

    def run(self):
        """Main service loop"""
        logger.info("GNews Service started")
        logger.info(f"Check interval: {CHECK_INTERVAL} seconds")

        processed_urls = set()

        while True:
            try:
                search_topics = self.get_search_topics()
                logger.info("Monitoring %d search topics", len(search_topics))

                for topic_str, related_stock in search_topics:
                    articles = self.fetch_news(topic_str)

                    for article in articles:
                        url = article.get('url', '')
                        if url and url not in processed_urls:
                            news_data = self.process_article(article, topic_str, related_stock)
                            self.publish_news(news_data)
                            processed_urls.add(url)

                            # Limit processed URLs cache size
                            if len(processed_urls) > 10000:
                                # Discard roughly half the entries; we use a list
                                # snapshot only to truncate to a predictable size.
                                processed_urls = set(list(processed_urls)[5000:])

                    # Small delay between topics
                    time.sleep(2)

                logger.info(f"Completed news check cycle. Sleeping for {CHECK_INTERVAL} seconds...")
                time.sleep(CHECK_INTERVAL)

            except KeyboardInterrupt:
                logger.info("Shutting down GNews Service...")
                break
            except Exception as e:
                logger.error(f"Error in main loop: {e}")
                time.sleep(30)

    def close(self):
        """Close RabbitMQ connection"""
        if self.connection and not self.connection.is_closed:
            self.connection.close()
            logger.info("RabbitMQ connection closed")

if __name__ == '__main__':
    service = GNewsService()
    try:
        service.run()
    finally:
        service.close()
