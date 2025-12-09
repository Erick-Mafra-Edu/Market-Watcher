"""
Scraping Worker - StatusInvest web scraping service
Scrapes fundamental data from StatusInvest and publishes to RabbitMQ
"""
import os
import time
import json
import logging
from datetime import datetime
from typing import Dict, Optional
import requests
from bs4 import BeautifulSoup
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
CHECK_INTERVAL = int(os.getenv('CHECK_INTERVAL', '300'))

# Brazilian stocks to monitor
BRAZILIAN_STOCKS = [
    'PETR4', 'VALE3', 'ITUB4', 'BBDC4', 'ABEV3',
    'B3SA3', 'WEGE3', 'RENT3', 'MGLU3', 'SUZB3'
]

class StatusInvestScraper:
    """Scraper for StatusInvest website"""
    
    BASE_URL = 'https://statusinvest.com.br/acoes'
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
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
                    exchange='fundamental_data',
                    exchange_type='fanout',
                    durable=True
                )
                
                self.channel.queue_declare(queue='fundamentals_queue', durable=True)
                self.channel.queue_bind(
                    exchange='fundamental_data',
                    queue='fundamentals_queue'
                )
                
                logger.info("Successfully connected to RabbitMQ")
                return
                
            except Exception as e:
                logger.error(f"Failed to connect to RabbitMQ (attempt {attempt + 1}/{max_retries}): {e}")
                if attempt < max_retries - 1:
                    time.sleep(retry_delay)
                else:
                    raise
    
    def scrape_stock(self, symbol: str) -> Optional[Dict]:
        """Scrape fundamental data for a stock from StatusInvest"""
        try:
            url = f"{self.BASE_URL}/{symbol.lower()}"
            logger.info(f"Scraping data for {symbol} from {url}")
            
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Extract fundamental indicators
            # Note: This is a simplified version. Real implementation would need
            # to parse actual StatusInvest HTML structure
            data = {
                'symbol': symbol,
                'dividend_yield': self._extract_indicator(soup, 'dividend-yield'),
                'p_vp': self._extract_indicator(soup, 'p-vp'),
                'p_l': self._extract_indicator(soup, 'p-l'),
                'roe': self._extract_indicator(soup, 'roe'),
                'liquidity': self._extract_indicator(soup, 'liquidity'),
                'scraped_at': datetime.utcnow().isoformat()
            }
            
            logger.info(f"Successfully scraped data for {symbol}")
            return data
            
        except requests.RequestException as e:
            logger.error(f"Error scraping {symbol}: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error scraping {symbol}: {e}")
            return None
    
    def _extract_indicator(self, soup: BeautifulSoup, indicator_name: str) -> Optional[float]:
        """Extract a specific indicator from the page
        
        NOTE: This is currently a MOCK implementation for demonstration purposes.
        In production, this should parse actual HTML elements from StatusInvest.
        
        To implement properly:
        1. Inspect StatusInvest page HTML structure
        2. Find the correct CSS selectors or element IDs
        3. Parse and convert values to float
        4. Handle missing or invalid data gracefully
        
        Example real implementation:
            element = soup.find('div', {'title': indicator_name})
            if element:
                value_text = element.find('strong').text.strip()
                return float(value_text.replace(',', '.').replace('%', ''))
        """
        try:
            # MOCK DATA - Replace with actual HTML parsing
            # TODO: Implement real StatusInvest HTML parsing
            logger.warning(f'Using mock data for {indicator_name} - implement actual HTML parsing for production')
            
            mock_data = {
                'dividend-yield': 5.5,
                'p-vp': 2.3,
                'p-l': 15.2,
                'roe': 18.5,
                'liquidity': 1000000
            }
            return mock_data.get(indicator_name, 0.0)
        except Exception as e:
            logger.error(f"Error extracting {indicator_name}: {e}")
            return None
    
    def publish_data(self, data: Dict):
        """Publish fundamental data to RabbitMQ"""
        try:
            message = json.dumps(data)
            self.channel.basic_publish(
                exchange='fundamental_data',
                routing_key='',
                body=message,
                properties=pika.BasicProperties(
                    delivery_mode=2,  # Make message persistent
                    content_type='application/json'
                )
            )
            logger.info(f"Published fundamental data for {data.get('symbol', 'N/A')}")
        except Exception as e:
            logger.error(f"Error publishing data: {e}")
            # Reconnect if connection was lost
            self.connect_rabbitmq()
    
    def run(self):
        """Main service loop"""
        logger.info("Scraping Worker started")
        logger.info(f"Monitoring {len(BRAZILIAN_STOCKS)} Brazilian stocks")
        logger.info(f"Check interval: {CHECK_INTERVAL} seconds")
        
        while True:
            try:
                for symbol in BRAZILIAN_STOCKS:
                    data = self.scrape_stock(symbol)
                    
                    if data:
                        self.publish_data(data)
                    
                    # Delay between requests to avoid rate limiting
                    time.sleep(3)
                
                logger.info(f"Completed scraping cycle. Sleeping for {CHECK_INTERVAL} seconds...")
                time.sleep(CHECK_INTERVAL)
                
            except KeyboardInterrupt:
                logger.info("Shutting down Scraping Worker...")
                break
            except Exception as e:
                logger.error(f"Error in main loop: {e}")
                time.sleep(30)
    
    def close(self):
        """Close connections"""
        if self.connection and not self.connection.is_closed:
            self.connection.close()
            logger.info("RabbitMQ connection closed")
        self.session.close()
        logger.info("HTTP session closed")

if __name__ == '__main__':
    scraper = StatusInvestScraper()
    try:
        scraper.run()
    finally:
        scraper.close()
