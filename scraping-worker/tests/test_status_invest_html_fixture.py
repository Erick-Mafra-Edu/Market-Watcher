"""
HTML fixture regression tests for StatusInvestScraper.

These tests parse a versioned HTML snapshot that mimics the real StatusInvest
page structure so that changes to the site's markup cause an explicit test
failure rather than silently returning None for all indicators.

Run with:
  python -m pytest tests/test_status_invest_html_fixture.py -v
"""
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import MagicMock

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

# Versioned HTML fixture for StatusInvest parser regression tests.
# Each fixture constant should be updated if the corresponding site structure
# changes and the parser is updated to match.  Add a date stamp when updating.

# ---------------------------------------------------------------------------
# Fixture V1 — clean indicator-card layout
# Last validated: 2026-03-05
# ---------------------------------------------------------------------------

FIXTURE_HTML_V1 = """
<!DOCTYPE html>
<html lang="pt-br">
<head><title>PETR4 - Análise | Status Invest</title></head>
<body>
  <section class="indicators">
    <div class="indicator-card">
      <span class="indicator-name">Dividend Yield</span>
      <strong class="indicator-value">7,10%</strong>
    </div>
    <div class="indicator-card">
      <span class="indicator-name">P/VP</span>
      <strong class="indicator-value">1,35</strong>
    </div>
    <div class="indicator-card">
      <span class="indicator-name">P/L</span>
      <strong class="indicator-value">10,42</strong>
    </div>
    <div class="indicator-card">
      <span class="indicator-name">ROE</span>
      <strong class="indicator-value">15,90%</strong>
    </div>
    <div class="indicator-card">
      <span class="indicator-name">Liquidez media diaria</span>
      <strong class="indicator-value">1,2M</strong>
    </div>
  </section>
</body>
</html>
"""

# ---------------------------------------------------------------------------
# Fixture V2 — noisy table layout with surrounding content
# Last validated: 2026-03-05
# ---------------------------------------------------------------------------

FIXTURE_HTML_V2_NOISY = """
<!DOCTYPE html>
<html lang="pt-br">
<head><title>VALE3 - Status Invest</title></head>
<body>
  <nav>
    <a href="/">Home</a> |
    <a href="/acoes">Ações</a> |
    <span>VALE3</span>
  </nav>
  <header>
    <h1>VALE3 - VALE S.A.</h1>
    <p>Código: VALE3 | Setor: Mineração</p>
  </header>
  <main>
    <div class="company-overview">
      <p>A Vale é uma das maiores mineradoras do mundo.</p>
    </div>
    <section class="fundamentals-section">
      <h2>Indicadores Fundamentalistas</h2>
      <table class="indicators-table">
        <tbody>
          <tr>
            <td>Dividend Yield</td>
            <td><strong>5,42%</strong></td>
          </tr>
          <tr>
            <td>P/VP</td>
            <td><strong>2,10</strong></td>
          </tr>
          <tr>
            <td>P/L</td>
            <td><strong>6,80</strong></td>
          </tr>
          <tr>
            <td>ROE</td>
            <td><strong>28,50%</strong></td>
          </tr>
          <tr>
            <td>Liquidez media diaria</td>
            <td><strong>850K</strong></td>
          </tr>
        </tbody>
      </table>
    </section>
    <aside>
      <p>Nota: valores baseados nos últimos 12 meses.</p>
    </aside>
  </main>
  <footer>
    <p>© 2026 Status Invest</p>
  </footer>
</body>
</html>
"""

# A fixture that intentionally contains no indicator data — simulates a page
# that is temporarily unavailable or structurally changed so all indicators
# must degrade gracefully to None.
FIXTURE_HTML_EMPTY = """
<!DOCTYPE html>
<html lang="pt-br">
<body>
  <p>Dados indisponíveis no momento.</p>
</body>
</html>
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _scrape_from_html(scraper: StatusInvestScraper, html: str, symbol: str = "PETR4") -> dict:
    """Invoke scrape_stock() with an injected HTML response instead of live HTTP."""
    mock_response = MagicMock()
    mock_response.content = html.encode("utf-8")
    mock_response.raise_for_status = MagicMock()

    from unittest.mock import patch
    with patch.object(scraper.session, "get", return_value=mock_response):
        result = scraper.scrape_stock(symbol)

    return result


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class StatusInvestHtmlFixtureRegressionTests(unittest.TestCase):
    """
    Snapshot-style regression tests for the StatusInvest HTML parser.

    Whenever the real page structure changes and the scraper is updated, the
    corresponding fixture in this file must also be updated so the test
    continues to represent real-world extraction behaviour.
    """

    def setUp(self):
        self.scraper = StatusInvestScraper(connect_rabbitmq=False)

    def tearDown(self):
        self.scraper.close()

    # -----------------------------------------------------------------------
    # Fixture V1 — clean indicator-card layout
    # -----------------------------------------------------------------------

    def test_v1_fixture_returns_non_none_result(self):
        result = _scrape_from_html(self.scraper, FIXTURE_HTML_V1, "PETR4")
        self.assertIsNotNone(result, "scrape_stock() must not return None for a valid HTML fixture")

    def test_v1_fixture_symbol_is_preserved(self):
        result = _scrape_from_html(self.scraper, FIXTURE_HTML_V1, "PETR4")
        self.assertEqual(result["symbol"], "PETR4")

    def test_v1_fixture_dividend_yield_extracted(self):
        result = _scrape_from_html(self.scraper, FIXTURE_HTML_V1)
        self.assertIsNotNone(result["dividend_yield"], "dividend_yield must be extracted from V1 fixture")
        self.assertAlmostEqual(result["dividend_yield"], 7.10, places=1)

    def test_v1_fixture_p_vp_extracted(self):
        result = _scrape_from_html(self.scraper, FIXTURE_HTML_V1)
        self.assertIsNotNone(result["p_vp"], "p_vp must be extracted from V1 fixture")
        self.assertAlmostEqual(result["p_vp"], 1.35, places=2)

    def test_v1_fixture_p_l_extracted(self):
        result = _scrape_from_html(self.scraper, FIXTURE_HTML_V1)
        self.assertIsNotNone(result["p_l"], "p_l must be extracted from V1 fixture")
        self.assertAlmostEqual(result["p_l"], 10.42, places=2)

    def test_v1_fixture_roe_extracted(self):
        result = _scrape_from_html(self.scraper, FIXTURE_HTML_V1)
        self.assertIsNotNone(result["roe"], "roe must be extracted from V1 fixture")
        self.assertAlmostEqual(result["roe"], 15.90, places=1)

    def test_v1_fixture_liquidity_extracted(self):
        result = _scrape_from_html(self.scraper, FIXTURE_HTML_V1)
        self.assertIsNotNone(result["liquidity"], "liquidity must be extracted from V1 fixture")
        self.assertAlmostEqual(result["liquidity"], 1_200_000.0, places=0)

    def test_v1_fixture_scraped_at_is_iso_string(self):
        import re
        result = _scrape_from_html(self.scraper, FIXTURE_HTML_V1)
        self.assertIsInstance(result["scraped_at"], str)
        self.assertRegex(result["scraped_at"], r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}")

    def test_v1_fixture_all_required_fields_present(self):
        required = ["symbol", "dividend_yield", "p_vp", "p_l", "roe", "liquidity", "scraped_at"]
        result = _scrape_from_html(self.scraper, FIXTURE_HTML_V1)
        for field in required:
            self.assertIn(field, result, f"Required field '{field}' missing from result")

    # -----------------------------------------------------------------------
    # Fixture V2 — noisy table layout with surrounding content
    # -----------------------------------------------------------------------

    def test_v2_noisy_fixture_returns_non_none_result(self):
        result = _scrape_from_html(self.scraper, FIXTURE_HTML_V2_NOISY, "VALE3")
        self.assertIsNotNone(result)

    def test_v2_noisy_fixture_symbol_is_preserved(self):
        result = _scrape_from_html(self.scraper, FIXTURE_HTML_V2_NOISY, "VALE3")
        self.assertEqual(result["symbol"], "VALE3")

    def test_v2_noisy_fixture_dividend_yield_extracted(self):
        result = _scrape_from_html(self.scraper, FIXTURE_HTML_V2_NOISY, "VALE3")
        self.assertIsNotNone(result["dividend_yield"])
        self.assertAlmostEqual(result["dividend_yield"], 5.42, places=1)

    def test_v2_noisy_fixture_p_vp_extracted(self):
        result = _scrape_from_html(self.scraper, FIXTURE_HTML_V2_NOISY, "VALE3")
        self.assertIsNotNone(result["p_vp"])
        self.assertAlmostEqual(result["p_vp"], 2.10, places=2)

    def test_v2_noisy_fixture_p_l_extracted(self):
        result = _scrape_from_html(self.scraper, FIXTURE_HTML_V2_NOISY, "VALE3")
        self.assertIsNotNone(result["p_l"])
        self.assertAlmostEqual(result["p_l"], 6.80, places=2)

    def test_v2_noisy_fixture_roe_extracted(self):
        result = _scrape_from_html(self.scraper, FIXTURE_HTML_V2_NOISY, "VALE3")
        self.assertIsNotNone(result["roe"])
        self.assertAlmostEqual(result["roe"], 28.50, places=1)

    def test_v2_noisy_fixture_liquidity_extracted(self):
        result = _scrape_from_html(self.scraper, FIXTURE_HTML_V2_NOISY, "VALE3")
        self.assertIsNotNone(result["liquidity"])
        self.assertAlmostEqual(result["liquidity"], 850_000.0, places=0)

    # -----------------------------------------------------------------------
    # Empty fixture — graceful degradation
    # -----------------------------------------------------------------------

    def test_empty_fixture_returns_payload_not_none(self):
        """scrape_stock() must return a dict even when no indicators are present."""
        result = _scrape_from_html(self.scraper, FIXTURE_HTML_EMPTY, "ABEV3")
        self.assertIsNotNone(result)

    def test_empty_fixture_symbol_still_correct(self):
        result = _scrape_from_html(self.scraper, FIXTURE_HTML_EMPTY, "ABEV3")
        self.assertEqual(result["symbol"], "ABEV3")

    def test_empty_fixture_all_indicators_are_none(self):
        result = _scrape_from_html(self.scraper, FIXTURE_HTML_EMPTY, "ABEV3")
        for field in ["dividend_yield", "p_vp", "p_l", "roe", "liquidity"]:
            self.assertIsNone(
                result[field],
                f"Expected None for '{field}' when page has no indicator data"
            )

    def test_empty_fixture_scraped_at_still_present(self):
        """scraped_at must always be populated regardless of indicator data."""
        result = _scrape_from_html(self.scraper, FIXTURE_HTML_EMPTY, "ABEV3")
        self.assertIsNotNone(result["scraped_at"])
        self.assertGreater(len(result["scraped_at"]), 0)


if __name__ == "__main__":
    unittest.main()
