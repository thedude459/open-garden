from types import SimpleNamespace

from app.core.logging_utils import get_logger


def test_get_logger_configures_only_when_handlers_are_missing(monkeypatch):
    calls = []
    first = SimpleNamespace(handlers=[])
    second = SimpleNamespace(handlers=[object()])
    original_get_logger = __import__("logging").getLogger

    def fake_get_logger(name=None):
        if name == "empty":
            return first
        if name == "configured":
            return second
        return original_get_logger(name)

    monkeypatch.setattr("app.core.logging_utils.logging.getLogger", fake_get_logger)
    monkeypatch.setattr(
        "app.core.logging_utils.logging.basicConfig", lambda **kwargs: calls.append(kwargs)
    )

    assert get_logger("empty") is first
    assert get_logger("configured") is second
    assert len(calls) == 1
