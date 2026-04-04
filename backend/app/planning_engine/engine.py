from collections import Counter
from datetime import date, timedelta

from ..engines.climate import build_dynamic_planting_windows


_COMPANION_RULES = {
    "tomato": {
        "good_with": {"basil", "carrot", "marigold", "onion"},
        "avoid": {"potato", "corn", "fennel"},
    },
    "carrot": {
        "good_with": {"onion", "tomato", "radish", "lettuce"},
        "avoid": {"dill"},
    },
    "lettuce": {
        "good_with": {"carrot", "radish", "onion", "cucumber"},
        "avoid": set(),
    },
    "pepper": {
        "good_with": {"basil", "onion", "carrot"},
        "avoid": {"fennel"},
    },
    "cucumber": {
        "good_with": {"lettuce", "radish", "bean"},
        "avoid": {"potato", "sage"},
    },
    "bean": {
        "good_with": {"cucumber", "carrot", "corn"},
        "avoid": {"onion", "garlic"},
    },
}


_FAMILY_COMPATIBILITY = {
    "solanaceae": {"apiaceae", "alliaceae", "asteraceae", "lamiaceae"},
    "brassicaceae": {"apiaceae", "asteraceae", "alliaceae"},
    "apiaceae": {"solanaceae", "alliaceae", "asteraceae", "brassicaceae"},
    "cucurbitaceae": {"fabaceae", "asteraceae", "alliaceae"},
    "fabaceae": {"cucurbitaceae", "poaceae", "brassicaceae"},
    "alliaceae": {"apiaceae", "solanaceae", "brassicaceae"},
}


def _base_crop_name(crop_name: str) -> str:
    clean = crop_name.strip().lower()
    if clean.endswith(")") and "(" in clean:
        clean = clean.rsplit("(", 1)[0].strip()
    return clean


def _slug_family(family: str) -> str:
    return family.strip().lower().replace(" ", "")


def _template_lookup_by_name(crop_templates: list) -> tuple[dict[str, object], dict[int, object]]:
    by_name: dict[str, object] = {}
    by_id: dict[int, object] = {}
    for crop in crop_templates:
        by_name[crop.name] = crop
        by_name[_base_crop_name(crop.name)] = crop
        by_id[crop.id] = crop
    return by_name, by_id


def _growth_stage(days_since_planting: int, days_to_harvest: int, harvested_on: date | None) -> tuple[str, int]:
    if harvested_on is not None:
        return "harvested", 100

    safe_days = max(1, days_to_harvest)
    progress_pct = max(0, min(100, int((days_since_planting / safe_days) * 100)))
    if progress_pct < 15:
        stage = "germination"
    elif progress_pct < 55:
        stage = "vegetative"
    elif progress_pct < 85:
        stage = "flowering_fruiting"
    else:
        stage = "harvest_ready"
    return stage, progress_pct


def _rotation_recommendations(plantings: list, crop_templates_by_name: dict[str, object]) -> list[dict]:
    by_bed: dict[int, list] = {}
    for planting in plantings:
        by_bed.setdefault(planting.bed_id, []).append(planting)

    recommendations: list[dict] = []
    for bed_id, bed_plantings in by_bed.items():
        ordered = sorted(bed_plantings, key=lambda item: item.planted_on, reverse=True)
        latest = ordered[0]
        latest_template = crop_templates_by_name.get(latest.crop_name)
        latest_family = _slug_family(latest_template.family) if latest_template and latest_template.family else "unknown"

        recent_families = []
        for planting in ordered[:4]:
            template = crop_templates_by_name.get(planting.crop_name)
            if template and template.family:
                recent_families.append(_slug_family(template.family))

        suggested = sorted(_FAMILY_COMPATIBILITY.get(latest_family, set()))
        recommendations.append(
            {
                "bed_id": bed_id,
                "last_crop": latest.crop_name,
                "avoid_family": latest_family,
                "recent_families": recent_families,
                "recommended_families": suggested,
                "reason": "Rotate away from the most recent family in each bed to reduce pest and disease carryover.",
            }
        )

    return sorted(recommendations, key=lambda item: item["bed_id"])


def _companion_insights(active_plantings: list, crop_templates_by_name: dict[str, object]) -> list[dict]:
    if not active_plantings:
        return []

    by_bed: dict[int, list] = {}
    for planting in active_plantings:
        by_bed.setdefault(planting.bed_id, []).append(planting)

    insights: list[dict] = []
    for bed_id, bed_plantings in by_bed.items():
        base_names = [_base_crop_name(item.crop_name) for item in bed_plantings]
        unique_names = sorted(set(base_names))

        for crop_name in unique_names:
            rule = _COMPANION_RULES.get(crop_name)
            if rule is None:
                continue

            positives = sorted(name for name in unique_names if name != crop_name and name in rule["good_with"])
            risks = sorted(name for name in unique_names if name != crop_name and name in rule["avoid"])

            if not positives and not risks:
                continue

            insights.append(
                {
                    "bed_id": bed_id,
                    "crop": crop_name,
                    "good_matches": positives,
                    "risk_matches": risks,
                    "reason": "Companion pairings are based on broad horticultural compatibility heuristics.",
                }
            )

    return insights


def _succession_recommendations(
    plantings: list,
    climate_windows: dict,
    crop_templates_by_name: dict[str, object],
    active_plantings: list,
) -> list[dict]:
    today = date.today()
    upcoming_harvests = [
        planting
        for planting in active_plantings
        if planting.expected_harvest_on <= today + timedelta(days=30)
    ]

    open_or_upcoming_windows = [
        window
        for window in climate_windows["windows"]
        if window["status"] in {"open", "upcoming", "watch"}
    ]

    suggestions: list[dict] = []
    for planting in sorted(upcoming_harvests, key=lambda item: item.expected_harvest_on):
        current_template = crop_templates_by_name.get(planting.crop_name)
        current_family = _slug_family(current_template.family) if current_template and current_template.family else ""

        bed_recent_families = []
        for candidate in plantings:
            if candidate.bed_id != planting.bed_id:
                continue
            candidate_template = crop_templates_by_name.get(candidate.crop_name)
            if candidate_template and candidate_template.family:
                bed_recent_families.append(_slug_family(candidate_template.family))

        candidate_window = None
        for window in open_or_upcoming_windows:
            candidate_template = crop_templates_by_name.get(window["crop_name"])
            candidate_family = _slug_family(candidate_template.family) if candidate_template and candidate_template.family else ""
            if current_family and candidate_family == current_family:
                continue
            if candidate_family and candidate_family in bed_recent_families[:2]:
                continue
            candidate_window = window
            break

        if candidate_window is None:
            continue

        suggestions.append(
            {
                "bed_id": planting.bed_id,
                "after_planting_id": planting.id,
                "after_crop": planting.crop_name,
                "target_harvest_date": planting.expected_harvest_on,
                "recommended_crop": candidate_window["crop_name"],
                "recommended_method": candidate_window["method"],
                "window_start": candidate_window["window_start"],
                "window_end": candidate_window["window_end"],
                "window_status": candidate_window["status"],
                "reason": "Succession slot based on expected harvest date, climate window, and family rotation.",
            }
        )

    return suggestions


def _recommended_next_plantings(climate_windows: dict, crop_templates_by_name: dict[str, object], active_plantings: list) -> list[dict]:
    active_crop_names = {_base_crop_name(planting.crop_name) for planting in active_plantings}
    today = date.today()

    candidates = []
    for window in climate_windows["windows"]:
        if window["status"] not in {"open", "watch", "upcoming"}:
            continue

        base_name = _base_crop_name(window["crop_name"])
        if base_name in active_crop_names:
            continue

        crop = crop_templates_by_name.get(window["crop_name"])
        family = crop.family if crop and crop.family else "Unknown"
        priority = 0
        if window["status"] == "open":
            priority += 3
        elif window["status"] == "watch":
            priority += 2
        else:
            priority += 1
        indoor_seed_start = window.get("indoor_seed_start")
        indoor_seed_end = window.get("indoor_seed_end")
        if window["method"] == "direct_sow":
            priority += 1
            if window["status"] in {"open", "watch"}:
                priority += 1
        elif indoor_seed_start and indoor_seed_end and indoor_seed_start <= today <= indoor_seed_end:
            # Favor transplants that should be started indoors now so they are ready after frost.
            priority += 3

        candidates.append(
            {
                "crop_name": window["crop_name"],
                "variety": window["variety"],
                "family": family,
                "method": window["method"],
                "window_start": window["window_start"],
                "window_end": window["window_end"],
                "indoor_seed_start": indoor_seed_start,
                "indoor_seed_end": indoor_seed_end,
                "status": window["status"],
                "reason": window["reason"],
                "priority": priority,
            }
        )

    def _candidate_sort_key(item: dict) -> tuple:
        return (-item["priority"], item["window_start"], item["crop_name"])

    candidates.sort(key=_candidate_sort_key)

    direct_sow_candidates = [
        item
        for item in candidates
        if item["method"] == "direct_sow"
    ]
    seed_start_now_candidates = [
        item
        for item in candidates
        if item["method"] == "transplant"
        and item["indoor_seed_start"] is not None
        and item["indoor_seed_end"] is not None
        and item["indoor_seed_start"] <= today <= item["indoor_seed_end"]
    ]

    selected: list[dict] = []
    seen = set()

    def _add_unique(items: list[dict], limit: int) -> None:
        for item in items:
            key = (item["crop_name"], item["variety"], item["method"])
            if key in seen:
                continue
            seen.add(key)
            selected.append(item)
            if len(selected) >= limit:
                break

    _add_unique(direct_sow_candidates, 8)
    _add_unique(seed_start_now_candidates, 16)

    for item in candidates:
        if len(selected) >= 20:
            break
        key = (item["crop_name"], item["variety"], item["method"])
        if key in seen:
            continue
        seen.add(key)
        selected.append(item)

    return selected


def build_seasonal_plan(garden, weather: dict, crop_templates: list, plantings: list) -> dict:
    today = date.today()
    crop_templates_by_name, _ = _template_lookup_by_name(crop_templates)

    growth_stages = []
    for planting in plantings:
        template = crop_templates_by_name.get(planting.crop_name)
        days_to_harvest = template.days_to_harvest if template else 60
        days_since = (today - planting.planted_on).days
        stage, progress_pct = _growth_stage(days_since, days_to_harvest, planting.harvested_on)
        growth_stages.append(
            {
                "planting_id": planting.id,
                "crop_name": planting.crop_name,
                "bed_id": planting.bed_id,
                "days_since_planting": max(0, days_since),
                "days_to_harvest": days_to_harvest,
                "progress_pct": progress_pct,
                "stage": stage,
                "expected_harvest_on": planting.expected_harvest_on,
                "harvested_on": planting.harvested_on,
            }
        )

    active_plantings = [item for item in plantings if item.harvested_on is None]
    climate_windows = build_dynamic_planting_windows(garden, weather, crop_templates)

    rotation = _rotation_recommendations(plantings, crop_templates_by_name)
    companion = _companion_insights(active_plantings, crop_templates_by_name)
    succession = _succession_recommendations(plantings, climate_windows, crop_templates_by_name, active_plantings)
    recommended_next = _recommended_next_plantings(climate_windows, crop_templates_by_name, active_plantings)

    stage_counts = Counter(stage["stage"] for stage in growth_stages)

    return {
        "generated_on": today,
        "garden_id": garden.id,
        "zone": garden.growing_zone,
        "microclimate_band": climate_windows["microclimate_band"],
        "soil_temperature_estimate_f": climate_windows["soil_temperature_estimate_f"],
        "frost_risk_next_10_days": climate_windows["frost_risk_next_10_days"],
        "stage_counts": dict(stage_counts),
        "growth_stages": sorted(growth_stages, key=lambda item: (item["stage"], item["crop_name"])),
        "rotation_recommendations": rotation,
        "companion_insights": companion,
        "succession_recommendations": succession,
        "recommended_next_plantings": recommended_next,
    }


def build_planting_recommendations(
    planting,
    garden,
    weather: dict,
    crop_templates: list,
    plantings: list,
) -> dict:
    today = date.today()
    crop_templates_by_name, _ = _template_lookup_by_name(crop_templates)

    target_template = crop_templates_by_name.get(planting.crop_name)
    days_to_harvest = target_template.days_to_harvest if target_template else 60
    days_since = max(0, (today - planting.planted_on).days)
    stage, progress_pct = _growth_stage(days_since, days_to_harvest, planting.harvested_on)

    climate_windows = build_dynamic_planting_windows(garden, weather, crop_templates)

    active_plantings = [item for item in plantings if item.harvested_on is None and item.id != planting.id]
    active_base_names = {_base_crop_name(item.crop_name) for item in active_plantings}

    target_base = _base_crop_name(planting.crop_name)
    companion_rule = _COMPANION_RULES.get(target_base, {"good_with": set(), "avoid": set()})
    good_matches = sorted(name for name in active_base_names if name in companion_rule["good_with"])
    risk_matches = sorted(name for name in active_base_names if name in companion_rule["avoid"])

    current_family = _slug_family(target_template.family) if target_template and target_template.family else ""
    succession_candidates = []
    for window in climate_windows["windows"]:
        if window["status"] not in {"open", "watch", "upcoming"}:
            continue
        candidate_template = crop_templates_by_name.get(window["crop_name"])
        candidate_family = _slug_family(candidate_template.family) if candidate_template and candidate_template.family else ""
        if current_family and candidate_family == current_family:
            continue
        succession_candidates.append(
            {
                "crop_name": window["crop_name"],
                "variety": window["variety"],
                "method": window["method"],
                "window_start": window["window_start"],
                "window_end": window["window_end"],
                "status": window["status"],
                "reason": "Follow-on crop avoids immediate same-family rotation and has a viable window.",
            }
        )

    return {
        "generated_on": today,
        "planting_id": planting.id,
        "crop_name": planting.crop_name,
        "bed_id": planting.bed_id,
        "stage": stage,
        "progress_pct": progress_pct,
        "days_since_planting": days_since,
        "days_to_harvest": days_to_harvest,
        "expected_harvest_on": planting.expected_harvest_on,
        "companion": {
            "good_matches": good_matches,
            "risk_matches": risk_matches,
            "reason": "Companion guidance compares this planting to currently active crops in the same garden.",
        },
        "next_actions": [
            {
                "title": "Check growth stage targets",
                "detail": "Use stage-specific care for watering, feeding, and pest checks.",
            },
            {
                "title": "Review succession options",
                "detail": "Select a follow-on crop before harvest to reduce bed downtime.",
            },
        ],
        "succession_candidates": succession_candidates[:8],
    }
