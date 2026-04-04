from datetime import date, datetime


def _as_date(value: str | date) -> date:
    if isinstance(value, date):
        return value
    return date.fromisoformat(value)


def _weather_events(weather: dict | None) -> list[dict]:
    if not weather:
        return []

    events: list[dict] = []
    daily = weather.get("daily") or {}
    times = daily.get("time") or []
    lows = daily.get("temperature_2m_min") or []
    highs = daily.get("temperature_2m_max") or []
    rain = daily.get("precipitation_sum") or []

    for i in range(min(len(times), len(lows), len(highs), len(rain), 7)):
        day = _as_date(times[i])
        low = float(lows[i])
        high = float(highs[i])
        precip = float(rain[i])

        if low <= 34:
            events.append(
                {
                    "event_date": day,
                    "title": "Frost watch",
                    "detail": f"Overnight low near {low:.0f}F expected.",
                    "category": "weather",
                    "source": "forecast",
                    "severity": "high" if low <= 32 else "medium",
                    "drilldown": {"low_f": low, "high_f": high, "precip_in": precip},
                }
            )

        if high >= 85:
            events.append(
                {
                    "event_date": day,
                    "title": "Heat alert",
                    "detail": f"Daytime high near {high:.0f}F expected.",
                    "category": "weather",
                    "source": "forecast",
                    "severity": "medium",
                    "drilldown": {"low_f": low, "high_f": high, "precip_in": precip},
                }
            )

        if precip >= 0.3:
            events.append(
                {
                    "event_date": day,
                    "title": "Rain event",
                    "detail": f"Forecast rain {precip:.2f} in.",
                    "category": "weather",
                    "source": "forecast",
                    "severity": "low",
                    "drilldown": {"low_f": low, "high_f": high, "precip_in": precip},
                }
            )

    return events


def _task_events(tasks: list) -> list[dict]:
    events: list[dict] = []
    for task in tasks:
        events.append(
            {
                "event_date": task.due_on,
                "title": task.title,
                "detail": task.notes or "Task due",
                "category": "task",
                "source": "tasks",
                "severity": "low" if task.is_done else "medium",
                "drilldown": {
                    "task_id": task.id,
                    "is_done": task.is_done,
                },
            }
        )
    return events


def _planting_window_events(planting_windows: dict) -> list[dict]:
    events: list[dict] = []
    for window in planting_windows.get("windows", [])[:18]:
        if window["status"] not in {"open", "upcoming", "watch"}:
            continue
        indoor_start = window.get("indoor_seed_start")
        indoor_end = window.get("indoor_seed_end")
        if window["method"] == "transplant" and indoor_start:
            detail = (
                f"Start indoors {indoor_start} – {indoor_end}; "
                f"transplant outdoors {window['window_start']} – {window['window_end']} ({window['status']})."
            )
        else:
            detail = f"Direct sow outdoors {window['window_start']} – {window['window_end']} ({window['status']})."
        events.append(
            {
                "event_date": indoor_start if (window["method"] == "transplant" and indoor_start) else window["window_start"],
                "title": f"Planting window: {window['crop_name']}",
                "detail": detail,
                "category": "planting_window",
                "source": "climate_engine",
                "severity": "low" if window["status"] == "upcoming" else "medium",
                "drilldown": {
                    "crop_name": window["crop_name"],
                    "variety": window.get("variety", ""),
                    "method": window["method"],
                    "status": window["status"],
                    "indoor_seed_start": str(indoor_start) if indoor_start else "",
                    "indoor_seed_end": str(indoor_end) if indoor_end else "",
                    "outdoor_window_start": str(window["window_start"]),
                    "outdoor_window_end": str(window["window_end"]),
                    "reason": window["reason"],
                },
            }
        )
    return events


def _sensor_alert_events(sensor_summary: dict) -> list[dict]:
    events: list[dict] = []
    now = datetime.utcnow().date()

    for suggestion in sensor_summary.get("irrigation_suggestions", []):
        severity = "medium"
        if suggestion["status"] == "irrigate_now":
            severity = "high"
        elif suggestion["status"] in {"hold", "monitor"}:
            severity = "low"

        events.append(
            {
                "event_date": now,
                "title": f"Sensor alert: {suggestion['title']}",
                "detail": suggestion["detail"],
                "category": "sensor_alert",
                "source": "sensors",
                "severity": severity,
                "drilldown": {"status": suggestion["status"]},
            }
        )

    return events


def _coach_recommendation_events(coach_response: dict) -> list[dict]:
    today = datetime.utcnow().date()
    events: list[dict] = []

    for action in coach_response.get("suggested_actions", [])[:8]:
        priority = action.get("priority", "low")
        severity = "low"
        if priority == "high":
            severity = "high"
        elif priority == "medium":
            severity = "medium"

        events.append(
            {
                "event_date": today,
                "title": f"Coach: {action['title']}",
                "detail": action["detail"],
                "category": "ai_recommendation",
                "source": "ai_coach",
                "severity": severity,
                "drilldown": {
                    "priority": priority,
                    "category": action.get("category", "general"),
                },
            }
        )

    return events


def build_unified_timeline(
    *,
    tasks: list,
    weather: dict | None,
    planting_windows: dict,
    sensor_summary: dict,
    coach_response: dict,
) -> dict:
    events = []
    events.extend(_task_events(tasks))
    events.extend(_weather_events(weather))
    events.extend(_planting_window_events(planting_windows))
    events.extend(_sensor_alert_events(sensor_summary))
    events.extend(_coach_recommendation_events(coach_response))

    events.sort(key=lambda item: (item["event_date"], item["category"], item["title"]))

    return {
        "generated_at": datetime.utcnow(),
        "events": events,
        "counts_by_category": {
            "task": sum(1 for event in events if event["category"] == "task"),
            "weather": sum(1 for event in events if event["category"] == "weather"),
            "planting_window": sum(1 for event in events if event["category"] == "planting_window"),
            "sensor_alert": sum(1 for event in events if event["category"] == "sensor_alert"),
            "ai_recommendation": sum(1 for event in events if event["category"] == "ai_recommendation"),
        },
    }
