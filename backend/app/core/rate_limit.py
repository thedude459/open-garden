"""Shared in-memory rate limiting utilities."""
from collections import defaultdict, deque
from threading import Lock
from time import time

from fastapi import HTTPException, Request

from ..config import settings

_RATE_LIMIT_LOCK = Lock()
_RATE_LIMIT_BUCKETS: dict[str, deque[float]] = defaultdict(deque)


def client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def rate_limit_hit(key: str, limit: int, window_seconds: int) -> int | None:
    now = time()
    oldest = now - window_seconds
    with _RATE_LIMIT_LOCK:
        bucket = _RATE_LIMIT_BUCKETS[key]
        while bucket and bucket[0] <= oldest:
            bucket.popleft()
        if len(bucket) >= limit:
            retry_after = max(1, int(window_seconds - (now - bucket[0])))
            return retry_after
        bucket.append(now)
    return None


def enforce_rate_limit(
    request: Request,
    bucket: str,
    limit: int,
    window_seconds: int,
    identity: str = "",
) -> None:
    ip = client_ip(request)
    key = f"{bucket}:{ip}:{identity}" if identity else f"{bucket}:{ip}"
    retry_after = rate_limit_hit(key, limit, window_seconds)
    if retry_after is not None:
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )


def global_rate_limit_hit(request: Request) -> int | None:
    return rate_limit_hit(
        key=f"global:{client_ip(request)}",
        limit=settings.global_rate_limit_per_minute,
        window_seconds=60,
    )
