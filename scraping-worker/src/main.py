"""
Scraping Worker - StatusInvest web scraping service
Scrapes fundamental data from StatusInvest and publishes to RabbitMQ
"""
import os
import time
import json
import logging
import re
from datetime import datetime, timezone
from typing import Dict, List, Optional
import requests
from bs4 import BeautifulSoup
import pika
from prometheus_client import start_http_server
from metrics import (
    registry,
    scraping_requests,
    dividends_found,
    fundamental_data_scraped,
    scraping_duration,
    scraping_errors,
    status_invest_requests,
)

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
BRAPI_TOKEN = os.getenv('BRAPI_TOKEN')
BRAPI_BASE_URL = os.getenv('BRAPI_BASE_URL', 'https://brapi.dev/api')
YAHOO_CHART_BASE_URL = os.getenv('YAHOO_CHART_BASE_URL', 'https://query2.finance.yahoo.com/v8/finance/chart')

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
        self.brapi_dividends_enabled = True
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
                self.channel.exchange_declare(
                    exchange='dividend_events',
                    exchange_type='fanout',
                    durable=True
                )
                
                self.channel.queue_declare(queue='fundamentals_queue', durable=True)
                self.channel.queue_bind(
                    exchange='fundamental_data',
                    queue='fundamentals_queue'
                )
                self.channel.queue_declare(queue='dividends_queue', durable=True)
                self.channel.queue_bind(
                    exchange='dividend_events',
                    queue='dividends_queue'
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
        start_time = time.time()
        try:
            url = f"{self.BASE_URL}/{symbol.lower()}"
            logger.info(f"Scraping data for {symbol} from {url}")
            
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            status_invest_requests.labels(status='success').inc()
            
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
                'scraped_at': datetime.now(timezone.utc).isoformat()
            }
            
            duration = time.time() - start_time
            scraping_duration.labels(symbol=symbol).observe(duration)
            scraping_requests.labels(status='success').inc()
            fundamental_data_scraped.labels(symbol=symbol, status='success').inc()
            logger.info(f"Successfully scraped data for {symbol}")
            return data
            
        except requests.RequestException as e:
            status_invest_requests.labels(status='failure').inc()
            scraping_requests.labels(status='failure').inc()
            scraping_errors.labels(error_type='request_error').inc()
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

    def _normalize_date(self, raw_value) -> Optional[str]:
        """Normalize date strings to YYYY-MM-DD."""
        if not raw_value:
            return None

        if isinstance(raw_value, (int, float)):
            try:
                return datetime.fromtimestamp(float(raw_value), tz=timezone.utc).date().isoformat()
            except (ValueError, OSError, OverflowError):
                return None

        if isinstance(raw_value, str) and raw_value.strip().isdigit():
            try:
                return datetime.fromtimestamp(float(raw_value.strip()), tz=timezone.utc).date().isoformat()
            except (ValueError, OSError, OverflowError):
                return None

        for pattern in ['%d/%m/%Y', '%Y-%m-%d']:
            try:
                return datetime.strptime(raw_value.strip(), pattern).date().isoformat()
            except ValueError:
                continue

        return None

    def _infer_dividend_type(self, raw_text: str) -> str:
        """Infer dividend type from free text snippets."""
        lowered = (raw_text or '').lower()
        if 'jcp' in lowered or 'jscp' in lowered:
            return 'JCP'
        if 'rendimento' in lowered:
            return 'INCOME'
        if 'dividendo' in lowered or 'dividend' in lowered:
            return 'DIVIDEND'
        return 'UNKNOWN'

    def _extract_dividend_events(self, soup: BeautifulSoup, symbol: str) -> List[Dict]:
        """Extract dividend events from common tabular rows in the page."""
        events: List[Dict] = []
        seen_keys = set()

        # Typical pages expose dividend history in table rows.
        for row in soup.find_all('tr'):
            row_text = row.get_text(' ', strip=True)
            if not row_text:
                continue

            lowered = row_text.lower()
            if not any(term in lowered for term in ['dividendo', 'dividend', 'jcp', 'provento', 'rendimento']):
                continue

            dates = re.findall(r'\b\d{2}/\d{2}/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b', row_text)
            if not dates:
                continue

            ex_date = self._normalize_date(dates[0])
            if not ex_date:
                continue

            payment_date = self._normalize_date(dates[1]) if len(dates) > 1 else None

            amount_tokens = re.findall(r'(?:R\$\s*)?\d+[\.,]\d{1,6}', row_text)
            dividend_amount = None
            for token in amount_tokens:
                parsed_amount = self._normalize_numeric(token)
                if parsed_amount is not None and 0 < parsed_amount < 1000:
                    dividend_amount = parsed_amount
                    break

            if dividend_amount is None:
                continue

            dividend_type = self._infer_dividend_type(row_text)
            event_key = (symbol, ex_date, dividend_type)
            if event_key in seen_keys:
                continue

            seen_keys.add(event_key)
            events.append({
                'symbol': symbol,
                'dividend_amount': dividend_amount,
                'ex_date': ex_date,
                'payment_date': payment_date,
                'dividend_type': dividend_type,
                'source': 'statusinvest',
                'scraped_at': datetime.now(timezone.utc).isoformat(),
            })

        return events

    def _normalize_dividend_event(self, raw_event: Dict, symbol: str, source: str) -> Optional[Dict]:
        """Normalize event-like dicts from multiple providers into a common format."""
        amount_candidates = [
            raw_event.get('dividend_amount'),
            raw_event.get('amount'),
            raw_event.get('value'),
            raw_event.get('cashDividends'),
            raw_event.get('rate'),
            raw_event.get('valor'),
        ]
        dividend_amount = None
        for candidate in amount_candidates:
            parsed_amount = self._normalize_numeric(candidate)
            if parsed_amount is not None:
                dividend_amount = parsed_amount
                break

        ex_date_candidates = [
            raw_event.get('ex_date'),
            raw_event.get('exDate'),
            raw_event.get('exDividendDate'),
            raw_event.get('date'),
            raw_event.get('dataCom'),
        ]
        ex_date = None
        for candidate in ex_date_candidates:
            parsed_ex_date = self._normalize_date(candidate)
            if parsed_ex_date:
                ex_date = parsed_ex_date
                break

        payment_date_candidates = [
            raw_event.get('payment_date'),
            raw_event.get('paymentDate'),
            raw_event.get('payDate'),
            raw_event.get('dataPagamento'),
        ]
        payment_date = None
        for candidate in payment_date_candidates:
            parsed_payment_date = self._normalize_date(candidate)
            if parsed_payment_date:
                payment_date = parsed_payment_date
                break

        type_candidates = [
            raw_event.get('dividend_type'),
            raw_event.get('type'),
            raw_event.get('label'),
            raw_event.get('description'),
        ]
        inferred_type = next((self._infer_dividend_type(str(v)) for v in type_candidates if v), 'UNKNOWN')

        if dividend_amount is None or not ex_date:
            return None

        return {
            'symbol': symbol,
            'dividend_amount': dividend_amount,
            'ex_date': ex_date,
            'payment_date': payment_date,
            'dividend_type': inferred_type,
            'source': source,
            'scraped_at': datetime.now(timezone.utc).isoformat(),
        }

    def _extract_brapi_dividend_events(self, payload: Dict, symbol: str) -> List[Dict]:
        """Extract dividend events from BRAPI quote payload."""
        events: List[Dict] = []
        results = payload.get('results') if isinstance(payload, dict) else None

        if not isinstance(results, list) or len(results) == 0:
            return events

        result = results[0]
        if not isinstance(result, dict):
            return events

        candidate_lists: List[List[Dict]] = []
        direct_keys = ['dividendsData', 'dividends', 'cashDividends', 'stockDividends']

        for key in direct_keys:
            value = result.get(key)
            if isinstance(value, list):
                candidate_lists.append(value)

        if isinstance(result.get('dividendsData'), dict):
            nested = result['dividendsData']
            for key in ['cashDividends', 'stockDividends', 'allDividends', 'results']:
                value = nested.get(key)
                if isinstance(value, list):
                    candidate_lists.append(value)

        for candidate_list in candidate_lists:
            for raw_event in candidate_list:
                if not isinstance(raw_event, dict):
                    continue

                normalized = self._normalize_dividend_event(raw_event, symbol, 'brapi')
                if normalized:
                    events.append(normalized)

        return events

    def fetch_brapi_dividend_events(self, symbol: str) -> List[Dict]:
        """Fetch dividend events from BRAPI as a complementary source."""
        if not self.brapi_dividends_enabled:
            return []

        try:
            params = {
                'modules': 'dividends',
                'range': '5y',
                'interval': '1d',
            }

            if BRAPI_TOKEN:
                params['token'] = BRAPI_TOKEN

            response = self.session.get(
                f"{BRAPI_BASE_URL}/quote/{symbol}",
                params=params,
                timeout=10
            )
            response.raise_for_status()

            payload = response.json()
            events = self._extract_brapi_dividend_events(payload, symbol)

            if events:
                logger.info(f"Fetched {len(events)} BRAPI dividend events for {symbol}")
            else:
                logger.info(f"No BRAPI dividend events found for {symbol}")

            return events
        except requests.RequestException as e:
            response = getattr(e, 'response', None)
            if response is not None and response.status_code == 400:
                try:
                    payload = response.json()
                    message = str(payload.get('message', ''))
                except ValueError:
                    message = response.text

                if 'não estão disponíveis no seu plano' in message or 'nao estao disponiveis no seu plano' in message.lower():
                    self.brapi_dividends_enabled = False
                    logger.warning(
                        'BRAPI dividends module is unavailable for current plan. '
                        'Disabling BRAPI dividends fetch and using fallback sources only.'
                    )

            logger.error(f"Error fetching BRAPI dividend events for {symbol}: {e}")
            return []
        except ValueError as e:
            logger.error(f"Error parsing BRAPI response for {symbol}: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error fetching BRAPI dividend events for {symbol}: {e}")
            return []

    def _extract_yahoo_dividend_events(self, payload: Dict, symbol: str) -> List[Dict]:
        """Extract dividend events from Yahoo chart/events payload."""
        events: List[Dict] = []
        chart = payload.get('chart') if isinstance(payload, dict) else None
        results = chart.get('result') if isinstance(chart, dict) else None

        if not isinstance(results, list) or len(results) == 0:
            return events

        result = results[0]
        if not isinstance(result, dict):
            return events

        raw_dividends = (result.get('events') or {}).get('dividends')
        if not isinstance(raw_dividends, dict):
            return events

        for raw_event in raw_dividends.values():
            if not isinstance(raw_event, dict):
                continue

            normalized = self._normalize_dividend_event(raw_event, symbol, 'yahoo')
            if normalized:
                normalized['dividend_type'] = normalized.get('dividend_type') or 'DIVIDEND'
                events.append(normalized)

        return events

    def fetch_yahoo_dividend_events(self, symbol: str) -> List[Dict]:
        """Fetch dividend events from Yahoo chart API as temporary fallback source."""
        try:
            yahoo_symbol = symbol if symbol.endswith('.SA') else f"{symbol}.SA"
            response = self.session.get(
                f"{YAHOO_CHART_BASE_URL}/{yahoo_symbol}",
                params={
                    'interval': '1mo',
                    'range': '10y',
                    'events': 'div',
                },
                timeout=10,
            )
            response.raise_for_status()

            payload = response.json()
            events = self._extract_yahoo_dividend_events(payload, symbol)

            if events:
                logger.info(f"Fetched {len(events)} Yahoo dividend events for {symbol}")
            else:
                logger.info(f"No Yahoo dividend events found for {symbol}")

            return events
        except requests.RequestException as e:
            logger.error(f"Error fetching Yahoo dividend events for {symbol}: {e}")
            return []
        except ValueError as e:
            logger.error(f"Error parsing Yahoo response for {symbol}: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error fetching Yahoo dividend events for {symbol}: {e}")
            return []

    def merge_dividend_events(self, *event_lists: List[Dict]) -> List[Dict]:
        """Merge and deduplicate events from multiple sources.

        Dedup key: symbol + ex_date + dividend_type. When duplicated, BRAPI is preferred.
        """
        by_key: Dict[tuple, Dict] = {}

        def score(event: Dict) -> int:
            base = 0
            base += 2 if event.get('payment_date') else 0
            base += 1 if event.get('dividend_amount') is not None else 0
            base += 1 if event.get('source') == 'brapi' else 0
            return base

        for events in event_lists:
            for event in events:
                key = (event.get('symbol'), event.get('ex_date'), event.get('dividend_type'))
                if key not in by_key or score(event) > score(by_key[key]):
                    by_key[key] = event

        return list(by_key.values())

    def scrape_dividend_events(self, symbol: str) -> List[Dict]:
        """Scrape dividend events for a stock from StatusInvest."""
        try:
            url = f"{self.BASE_URL}/{symbol.lower()}"
            response = self.session.get(url, timeout=10)
            response.raise_for_status()

            soup = BeautifulSoup(response.content, 'html.parser')
            events = self._extract_dividend_events(soup, symbol)

            if events:
                # Track dividends found - THIS IS THE KEY METRIC!
                dividends_found.labels(symbol=symbol).inc(len(events))
                logger.info(f"Extracted {len(events)} dividend events for {symbol}")
            else:
                logger.info(f"No dividend events found for {symbol}")

            return events
        except requests.RequestException as e:
            scraping_errors.labels(error_type='dividend_request_error').inc()
            logger.error(f"Error scraping dividend events for {symbol}: {e}")
            return []
        except Exception as e:
            scraping_errors.labels(error_type='dividend_parse_error').inc()
            logger.error(f"Unexpected error scraping dividend events for {symbol}: {e}")
            return []
    
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

    def publish_dividend_events(self, events: List[Dict]):
        """Publish dividend event messages to RabbitMQ."""
        if not events:
            return

        try:
            for event in events:
                self.channel.basic_publish(
                    exchange='dividend_events',
                    routing_key='',
                    body=json.dumps(event),
                    properties=pika.BasicProperties(
                        delivery_mode=2,
                        content_type='application/json'
                    )
                )

            symbol = events[0].get('symbol', 'N/A')
            logger.info(f"Published {len(events)} dividend events for {symbol}")
        except Exception as e:
            logger.error(f"Error publishing dividend events: {e}")
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

                    statusinvest_dividend_events = self.scrape_dividend_events(symbol)
                    brapi_dividend_events = self.fetch_brapi_dividend_events(symbol)
                    yahoo_dividend_events = self.fetch_yahoo_dividend_events(symbol)
                    merged_dividend_events = self.merge_dividend_events(
                        statusinvest_dividend_events,
                        brapi_dividend_events,
                        yahoo_dividend_events,
                    )
                    self.publish_dividend_events(merged_dividend_events)
                    
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
    # Start Prometheus metrics server on port 8001
    start_http_server(8001, registry=registry)
    logger.info("Prometheus metrics server started on port 8001")
    
    scraper = StatusInvestScraper()
    try:
        scraper.run()
    finally:
        scraper.close()
