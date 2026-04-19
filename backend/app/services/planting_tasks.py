"""Auto-generated tasks for plantings: bed-side schedule anchored on bed-entry date."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..models import CropTemplate, Garden, Planting, Task


def crop_task_title(crop_name: str, action: str, variety: str = "") -> str:
    clean_variety = variety.strip()
    base_name = crop_name.strip()
    if clean_variety and base_name.endswith(f" ({clean_variety})"):
        base_name = base_name[: -(len(clean_variety) + 3)].strip()
    if clean_variety:
        return f"{base_name} • {clean_variety}: {action}"
    return f"{base_name}: {action}"


def indoor_effective_bed_entry_date(
    planted_on: date, moved_on: date | None, weeks_to_transplant: int
) -> date:
    """Earliest realistic move-to-bed date for indoor starts.

    Planned `moved_on` must not precede the usual minimum seedling age
    (weeks_to_transplant × 7 days after seed start); otherwise hardening and
    transplant tasks would fire before seedlings are typically ready.
    """
    w = max(1, weeks_to_transplant)
    earliest = planted_on + timedelta(days=w * 7)
    if moved_on is not None:
        return max(moved_on, earliest)
    return earliest


def bed_entry_date_for_planting(planting: Planting, weeks_to_transplant: int) -> date:
    """Date the crop is treated as being in the bed for watering, harvest, and transplant tasks."""
    w = max(1, weeks_to_transplant)
    if planting.location == "indoor":
        return indoor_effective_bed_entry_date(planting.planted_on, planting.moved_on, w)
    if planting.moved_on is not None:
        return planting.moved_on
    return planting.planted_on


def should_skip_start_seeds_indoors(planting: Planting) -> bool:
    """True when seeds were started indoors before the bed timeline (or still are)."""
    if planting.location == "indoor":
        return True
    if planting.moved_on is not None and planting.planted_on < planting.moved_on:
        return True
    return False


def collect_planting_autotasks(
    *,
    zone_note: str,
    crop_name: str,
    crop_variety: str,
    days_to_harvest: int,
    crop_notes: str,
    direct_sow: bool,
    t0: date,
    weeks_to_transplant: int,
    skip_start_seeds_indoors: bool,
) -> list[tuple[str, date, str]]:
    """Return (title, due_on, notes) rows for a planting's default task list."""
    crop = crop_name
    wtt = max(1, weeks_to_transplant)
    auto_tasks: list[tuple[str, date, str]] = []

    if not direct_sow:
        if not skip_start_seeds_indoors:
            start_date = t0 - timedelta(days=wtt * 7)
            auto_tasks.append(
                (
                    crop_task_title(crop, "Start seeds indoors", crop_variety),
                    start_date,
                    f"Fill trays with seed-starting mix. Sow 2 seeds per cell at 70–75 F{zone_note}. Thin to strongest seedling once germinated.",
                )
            )
        harden_date = t0 - timedelta(days=7)
        auto_tasks.append(
            (
                crop_task_title(crop, "Harden off seedlings", crop_variety),
                harden_date,
                f"Move seedlings outside in a sheltered spot for 2-3 hrs/day{zone_note}. Increase exposure over 7 days to avoid transplant shock.",
            )
        )
        auto_tasks.append(
            (
                crop_task_title(crop, "Transplant seedlings to bed", crop_variety),
                t0,
                f"Plant at soil level. Water in with dilute liquid fertiliser{zone_note}. Protect with row cover if frost is still possible.",
            )
        )
    else:
        auto_tasks.append(
            (
                crop_task_title(crop, "Direct sow seeds", crop_variety),
                t0,
                f"Sow seeds at the depth and spacing shown on the packet{zone_note}. Keep soil moist (not saturated) until emergence.",
            )
        )

    auto_tasks.append(
        (
            crop_task_title(crop, "Water and check establishment", crop_variety),
            t0 + timedelta(days=3),
            "Check soil 1 inch deep - water when dry. Consistent moisture is critical in the first two weeks.",
        )
    )
    if days_to_harvest > 10:
        auto_tasks.append(
            (
                crop_task_title(crop, "Water and thin seedlings", crop_variety),
                t0 + timedelta(days=10),
                "Thin direct-sown seedlings if crowded. Water at the base; avoid wetting foliage.",
            )
        )

    if days_to_harvest > 14:
        auto_tasks.append(
            (
                crop_task_title(crop, "Weed bed", crop_variety),
                t0 + timedelta(days=14),
                "Remove weeds before they compete for nutrients. Shallow hoe to avoid disturbing roots.",
            )
        )
        auto_tasks.append(
            (
                crop_task_title(crop, "Pest and disease check", crop_variety),
                t0 + timedelta(days=7),
                f"Inspect leaves top and underside for pests, discolouration or disease{zone_note}. Treat organically early - neem oil or insecticidal soap for soft-bodied insects.",
            )
        )

    if days_to_harvest > 20:
        auto_tasks.append(
            (
                crop_task_title(crop, "Fertilise", crop_variety),
                t0 + timedelta(days=20),
                "Apply balanced fertiliser (e.g. 10-10-10) or side-dress with compost. Avoid excess nitrogen once flowering begins.",
            )
        )

    if days_to_harvest > 40:
        auto_tasks.append(
            (
                crop_task_title(crop, "Mid-season weed and water check", crop_variety),
                t0 + timedelta(days=40),
                "Remove weeds; check mulch depth (2-3 in helps retain moisture and suppress weeds). Deep watering every few days is better than shallow daily watering.",
            )
        )
    if days_to_harvest > 45:
        auto_tasks.append(
            (
                crop_task_title(crop, "Mid-season pest inspection", crop_variety),
                t0 + timedelta(days=45),
                "Check for disease progression; remove and dispose of infected leaves. Apply a second round of fertiliser if growth looks slow.",
            )
        )

    if days_to_harvest > 70:
        auto_tasks.append(
            (
                crop_task_title(crop, "Late-season check", crop_variety),
                t0 + timedelta(days=70),
                f"Ensure adequate water as fruit/roots swell{zone_note}. Watch for late blight (wet weather). Begin preparing bed for next crop rotation.",
            )
        )

    harvest_note = f"Expected ~day {days_to_harvest}{zone_note}."
    if crop_notes:
        harvest_note += f" {crop_notes}"
    auto_tasks.append(
        (
            crop_task_title(crop, "Harvest window opens", crop_variety),
            t0 + timedelta(days=days_to_harvest),
            harvest_note,
        )
    )

    return auto_tasks


def _schedule_group_key(planting: Planting, template: CropTemplate | None) -> tuple[str, str, str]:
    """Group plantings that share the same crop, variety label, and bed-entry schedule (t0)."""
    wtt = max(1, (template.weeks_to_transplant if template else None) or 6)
    t0 = bed_entry_date_for_planting(planting, wtt)
    variety = (template.variety if template else "") or ""
    if template is None:
        return (planting.crop_name.strip(), "", f"_solo_{planting.id}_{t0.isoformat()}")
    return (planting.crop_name.strip(), variety.strip(), t0.isoformat())


def delete_garden_schedule_tasks(db: Session, garden_id: int) -> None:
    """Remove auto-generated planting schedule tasks (keeps user tasks with no planting link)."""
    db.query(Task).filter(
        Task.garden_id == garden_id,
        or_(Task.planting_id.isnot(None), Task.bundled_planting_ids.isnot(None)),
    ).delete(synchronize_session=False)


def rebuild_garden_autotasks(
    db: Session,
    *,
    garden: Garden,
    mark_transplant_done_for_planting_ids: set[int] | frozenset[int] | None = None,
) -> None:
    """Rebuild bundled schedule tasks for all active plantings in the garden."""
    mark_ids: set[int] = set(mark_transplant_done_for_planting_ids or ())
    delete_garden_schedule_tasks(db, garden.id)

    plantings = (
        db.query(Planting)
        .filter(Planting.garden_id == garden.id, Planting.harvested_on.is_(None))
        .all()
    )
    if not plantings:
        return

    zone = garden.growing_zone or "Unknown"
    zone_note = f" (Zone {zone})" if zone and zone != "Unknown" else ""

    groups: dict[tuple[str, str, str], list[Planting]] = defaultdict(list)
    for planting in plantings:
        template = db.query(CropTemplate).filter(CropTemplate.name == planting.crop_name).first()
        key = _schedule_group_key(planting, template)
        groups[key].append(planting)

    for group in groups.values():
        canonical = min(group, key=lambda p: p.id)
        template = db.query(CropTemplate).filter(CropTemplate.name == canonical.crop_name).first()
        days_to_harvest = template.days_to_harvest if template else 60
        direct_sow = template.direct_sow if template else True
        weeks_to_transplant = max(1, template.weeks_to_transplant if template else 6)
        crop_notes = template.notes if template else ""
        crop_variety = template.variety if template else ""

        t0 = bed_entry_date_for_planting(canonical, weeks_to_transplant)
        skip = should_skip_start_seeds_indoors(canonical)

        rows = collect_planting_autotasks(
            zone_note=zone_note,
            crop_name=canonical.crop_name,
            crop_variety=crop_variety,
            days_to_harvest=days_to_harvest,
            crop_notes=crop_notes,
            direct_sow=direct_sow,
            t0=t0,
            weeks_to_transplant=weeks_to_transplant,
            skip_start_seeds_indoors=skip,
        )

        pids = sorted(p.id for p in group)
        n = len(pids)
        bundle = n > 1

        for title, due_on, notes in rows:
            display_title = f"{title} ({n} plantings)" if bundle else title
            display_notes = notes
            if bundle:
                display_notes = (
                    f"{notes}\n\n— Applies to {n} plantings on the same start schedule "
                    f"(planting ids {', '.join(map(str, pids))})."
                )
            planting_id = pids[0]
            bundled = pids if bundle else None
            done = bool(
                mark_ids
                and "Transplant seedlings to bed" in title
                and mark_ids.intersection(pids)
            )
            db.add(
                Task(
                    garden_id=garden.id,
                    planting_id=planting_id,
                    bundled_planting_ids=bundled,
                    title=display_title,
                    due_on=due_on,
                    notes=display_notes,
                    is_done=done,
                )
            )


def replace_planting_autotasks(
    db: Session, *, garden: Garden, planting: Planting, mark_transplant_done: bool = False
) -> None:
    """Resync auto-generated tasks for the whole garden (call after one planting changes)."""
    mids = frozenset({planting.id}) if mark_transplant_done else frozenset()
    rebuild_garden_autotasks(
        db,
        garden=garden,
        mark_transplant_done_for_planting_ids=mids if mark_transplant_done else None,
    )
