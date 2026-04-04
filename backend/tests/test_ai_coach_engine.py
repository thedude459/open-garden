from datetime import date, timedelta
from types import SimpleNamespace

from app.ai_coach.engine import build_coach_context, generate_coach_response


def test_build_coach_context_summarizes_garden_inputs():
    garden = SimpleNamespace(id=1, name="Backyard", growing_zone="10b", yard_width_ft=10, yard_length_ft=20, orientation="south", sun_exposure="full_sun")
    planting = SimpleNamespace(crop_name="Tomato", expected_harvest_on=date.today() + timedelta(days=30), harvested_on=None)
    task = SimpleNamespace(is_done=False, due_on=date.today() + timedelta(days=1))

    context = build_coach_context(
        garden=garden,
        weather={"daily": {"temperature_2m_max": [82, 84], "temperature_2m_min": [55, 56], "precipitation_sum": [0.1, 0.0]}},
        plantings=[planting],
        tasks=[task],
        sensor_summary={"sensors": [{"id": 1}], "soil_moisture_series": [{"value": 31}], "soil_temperature_series": [{"value": 68}], "irrigation_suggestions": [{"status": "watch"}]},
        user_message=" What should I do next? ",
        scenario={"days_ahead": 14, "rain_outlook": "dry", "labor_hours": 1},
    )

    assert context["garden"]["yard"] == "10x20 ft"
    assert context["plantings"]["active"] == 1
    assert context["tasks"] == {"open": 1, "due_soon": 1}
    assert context["sensors"]["irrigation_signal"] == "watch"
    assert context["user_message"] == "What should I do next?"


def test_generate_coach_response_prioritizes_due_tasks_and_dry_soil():
    response = generate_coach_response(
        {
            "garden": {"name": "Backyard", "zone": "10b", "yard": "10x20 ft"},
            "tasks": {"open": 3, "due_soon": 2},
            "sensors": {"sensor_count": 1, "latest_soil_moisture": 29.5},
            "weather": {"next_5d_high_f": [86, 84]},
            "scenario": {"days_ahead": 14, "rain_outlook": "dry", "labor_hours": 1},
        }
    )

    assert response["suggested_actions"][0]["title"] == "Clear due-soon tasks"
    assert any(item["title"] == "Run irrigation check" for item in response["suggested_actions"])
    assert any(item["title"] == "Heat protection prep" for item in response["suggested_actions"])
    assert len(response["scenario_outcomes"]) == 3


def test_generate_coach_response_falls_back_to_steady_state_without_signals():
    response = generate_coach_response(
        {
            "garden": {"name": "Backyard", "zone": "10b", "yard": "10x20 ft"},
            "tasks": {"open": 0, "due_soon": 0},
            "sensors": {"sensor_count": 0, "latest_soil_moisture": None},
            "weather": {"next_5d_high_f": [70, 72]},
            "scenario": {},
        }
    )

    assert response["suggested_actions"] == [
        {
            "title": "Steady-state maintenance",
            "detail": "No urgent signals detected. Continue normal watering, harvest, and scouting cadence.",
            "priority": "low",
            "category": "general",
        }
    ]