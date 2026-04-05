from datetime import date


def _task_counts(tasks: list) -> dict:
    open_count = sum(1 for task in tasks if not task.is_done)
    due_soon = sum(
        1 for task in tasks if not task.is_done and (task.due_on - date.today()).days <= 3
    )
    return {"open": open_count, "due_soon": max(0, due_soon)}


def _sensor_snapshot(sensor_summary: dict | None) -> dict:
    if not sensor_summary:
        return {
            "sensor_count": 0,
            "latest_soil_moisture": None,
            "latest_soil_temperature": None,
            "irrigation_signal": "unknown",
        }

    moisture = sensor_summary.get("soil_moisture_series") or []
    temperature = sensor_summary.get("soil_temperature_series") or []
    irrigation_suggestions = sensor_summary.get("irrigation_suggestions") or []

    return {
        "sensor_count": len(sensor_summary.get("sensors") or []),
        "latest_soil_moisture": moisture[-1]["value"] if moisture else None,
        "latest_soil_temperature": temperature[-1]["value"] if temperature else None,
        "irrigation_signal": irrigation_suggestions[0]["status"]
        if irrigation_suggestions
        else "unknown",
    }


def build_coach_context(
    *,
    garden,
    weather: dict | None,
    plantings: list,
    tasks: list,
    sensor_summary: dict | None,
    user_message: str,
    scenario: dict,
) -> dict:
    weather_daily = (weather or {}).get("daily") or {}
    upcoming_max = weather_daily.get("temperature_2m_max") or []
    upcoming_min = weather_daily.get("temperature_2m_min") or []
    upcoming_rain = weather_daily.get("precipitation_sum") or []

    task_counts = _task_counts(tasks)
    sensor_snapshot = _sensor_snapshot(sensor_summary)

    return {
        "garden": {
            "id": garden.id,
            "name": garden.name,
            "zone": garden.growing_zone,
            "yard": f"{garden.yard_width_ft}x{garden.yard_length_ft} ft",
            "orientation": garden.orientation,
            "sun_exposure": garden.sun_exposure,
        },
        "plantings": {
            "count": len(plantings),
            "active": sum(1 for planting in plantings if planting.harvested_on is None),
            "next_harvests": [
                {
                    "crop_name": planting.crop_name,
                    "expected_harvest_on": planting.expected_harvest_on,
                }
                for planting in sorted(plantings, key=lambda p: p.expected_harvest_on)[:5]
            ],
        },
        "tasks": task_counts,
        "weather": {
            "next_5d_high_f": upcoming_max[:5],
            "next_5d_low_f": upcoming_min[:5],
            "next_5d_rain_in": upcoming_rain[:5],
        },
        "sensors": sensor_snapshot,
        "scenario": scenario,
        "user_message": user_message.strip(),
    }


def _scenario_outcomes(context: dict) -> list[dict]:
    scenario = context.get("scenario") or {}
    outcomes: list[dict] = []

    days_ahead = int(scenario.get("days_ahead") or 0)
    rain_outlook = str(scenario.get("rain_outlook") or "normal")
    labor_hours = float(scenario.get("labor_hours") or 2)

    if days_ahead >= 10:
        outcomes.append(
            {
                "title": "Two-week readiness",
                "detail": "Prioritize tasks with due dates in the next 10 days and prep irrigation checks before the look-ahead window.",
            }
        )

    if rain_outlook == "dry":
        outcomes.append(
            {
                "title": "Dry-weather plan",
                "detail": "Shift to deeper, less frequent watering and mulch exposed beds to reduce evaporation.",
            }
        )
    elif rain_outlook == "wet":
        outcomes.append(
            {
                "title": "Wet-weather plan",
                "detail": "Reduce irrigation frequency and increase disease scouting around dense canopies.",
            }
        )

    if labor_hours < 2:
        outcomes.append(
            {
                "title": "Low-labor mode",
                "detail": "Focus on highest impact tasks only: irrigation checks, harvest-ready crops, and pest outbreaks.",
            }
        )

    return outcomes


def generate_coach_response(context: dict) -> dict:
    garden = context["garden"]
    tasks = context["tasks"]
    sensors = context["sensors"]
    weather = context["weather"]

    suggested_actions: list[dict] = []

    if tasks["due_soon"] > 0:
        suggested_actions.append(
            {
                "title": "Clear due-soon tasks",
                "detail": f"You have {tasks['due_soon']} task(s) due in the next 3 days.",
                "priority": "high",
                "category": "tasks",
            }
        )

    latest_moisture = sensors.get("latest_soil_moisture")
    if latest_moisture is not None and latest_moisture < 35:
        suggested_actions.append(
            {
                "title": "Run irrigation check",
                "detail": f"Latest soil moisture is {latest_moisture:.1f}%. Consider watering this bed today.",
                "priority": "high",
                "category": "irrigation",
            }
        )

    highs = weather.get("next_5d_high_f") or []
    if highs and max(highs) >= 85:
        suggested_actions.append(
            {
                "title": "Heat protection prep",
                "detail": "Forecasted highs are elevated. Plan for morning watering and midday shade checks.",
                "priority": "medium",
                "category": "weather",
            }
        )

    if not suggested_actions:
        suggested_actions.append(
            {
                "title": "Steady-state maintenance",
                "detail": "No urgent signals detected. Continue normal watering, harvest, and scouting cadence.",
                "priority": "low",
                "category": "general",
            }
        )

    scenario_outcomes = _scenario_outcomes(context)
    highlights = [
        f"Garden {garden['name']} in zone {garden['zone']} ({garden['yard']})",
        f"Open tasks: {tasks['open']} (due soon: {tasks['due_soon']})",
        f"Sensors online: {sensors['sensor_count']}",
    ]

    response_text = (
        f"Based on your current garden context, I recommend focusing on {suggested_actions[0]['title'].lower()} first. "
        f"I used your tasks, weather trend, planting activity, and sensor signals to prioritize actions."
    )

    return {
        "reply": response_text,
        "context_highlights": highlights,
        "suggested_actions": suggested_actions,
        "scenario_outcomes": scenario_outcomes,
    }
