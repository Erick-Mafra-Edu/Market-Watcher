"""
Retry/reconnect behaviour tests for GNewsService.

Validates that connect_rabbitmq():
- Retries up to max_retries times before raising.
- Raises the original exception after all retries are exhausted.
- Succeeds on a later attempt after initial failures.

Run with:
  python -m pytest tests/test_rabbitmq_retry.py -v
"""
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

# ---------------------------------------------------------------------------
# Stub external dependencies so the import of main.py succeeds without a
# live broker or the gnews package installed.
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

import pika as _pika  # noqa: E402
import main as _main_module  # noqa: E402


def _make_service_no_connect() -> "_main_module.GNewsService":
    """Return a GNewsService without triggering a RabbitMQ connection."""
    svc = _main_module.GNewsService.__new__(_main_module.GNewsService)
    svc.gnews = _DummyGNews()
    svc.connection = None
    svc.channel = None
    return svc


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class GNewsRabbitMQRetryTests(unittest.TestCase):
    """Tests for the retry/reconnect logic in GNewsService.connect_rabbitmq()."""

    def setUp(self):
        self.service = _make_service_no_connect()

    def tearDown(self):
        try:
            self.service.close()
        except Exception:
            pass

    # -----------------------------------------------------------------------
    # Failure scenarios
    # -----------------------------------------------------------------------

    def test_raises_after_max_retries_exhausted(self):
        """connect_rabbitmq() must raise once all 5 attempts fail."""
        connect_error = ConnectionRefusedError("broker unavailable")

        with patch.object(_pika, "BlockingConnection", side_effect=connect_error), \
             patch("time.sleep"):
            with self.assertRaises(ConnectionRefusedError):
                self.service.connect_rabbitmq()

    def test_attempts_exactly_max_retries_times(self):
        """connect_rabbitmq() must attempt exactly 5 times (max_retries=5)."""
        connect_error = OSError("connection refused")
        mock_connection_cls = MagicMock(side_effect=connect_error)

        with patch.object(_pika, "BlockingConnection", mock_connection_cls), \
             patch("time.sleep"):
            try:
                self.service.connect_rabbitmq()
            except OSError:
                pass

        self.assertEqual(mock_connection_cls.call_count, 5)

    def test_does_not_sleep_after_last_attempt(self):
        """sleep() must not be called after the final (5th) attempt."""
        connect_error = OSError("connection refused")
        sleep_mock = MagicMock()

        with patch.object(_pika, "BlockingConnection", side_effect=connect_error), \
             patch("time.sleep", sleep_mock):
            try:
                self.service.connect_rabbitmq()
            except OSError:
                pass

        # 5 attempts → sleep called 4 times (between attempts, not after last)
        self.assertEqual(sleep_mock.call_count, 4)

    def test_error_message_is_propagated(self):
        """The original error type and message must be preserved after retries."""
        class BrokerError(Exception):
            pass

        with patch.object(_pika, "BlockingConnection", side_effect=BrokerError("auth failed")), \
             patch("time.sleep"):
            with self.assertRaises(BrokerError) as ctx:
                self.service.connect_rabbitmq()

        self.assertIn("auth failed", str(ctx.exception))

    # -----------------------------------------------------------------------
    # Success scenarios
    # -----------------------------------------------------------------------

    def test_succeeds_on_first_attempt(self):
        """connect_rabbitmq() returns immediately when the first attempt succeeds."""
        mock_conn = MagicMock()
        mock_channel = MagicMock()
        mock_conn.channel.return_value = mock_channel

        with patch.object(_pika, "BlockingConnection", return_value=mock_conn), \
             patch("time.sleep") as sleep_mock:
            self.service.connect_rabbitmq()

        sleep_mock.assert_not_called()
        self.assertIs(self.service.connection, mock_conn)
        self.assertIs(self.service.channel, mock_channel)

    def test_succeeds_on_third_attempt_after_two_failures(self):
        """connect_rabbitmq() succeeds when the third attempt works after two failures."""
        connect_error = OSError("transient failure")
        mock_conn = MagicMock()
        mock_channel = MagicMock()
        mock_conn.channel.return_value = mock_channel

        side_effects = [connect_error, connect_error, mock_conn]
        mock_connection_cls = MagicMock(side_effect=side_effects)

        with patch.object(_pika, "BlockingConnection", mock_connection_cls), \
             patch("time.sleep") as sleep_mock:
            self.service.connect_rabbitmq()

        self.assertEqual(mock_connection_cls.call_count, 3)
        # sleep called between attempt 1→2 and 2→3 (not after successful 3rd)
        self.assertEqual(sleep_mock.call_count, 2)
        self.assertIs(self.service.connection, mock_conn)

    def test_channel_is_set_on_successful_connect(self):
        """After a successful connect_rabbitmq(), self.channel must be set."""
        mock_conn = MagicMock()
        mock_channel = MagicMock()
        mock_conn.channel.return_value = mock_channel

        with patch.object(_pika, "BlockingConnection", return_value=mock_conn), \
             patch("time.sleep"):
            self.service.connect_rabbitmq()

        self.assertIsNotNone(self.service.channel)

    def test_exchange_and_queue_declared_on_success(self):
        """exchange_declare, queue_declare, and queue_bind must be called after connect."""
        mock_conn = MagicMock()
        mock_channel = MagicMock()
        mock_conn.channel.return_value = mock_channel

        with patch.object(_pika, "BlockingConnection", return_value=mock_conn), \
             patch("time.sleep"):
            self.service.connect_rabbitmq()

        mock_channel.exchange_declare.assert_called_once()
        mock_channel.queue_declare.assert_called_once()
        mock_channel.queue_bind.assert_called_once()


if __name__ == "__main__":
    unittest.main()
