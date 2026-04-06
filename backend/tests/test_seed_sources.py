from app.services import seed


class _StaticSpacingProvider:
    def get_row_and_in_row_spacing(self, crop_name: str, root_segment: str) -> tuple[int, int]:
        del crop_name, root_segment
        return (18, 6)


def test_is_high_mowing_product_url_accepts_product_path():
    url = "https://www.highmowingseeds.com/vegetables/beans/organic-snap-bush-bean-seed.html"
    assert seed._is_high_mowing_product_url(url) is True


def test_is_high_mowing_product_url_rejects_non_product_and_excluded_paths():
    assert (
        seed._is_high_mowing_product_url("https://www.highmowingseeds.com/vegetables/beans.html")
        is False
    )
    assert (
        seed._is_high_mowing_product_url(
            "https://www.highmowingseeds.com/vegetables/microgreens.html"
        )
        is False
    )


def test_build_high_mowing_record_from_url_builds_normalized_record():
    record = seed._build_high_mowing_record_from_url(
        "https://www.highmowingseeds.com/vegetables/beans/organic-snap-bush-bean-seed.html",
        _StaticSpacingProvider(),
    )

    assert record.source_key == seed.HIGH_MOWING_SOURCE
    assert record.canonical_name.startswith("Bean (")
    assert record.variety == "Snap Bush"
    assert record.row_spacing_in == 18
    assert record.in_row_spacing_in == 6
    assert "High Mowing" in record.notes
