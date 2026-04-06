import pytest

from app.models import CropSourceConfig, CropTemplate
from app.services.crop_source_providers import NormalizedCropRecord
from app.services.crop_source_registry import CropSourceRegistry


class _Provider:
    def __init__(self, source_key: str, display_name: str, records: list[NormalizedCropRecord]):
        self._source_key = source_key
        self._display_name = display_name
        self._records = records

    @property
    def source_key(self) -> str:
        return self._source_key

    @property
    def display_name(self) -> str:
        return self._display_name

    def fetch_crops(self, spacing_provider):
        del spacing_provider
        return self._records


def _record(source_key: str, canonical_name: str, product_id: str) -> NormalizedCropRecord:
    return NormalizedCropRecord(
        canonical_name=canonical_name,
        variety="",
        source_key=source_key,
        source_url=f"https://example.com/{product_id}",
        image_url="",
        external_product_id=product_id,
        family="",
        spacing_in=12,
        row_spacing_in=18,
        in_row_spacing_in=12,
        planting_window="Spring",
        days_to_harvest=60,
        direct_sow=True,
        frost_hardy=False,
        weeks_to_transplant=0,
        notes="",
    )


@pytest.mark.unit
def test_registry_dedupes_secondary_when_primary_claims_name(db_session):
    registry = CropSourceRegistry()
    registry.register(
        _Provider(
            "johnnys-selected-seeds",
            "Johnny's Selected Seeds",
            [_record("johnnys-selected-seeds", "Carrot", "johnnys-carrot")],
        )
    )
    registry.register(
        _Provider(
            "high-mowing-seeds",
            "High Mowing Organic Seeds",
            [_record("high-mowing-seeds", "Carrot", "high-carrot")],
        )
    )
    registry.ensure_source_configs(db_session)

    result = registry.sync_to_db(db_session, force_refresh=True, spacing_provider=object())

    templates = db_session.query(CropTemplate).all()
    assert result["added"] == 1
    assert len(templates) == 1
    assert templates[0].source == "johnnys-selected-seeds"


@pytest.mark.unit
def test_registry_respects_primary_flag_over_priority(db_session):
    registry = CropSourceRegistry()
    registry.register(
        _Provider(
            "johnnys-selected-seeds",
            "Johnny's Selected Seeds",
            [_record("johnnys-selected-seeds", "Tomato", "johnnys-tomato")],
        )
    )
    registry.register(
        _Provider(
            "high-mowing-seeds",
            "High Mowing Organic Seeds",
            [_record("high-mowing-seeds", "Tomato", "high-tomato")],
        )
    )
    registry.ensure_source_configs(db_session)

    johnnys = (
        db_session.query(CropSourceConfig)
        .filter(CropSourceConfig.source_key == "johnnys-selected-seeds")
        .first()
    )
    high = (
        db_session.query(CropSourceConfig)
        .filter(CropSourceConfig.source_key == "high-mowing-seeds")
        .first()
    )
    assert johnnys is not None and high is not None

    johnnys.is_primary = False
    high.is_primary = True
    high.priority = 100
    johnnys.priority = 0
    db_session.commit()

    result = registry.sync_to_db(db_session, force_refresh=True, spacing_provider=object())

    templates = db_session.query(CropTemplate).all()
    assert result["added"] == 1
    assert len(templates) == 1
    assert templates[0].source == "high-mowing-seeds"
