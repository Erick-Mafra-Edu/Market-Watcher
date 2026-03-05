import sys
import unittest
from pathlib import Path
import types

from bs4 import BeautifulSoup

class _DummyPikaObject:
    def __init__(self, *args, **kwargs):
        pass


sys.modules.setdefault(
    'pika',
    types.SimpleNamespace(
        PlainCredentials=_DummyPikaObject,
        ConnectionParameters=_DummyPikaObject,
        BlockingConnection=_DummyPikaObject,
        BasicProperties=_DummyPikaObject,
    ),
)

sys.path.append(str(Path(__file__).resolve().parents[1] / 'src'))
from main import StatusInvestScraper


class StatusInvestParserTests(unittest.TestCase):
    def setUp(self):
        self.scraper = StatusInvestScraper(connect_rabbitmq=False)

    def tearDown(self):
        self.scraper.close()

    def test_normalize_brazilian_percent(self):
        self.assertEqual(self.scraper._normalize_numeric('5,42%'), 5.42)

    def test_normalize_thousand_decimal(self):
        self.assertEqual(self.scraper._normalize_numeric('1.234,56'), 1234.56)

    def test_normalize_suffix_multiplier(self):
        self.assertEqual(self.scraper._normalize_numeric('2,5M'), 2500000.0)

    def test_extract_indicator_from_label_and_value(self):
        html = """
        <div>
          <span>DY</span><strong>7,10%</strong>
          <span>P/VP</span><strong>1,35</strong>
          <span>P/L</span><strong>10,42</strong>
          <span>ROE</span><strong>15,90%</strong>
          <span>Liquidez media diaria</span><strong>1,2M</strong>
        </div>
        """
        soup = BeautifulSoup(html, 'html.parser')

        self.assertEqual(self.scraper._extract_indicator(soup, 'dividend-yield'), 7.10)
        self.assertEqual(self.scraper._extract_indicator(soup, 'p-vp'), 1.35)
        self.assertEqual(self.scraper._extract_indicator(soup, 'p-l'), 10.42)
        self.assertEqual(self.scraper._extract_indicator(soup, 'roe'), 15.90)
        self.assertEqual(self.scraper._extract_indicator(soup, 'liquidity'), 1200000.0)

    def test_extract_indicator_returns_none_when_missing(self):
        soup = BeautifulSoup('<div><span>Sem indicadores</span></div>', 'html.parser')
        self.assertIsNone(self.scraper._extract_indicator(soup, 'p-l'))


if __name__ == '__main__':
    unittest.main()