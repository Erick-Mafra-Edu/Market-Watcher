"""
GNews Service - News scraping service using ranahaani/GNews
Monitors news for market topics and publishes to RabbitMQ
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

# Market topics to monitor
MARKET_TOPICS = [
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
    'market rally'
]

class GNewsService:
    """Service for fetching and publishing market news"""
    
    def __init__(self):
        self.gnews = GNews(language='en', max_results=10)
        self.connection = None
        self.channel = None
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
    
    def process_article(self, article, topic):
        """Process and structure article data"""
        return {
            'title': article.get('title', ''),
            'description': article.get('description', ''),
            'url': article.get('url', ''),
            'source': article.get('publisher', {}).get('title', 'Unknown'),
            'published_at': article.get('published date', datetime.utcnow().isoformat()),
            'topic': topic,
            'fetched_at': datetime.utcnow().isoformat()
        }
    
    def run(self):
        """Main service loop"""
        logger.info("GNews Service started")
        logger.info(f"Monitoring topics: {', '.join(MARKET_TOPICS)}")
        logger.info(f"Check interval: {CHECK_INTERVAL} seconds")
        
        processed_urls = set()
        
        while True:
            try:
                for topic in MARKET_TOPICS:
                    articles = self.fetch_news(topic)
                    
                    for article in articles:
                        url = article.get('url', '')
                        if url and url not in processed_urls:
                            news_data = self.process_article(article, topic)
                            self.publish_news(news_data)
                            processed_urls.add(url)
                            
                            # Limit processed URLs cache size
                            if len(processed_urls) > 10000:
                                processed_urls = set(list(processed_urls)[-5000:])
                    
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
