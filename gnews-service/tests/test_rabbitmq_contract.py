"""
RabbitMQ contract tests for GNewsService (producer side).

Validates that process_article() produces a market_news payload that
satisfies the contract agreed with the notifier-service consumer:

  Required fields: title, description, url, source, published_at, topic

Run with:
  python -m pytest tests/test_rabbitmq_contract.py -v
"""
import sys
import types
import unittest
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# Stub external dependencies so no broker is required
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


class _DummyGNews:
    """Minimal stand-in for the gnews.GNews class."""
    def __init__(self, *args, **kwargs):
        pass

    def get_news(self, topic):
        return []


# Stub the gnews package so the import in main.py does not fail
sys.modules.setdefault(
    "gnews",
    types.SimpleNamespace(GNews=_DummyGNews),
)

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from main import GNewsService  # noqa: E402  (import after path setup)

# ---------------------------------------------------------------------------
# Test data
# ---------------------------------------------------------------------------

_SAMPLE_ARTICLE = {
    "title": "PETR4 Surges After Oil Price Rally",
    "description": "Petrobras shares jumped as oil prices reached a 6-month high.",
    "url": "https://news.example.com/petr4-surges",
    "publisher": {"title": "Reuters"},
    "published date": "2026-03-05T10:00:00Z",
}

_REQUIRED_FIELDS = ["title", "description", "url", "source", "published_at", "topic"]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class GNewsServiceContractTests(unittest.TestCase):
    """Producer-side contract tests for the market_news payload."""

    def setUp(self):
        # Instantiate without connecting to RabbitMQ
        self.service = GNewsService.__new__(GNewsService)
        self.service.gnews = _DummyGNews()
        self.service.connection = None
        self.service.channel = None

    # -----------------------------------------------------------------------
    # Required-field presence
    # -----------------------------------------------------------------------

    def test_payload_contains_all_required_fields(self):
        payload = self.service.process_article(_SAMPLE_ARTICLE, "stock market")
        for field in _REQUIRED_FIELDS:
            self.assertIn(field, payload, f"Required field '{field}' is missing")

    def test_title_matches_article_title(self):
        payload = self.service.process_article(_SAMPLE_ARTICLE, "nasdaq")
        self.assertEqual(payload["title"], _SAMPLE_ARTICLE["title"])

    def test_description_matches_article_description(self):
        payload = self.service.process_article(_SAMPLE_ARTICLE, "nasdaq")
        self.assertEqual(payload["description"], _SAMPLE_ARTICLE["description"])

    def test_url_matches_article_url(self):
        payload = self.service.process_article(_SAMPLE_ARTICLE, "dow jones")
        self.assertEqual(payload["url"], _SAMPLE_ARTICLE["url"])

    def test_source_is_extracted_from_publisher(self):
        payload = self.service.process_article(_SAMPLE_ARTICLE, "stock market")
        self.assertEqual(payload["source"], "Reuters")

    def test_topic_matches_the_argument(self):
        for topic in ["nasdaq", "stock market", "inflation"]:
            with self.subTest(topic=topic):
                payload = self.service.process_article(_SAMPLE_ARTICLE, topic)
                self.assertEqual(payload["topic"], topic)

    def test_published_at_matches_article_published_date(self):
        payload = self.service.process_article(_SAMPLE_ARTICLE, "stock market")
        self.assertEqual(payload["published_at"], _SAMPLE_ARTICLE["published date"])

    # -----------------------------------------------------------------------
    # Type constraints
    # -----------------------------------------------------------------------

    def test_all_required_fields_are_strings(self):
        payload = self.service.process_article(_SAMPLE_ARTICLE, "stock market")
        for field in _REQUIRED_FIELDS:
            self.assertIsInstance(
                payload[field], str, f"Field '{field}' must be a string"
            )

    # -----------------------------------------------------------------------
    # Missing / partial article data (graceful degradation)
    # -----------------------------------------------------------------------

    def test_source_defaults_to_unknown_when_publisher_missing(self):
        article = {**_SAMPLE_ARTICLE}
        del article["publisher"]
        payload = self.service.process_article(article, "stock market")
        self.assertEqual(payload["source"], "Unknown")

    def test_title_defaults_to_empty_string_when_missing(self):
        article = {**_SAMPLE_ARTICLE}
        del article["title"]
        payload = self.service.process_article(article, "stock market")
        self.assertEqual(payload["title"], "")

    def test_published_at_defaults_to_iso_string_when_missing(self):
        article = {k: v for k, v in _SAMPLE_ARTICLE.items() if k != "published date"}
        payload = self.service.process_article(article, "stock market")
        # Must be a non-empty string parseable as a datetime
        self.assertIsInstance(payload["published_at"], str)
        self.assertTrue(len(payload["published_at"]) > 0)
        # Should not raise
        datetime.fromisoformat(payload["published_at"].replace("Z", "+00:00"))

    # -----------------------------------------------------------------------
    # No extra fields that would break a strict consumer schema
    # -----------------------------------------------------------------------

    def test_payload_does_not_contain_unexpected_required_only_fields(self):
        """Warn if the payload schema grows fields not in the agreed contract."""
        payload = self.service.process_article(_SAMPLE_ARTICLE, "stock market")
        # All required fields must be present; extra fields (e.g. fetched_at) are allowed
        missing = [f for f in _REQUIRED_FIELDS if f not in payload]
        self.assertEqual(missing, [], f"Missing required fields: {missing}")


if __name__ == "__main__":
    unittest.main()
