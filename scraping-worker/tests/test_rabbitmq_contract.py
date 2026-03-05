"""
RabbitMQ contract tests for StatusInvestScraper (producer side).

Validates that scrape_stock() produces a fundamental_data payload that
satisfies the contract agreed with the notifier-service consumer:

  Required fields: symbol, dividend_yield, p_vp, p_l, roe, liquidity, scraped_at

Run with:
  python -m pytest tests/test_rabbitmq_contract.py -v
"""
import json
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from bs4 import BeautifulSoup

# ---------------------------------------------------------------------------
# Stub pika so the import succeeds without a live broker
# ---------------------------------------------------------------------------

class _DummyPikaObject:
    def __init__(self, *args, **kwargs):
        pass


sys.modules.setdefault(
    "pika",
    types.SimpleNamespace(
        PlainCredentials=_DummyPikaObject,
        ConnectionParameters=_DummyPikaObject,
        BlockingConnection=_DummyPikaObject,
        BasicProperties=_DummyPikaObject,
    ),
)

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from main import StatusInvestScraper  # noqa: E402

# ---------------------------------------------------------------------------
# Minimal HTML fixture representing a StatusInvest stock page
# ---------------------------------------------------------------------------

_FIXTURE_HTML = """
<html><body>
  <div>
    <span>Dividend Yield</span><strong>7,10%</strong>
    <span>P/VP</span><strong>1,35</strong>
    <span>P/L</span><strong>10,42</strong>
    <span>ROE</span><strong>15,90%</strong>
    <span>Liquidez media diaria</span><strong>1,2M</strong>
  </div>
</body></html>
"""

_DIVIDENDS_FIXTURE_HTML = """
<html><body>
    <table>
        <tr>
            <td>Dividendo</td>
            <td>0,85</td>
            <td>15/03/2026</td>
            <td>30/03/2026</td>
        </tr>
        <tr>
            <td>JCP</td>
            <td>0,42</td>
            <td>2026-04-10</td>
            <td>2026-04-25</td>
        </tr>
    </table>
</body></html>
"""

_BRAPI_DIVIDENDS_FIXTURE = {
    "results": [
        {
            "symbol": "PETR4",
            "dividendsData": {
                "cashDividends": [
                    {
                        "rate": 0.91,
                        "exDate": "2026-05-10",
                        "paymentDate": "2026-05-25",
                        "label": "Dividendo"
                    }
                ]
            }
        }
    ]
}

_REQUIRED_FIELDS = [
    "symbol",
    "dividend_yield",
    "p_vp",
    "p_l",
    "roe",
    "liquidity",
    "scraped_at",
]

# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class ScrapingWorkerContractTests(unittest.TestCase):
    """Producer-side contract tests for the fundamental_data payload."""

    def setUp(self):
        self.scraper = StatusInvestScraper(connect_rabbitmq=False)

    def tearDown(self):
        self.scraper.close()

    # -----------------------------------------------------------------------
    # Required-field presence
    # -----------------------------------------------------------------------

    def _scrape_with_fixture(self, symbol: str = "PETR4") -> dict:
        """Run scrape_stock() against the HTML fixture instead of a live URL."""
        mock_response = MagicMock()
        mock_response.content = _FIXTURE_HTML.encode("utf-8")
        mock_response.raise_for_status = MagicMock()

        with patch.object(self.scraper.session, "get", return_value=mock_response):
            result = self.scraper.scrape_stock(symbol)

        self.assertIsNotNone(result, "scrape_stock() must not return None for a valid page")
        return result

    def test_payload_contains_all_required_fields(self):
        payload = self._scrape_with_fixture()
        for field in _REQUIRED_FIELDS:
            self.assertIn(field, payload, f"Required field '{field}' is missing")

    def test_symbol_matches_input(self):
        payload = self._scrape_with_fixture("VALE3")
        self.assertEqual(payload["symbol"], "VALE3")

    def test_scraped_at_is_iso_string(self):
        import re
        payload = self._scrape_with_fixture()
        self.assertIsInstance(payload["scraped_at"], str)
        # ISO-8601 basic check: contains a 'T' separator
        self.assertRegex(payload["scraped_at"], r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}")

    # -----------------------------------------------------------------------
    # Numeric indicator types
    # -----------------------------------------------------------------------

    def test_dividend_yield_is_float_or_none(self):
        payload = self._scrape_with_fixture()
        self.assertIsInstance(payload["dividend_yield"], (float, type(None)))

    def test_p_vp_is_float_or_none(self):
        payload = self._scrape_with_fixture()
        self.assertIsInstance(payload["p_vp"], (float, type(None)))

    def test_p_l_is_float_or_none(self):
        payload = self._scrape_with_fixture()
        self.assertIsInstance(payload["p_l"], (float, type(None)))

    def test_roe_is_float_or_none(self):
        payload = self._scrape_with_fixture()
        self.assertIsInstance(payload["roe"], (float, type(None)))

    def test_liquidity_is_float_or_none(self):
        payload = self._scrape_with_fixture()
        self.assertIsInstance(payload["liquidity"], (float, type(None)))

    # -----------------------------------------------------------------------
    # None for missing indicators (graceful degradation)
    # -----------------------------------------------------------------------

    def test_missing_indicators_are_none(self):
        """When the page has no recognised indicator, all five must be None."""
        empty_html = "<html><body><p>Sem dados</p></body></html>"
        mock_response = MagicMock()
        mock_response.content = empty_html.encode("utf-8")
        mock_response.raise_for_status = MagicMock()

        with patch.object(self.scraper.session, "get", return_value=mock_response):
            result = self.scraper.scrape_stock("ABEV3")

        self.assertIsNotNone(result)
        for field in ["dividend_yield", "p_vp", "p_l", "roe", "liquidity"]:
            self.assertIsNone(result[field], f"Expected None for missing indicator '{field}'")

    # -----------------------------------------------------------------------
    # Payload is JSON-serialisable (broker compatibility)
    # -----------------------------------------------------------------------

    def test_payload_is_json_serialisable(self):
        payload = self._scrape_with_fixture()
        try:
            serialised = json.dumps(payload)
            recovered = json.loads(serialised)
        except (TypeError, ValueError) as exc:
            self.fail(f"Payload is not JSON-serialisable: {exc}")

        self.assertEqual(recovered["symbol"], payload["symbol"])

    # -----------------------------------------------------------------------
    # publish_data serialises to the correct exchange
    # -----------------------------------------------------------------------

    def test_publish_data_sends_to_fundamental_data_exchange(self):
        mock_channel = MagicMock()
        self.scraper.channel = mock_channel

        sample_payload = {
            "symbol": "ITUB4",
            "dividend_yield": 5.0,
            "p_vp": 1.8,
            "p_l": 9.0,
            "roe": 18.0,
            "liquidity": 700_000.0,
            "scraped_at": "2026-03-05T10:00:00",
        }

        self.scraper.publish_data(sample_payload)

        mock_channel.basic_publish.assert_called_once()
        call_kwargs = mock_channel.basic_publish.call_args
        self.assertEqual(call_kwargs.kwargs.get("exchange", call_kwargs.args[0] if call_kwargs.args else None), "fundamental_data")

    def test_publish_data_sends_valid_json_body(self):
        mock_channel = MagicMock()
        self.scraper.channel = mock_channel

        sample_payload = {
            "symbol": "BBDC4",
            "dividend_yield": 6.5,
            "p_vp": 1.5,
            "p_l": 8.5,
            "roe": 22.0,
            "liquidity": 600_000.0,
            "scraped_at": "2026-03-05T10:00:00",
        }

        self.scraper.publish_data(sample_payload)

        body = mock_channel.basic_publish.call_args.kwargs.get("body")
        if body is None:
            # positional args fallback
            body = mock_channel.basic_publish.call_args.args[2]

        parsed = json.loads(body)
        self.assertEqual(parsed["symbol"], sample_payload["symbol"])
        for field in _REQUIRED_FIELDS:
            self.assertIn(field, parsed)

    # -----------------------------------------------------------------------
    # Dividend events payload and exchange contract
    # -----------------------------------------------------------------------

    def test_scrape_dividend_events_extracts_required_fields(self):
        mock_response = MagicMock()
        mock_response.content = _DIVIDENDS_FIXTURE_HTML.encode("utf-8")
        mock_response.raise_for_status = MagicMock()

        with patch.object(self.scraper.session, "get", return_value=mock_response):
            events = self.scraper.scrape_dividend_events("PETR4")

        self.assertGreaterEqual(len(events), 1)
        first = events[0]

        for field in [
            "symbol",
            "dividend_amount",
            "ex_date",
            "payment_date",
            "dividend_type",
            "source",
            "scraped_at",
        ]:
            self.assertIn(field, first)

        self.assertEqual(first["symbol"], "PETR4")
        self.assertIsInstance(first["dividend_amount"], float)

    def test_publish_dividend_events_sends_to_dividend_events_exchange(self):
        mock_channel = MagicMock()
        self.scraper.channel = mock_channel

        events = [
            {
                "symbol": "ITUB4",
                "dividend_amount": 0.65,
                "ex_date": "2026-03-20",
                "payment_date": "2026-03-31",
                "dividend_type": "DIVIDEND",
                "source": "statusinvest",
                "scraped_at": "2026-03-05T10:00:00",
            }
        ]

        self.scraper.publish_dividend_events(events)

        mock_channel.basic_publish.assert_called_once()
        call_kwargs = mock_channel.basic_publish.call_args
        exchange = call_kwargs.kwargs.get("exchange", call_kwargs.args[0] if call_kwargs.args else None)
        self.assertEqual(exchange, "dividend_events")

    def test_publish_dividend_events_sends_valid_json_body(self):
        mock_channel = MagicMock()
        self.scraper.channel = mock_channel

        events = [
            {
                "symbol": "BBDC4",
                "dividend_amount": 0.31,
                "ex_date": "2026-04-10",
                "payment_date": "2026-04-22",
                "dividend_type": "JCP",
                "source": "statusinvest",
                "scraped_at": "2026-03-05T10:00:00",
            }
        ]

        self.scraper.publish_dividend_events(events)

        body = mock_channel.basic_publish.call_args.kwargs.get("body")
        if body is None:
            body = mock_channel.basic_publish.call_args.args[2]

        parsed = json.loads(body)
        self.assertEqual(parsed["symbol"], "BBDC4")
        self.assertEqual(parsed["dividend_type"], "JCP")

    def test_fetch_brapi_dividend_events_extracts_required_fields(self):
        mock_response = MagicMock()
        mock_response.json.return_value = _BRAPI_DIVIDENDS_FIXTURE
        mock_response.raise_for_status = MagicMock()

        with patch.object(self.scraper.session, "get", return_value=mock_response):
            events = self.scraper.fetch_brapi_dividend_events("PETR4")

        self.assertEqual(len(events), 1)
        first = events[0]
        self.assertEqual(first["symbol"], "PETR4")
        self.assertEqual(first["source"], "brapi")
        self.assertEqual(first["ex_date"], "2026-05-10")
        self.assertEqual(first["payment_date"], "2026-05-25")
        self.assertAlmostEqual(first["dividend_amount"], 0.91)

    def test_merge_dividend_events_prefers_brapi_on_duplicates(self):
        statusinvest = [
            {
                "symbol": "PETR4",
                "dividend_amount": 0.9,
                "ex_date": "2026-05-10",
                "payment_date": None,
                "dividend_type": "DIVIDEND",
                "source": "statusinvest",
                "scraped_at": "2026-03-05T10:00:00",
            }
        ]
        brapi = [
            {
                "symbol": "PETR4",
                "dividend_amount": 0.91,
                "ex_date": "2026-05-10",
                "payment_date": "2026-05-25",
                "dividend_type": "DIVIDEND",
                "source": "brapi",
                "scraped_at": "2026-03-05T10:00:00",
            }
        ]

        merged = self.scraper.merge_dividend_events(statusinvest, brapi)
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]["source"], "brapi")
        self.assertEqual(merged[0]["payment_date"], "2026-05-25")


if __name__ == "__main__":
    unittest.main()
