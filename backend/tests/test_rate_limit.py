from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.core import rate_limit


def _request(host="127.0.0.1", headers=None):
    return SimpleNamespace(headers=headers or {}, client=SimpleNamespace(host=host))


@pytest.fixture(autouse=True)
def clear_rate_limit_state():
    rate_limit._RATE_LIMIT_BUCKETS.clear()


def test_client_ip_prefers_forwarded_header():
    request = _request(headers={"x-forwarded-for": "10.0.0.1, 10.0.0.2"})

    assert rate_limit.client_ip(request) == "10.0.0.1"


def test_client_ip_falls_back_to_unknown():
    request = SimpleNamespace(headers={}, client=None)

    assert rate_limit.client_ip(request) == "unknown"


def test_rate_limit_hit_allows_until_bucket_is_full(monkeypatch):
    now = iter([0.0, 1.0, 2.0])
    monkeypatch.setattr(rate_limit, "time", lambda: next(now))

    assert rate_limit.rate_limit_hit("bucket", 2, 60) is None
    assert rate_limit.rate_limit_hit("bucket", 2, 60) is None
    assert rate_limit.rate_limit_hit("bucket", 2, 60) == 58


def test_rate_limit_hit_expires_old_entries(monkeypatch):
    now = iter([0.0, 1.0, 61.0])
    monkeypatch.setattr(rate_limit, "time", lambda: next(now))

    assert rate_limit.rate_limit_hit("bucket", 1, 60) is None
    assert rate_limit.rate_limit_hit("bucket", 1, 60) == 59
    assert rate_limit.rate_limit_hit("bucket", 1, 60) is None


def test_enforce_rate_limit_raises_with_retry_after(monkeypatch):
    monkeypatch.setattr(rate_limit, "rate_limit_hit", lambda *args, **kwargs: 17)

    with pytest.raises(HTTPException) as exc:
        rate_limit.enforce_rate_limit(_request(), "auth", 1, 60)

    assert exc.value.status_code == 429
    assert exc.value.headers["Retry-After"] == "17"


def test_global_rate_limit_hit_uses_global_setting(monkeypatch):
    monkeypatch.setattr(rate_limit.settings, "global_rate_limit_per_minute", 99)
    captured = {}

    def fake_rate_limit_hit(key, limit, window_seconds):
        captured.update({"key": key, "limit": limit, "window_seconds": window_seconds})
        return None

    monkeypatch.setattr(rate_limit, "rate_limit_hit", fake_rate_limit_hit)

    assert rate_limit.global_rate_limit_hit(_request(host="8.8.8.8")) is None
    assert captured == {"key": "global:8.8.8.8", "limit": 99, "window_seconds": 60}