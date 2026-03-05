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


if __name__ == "__main__":
    unittest.main()
