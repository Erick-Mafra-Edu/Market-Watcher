"""
Scraping Worker - StatusInvest web scraping service
Scrapes fundamental data from StatusInvest and publishes to RabbitMQ
"""
import os
import time
import json
import logging
import re
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
    
    INDICATOR_ALIASES = {
        'dividend-yield': ['dividend yield', 'dy', 'dividend-yield'],
        'p-vp': ['p/vp', 'p vp', 'p-vp', 'pvp'],
        'p-l': ['p/l', 'p l', 'p-l', 'pl'],
        'roe': ['roe', 'return on equity'],
        'liquidity': ['liquidez media diaria', 'liquidez media', 'liquidity'],
    }

    def __init__(self, connect_rabbitmq: bool = True):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        self.connection = None
        self.channel = None
        if connect_rabbitmq:
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
    
    def _normalize_numeric(self, raw_value: str) -> Optional[float]:
        """Normalize numeric strings from Brazilian/US formats into float."""
        if raw_value is None:
            return None

        text = str(raw_value).strip().replace('\xa0', ' ')
        if text in ['', '-', '--', 'N/A', 'n/a']:
            return None

        multiplier = 1.0
        lowered = text.lower()
        if lowered.endswith('k'):
            multiplier = 1_000.0
            text = text[:-1]
        elif lowered.endswith('m'):
            multiplier = 1_000_000.0
            text = text[:-1]
        elif lowered.endswith('b'):
            multiplier = 1_000_000_000.0
            text = text[:-1]

        cleaned = re.sub(r'[^0-9,.-]', '', text)
        if not cleaned or cleaned in ['-', '.', ',']:
            return None

        if ',' in cleaned and '.' in cleaned:
            if cleaned.rfind(',') > cleaned.rfind('.'):
                cleaned = cleaned.replace('.', '').replace(',', '.')
            else:
                cleaned = cleaned.replace(',', '')
        elif ',' in cleaned:
            parts = cleaned.split(',')
            if len(parts) == 2 and len(parts[1]) <= 2:
                cleaned = cleaned.replace(',', '.')
            else:
                cleaned = cleaned.replace(',', '')

        try:
            return float(cleaned) * multiplier
        except ValueError:
            return None

    def _extract_indicator(self, soup: BeautifulSoup, indicator_name: str) -> Optional[float]:
        """Extract a specific indicator from page text and nearby DOM labels."""
        try:
            aliases = self.INDICATOR_ALIASES.get(indicator_name, [indicator_name])
            page_text = soup.get_text(' ', strip=True)

            for alias in aliases:
                pattern = re.compile(
                    rf'{re.escape(alias)}\s*[:\-]?\s*([-+]?[0-9][0-9\.,]*(?:\s*[kKmMbB]|%)?)',
                    re.IGNORECASE
                )
                match = pattern.search(page_text)
                if match:
                    parsed = self._normalize_numeric(match.group(1).strip())
                    if parsed is not None:
                        return parsed

            numeric_token = re.compile(r'[-+]?[0-9][0-9\.,]*(?:\s*[kKmMbB]|%)?')
            for label_node in soup.find_all(string=True):
                label_text = label_node.strip().lower()
                if not label_text:
                    continue

                if not any(alias in label_text for alias in aliases):
                    continue

                parent = label_node.parent
                candidate_blocks = []

                if parent:
                    candidate_blocks.append(parent.get_text(' ', strip=True))
                    sibling = parent.find_next_sibling()
                    if sibling:
                        candidate_blocks.append(sibling.get_text(' ', strip=True))

                for block in candidate_blocks:
                    tokens = numeric_token.findall(block)
                    for token in reversed(tokens):
                        parsed = self._normalize_numeric(token.strip())
                        if parsed is not None:
                            return parsed

            logger.warning(f'Indicator not found for {indicator_name}')
            return None
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
