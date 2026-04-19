from datetime import date, timedelta
from types import SimpleNamespace

from app.planning_engine import engine
from app.planning_engine.engine import build_planting_recommendations, build_seasonal_plan


def test_build_seasonal_plan_groups_growth_rotation_and_next_plantings(monkeypatch):
    garden = SimpleNamespace(id=1, growing_zone="10b")
    crop_templates = [
        SimpleNamespace(
            id=1, name="Tomato (Roma)", variety="Roma", family="Solanaceae", days_to_harvest=75
        ),
        SimpleNamespace(
            id=2, name="Carrot", variety="Napoli", family="Apiaceae", days_to_harvest=60
        ),
    ]
    plantings = [
        SimpleNamespace(
            id=1,
            bed_id=1,
            crop_name="Tomato (Roma)",
            planted_on=date.today() - timedelta(days=50),
            expected_harvest_on=date.today() + timedelta(days=10),
            harvested_on=None,
        ),
        SimpleNamespace(
            id=2,
            bed_id=1,
            crop_name="Carrot",
            planted_on=date.today() - timedelta(days=15),
            expected_harvest_on=date.today() + timedelta(days=40),
            harvested_on=None,
        ),
    ]

    monkeypatch.setattr(
        "app.planning_engine.engine.build_dynamic_planting_windows",
        lambda garden, weather, crop_templates: {
            "microclimate_band": "balanced",
            "soil_temperature_estimate_f": 62.0,
            "frost_risk_next_10_days": "low",
            "windows": [
                {
                    "crop_name": "Lettuce",
                    "variety": "Butterhead",
                    "method": "direct_sow",
                    "window_start": date.today(),
                    "window_end": date.today() + timedelta(days=14),
                    "status": "open",
                    "reason": "Ready now",
                    "indoor_seed_start": None,
                    "indoor_seed_end": None,
                },
            ],
        },
    )

    result = build_seasonal_plan(
        garden, weather={}, crop_templates=crop_templates, plantings=plantings
    )

    assert result["microclimate_band"] == "balanced"
    assert result["stage_counts"]["flowering_fruiting"] == 1
    assert result["rotation_recommendations"][0]["avoid_family"] == "apiaceae"
    assert result["companion_insights"][0]["crop"] == "carrot"
    assert result["recommended_next_plantings"][0]["crop_name"] == "Lettuce"


def test_recommended_next_plantings_skip_crops_already_started_indoors(monkeypatch):
    """Indoor trays count as active so we do not suggest starting the same crop again."""
    garden = SimpleNamespace(id=1, growing_zone="7a")
    crop_templates = [
        SimpleNamespace(
            id=1, name="Broccoli", variety="", family="Brassicaceae", days_to_harvest=60
        ),
        SimpleNamespace(
            id=2, name="Lettuce", variety="Butter", family="Asteraceae", days_to_harvest=45
        ),
    ]
    plantings = [
        SimpleNamespace(
            id=1,
            bed_id=1,
            crop_name="Broccoli",
            planted_on=date.today(),
            expected_harvest_on=date.today() + timedelta(days=120),
            harvested_on=None,
            location="indoor",
        ),
    ]
    monkeypatch.setattr(
        "app.planning_engine.engine.build_dynamic_planting_windows",
        lambda g, w, ct: {
            "microclimate_band": "balanced",
            "soil_temperature_estimate_f": 50.0,
            "frost_risk_next_10_days": "low",
            "windows": [
                {
                    "crop_name": "Broccoli",
                    "variety": "",
                    "method": "transplant",
                    "window_start": date.today(),
                    "window_end": date.today() + timedelta(days=14),
                    "status": "open",
                    "reason": "Window open",
                    "indoor_seed_start": date.today() - timedelta(days=7),
                    "indoor_seed_end": date.today() + timedelta(days=7),
                },
                {
                    "crop_name": "Lettuce",
                    "variety": "Butter",
                    "method": "direct_sow",
                    "window_start": date.today(),
                    "window_end": date.today() + timedelta(days=14),
                    "status": "open",
                    "reason": "Ok",
                    "indoor_seed_start": None,
                    "indoor_seed_end": None,
                },
            ],
        },
    )

    result = build_seasonal_plan(
        garden, weather={}, crop_templates=crop_templates, plantings=plantings
    )
    names = [r["crop_name"] for r in result["recommended_next_plantings"]]
    assert "Broccoli" not in names
    assert "Lettuce" in names


def test_internal_planning_helpers_cover_risk_and_transplant_paths():
    crop_templates = [
        SimpleNamespace(
            id=1, name="Cucumber", variety="", family="Cucurbitaceae", days_to_harvest=55
        ),
        SimpleNamespace(id=2, name="Bean", variety="", family="Fabaceae", days_to_harvest=50),
        SimpleNamespace(id=3, name="Pepper", variety="", family="Solanaceae", days_to_harvest=80),
    ]
    by_name, _ = engine._template_lookup_by_name(crop_templates)
    active = [
        SimpleNamespace(
            id=1,
            bed_id=1,
            crop_name="Cucumber",
            planted_on=date.today() - timedelta(days=20),
            expected_harvest_on=date.today() + timedelta(days=10),
            harvested_on=None,
        ),
        SimpleNamespace(
            id=2,
            bed_id=1,
            crop_name="Bean",
            planted_on=date.today() - timedelta(days=8),
            expected_harvest_on=date.today() + timedelta(days=40),
            harvested_on=None,
        ),
    ]
    windows = {
        "windows": [
            {
                "crop_name": "Pepper",
                "variety": "",
                "method": "transplant",
                "window_start": date.today(),
                "window_end": date.today() + timedelta(days=7),
                "status": "watch",
                "reason": "Soon",
                "indoor_seed_start": date.today() - timedelta(days=1),
                "indoor_seed_end": date.today() + timedelta(days=5),
            },
        ]
    }

    stage, pct = engine._growth_stage(90, 60, date.today())
    companions = engine._companion_insights(active, by_name)
    succession = engine._succession_recommendations(active, windows, by_name, active)
    active_names = {engine._base_crop_name(p.crop_name) for p in active}
    next_up = engine._recommended_next_plantings(windows, by_name, active_names)

    assert (stage, pct) == ("harvested", 100)
    assert companions[0]["crop"] == "bean"
    assert succession[0]["recommended_crop"] == "Pepper"
    assert next_up[0]["method"] == "transplant"


def test_planning_helpers_cover_unknown_and_empty_paths():
    crop_templates = [
        SimpleNamespace(id=1, name="Tomato", variety="", family="Solanaceae", days_to_harvest=80),
        SimpleNamespace(id=2, name="Lettuce", variety="", family="Asteraceae", days_to_harvest=45),
    ]
    by_name, _ = engine._template_lookup_by_name(crop_templates)

    mystery_planting = SimpleNamespace(
        id=1,
        bed_id=2,
        crop_name="Mystery Crop",
        planted_on=date.today() - timedelta(days=90),
        expected_harvest_on=date.today() + timedelta(days=5),
        harvested_on=None,
    )

    rotation = engine._rotation_recommendations([mystery_planting], by_name)

    assert engine._growth_stage(5, 100, None) == ("germination", 5)
    assert engine._growth_stage(25, 50, None) == ("vegetative", 50)
    assert engine._growth_stage(90, 100, None) == ("harvest_ready", 90)
    assert engine._companion_insights([], by_name) == []
    assert engine._companion_insights([mystery_planting], by_name) == []
    assert rotation == [
        {
            "bed_id": 2,
            "last_crop": "Mystery Crop",
            "avoid_family": "unknown",
            "recent_families": [],
            "recommended_families": [],
            "reason": "Rotate away from the most recent family in each bed to reduce pest and disease carryover.",
        }
    ]


def test_succession_and_next_plantings_cover_skip_branches():
    today = date.today()
    crop_templates = [
        SimpleNamespace(
            id=1, name="Tomato", variety="Roma", family="Solanaceae", days_to_harvest=75
        ),
        SimpleNamespace(
            id=2, name="Pepper", variety="King", family="Solanaceae", days_to_harvest=80
        ),
        SimpleNamespace(
            id=3, name="Bean", variety="Blue Lake", family="Fabaceae", days_to_harvest=50
        ),
        SimpleNamespace(
            id=4, name="Lettuce", variety="Butterhead", family="Asteraceae", days_to_harvest=45
        ),
    ]
    by_name, _ = engine._template_lookup_by_name(crop_templates)
    active_plantings = [
        SimpleNamespace(
            id=1,
            bed_id=1,
            crop_name="Tomato",
            planted_on=today - timedelta(days=30),
            expected_harvest_on=today + timedelta(days=7),
            harvested_on=None,
        ),
        SimpleNamespace(
            id=2,
            bed_id=1,
            crop_name="Bean",
            planted_on=today - timedelta(days=10),
            expected_harvest_on=today + timedelta(days=40),
            harvested_on=None,
        ),
        SimpleNamespace(
            id=3,
            bed_id=2,
            crop_name="Pepper",
            planted_on=today - timedelta(days=12),
            expected_harvest_on=today + timedelta(days=12),
            harvested_on=None,
        ),
    ]
    climate_windows = {
        "windows": [
            {
                "crop_name": "Tomato",
                "variety": "Roma",
                "method": "transplant",
                "window_start": today,
                "window_end": today + timedelta(days=7),
                "status": "open",
                "reason": "Same family",
                "indoor_seed_start": today - timedelta(days=2),
                "indoor_seed_end": today + timedelta(days=2),
            },
            {
                "crop_name": "Bean",
                "variety": "Blue Lake",
                "method": "direct_sow",
                "window_start": today,
                "window_end": today + timedelta(days=7),
                "status": "watch",
                "reason": "Recent family",
                "indoor_seed_start": None,
                "indoor_seed_end": None,
            },
            {
                "crop_name": "Lettuce",
                "variety": "Butterhead",
                "method": "direct_sow",
                "window_start": today + timedelta(days=1),
                "window_end": today + timedelta(days=10),
                "status": "upcoming",
                "reason": "Good follow-on",
                "indoor_seed_start": None,
                "indoor_seed_end": None,
            },
            {
                "crop_name": "Pepper",
                "variety": "King",
                "method": "transplant",
                "window_start": today + timedelta(days=2),
                "window_end": today + timedelta(days=12),
                "status": "closing",
                "reason": "Ignored",
                "indoor_seed_start": today - timedelta(days=1),
                "indoor_seed_end": today + timedelta(days=1),
            },
        ]
    }

    succession = engine._succession_recommendations(
        active_plantings, climate_windows, by_name, active_plantings
    )

    many_windows = {"windows": []}
    for index in range(25):
        many_windows["windows"].append(
            {
                "crop_name": f"Crop {index}",
                "variety": f"V{index % 2}",
                "method": "direct_sow" if index % 2 == 0 else "transplant",
                "window_start": today + timedelta(days=index),
                "window_end": today + timedelta(days=index + 5),
                "status": "open" if index % 3 == 0 else "watch",
                "reason": "Candidate",
                "indoor_seed_start": today - timedelta(days=1) if index % 2 else None,
                "indoor_seed_end": today + timedelta(days=3) if index % 2 else None,
            }
        )
    many_windows["windows"].append(
        {
            "crop_name": "Tomato",
            "variety": "Roma",
            "method": "direct_sow",
            "window_start": today,
            "window_end": today + timedelta(days=3),
            "status": "open",
            "reason": "Already active",
            "indoor_seed_start": None,
            "indoor_seed_end": None,
        }
    )
    many_windows["windows"].append(
        {
            "crop_name": "Crop 0",
            "variety": "V0",
            "method": "direct_sow",
            "window_start": today,
            "window_end": today + timedelta(days=5),
            "status": "closing",
            "reason": "Ignored status",
            "indoor_seed_start": None,
            "indoor_seed_end": None,
        }
    )

    active_base = {engine._base_crop_name(p.crop_name) for p in active_plantings}
    next_up = engine._recommended_next_plantings(many_windows, by_name, active_base)

    assert [item["recommended_crop"] for item in succession] == ["Lettuce", "Bean"]
    assert len(next_up) == 20
    assert next_up[0]["method"] == "direct_sow"
    assert all(item["crop_name"] != "Tomato" for item in next_up)
    assert len({(item["crop_name"], item["variety"], item["method"]) for item in next_up}) == len(
        next_up
    )


def test_build_planting_recommendations_returns_companions_and_candidates(monkeypatch):
    today = date.today()
    garden = SimpleNamespace(id=1, growing_zone="10b")
    crop_templates = [
        SimpleNamespace(
            id=1, name="Tomato", variety="Roma", family="Solanaceae", days_to_harvest=75
        ),
        SimpleNamespace(
            id=2, name="Lettuce", variety="Butterhead", family="Asteraceae", days_to_harvest=45
        ),
        SimpleNamespace(
            id=3, name="Carrot", variety="Napoli", family="Apiaceae", days_to_harvest=60
        ),
    ]
    target = SimpleNamespace(
        id=10,
        bed_id=1,
        crop_name="Tomato",
        planted_on=today - timedelta(days=20),
        expected_harvest_on=today + timedelta(days=55),
        harvested_on=None,
    )
    other_plantings = [
        target,
        SimpleNamespace(
            id=11,
            bed_id=1,
            crop_name="Carrot",
            planted_on=today - timedelta(days=5),
            expected_harvest_on=today + timedelta(days=40),
            harvested_on=None,
        ),
        SimpleNamespace(
            id=12,
            bed_id=2,
            crop_name="Potato",
            planted_on=today - timedelta(days=3),
            expected_harvest_on=today + timedelta(days=70),
            harvested_on=None,
        ),
        SimpleNamespace(
            id=13,
            bed_id=2,
            crop_name="Lettuce",
            planted_on=today - timedelta(days=2),
            expected_harvest_on=today + timedelta(days=30),
            harvested_on=today,
        ),
    ]

    monkeypatch.setattr(
        "app.planning_engine.engine.build_dynamic_planting_windows",
        lambda garden, weather, crop_templates: {
            "windows": [
                {
                    "crop_name": "Tomato",
                    "variety": "Roma",
                    "method": "transplant",
                    "window_start": today,
                    "window_end": today + timedelta(days=5),
                    "status": "open",
                    "reason": "Same family",
                },
                {
                    "crop_name": "Lettuce",
                    "variety": "Butterhead",
                    "method": "direct_sow",
                    "window_start": today + timedelta(days=1),
                    "window_end": today + timedelta(days=10),
                    "status": "watch",
                    "reason": "Cool season",
                },
                {
                    "crop_name": "Bean",
                    "variety": "Blue Lake",
                    "method": "direct_sow",
                    "window_start": today + timedelta(days=2),
                    "window_end": today + timedelta(days=11),
                    "status": "closed",
                    "reason": "Ignored",
                },
            ]
        },
    )

    result = build_planting_recommendations(
        target, garden, weather={}, crop_templates=crop_templates, plantings=other_plantings
    )

    assert result["stage"] == "vegetative"
    assert result["companion"]["good_matches"] == ["carrot"]
    assert result["companion"]["risk_matches"] == ["potato"]
    assert result["succession_candidates"] == [
        {
            "crop_name": "Lettuce",
            "variety": "Butterhead",
            "method": "direct_sow",
            "window_start": today + timedelta(days=1),
            "window_end": today + timedelta(days=10),
            "status": "watch",
            "reason": "Follow-on crop avoids immediate same-family rotation and has a viable window.",
        }
    ]
