from datetime import date, timedelta
from types import SimpleNamespace

from app.engines.climate import (
    _forecast_days,
    _normalize_zone,
    _soil_status,
    build_climate_summary,
    build_dynamic_planting_windows,
)


def make_garden(**overrides):
    data = {
        "growing_zone": "10b",
        "orientation": "south",
        "sun_exposure": "full_sun",
        "wind_exposure": "sheltered",
        "thermal_mass": "high",
        "slope_position": "high",
        "frost_pocket_risk": "low",
    }
    data.update(overrides)
    return SimpleNamespace(**data)


def make_weather(*, low_f: float, high_f: float, precip_in: float = 0.0, days: int = 10) -> dict:
    today = date.today()
    return {
        "daily": {
            "time": [(today + timedelta(days=index)).isoformat() for index in range(days)],
            "temperature_2m_min": [low_f] * days,
            "temperature_2m_max": [high_f] * days,
            "precipitation_sum": [precip_in] * days,
        }
    }


def make_crop(**overrides):
    data = {
        "id": 1,
        "name": "Tomato",
        "variety": "",
        "days_to_harvest": 75,
        "direct_sow": False,
        "frost_hardy": False,
        "weeks_to_transplant": 6,
        "planting_window": "Late spring",
    }
    data.update(overrides)
    return SimpleNamespace(**data)


def test_build_climate_summary_opens_warm_season_for_hot_microclimates():
    summary = build_climate_summary(make_garden(), make_weather(low_f=58, high_f=82))
    warm_season = next(item for item in summary["recommendations"] if item["key"] == "warm-season")

    assert summary["microclimate_band"] == "warm pocket"
    assert summary["frost_risk_next_10_days"] == "low"
    assert summary["soil_temperature_status"] == "warm"
    assert summary["soil_temperature_estimate_f"] >= 60
    assert warm_season["status"] == "open"


def test_build_dynamic_planting_windows_marks_warm_crops_watch_and_sets_indoor_dates():
    weather = make_weather(low_f=31, high_f=55)
    windows = build_dynamic_planting_windows(
        make_garden(),
        weather,
        [
            make_crop(),
            make_crop(
                id=2,
                name="Spinach",
                direct_sow=True,
                frost_hardy=True,
                days_to_harvest=40,
                planting_window="Early spring",
            ),
        ],
    )["windows"]

    tomato_window = next(item for item in windows if item["crop_name"] == "Tomato")
    spinach_window = next(item for item in windows if item["crop_name"] == "Spinach")

    assert tomato_window["method"] == "transplant"
    assert tomato_window["status"] == "watch"
    assert tomato_window["indoor_seed_start"] is not None
    assert tomato_window["indoor_seed_end"] is not None
    assert spinach_window["method"] == "direct_sow"
    assert spinach_window["soil_temperature_min_f"] == 42.0


def test_climate_helpers_cover_normalization_forecast_and_soil_status():
    weather = make_weather(low_f=40, high_f=60, precip_in=0.25, days=2)

    assert _normalize_zone(" Zone 11 ") == "10a"
    assert _normalize_zone("nonsense") == "7a"
    assert _forecast_days(weather)[0]["precipitation_in"] == 0.25
    assert _soil_status(44.9) == "cold"
    assert _soil_status(54.9) == "cool"
    assert _soil_status(64.9) == "warming"
    assert _soil_status(65.0) == "warm"


def test_build_dynamic_planting_windows_handles_direct_ground_transplants():
    windows = build_dynamic_planting_windows(
        make_garden(growing_zone="6a"),
        make_weather(low_f=45, high_f=65),
        [
            make_crop(
                id=3,
                name="Strawberry",
                variety="Honeoye",
                direct_sow=False,
                frost_hardy=True,
                weeks_to_transplant=0,
            ),
        ],
    )["windows"]

    strawberry = windows[0]
    assert strawberry["method"] == "transplant"
    assert strawberry["indoor_seed_start"] is None
    assert strawberry["indoor_seed_end"] is None


def test_build_climate_summary_handles_cool_weather_and_moderate_frost_risk():
    summary = build_climate_summary(
        make_garden(
            orientation="north",
            sun_exposure="full_shade",
            wind_exposure="exposed",
            thermal_mass="low",
            slope_position="low",
            frost_pocket_risk="moderate",
        ),
        make_weather(low_f=35, high_f=48),
    )

    assert summary["microclimate_band"] == "cool pocket"
    assert summary["frost_risk_next_10_days"] == "moderate"
    assert summary["soil_temperature_status"] in {"cold", "cool"}
