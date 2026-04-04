from datetime import date, timedelta
from types import SimpleNamespace

from app.engines.timeline import (
    _as_date,
    _coach_recommendation_events,
    _planting_window_events,
    _sensor_alert_events,
    _weather_events,
    build_unified_timeline,
)


def test_build_unified_timeline_combines_and_counts_all_event_sources():
    today = date.today()
    result = build_unified_timeline(
        tasks=[
            SimpleNamespace(id=1, title="Water seedlings", due_on=today, notes="Use the drip line.", is_done=False),
            SimpleNamespace(id=2, title="Clean tools", due_on=today + timedelta(days=1), notes="", is_done=True),
        ],
        weather={
            "daily": {
                "time": [today.isoformat(), (today + timedelta(days=1)).isoformat(), (today + timedelta(days=2)).isoformat()],
                "temperature_2m_min": [31, 58, 61],
                "temperature_2m_max": [60, 88, 74],
                "precipitation_sum": [0.0, 0.0, 0.45],
            }
        },
        planting_windows={
            "windows": [
                {
                    "crop_name": "Spinach",
                    "method": "direct_sow",
                    "window_start": today,
                    "window_end": today + timedelta(days=14),
                    "status": "open",
                    "reason": "Cool soil is ready.",
                },
                {
                    "crop_name": "Corn",
                    "method": "direct_sow",
                    "window_start": today + timedelta(days=21),
                    "window_end": today + timedelta(days=35),
                    "status": "closing",
                    "reason": "Too late for this test window.",
                },
            ]
        },
        sensor_summary={
            "irrigation_suggestions": [
                {"title": "Bed 1 dry", "detail": "Moisture is below threshold.", "status": "irrigate_now"},
            ]
        },
        coach_response={
            "suggested_actions": [
                {"title": "Mulch tomatoes", "detail": "Reduce moisture swings.", "priority": "high", "category": "maintenance"},
            ]
        },
    )

    assert result["counts_by_category"] == {
        "task": 2,
        "weather": 3,
        "planting_window": 1,
        "sensor_alert": 1,
        "ai_recommendation": 1,
    }
    assert len(result["events"]) == 8
    assert result["events"] == sorted(result["events"], key=lambda item: (item["event_date"], item["category"], item["title"]))
    assert any(event["title"] == "Frost watch" and event["severity"] == "high" for event in result["events"])
    assert any(event["title"] == "Sensor alert: Bed 1 dry" and event["severity"] == "high" for event in result["events"])


def test_timeline_helpers_cover_date_passthrough_and_severity_variants():
    today = date.today()

    planting_events = _planting_window_events(
        {
            "windows": [
                {
                    "crop_name": "Pepper",
                    "variety": "King",
                    "method": "transplant",
                    "window_start": today,
                    "window_end": today + timedelta(days=7),
                    "status": "watch",
                    "reason": "Warm soil soon.",
                },
                {
                    "crop_name": "Beet",
                    "variety": "Detroit",
                    "method": "direct_sow",
                    "window_start": today + timedelta(days=2),
                    "window_end": today + timedelta(days=9),
                    "status": "upcoming",
                    "reason": "Almost ready.",
                },
            ]
        }
    )
    sensor_events = _sensor_alert_events(
        {
            "irrigation_suggestions": [
                {"title": "Hold irrigation", "detail": "Rain is coming.", "status": "hold"},
                {"title": "Monitor bed 2", "detail": "Moisture is borderline.", "status": "monitor"},
            ]
        }
    )
    coach_events = _coach_recommendation_events(
        {
            "suggested_actions": [
                {"title": "Scout aphids", "detail": "Check undersides of leaves.", "priority": "medium", "category": "pests"},
                {"title": "Rotate hose", "detail": "Keep coverage even."},
            ]
        }
    )

    assert _as_date(today) == today
    assert _weather_events(None) == []
    assert planting_events[0]["detail"].startswith("Plant outdoors (crowns/starts)")
    assert planting_events[1]["severity"] == "low"
    assert [event["severity"] for event in sensor_events] == ["low", "low"]
    assert [event["severity"] for event in coach_events] == ["medium", "low"]

