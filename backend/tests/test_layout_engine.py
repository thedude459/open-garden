from datetime import date
from types import SimpleNamespace

from app.engines.layout import build_garden_sun_path


def test_build_garden_sun_path_returns_daylight_points_for_summer():
    garden = SimpleNamespace(latitude=37.77, longitude=-122.42, orientation="south")

    result = build_garden_sun_path(garden, date(2026, 6, 21))

    assert result["sunrise_hour"] < result["solar_noon_hour"] < result["sunset_hour"]
    assert result["day_length_hours"] > 14
    assert result["points"]
    assert result["points"] == sorted(result["points"], key=lambda point: point["hour_local"])
    assert all(point["altitude_deg"] > 0 for point in result["points"])
    assert all(0 <= point["intensity"] <= 1 for point in result["points"])
