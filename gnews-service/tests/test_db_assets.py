"""
Tests for the dynamic asset-fetching functionality in GNewsService.

Validates:
- fetch_tracked_assets() returns the expected shape when a DB connection works.
- fetch_tracked_assets() returns [] gracefully when the DB is unavailable.
- get_search_topics() returns (topic, related_stock) tuples from DB assets.
- get_search_topics() falls back to default topics when no DB assets exist.
- process_article() includes related_stock in the payload when supplied.
- process_article() omits related_stock when not supplied (backward-compat).
- Asset list is refreshed only after ASSET_REFRESH_INTERVAL seconds.

Run with:
  python -m pytest tests/test_db_assets.py -v
"""
import sys
import time
import types
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

# ---------------------------------------------------------------------------
# Stub external dependencies
# ---------------------------------------------------------------------------

class _DummyPikaObject:
    def __init__(self, *args, **kwargs):
        pass


_PIKA_STUB = types.SimpleNamespace(
    PlainCredentials=_DummyPikaObject,
    ConnectionParameters=_DummyPikaObject,
    BlockingConnection=_DummyPikaObject,
    BasicProperties=_DummyPikaObject,
)
sys.modules.setdefault("pika", _PIKA_STUB)


class _DummyGNews:
    def __init__(self, *args, **kwargs):
        pass

    def get_news(self, topic):
        return []


sys.modules.setdefault("gnews", types.SimpleNamespace(GNews=_DummyGNews))

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import main as _main_module  # noqa: E402


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_service() -> "_main_module.GNewsService":
    """Return a GNewsService without connecting to RabbitMQ or DB."""
    svc = _main_module.GNewsService.__new__(_main_module.GNewsService)
    svc.gnews = _DummyGNews()
    svc.connection = None
    svc.channel = None
    svc._tracked_assets = []
    svc._last_asset_refresh = 0
    return svc


# ---------------------------------------------------------------------------
# Tests for fetch_tracked_assets()
# ---------------------------------------------------------------------------

class FetchTrackedAssetsTests(unittest.TestCase):

    def test_returns_assets_from_db_when_available(self):
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__ = lambda s: mock_cur
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_cur.fetchall.return_value = [
            ('PETR4', 'Petrobras PN'),
            ('VALE3', 'Vale ON'),
        ]

        with patch.object(_main_module, '_connect_db', return_value=mock_conn):
            result = _main_module.fetch_tracked_assets()

        self.assertEqual(len(result), 2)
        self.assertEqual(result[0], {'symbol': 'PETR4', 'name': 'Petrobras PN'})
        self.assertEqual(result[1], {'symbol': 'VALE3', 'name': 'Vale ON'})

    def test_returns_empty_list_when_db_unavailable(self):
        with patch.object(_main_module, '_connect_db', return_value=None):
            result = _main_module.fetch_tracked_assets()

        self.assertEqual(result, [])

    def test_returns_empty_list_on_query_error(self):
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__ = lambda s: mock_cur
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_cur.fetchall.side_effect = Exception("query error")

        with patch.object(_main_module, '_connect_db', return_value=mock_conn):
            result = _main_module.fetch_tracked_assets()

        self.assertEqual(result, [])


# ---------------------------------------------------------------------------
# Tests for get_search_topics()
# ---------------------------------------------------------------------------

class GetSearchTopicsTests(unittest.TestCase):

    def setUp(self):
        self.service = _make_service()

    def test_uses_db_assets_when_available(self):
        db_assets = [
            {'symbol': 'AAPL', 'name': 'Apple Inc.'},
            {'symbol': 'TSLA', 'name': 'Tesla Inc.'},
        ]
        with patch.object(_main_module, 'fetch_tracked_assets', return_value=db_assets):
            topics = self.service.get_search_topics()

        topic_strings = [t for t, _ in topics]
        related_stocks = [r for _, r in topics]

        self.assertIn('AAPL', topic_strings)
        self.assertIn('Apple Inc.', topic_strings)
        self.assertIn('TSLA', topic_strings)
        self.assertIn('Tesla Inc.', topic_strings)

        # All returned related_stock values should be the asset symbol
        self.assertTrue(all(r == 'AAPL' for t, r in topics if t in ('AAPL', 'Apple Inc.')))
        self.assertTrue(all(r == 'TSLA' for t, r in topics if t in ('TSLA', 'Tesla Inc.')))

    def test_falls_back_to_default_topics_when_db_empty(self):
        with patch.object(_main_module, 'fetch_tracked_assets', return_value=[]):
            topics = self.service.get_search_topics()

        # All fallback topics should have related_stock=None
        self.assertTrue(all(r is None for _, r in topics))
        topic_strings = [t for t, _ in topics]
        self.assertIn('bitcoin', topic_strings)
        self.assertIn('nasdaq', topic_strings)

    def test_does_not_duplicate_topic_when_name_equals_symbol(self):
        db_assets = [{'symbol': 'BTC', 'name': 'BTC'}]
        with patch.object(_main_module, 'fetch_tracked_assets', return_value=db_assets):
            topics = self.service.get_search_topics()

        # Should produce exactly one entry since name == symbol
        self.assertEqual(len(topics), 1)
        self.assertEqual(topics[0], ('BTC', 'BTC'))

    def test_asset_refresh_skipped_within_interval(self):
        self.service._tracked_assets = [{'symbol': 'CACHED', 'name': 'Cached Asset'}]
        self.service._last_asset_refresh = time.time()  # just refreshed

        with patch.object(_main_module, 'fetch_tracked_assets') as mock_fetch:
            self.service.get_search_topics()
            mock_fetch.assert_not_called()

    def test_asset_refresh_triggered_after_interval(self):
        self.service._tracked_assets = [{'symbol': 'OLD', 'name': 'Old Asset'}]
        self.service._last_asset_refresh = 0  # force refresh

        new_assets = [{'symbol': 'NEW', 'name': 'New Asset'}]
        with patch.object(_main_module, 'fetch_tracked_assets', return_value=new_assets):
            topics = self.service.get_search_topics()

        topic_strings = [t for t, _ in topics]
        self.assertIn('NEW', topic_strings)
        self.assertNotIn('OLD', topic_strings)


# ---------------------------------------------------------------------------
# Tests for process_article() with related_stock
# ---------------------------------------------------------------------------

class ProcessArticleWithRelatedStockTests(unittest.TestCase):

    _SAMPLE_ARTICLE = {
        'title': 'PETR4 Surges After Oil Price Rally',
        'description': 'Petrobras shares jumped.',
        'url': 'https://news.example.com/petr4-surges',
        'publisher': {'title': 'Reuters'},
        'published date': '2026-03-05T10:00:00Z',
    }

    def setUp(self):
        self.service = _make_service()

    def test_related_stock_included_in_payload_when_provided(self):
        payload = self.service.process_article(
            self._SAMPLE_ARTICLE, 'PETR4', related_stock='PETR4'
        )
        self.assertIn('related_stock', payload)
        self.assertEqual(payload['related_stock'], 'PETR4')

    def test_related_stock_absent_when_not_provided(self):
        payload = self.service.process_article(self._SAMPLE_ARTICLE, 'stock market')
        self.assertNotIn('related_stock', payload)

    def test_related_stock_absent_when_none_explicitly_passed(self):
        payload = self.service.process_article(
            self._SAMPLE_ARTICLE, 'stock market', related_stock=None
        )
        self.assertNotIn('related_stock', payload)

    def test_all_required_fields_still_present_with_related_stock(self):
        required = ['title', 'description', 'url', 'source', 'published_at', 'topic']
        payload = self.service.process_article(
            self._SAMPLE_ARTICLE, 'PETR4', related_stock='PETR4'
        )
        for field in required:
            self.assertIn(field, payload, f"Required field '{field}' missing")


if __name__ == '__main__':
    unittest.main()
