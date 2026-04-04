from datetime import date, timedelta
import re


_ZONE_FROST_WINDOWS: dict[str, tuple[tuple[int, int], tuple[int, int]]] = {
    "3a": ((5, 25), (9, 15)),
    "3b": ((5, 15), (9, 25)),
    "4a": ((5, 15), (9, 30)),
    "4b": ((5, 5), (10, 5)),
    "5a": ((4, 30), (10, 10)),
    "5b": ((4, 20), (10, 20)),
    "6a": ((4, 15), (10, 25)),
    "6b": ((4, 5), (11, 1)),
    "7a": ((4, 1), (11, 5)),
    "7b": ((3, 25), (11, 15)),
    "8a": ((3, 15), (11, 25)),
    "8b": ((3, 5), (12, 5)),
    "9a": ((2, 20), (12, 15)),
    "9b": ((2, 10), (12, 20)),
    "10a": ((1, 31), (12, 31)),
    "10b": ((1, 15), (12, 31)),
}

_ORIENTATION_EFFECTS = {
    "north": {"spring": 4, "fall": -4, "soil": -2, "label": "North-facing exposure stays cooler and delays warm-up."},
    "east": {"spring": 1, "fall": -1, "soil": 0, "label": "East exposure warms steadily but avoids peak afternoon heat."},
    "south": {"spring": -3, "fall": 3, "soil": 2, "label": "South exposure captures more sun and usually warms faster."},
    "west": {"spring": -2, "fall": 2, "soil": 1, "label": "West exposure holds extra afternoon heat."},
}

_SUN_EXPOSURE_EFFECTS = {
    "full_sun": {"spring": -3, "fall": 3, "soil": 4, "label": "Full sun improves soil warm-up and extends the heat window."},
    "part_sun": {"spring": -1, "fall": 1, "soil": 1, "label": "Part sun keeps the site close to regional norms."},
    "part_shade": {"spring": 3, "fall": -3, "soil": -2, "label": "Part shade slows warm-up and shortens warm-season capacity."},
    "full_shade": {"spring": 6, "fall": -6, "soil": -4, "label": "Full shade behaves like a materially cooler microclimate."},
}

_WIND_EXPOSURE_EFFECTS = {
    "sheltered": {"spring": -2, "fall": 2, "soil": 1, "label": "Sheltered areas retain heat overnight more effectively."},
    "moderate": {"spring": 0, "fall": 0, "soil": 0, "label": "Moderate wind exposure is near baseline."},
    "exposed": {"spring": 3, "fall": -3, "soil": -1, "label": "Wind-exposed sites lose heat quickly and dry out faster."},
}

_THERMAL_MASS_EFFECTS = {
    "low": {"spring": 1, "fall": -1, "soil": -1, "label": "Low thermal mass cools quickly after sunset."},
    "moderate": {"spring": 0, "fall": 0, "soil": 0, "label": "Moderate thermal mass tracks the regional average."},
    "high": {"spring": -4, "fall": 4, "soil": 2, "label": "High thermal mass smooths temperature swings and buffers frost."},
}

_SLOPE_POSITION_EFFECTS = {
    "low": {"spring": 5, "fall": -5, "soil": -2, "label": "Low spots collect cold air and are more frost-prone."},
    "mid": {"spring": 0, "fall": 0, "soil": 0, "label": "Mid-slope positions are generally balanced."},
    "high": {"spring": -2, "fall": 2, "soil": 1, "label": "Higher positions drain cold air more effectively."},
}

_FROST_POCKET_EFFECTS = {
    "low": {"spring": 0, "fall": 0, "soil": 0, "label": "Low frost-pocket risk keeps the site close to zone averages."},
    "moderate": {"spring": 2, "fall": -2, "soil": -1, "label": "Moderate frost-pocket risk increases overnight cold pooling."},
    "high": {"spring": 6, "fall": -6, "soil": -3, "label": "High frost-pocket risk materially shortens the frost-free window."},
}


def _normalize_zone(zone: str) -> str:
    normalized = zone.strip().lower().replace(" ", "")
    if normalized in _ZONE_FROST_WINDOWS:
        return normalized

    match = re.search(r"(\d+)([ab])?", normalized)
    if not match:
        return "7a"

    zone_number = max(3, min(10, int(match.group(1))))
    suffix = match.group(2) or "a"
    return f"{zone_number}{suffix}"


def _forecast_days(weather: dict) -> list[dict]:
    daily = weather.get("daily") or {}
    times = daily.get("time") or []
    mins = daily.get("temperature_2m_min") or []
    maxes = daily.get("temperature_2m_max") or []
    precip = daily.get("precipitation_sum") or []

    days: list[dict] = []
    count = min(len(times), len(mins), len(maxes), len(precip))
    for index in range(count):
        days.append(
            {
                "date": date.fromisoformat(times[index]),
                "temperature_min_f": float(mins[index]),
                "temperature_max_f": float(maxes[index]),
                "precipitation_in": float(precip[index]),
            }
        )
    return days


def _microclimate_adjustments(garden) -> dict:
    factors = [
        ("orientation", "Orientation", _ORIENTATION_EFFECTS.get(garden.orientation, _ORIENTATION_EFFECTS["south"])),
        ("sun_exposure", "Sun Exposure", _SUN_EXPOSURE_EFFECTS.get(garden.sun_exposure, _SUN_EXPOSURE_EFFECTS["part_sun"])),
        ("wind_exposure", "Wind Exposure", _WIND_EXPOSURE_EFFECTS.get(garden.wind_exposure, _WIND_EXPOSURE_EFFECTS["moderate"])),
        ("thermal_mass", "Thermal Mass", _THERMAL_MASS_EFFECTS.get(garden.thermal_mass, _THERMAL_MASS_EFFECTS["moderate"])),
        ("slope_position", "Slope Position", _SLOPE_POSITION_EFFECTS.get(garden.slope_position, _SLOPE_POSITION_EFFECTS["mid"])),
        ("frost_pocket_risk", "Frost Pocket Risk", _FROST_POCKET_EFFECTS.get(garden.frost_pocket_risk, _FROST_POCKET_EFFECTS["low"])),
    ]

    spring_shift = sum(item[2]["spring"] for item in factors)
    fall_shift = sum(item[2]["fall"] for item in factors)
    soil_shift = sum(item[2]["soil"] for item in factors)

    warmth_score = spring_shift * -1 + soil_shift
    if warmth_score >= 7:
        band = "warm pocket"
    elif warmth_score <= -7:
        band = "cool pocket"
    else:
        band = "balanced"

    return {
        "spring_shift": spring_shift,
        "fall_shift": fall_shift,
        "soil_shift": soil_shift,
        "band": band,
        "factors": [
            {"key": key, "label": label, "impact": effect["label"]}
            for key, label, effect in factors
        ],
    }


def _soil_status(soil_temperature_estimate_f: float) -> str:
    if soil_temperature_estimate_f < 45:
        return "cold"
    if soil_temperature_estimate_f < 55:
        return "cool"
    if soil_temperature_estimate_f < 65:
        return "warming"
    return "warm"


def build_climate_summary(garden, weather: dict) -> dict:
    today = date.today()
    normalized_zone = _normalize_zone(garden.growing_zone)
    baseline_last_frost_month_day, baseline_first_fall_month_day = _ZONE_FROST_WINDOWS[normalized_zone]
    baseline_last_spring_frost = date(today.year, *baseline_last_frost_month_day)
    baseline_first_fall_frost = date(today.year, *baseline_first_fall_month_day)

    adjustments = _microclimate_adjustments(garden)
    adjusted_last_spring_frost = baseline_last_spring_frost + timedelta(days=adjustments["spring_shift"])
    adjusted_first_fall_frost = baseline_first_fall_frost + timedelta(days=adjustments["fall_shift"])

    forecast = _forecast_days(weather)
    forecast_window = forecast[:10]
    next_frost_date = next((day["date"] for day in forecast_window if day["temperature_min_f"] <= 32), None)
    if next_frost_date is not None:
        frost_risk = "high"
    elif any(day["temperature_min_f"] <= 36 for day in forecast_window):
        frost_risk = "moderate"
    else:
        frost_risk = "low"

    soil_samples = forecast[:5] or forecast
    if soil_samples:
        average_air_temperature = sum((day["temperature_min_f"] + day["temperature_max_f"]) / 2 for day in soil_samples) / len(soil_samples)
    else:
        average_air_temperature = 50.0

    soil_temperature_estimate_f = round(average_air_temperature + 2 + adjustments["soil_shift"], 1)
    soil_temperature_status = _soil_status(soil_temperature_estimate_f)

    recommendations: list[dict] = []
    cool_season_open = today >= adjusted_last_spring_frost - timedelta(days=21) and soil_temperature_estimate_f >= 40
    recommendations.append(
        {
            "key": "cool-season",
            "title": "Cool-season sowing",
            "status": "open" if cool_season_open else "watch",
            "detail": (
                "Conditions are suitable for hardy direct-sown crops like peas, spinach, and radishes."
                if cool_season_open
                else "Watch soil warmth and frost forecasts before opening the cool-season window fully."
            ),
        }
    )

    warm_season_open = today >= adjusted_last_spring_frost and soil_temperature_estimate_f >= 60 and frost_risk == "low"
    recommendations.append(
        {
            "key": "warm-season",
            "title": "Warm-season planting",
            "status": "open" if warm_season_open else "wait",
            "detail": (
                "Warm-season crops can be transplanted with low frost risk and adequate soil warmth."
                if warm_season_open
                else "Hold tomatoes, peppers, and squash until the adjusted frost date passes and soils warm further."
            ),
        }
    )

    if frost_risk == "high":
        protection_status = "act"
        protection_detail = "A hard frost is in the near-term forecast. Protect tender crops or delay planting."
    elif frost_risk == "moderate":
        protection_status = "watch"
        protection_detail = "Overnight lows are near frost range. Keep row cover or cloches ready."
    else:
        protection_status = "stable"
        protection_detail = "No immediate frost signal appears in the next 10 days."

    recommendations.append(
        {
            "key": "frost-protection",
            "title": "Frost protection",
            "status": protection_status,
            "detail": protection_detail,
        }
    )

    return {
        "zone": garden.growing_zone,
        "microclimate_band": adjustments["band"],
        "baseline_last_spring_frost": baseline_last_spring_frost,
        "adjusted_last_spring_frost": adjusted_last_spring_frost,
        "baseline_first_fall_frost": baseline_first_fall_frost,
        "adjusted_first_fall_frost": adjusted_first_fall_frost,
        "last_frost_shift_days": adjustments["spring_shift"],
        "first_fall_shift_days": adjustments["fall_shift"],
        "soil_temperature_estimate_f": soil_temperature_estimate_f,
        "soil_temperature_status": soil_temperature_status,
        "frost_risk_next_10_days": frost_risk,
        "next_frost_date": next_frost_date,
        "growing_season_days": max(0, (adjusted_first_fall_frost - adjusted_last_spring_frost).days),
        "factors": adjustments["factors"],
        "recommendations": recommendations,
        "forecast": forecast[:5],
    }


def _clamp_date_window(start: date, end: date) -> tuple[date, date]:
    if end < start:
        return start, start
    return start, end


def _window_status(today: date, start: date, end: date, soil_ok: bool) -> str:
    if today < start:
        return "upcoming"
    if today > end:
        return "closing"
    if not soil_ok:
        return "watch"
    return "open"


_DIRECT_GROUND_TRANSPLANT_KEYWORDS = {
    "asparagus",
    "strawberry",
    "blueberry",
    "raspberry",
    "blackberry",
}


def _is_direct_ground_transplant(crop) -> bool:
    if crop.direct_sow:
        return False
    normalized_name = crop.name.strip().lower()
    if normalized_name.endswith(")") and "(" in normalized_name:
        normalized_name = normalized_name.rsplit("(", 1)[0].strip()
    return normalized_name in _DIRECT_GROUND_TRANSPLANT_KEYWORDS


def build_dynamic_planting_windows(garden, weather: dict, crop_templates: list) -> dict:
    climate_summary = build_climate_summary(garden, weather)
    today = date.today()
    adjusted_last_frost: date = climate_summary["adjusted_last_spring_frost"]
    adjusted_first_fall_frost: date = climate_summary["adjusted_first_fall_frost"]
    soil_temperature_estimate_f: float = climate_summary["soil_temperature_estimate_f"]
    frost_risk_next_10_days: str = climate_summary["frost_risk_next_10_days"]

    windows: list[dict] = []

    for crop in crop_templates:
        is_warm_crop = not crop.frost_hardy
        soil_min_f = 60.0 if is_warm_crop else 42.0
        soil_ok = soil_temperature_estimate_f >= soil_min_f

        if crop.direct_sow:
            start_offset_days = 14 if is_warm_crop else -21
            base_start = adjusted_last_frost + timedelta(days=start_offset_days)
            base_end = adjusted_first_fall_frost - timedelta(days=max(14, crop.days_to_harvest))
            window_start, window_end = _clamp_date_window(base_start, base_end)
            method = "direct_sow"
            indoor_seed_start = None
            indoor_seed_end = None
        else:
            transplant_offset_days = 10 if is_warm_crop else -7
            base_start = adjusted_last_frost + timedelta(days=transplant_offset_days)
            base_end = adjusted_first_fall_frost - timedelta(days=max(14, crop.days_to_harvest))
            window_start, window_end = _clamp_date_window(base_start, base_end)
            if _is_direct_ground_transplant(crop):
                # Crown and bare-root style crops are planted directly outdoors, not seed-started indoors.
                indoor_seed_start = None
                indoor_seed_end = None
            else:
                indoor_seed_start = window_start - timedelta(weeks=max(1, crop.weeks_to_transplant))
                indoor_seed_end = window_end - timedelta(weeks=max(1, crop.weeks_to_transplant))
            method = "transplant"

        status = _window_status(today, window_start, window_end, soil_ok)
        if frost_risk_next_10_days == "high" and is_warm_crop and status == "open":
            status = "watch"

        if status == "open":
            reason = "Conditions are in range for active planting."
        elif status == "watch":
            reason = "Calendar window is open, but soil warmth or near-term frost risk suggests caution."
        elif status == "upcoming":
            reason = "Window has not opened yet for this crop and method."
        else:
            reason = "Primary window is ending or has passed; consider succession or fall alternatives."

        windows.append(
            {
                "crop_template_id": crop.id,
                "crop_name": crop.name,
                "variety": crop.variety,
                "method": method,
                "window_start": window_start,
                "window_end": window_end,
                "status": status,
                "reason": reason,
                "soil_temperature_min_f": soil_min_f,
                "indoor_seed_start": indoor_seed_start,
                "indoor_seed_end": indoor_seed_end,
                "legacy_window_label": crop.planting_window,
            }
        )

    windows.sort(key=lambda item: (item["window_start"], item["crop_name"], item["variety"]))

    return {
        "generated_on": today,
        "zone": garden.growing_zone,
        "microclimate_band": climate_summary["microclimate_band"],
        "adjusted_last_spring_frost": adjusted_last_frost,
        "adjusted_first_fall_frost": adjusted_first_fall_frost,
        "soil_temperature_estimate_f": soil_temperature_estimate_f,
        "frost_risk_next_10_days": frost_risk_next_10_days,
        "windows": windows,
    }