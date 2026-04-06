"""Registry that orchestrates one primary and many secondary crop source providers.

Usage
-----
1. Call ``crop_source_registry.register(provider)`` for each source during app startup.
2. Call ``crop_source_registry.ensure_source_configs(db)`` to upsert DB config rows.
3. Call ``crop_source_registry.sync_to_db(db, force_refresh)`` from the crop sync thread.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from ..core.logging_utils import get_logger
from ..models import CropSourceConfig, CropTemplate
from .crop_source_providers import CropSourceProvider

if TYPE_CHECKING:
    from sqlalchemy.orm import Session
    from .spacing_providers import SpacingProvider

logger = get_logger(__name__)


class CropSourceRegistry:
    def __init__(self) -> None:
        self._providers: dict[str, CropSourceProvider] = {}

    # ------------------------------------------------------------------
    # Provider registration
    # ------------------------------------------------------------------

    def register(self, provider: CropSourceProvider) -> None:
        self._providers[provider.source_key] = provider

    def has_providers(self) -> bool:
        return bool(self._providers)

    def registered_keys(self) -> list[str]:
        return list(self._providers.keys())

    # ------------------------------------------------------------------
    # DB config bootstrap
    # ------------------------------------------------------------------

    def ensure_source_configs(self, db: Session) -> None:
        """Create a CropSourceConfig row for any newly registered provider.

        The first-ever registered provider becomes the primary source.
        """
        existing_keys = {row.source_key for row in db.query(CropSourceConfig.source_key).all()}
        has_any_primary = (
            db.query(CropSourceConfig).filter(CropSourceConfig.is_primary.is_(True)).count() > 0
        )

        for idx, (key, provider) in enumerate(self._providers.items()):
            if key in existing_keys:
                continue
            is_first = not has_any_primary and idx == 0
            config = CropSourceConfig(
                source_key=key,
                display_name=provider.display_name,
                is_primary=is_first,
                is_enabled=True,
                priority=idx,
            )
            db.add(config)
            if is_first:
                has_any_primary = True
            logger.info(
                "registered new crop source",
                extra={"source_key": key, "is_primary": config.is_primary},
            )

        db.commit()

    # ------------------------------------------------------------------
    # Sync
    # ------------------------------------------------------------------

    def sync_to_db(
        self,
        db: Session,
        force_refresh: bool = False,
        spacing_provider: SpacingProvider | None = None,
    ) -> dict:
        """Fetch crops from all enabled sources and persist to DB.

        Primary source runs first; secondaries follow in priority order (ASC).
        Crops whose canonical name (case-insensitive) was already claimed by a
        higher-priority source are silently skipped (deduplication).
        """
        if spacing_provider is None:
            from .spacing_providers import get_default_spacing_provider

            spacing_provider = get_default_spacing_provider()

        # Load ordered configs: primary first, secondaries by priority ASC.
        configs: list[CropSourceConfig] = (
            db.query(CropSourceConfig).filter(CropSourceConfig.is_enabled.is_(True)).all()
        )
        configs.sort(key=lambda c: (0 if c.is_primary else 1, c.priority))

        seen_names: set[str] = set()
        total_added = 0
        total_updated = 0
        total_skipped = 0
        total_failed = 0

        for config in configs:
            provider = self._providers.get(config.source_key)
            if provider is None:
                logger.warning(
                    "crop source in DB has no registered provider",
                    extra={"source_key": config.source_key},
                )
                continue

            existing_templates = (
                db.query(CropTemplate).filter(CropTemplate.source == config.source_key).all()
            )

            if existing_templates and not force_refresh:
                # Already have data — don't re-fetch, but mark names as seen.
                for t in existing_templates:
                    seen_names.add(t.name.lower())
                total_skipped += len(existing_templates)
                continue

            try:
                records = provider.fetch_crops(spacing_provider)
            except RuntimeError as exc:
                logger.error(
                    "crop source fetch failed",
                    extra={"source_key": config.source_key, "error": str(exc)},
                )
                total_failed += 1
                continue

            existing_by_product_id = {
                t.external_product_id: t for t in existing_templates if t.external_product_id
            }

            for record in records:
                norm_name = record.canonical_name.lower()
                if norm_name in seen_names:
                    # Duplicate from a higher-priority source.
                    continue
                seen_names.add(norm_name)

                payload = {
                    "name": record.canonical_name,
                    "variety": record.variety,
                    "source": record.source_key,
                    "source_url": record.source_url,
                    "image_url": record.image_url,
                    "external_product_id": record.external_product_id,
                    "family": record.family,
                    "spacing_in": record.spacing_in,
                    "row_spacing_in": record.row_spacing_in,
                    "in_row_spacing_in": record.in_row_spacing_in,
                    "planting_window": record.planting_window,
                    "days_to_harvest": record.days_to_harvest,
                    "direct_sow": record.direct_sow,
                    "frost_hardy": record.frost_hardy,
                    "weeks_to_transplant": record.weeks_to_transplant,
                    "notes": record.notes,
                }

                existing = existing_by_product_id.get(record.external_product_id)
                if existing is None:
                    db.add(CropTemplate(**payload))
                    total_added += 1
                else:
                    changed = any(getattr(existing, k) != v for k, v in payload.items())
                    if changed:
                        for k, v in payload.items():
                            setattr(existing, k, v)
                        total_updated += 1

        if total_added or total_updated:
            db.commit()

        return {
            "added": total_added,
            "updated": total_updated,
            "skipped": total_skipped,
            "failed": total_failed,
        }


# Module-level singleton — populated during app lifespan startup.
crop_source_registry = CropSourceRegistry()
