import asyncio

import httpx
import pytest

from app.core.exceptions import ValidationServiceError
from app import weather


class _FakeResponse:
    def __init__(self, status_code=200, payload=None, raise_error=None):
        self.status_code = status_code
        self._payload = payload or {}
        self._raise_error = raise_error

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self._raise_error is not None:
            raise self._raise_error


class _FakeClient:
    def __init__(self, responses):
        self._responses = list(responses)
        self.calls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, *args, **kwargs):
        self.calls.append({"args": args, "kwargs": kwargs})
        response = self._responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


class _FakeElevationClient:
    def __init__(self, response):
        self._response = response

    async def get(self, *args, **kwargs):
        if isinstance(self._response, Exception):
            raise self._response
        return self._response


def test_fetch_weather_returns_payload(monkeypatch):
    monkeypatch.setattr(
        weather.httpx,
        "AsyncClient",
        lambda *args, **kwargs: _FakeClient([_FakeResponse(payload={"daily": {"time": []}})]),
    )

    result = asyncio.run(weather.fetch_weather(37.7, -122.4))

    assert result == {"daily": {"time": []}}


def test_fetch_zip_profile_uses_fallback_on_request_error(monkeypatch):
    monkeypatch.setattr(
        weather.httpx,
        "AsyncClient",
        lambda *args, **kwargs: _FakeClient([httpx.RequestError("boom")]),
    )

    result = asyncio.run(weather.fetch_zip_profile("94110"))

    assert result["growing_zone"] == "10b"


def test_fetch_zip_profile_rejects_blank_zip():
    with pytest.raises(ValueError):
        asyncio.run(weather.fetch_zip_profile("   "))


def test_fetch_zip_profile_uses_fallback_on_non_200(monkeypatch):
    monkeypatch.setattr(
        weather.httpx,
        "AsyncClient",
        lambda *args, **kwargs: _FakeClient([_FakeResponse(status_code=404)]),
    )

    result = asyncio.run(weather.fetch_zip_profile("94110"))

    assert result["zip_code"] == "94110"
    assert result.get("state_code") == "CA"


def test_fetch_zip_profile_non_200_without_fallback_raises(monkeypatch):
    monkeypatch.setattr(
        weather.httpx,
        "AsyncClient",
        lambda *args, **kwargs: _FakeClient([_FakeResponse(status_code=404)]),
    )

    with pytest.raises(ValidationServiceError):
        asyncio.run(weather.fetch_zip_profile("00000"))


def test_fetch_zip_profile_rejects_when_no_places(monkeypatch):
    monkeypatch.setattr(
        weather.httpx,
        "AsyncClient",
        lambda *args, **kwargs: _FakeClient([_FakeResponse(payload={"places": []})]),
    )

    with pytest.raises(ValidationServiceError):
        asyncio.run(weather.fetch_zip_profile("99999"))


def test_fetch_zip_profile_returns_zone_when_enrichment_succeeds(monkeypatch):
    monkeypatch.setattr(
        weather.httpx,
        "AsyncClient",
        lambda *args, **kwargs: _FakeClient(
            [
                _FakeResponse(
                    payload={
                        "places": [
                            {
                                "latitude": "37.7",
                                "longitude": "-122.4",
                                "state abbreviation": "CA",
                            }
                        ]
                    }
                ),
                _FakeResponse(payload={"zone": "9b"}),
            ]
        ),
    )

    result = asyncio.run(weather.fetch_zip_profile("94110"))

    assert result["growing_zone"] == "9b"
    assert result.get("state_code") == "CA"


def test_fetch_zip_profile_returns_unknown_zone_on_enrichment_error(monkeypatch):
    monkeypatch.setattr(
        weather.httpx,
        "AsyncClient",
        lambda *args, **kwargs: _FakeClient(
            [
                _FakeResponse(payload={"places": [{"latitude": "37.7", "longitude": "-122.4"}]}),
                httpx.RequestError("zone failed"),
            ]
        ),
    )

    result = asyncio.run(weather.fetch_zip_profile("94110"))

    assert result["growing_zone"] == "Unknown"


def test_fetch_zip_profile_rejects_unavailable_non_fallback_zip(monkeypatch):
    monkeypatch.setattr(
        weather.httpx,
        "AsyncClient",
        lambda *args, **kwargs: _FakeClient([httpx.RequestError("boom")]),
    )

    with pytest.raises(ValidationServiceError):
        asyncio.run(weather.fetch_zip_profile("00000"))


def test_fetch_address_geocode_validates_blank_input():
    with pytest.raises(ValidationServiceError):
        asyncio.run(weather.fetch_address_geocode("   "))


def test_fetch_address_geocode_rejects_empty_results(monkeypatch):
    monkeypatch.setattr(
        weather.httpx,
        "AsyncClient",
        lambda *args, **kwargs: _FakeClient([_FakeResponse(payload=[])]),
    )

    with pytest.raises(ValidationServiceError):
        asyncio.run(weather.fetch_address_geocode("123 Main St"))


def test_fetch_address_geocode_rejects_unavailable_service(monkeypatch):
    monkeypatch.setattr(
        weather.httpx,
        "AsyncClient",
        lambda *args, **kwargs: _FakeClient([_FakeResponse(status_code=503)]),
    )

    with pytest.raises(ValidationServiceError):
        asyncio.run(weather.fetch_address_geocode("123 Main St"))


def test_fetch_address_geocode_returns_coordinates(monkeypatch):
    monkeypatch.setattr(
        weather.httpx,
        "AsyncClient",
        lambda *args, **kwargs: _FakeClient(
            [_FakeResponse(payload=[{"lat": "40.1", "lon": "-74.2", "display_name": "Addr"}])]
        ),
    )

    result = asyncio.run(weather.fetch_address_geocode("123 Main St"))

    assert result == {"latitude": 40.1, "longitude": -74.2, "display_name": "Addr"}


def test_fetch_address_geocode_uses_street_plus_zip_query(monkeypatch):
    fake_client = _FakeClient(
        [_FakeResponse(payload=[{"lat": "40.1", "lon": "-74.2", "display_name": "Addr"}])]
    )
    monkeypatch.setattr(weather.httpx, "AsyncClient", lambda *args, **kwargs: fake_client)

    asyncio.run(weather.fetch_address_geocode("123 Main St", "07001"))

    assert fake_client.calls[0]["kwargs"]["params"]["q"] == "123 Main St, 07001"


def test_fetch_elevation_usgs_handles_success_and_sentinels():
    ok = asyncio.run(
        weather._fetch_elevation_usgs(
            _FakeElevationClient(_FakeResponse(payload={"value": 1234})), 37.7, -122.4
        )
    )
    nodata = asyncio.run(
        weather._fetch_elevation_usgs(
            _FakeElevationClient(_FakeResponse(payload={"value": "NODATA"})), 37.7, -122.4
        )
    )

    assert ok == 1234.0
    assert nodata is None


def test_fetch_elevation_usgs_handles_request_error():
    result = asyncio.run(
        weather._fetch_elevation_usgs(
            _FakeElevationClient(httpx.RequestError("boom")), 37.7, -122.4
        )
    )

    assert result is None


def test_fetch_microclimate_signals_derives_sun_wind_and_slope(monkeypatch):
    monkeypatch.setattr(
        weather.httpx,
        "AsyncClient",
        lambda *args, **kwargs: _FakeClient(
            [
                _FakeResponse(
                    payload={
                        "daily": {
                            "sunshine_duration": [25200, 28800],
                            "wind_speed_10m_max": [10, 12],
                        }
                    }
                ),
            ]
        ),
    )
    elevations = iter([100.0, 110.0, 108.0, 109.0, 111.0])

    async def fake_elevation(*args, **kwargs):
        return next(elevations)

    monkeypatch.setattr(weather, "_fetch_elevation_usgs", fake_elevation)

    result = asyncio.run(weather.fetch_microclimate_signals(37.7, -122.4))

    assert result["suggestions"]["sun_exposure"] == "full_sun"
    assert result["suggestions"]["wind_exposure"] == "sheltered"
    assert result["suggestions"]["slope_position"] == "low"
    assert result["suggestions"]["frost_pocket_risk"] == "high"


def test_fetch_microclimate_signals_handles_weather_failure_and_missing_elevation(monkeypatch):
    monkeypatch.setattr(
        weather.httpx,
        "AsyncClient",
        lambda *args, **kwargs: _FakeClient([httpx.RequestError("boom")]),
    )
    monkeypatch.setattr(
        weather, "_fetch_elevation_usgs", lambda *args, **kwargs: asyncio.sleep(0, result=None)
    )

    result = asyncio.run(weather.fetch_microclimate_signals(37.7, -122.4))

    assert "orientation" in result["notes"]
    assert "Elevation data unavailable" in result["notes"]["slope_position"]


def test_fetch_microclimate_signals_handles_surroundings_unavailable(monkeypatch):
    monkeypatch.setattr(
        weather.httpx,
        "AsyncClient",
        lambda *args, **kwargs: _FakeClient(
            [
                _FakeResponse(
                    payload={"daily": {"sunshine_duration": [7200], "wind_speed_10m_max": [22]}}
                )
            ]
        ),
    )
    elevations = iter([100.0, None, None, None, None])

    async def fake_elevation(*args, **kwargs):
        return next(elevations)

    monkeypatch.setattr(weather, "_fetch_elevation_usgs", fake_elevation)

    result = asyncio.run(weather.fetch_microclimate_signals(37.7, -122.4))

    assert result["suggestions"]["sun_exposure"] == "part_shade"
    assert result["suggestions"]["wind_exposure"] == "moderate"
    assert result["suggestions"]["slope_position"] == "mid"


def test_fetch_microclimate_signals_high_ground_and_exposed(monkeypatch):
    monkeypatch.setattr(
        weather.httpx,
        "AsyncClient",
        lambda *args, **kwargs: _FakeClient(
            [
                _FakeResponse(
                    payload={"daily": {"sunshine_duration": [3600], "wind_speed_10m_max": [40]}}
                )
            ]
        ),
    )
    elevations = iter([120.0, 100.0, 99.0, 101.0, 100.0])

    async def fake_elevation(*args, **kwargs):
        return next(elevations)

    monkeypatch.setattr(weather, "_fetch_elevation_usgs", fake_elevation)

    result = asyncio.run(weather.fetch_microclimate_signals(37.7, -122.4))

    assert result["suggestions"]["sun_exposure"] == "full_shade"
    assert result["suggestions"]["wind_exposure"] == "exposed"
    assert result["suggestions"]["slope_position"] == "high"
    assert result["suggestions"]["frost_pocket_risk"] == "low"
