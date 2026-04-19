from __future__ import annotations

import concurrent.futures
import json
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from html import unescape
from urllib.parse import urlparse
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from ..models import CropTemplate
from ..core.logging_utils import get_logger
from .crop_source_providers import NormalizedCropRecord
from .crop_source_registry import crop_source_registry
from .spacing_providers import SpacingProvider, get_default_spacing_provider

JOHNNYS_SOURCE = "johnnys-selected-seeds"
HIGH_MOWING_SOURCE = "high-mowing-seeds"
MANUAL_SOURCE = "manual"
JOHNNYS_PRODUCT_SITEMAP = "https://www.johnnyseeds.com/sitemap_0-product.xml"
HIGH_MOWING_PRODUCT_SITEMAP = "https://www.highmowingseeds.com/sitemap.xml"
REQUEST_TIMEOUT_SECONDS = 20
REQUEST_USER_AGENT = "open-garden crop-sync/1.0"
MAX_IMPORT_WORKERS = 12
logger = get_logger(__name__)

ALLOWED_ROOT_SEGMENTS = {"vegetables", "fruits", "flowers", "herbs"}
EXCLUDED_PATH_SEGMENTS = {
    "microgreens",
    "shoots",
    "sprouts",
    "mushrooms",
}
EXCLUDED_TITLE_KEYWORDS = {
    "pelleted",
    "treated",
    "microgreen",
    "shoot",
    "sprouting",
    "collection",
    "seed set",
    "grow kit",
    "spawn",
}

HIGH_MOWING_EXCLUDED_SEGMENTS = {
    "microgreens",
    "sprouts",
    "shoots",
    "supplies",
    "apparel",
    "collections",
    "collection",
    "cover-crops",
}

HIGH_MOWING_EXCLUDED_LEAF_KEYWORDS = {
    "greens-sprouts-shoots",
    "greens-micro",
    "greens-salad-mixes",
    "greens-asian-mustard",
    "greens-specialty",
}

_HIGH_MOWING_NOISE_TOKENS = {
    "organic",
    "non",
    "gmo",
    "seed",
    "seeds",
    "open",
    "pollinated",
    "hybrid",
    "f1",
}

SINGULAR_OVERRIDES = {
    "asparagus": "Asparagus",
    "basil": "Basil",
    "broccoli": "Broccoli",
    "cabbage": "Cabbage",
    "calendula": "Calendula",
    "celery": "Celery",
    "celosia": "Celosia",
    "chard": "Chard",
    "cilantro coriander": "Cilantro",
    "cosmos": "Cosmos",
    "dill": "Dill",
    "endive": "Endive",
    "eucalyptus": "Eucalyptus",
    "fennel": "Fennel",
    "garlic": "Garlic",
    "greens": "Greens",
    "kale": "Kale",
    "lavender": "Lavender",
    "lettuce": "Lettuce",
    "mint": "Mint",
    "okra": "Okra",
    "oregano": "Oregano",
    "parsley": "Parsley",
    "rosemary": "Rosemary",
    "sage": "Sage",
    "spinach": "Spinach",
    "squash": "Squash",
    "stock": "Stock",
    "swiss chard": "Swiss Chard",
    "sweet corn": "Sweet Corn",
    "sweet peas": "Sweet Pea",
    "thyme": "Thyme",
    "tomatillos": "Tomatillo",
    "tomatoes": "Tomato",
    "watermelons": "Watermelon",
}

FAMILY_OVERRIDES = {
    "basil": "Lamiaceae",
    "bean": "Fabaceae",
    "beet": "Amaranthaceae",
    "blackberry": "Rosaceae",
    "blueberry": "Ericaceae",
    "broccoli": "Brassicaceae",
    "cabbage": "Brassicaceae",
    "calendula": "Asteraceae",
    "carrot": "Apiaceae",
    "cauliflower": "Brassicaceae",
    "celery": "Apiaceae",
    "cilantro": "Apiaceae",
    "corn": "Poaceae",
    "cosmos": "Asteraceae",
    "cucumber": "Cucurbitaceae",
    "dill": "Apiaceae",
    "eggplant": "Solanaceae",
    "garlic": "Alliaceae",
    "kale": "Brassicaceae",
    "lavender": "Lamiaceae",
    "leek": "Alliaceae",
    "lettuce": "Asteraceae",
    "marigold": "Asteraceae",
    "melon": "Cucurbitaceae",
    "mint": "Lamiaceae",
    "nasturtium": "Tropaeolaceae",
    "onion": "Alliaceae",
    "parsley": "Apiaceae",
    "pea": "Fabaceae",
    "pepper": "Solanaceae",
    "pumpkin": "Cucurbitaceae",
    "radish": "Brassicaceae",
    "raspberry": "Rosaceae",
    "rosemary": "Lamiaceae",
    "sage": "Lamiaceae",
    "spinach": "Amaranthaceae",
    "squash": "Cucurbitaceae",
    "strawberry": "Rosaceae",
    "sunflower": "Asteraceae",
    "swiss chard": "Amaranthaceae",
    "thyme": "Lamiaceae",
    "tomatillo": "Solanaceae",
    "tomato": "Solanaceae",
    "watermelon": "Cucurbitaceae",
    "zinnia": "Asteraceae",
}

SPACING_OVERRIDES = {
    "artichoke": 36,
    "asparagus": 18,
    "basil": 12,
    "bean": 6,
    "beet": 4,
    "blackberry": 36,
    "blueberry": 48,
    "broccoli": 18,
    "brussels sprout": 20,
    "cabbage": 18,
    "calendula": 10,
    "carrot": 3,
    "cauliflower": 18,
    "celery": 10,
    "cilantro": 6,
    "corn": 12,
    "cosmos": 12,
    "cucumber": 12,
    "dill": 9,
    "eggplant": 18,
    "garlic": 6,
    "kale": 15,
    "lavender": 18,
    "leek": 6,
    "lettuce": 10,
    "marigold": 8,
    "melon": 30,
    "mint": 18,
    "nasturtium": 12,
    "onion": 4,
    "parsley": 8,
    "pea": 6,
    "pepper": 18,
    "pumpkin": 48,
    "radish": 3,
    "raspberry": 30,
    "rosemary": 18,
    "sage": 16,
    "spinach": 6,
    "squash": 36,
    "strawberry": 12,
    "sunflower": 18,
    "swiss chard": 12,
    "thyme": 10,
    "tomatillo": 24,
    "tomato": 24,
    "watermelon": 36,
    "zinnia": 12,
}

TRANSPLANT_WEEKS_OVERRIDES = {
    "artichoke": 8,
    "asparagus": 6,
    "basil": 6,
    "broccoli": 6,
    "brussels sprout": 6,
    "cabbage": 6,
    "cauliflower": 6,
    "celery": 10,
    "eggplant": 8,
    "lavender": 8,
    "leek": 10,
    "onion": 10,
    "pepper": 10,
    "rosemary": 8,
    "sage": 6,
    "tomatillo": 8,
    "tomato": 8,
}

DIRECT_SOW_FALSE_KEYWORDS = {
    "artichoke",
    "asparagus",
    "basil",
    "broccoli",
    "brussels sprout",
    "cabbage",
    "cauliflower",
    "celery",
    "eggplant",
    "lavender",
    "leek",
    "onion",
    "pepper",
    "rosemary",
    "sage",
    "strawberry",
    "blueberry",
    "raspberry",
    "blackberry",
    "tomatillo",
    "tomato",
}

FROST_HARDY_KEYWORDS = {
    "artichoke",
    "asparagus",
    "beet",
    "blackberry",
    "blueberry",
    "broccoli",
    "brussels sprout",
    "cabbage",
    "calendula",
    "carrot",
    "cauliflower",
    "celery",
    "cilantro",
    "dill",
    "garlic",
    "kale",
    "lavender",
    "leek",
    "lettuce",
    "mint",
    "onion",
    "oregano",
    "parsley",
    "pea",
    "radish",
    "raspberry",
    "rosemary",
    "sage",
    "spinach",
    "strawberry",
    "swiss chard",
    "thyme",
}

FROST_TENDER_KEYWORDS = {
    "basil",
    "bean",
    "celosia",
    "corn",
    "cosmos",
    "cucumber",
    "eggplant",
    "marigold",
    "melon",
    "nasturtium",
    "okra",
    "pepper",
    "pumpkin",
    "squash",
    "sunflower",
    "tomatillo",
    "tomato",
    "watermelon",
    "zinnia",
}


@dataclass(slots=True)
class JohnnysCropRecord:
    external_product_id: str
    source_url: str
    image_url: str
    crop_name: str
    variety: str
    family: str
    spacing_in: int
    row_spacing_in: int
    in_row_spacing_in: int
    planting_window: str
    days_to_harvest: int
    direct_sow: bool
    frost_hardy: bool
    weeks_to_transplant: int
    notes: str


LEGACY_STARTER_SIGNATURES = {
    (
        payload["name"].strip().lower(),
        payload.get("variety", "").strip().lower(),
        payload["family"],
        int(payload["spacing_in"]),
        int(payload["days_to_harvest"]),
        payload["planting_window"],
        bool(payload["direct_sow"]),
        bool(payload["frost_hardy"]),
        int(payload["weeks_to_transplant"]),
    )
    for payload in [
        {
            "name": "Tomato",
            "variety": "Roma",
            "family": "Solanaceae",
            "spacing_in": 24,
            "days_to_harvest": 75,
            "planting_window": "After last frost — soil must be >60 °F (zones 3-6: late May/June; zones 7-9: Apr-May)",
            "direct_sow": False,
            "frost_hardy": False,
            "weeks_to_transplant": 8,
        },
        {
            "name": "Bell Pepper",
            "variety": "California Wonder",
            "family": "Solanaceae",
            "spacing_in": 18,
            "days_to_harvest": 85,
            "planting_window": "After last frost — soil >65 °F (zones 3-6: early June; zones 7-9: late Apr-May)",
            "direct_sow": False,
            "frost_hardy": False,
            "weeks_to_transplant": 10,
        },
        {
            "name": "Eggplant",
            "variety": "Black Beauty",
            "family": "Solanaceae",
            "spacing_in": 18,
            "days_to_harvest": 80,
            "planting_window": "After last frost — needs warmth (best zones 6-10)",
            "direct_sow": False,
            "frost_hardy": False,
            "weeks_to_transplant": 10,
        },
        {
            "name": "Zucchini",
            "variety": "Black Beauty",
            "family": "Cucurbitaceae",
            "spacing_in": 36,
            "days_to_harvest": 55,
            "planting_window": "After last frost — soil >60 °F (zones 3-6: late May/June; zones 7+: May)",
            "direct_sow": True,
            "frost_hardy": False,
            "weeks_to_transplant": 4,
        },
        {
            "name": "Cucumber",
            "variety": "Marketmore",
            "family": "Cucurbitaceae",
            "spacing_in": 12,
            "days_to_harvest": 60,
            "planting_window": "After last frost — soil >60 °F; trellis to save space",
            "direct_sow": True,
            "frost_hardy": False,
            "weeks_to_transplant": 3,
        },
        {
            "name": "Pumpkin",
            "variety": "Connecticut Field",
            "family": "Cucurbitaceae",
            "spacing_in": 48,
            "days_to_harvest": 105,
            "planting_window": "After last frost; count back from first fall frost for harvest date",
            "direct_sow": True,
            "frost_hardy": False,
            "weeks_to_transplant": 3,
        },
        {
            "name": "Broccoli",
            "variety": "Calabrese",
            "family": "Brassicaceae",
            "spacing_in": 18,
            "days_to_harvest": 80,
            "planting_window": "Start seeds indoors 4–6 weeks before last frost (supplier timing); transplant sturdy seedlings when weather allows",
            "direct_sow": False,
            "frost_hardy": True,
            "weeks_to_transplant": 6,
        },
        {
            "name": "Cabbage",
            "variety": "Golden Acre",
            "family": "Brassicaceae",
            "spacing_in": 18,
            "days_to_harvest": 70,
            "planting_window": "Spring: transplant 4 wks before last frost; Fall: transplant 8 wks before first frost",
            "direct_sow": False,
            "frost_hardy": True,
            "weeks_to_transplant": 6,
        },
        {
            "name": "Kale",
            "variety": "Lacinato",
            "family": "Brassicaceae",
            "spacing_in": 15,
            "days_to_harvest": 55,
            "planting_window": "Early spring (6 wks before last frost) or late summer for fall/winter harvest",
            "direct_sow": True,
            "frost_hardy": True,
            "weeks_to_transplant": 4,
        },
        {
            "name": "Radish",
            "variety": "Cherry Belle",
            "family": "Brassicaceae",
            "spacing_in": 3,
            "days_to_harvest": 25,
            "planting_window": "Direct sow as soon as soil is workable (spring and fall); avoid summer heat",
            "direct_sow": True,
            "frost_hardy": True,
            "weeks_to_transplant": 0,
        },
        {
            "name": "Carrot",
            "variety": "Nantes",
            "family": "Apiaceae",
            "spacing_in": 3,
            "days_to_harvest": 70,
            "planting_window": "Direct sow 4–6 wks before last frost; soil 45–85 °F for germination",
            "direct_sow": True,
            "frost_hardy": True,
            "weeks_to_transplant": 0,
        },
        {
            "name": "Celery",
            "variety": "Tall Utah",
            "family": "Apiaceae",
            "spacing_in": 12,
            "days_to_harvest": 100,
            "planting_window": "Start indoors 10–12 wks before last frost; needs long cool season",
            "direct_sow": False,
            "frost_hardy": True,
            "weeks_to_transplant": 10,
        },
        {
            "name": "Green Bean",
            "variety": "Provider",
            "family": "Fabaceae",
            "spacing_in": 6,
            "days_to_harvest": 55,
            "planting_window": "After last frost — soil >60 °F; direct sow every 2 weeks for continuous harvest",
            "direct_sow": True,
            "frost_hardy": False,
            "weeks_to_transplant": 0,
        },
        {
            "name": "Pea",
            "variety": "Sugar Snap",
            "family": "Fabaceae",
            "spacing_in": 6,
            "days_to_harvest": 65,
            "planting_window": "Direct sow 4–6 wks before last frost; tolerates light frost once sprouted",
            "direct_sow": True,
            "frost_hardy": True,
            "weeks_to_transplant": 0,
        },
        {
            "name": "Beet",
            "variety": "Detroit Dark Red",
            "family": "Amaranthaceae",
            "spacing_in": 4,
            "days_to_harvest": 60,
            "planting_window": "Direct sow 4 wks before last frost; also sow mid-summer for fall harvest",
            "direct_sow": True,
            "frost_hardy": True,
            "weeks_to_transplant": 0,
        },
        {
            "name": "Spinach",
            "variety": "Bloomsdale",
            "family": "Amaranthaceae",
            "spacing_in": 6,
            "days_to_harvest": 40,
            "planting_window": "Direct sow early spring or late summer; bolts quickly in heat (>75 °F)",
            "direct_sow": True,
            "frost_hardy": True,
            "weeks_to_transplant": 0,
        },
        {
            "name": "Swiss Chard",
            "variety": "Rainbow",
            "family": "Amaranthaceae",
            "spacing_in": 12,
            "days_to_harvest": 60,
            "planting_window": "Direct sow after last frost or 4 wks before; tolerates heat and light frost",
            "direct_sow": True,
            "frost_hardy": True,
            "weeks_to_transplant": 0,
        },
        {
            "name": "Onion",
            "variety": "Walla Walla",
            "family": "Alliaceae",
            "spacing_in": 4,
            "days_to_harvest": 100,
            "planting_window": "Start indoors 10–12 wks before last frost; choose variety for your day-length (long/short-day)",
            "direct_sow": False,
            "frost_hardy": True,
            "weeks_to_transplant": 10,
        },
        {
            "name": "Garlic",
            "variety": "Hardneck",
            "family": "Alliaceae",
            "spacing_in": 6,
            "days_to_harvest": 240,
            "planting_window": "Plant cloves in fall (Oct-Nov) for summer harvest; zones 3-6: before ground freezes",
            "direct_sow": True,
            "frost_hardy": True,
            "weeks_to_transplant": 0,
        },
        {
            "name": "Lettuce",
            "variety": "Butterhead",
            "family": "Asteraceae",
            "spacing_in": 10,
            "days_to_harvest": 45,
            "planting_window": "Direct sow from 4 wks before last frost; sow every 2 weeks; shade in summer",
            "direct_sow": True,
            "frost_hardy": True,
            "weeks_to_transplant": 0,
        },
        {
            "name": "Basil",
            "variety": "Genovese",
            "family": "Lamiaceae",
            "spacing_in": 12,
            "days_to_harvest": 60,
            "planting_window": "After last frost; soil and air must be reliably warm (>55 °F nights)",
            "direct_sow": False,
            "frost_hardy": False,
            "weeks_to_transplant": 6,
        },
        {
            "name": "Mint",
            "variety": "Spearmint",
            "family": "Lamiaceae",
            "spacing_in": 18,
            "days_to_harvest": 90,
            "planting_window": "Transplant after last frost; contains in pots to prevent aggressive spreading",
            "direct_sow": False,
            "frost_hardy": True,
            "weeks_to_transplant": 6,
        },
        {
            "name": "Sweet Corn",
            "variety": "Honey Select",
            "family": "Poaceae",
            "spacing_in": 12,
            "days_to_harvest": 80,
            "planting_window": "Direct sow after last frost; soil >60 °F; plant in blocks (4+ rows) for pollination",
            "direct_sow": True,
            "frost_hardy": False,
            "weeks_to_transplant": 0,
        },
        {
            "name": "Strawberry",
            "variety": "Honeoye",
            "family": "Rosaceae",
            "spacing_in": 12,
            "days_to_harvest": 60,
            "planting_window": "Transplant in early spring; June-bearers fruit in year 2; ever-bearers in year 1",
            "direct_sow": False,
            "frost_hardy": True,
            "weeks_to_transplant": 0,
        },
    ]
}


def _collapse_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _fetch_text(url: str) -> str:
    request = Request(url, headers={"User-Agent": REQUEST_USER_AGENT})
    with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
        return response.read().decode("utf-8", errors="ignore")


def _extract_sitemap_urls(xml_text: str) -> list[str]:
    namespace = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    root = ET.fromstring(xml_text)
    return [
        element.text.strip()
        for element in root.findall("s:url/s:loc", namespace)
        if element.text and element.text.strip()
    ]


def _singularize(label: str) -> str:
    normalized = re.sub(r"[^a-z0-9 ]+", " ", label.lower()).strip()
    normalized = _collapse_whitespace(normalized)
    if normalized in SINGULAR_OVERRIDES:
        return SINGULAR_OVERRIDES[normalized]
    if normalized.endswith("ies"):
        return f"{normalized[:-3]}y".title()
    if normalized.endswith("ses"):
        return normalized[:-2].title()
    if normalized.endswith("s") and not normalized.endswith("ss"):
        return normalized[:-1].title()
    return normalized.title()


def _normalized_keyword(value: str) -> str:
    return _collapse_whitespace(re.sub(r"[^a-z0-9]+", " ", value.lower()))


def _contains_keyword(value: str, keywords: set[str]) -> bool:
    normalized = _normalized_keyword(value)
    return any(keyword in normalized for keyword in keywords)


def _extract_breadcrumbs(page_text: str) -> list[str]:
    matches = re.findall(
        r'<script type="application/ld\+json">(.*?)</script>', page_text, re.IGNORECASE | re.DOTALL
    )
    for raw_json in matches:
        try:
            parsed = json.loads(raw_json)
        except json.JSONDecodeError:
            continue
        if parsed.get("@type") != "BreadcrumbList":
            continue

        items = parsed.get("itemListElement", [])
        breadcrumbs: list[str] = []
        for item in items:
            name = item.get("item", {}).get("name")
            if name:
                breadcrumbs.append(_collapse_whitespace(unescape(name)))
        if breadcrumbs:
            return breadcrumbs
    return []


def _extract_product_title(page_text: str) -> str:
    match = re.search(r"<h1[^>]*>(.*?)</h1>", page_text, re.IGNORECASE | re.DOTALL)
    if not match:
        raise ValueError("Missing product title")
    return _collapse_whitespace(unescape(re.sub(r"<[^>]+>", " ", match.group(1))))


def _extract_product_id(page_text: str) -> str:
    match = re.search(r'<span class="master-product-id">([^<]+)</span>', page_text)
    if not match:
        raise ValueError("Missing product id")
    return _collapse_whitespace(match.group(1))


def _extract_quick_facts(page_text: str) -> dict[str, str]:
    quick_facts: dict[str, str] = {}
    section_match = re.search(
        r'<dl class="c-facts__list">(.*?)</dl>', page_text, re.IGNORECASE | re.DOTALL
    )
    if not section_match:
        return quick_facts

    for match in re.finditer(
        r"<dt[^>]*>.*?<h3(?:[^>]*title=\"([^\"]+)\")?[^>]*>(.*?)</h3>.*?</dt>\s*<dd[^>]*>(.*?)</dd>",
        section_match.group(1),
        re.IGNORECASE | re.DOTALL,
    ):
        raw_key = match.group(1) or match.group(2)
        key = _collapse_whitespace(unescape(re.sub(r"<[^>]+>", " ", raw_key)))
        value = _collapse_whitespace(unescape(re.sub(r"<[^>]+>", " ", match.group(3))))
        if key and value:
            quick_facts[key.lower()] = value
    return quick_facts


def _is_importable_url(url: str) -> bool:
    parsed = urlparse(url)
    segments = [segment for segment in parsed.path.split("/") if segment]
    if not segments or segments[0] not in ALLOWED_ROOT_SEGMENTS:
        return False
    if any(segment in EXCLUDED_PATH_SEGMENTS for segment in segments):
        return False
    if parsed.path.endswith("_ps.html"):
        return False
    return True


def _is_high_mowing_product_url(url: str) -> bool:
    parsed = urlparse(url)
    if "highmowingseeds.com" not in parsed.netloc:
        return False
    if not parsed.path.endswith(".html"):
        return False

    segments = [segment for segment in parsed.path.split("/") if segment]
    if len(segments) < 3 or segments[0] not in ALLOWED_ROOT_SEGMENTS:
        return False
    if any(segment in HIGH_MOWING_EXCLUDED_SEGMENTS for segment in segments):
        return False

    leaf = segments[-1][: -len(".html")]
    if not leaf:
        return False
    if any(keyword in leaf for keyword in HIGH_MOWING_EXCLUDED_LEAF_KEYWORDS):
        return False
    if leaf in {"css", "index"}:
        return False
    return True


def _tokenize_slug(slug: str) -> list[str]:
    return [token for token in re.split(r"[^a-z0-9]+", slug.lower()) if token]


def _build_high_mowing_record_from_url(
    url: str,
    spacing_provider: SpacingProvider,
) -> NormalizedCropRecord:
    parsed = urlparse(url)
    segments = [segment for segment in parsed.path.split("/") if segment]
    if len(segments) < 3:
        raise ValueError("Missing path segments for High Mowing URL")

    root_segment = segments[0].lower()
    crop_segment = segments[1]
    slug = segments[-1][: -len(".html")]

    crop_name = _singularize(crop_segment.replace("-", " "))
    crop_tokens = set(_tokenize_slug(_normalized_keyword(crop_name)))
    slug_tokens = _tokenize_slug(slug)
    variety_tokens = [
        token
        for token in slug_tokens
        if token not in _HIGH_MOWING_NOISE_TOKENS and token not in crop_tokens
    ]
    variety = _clean_variety_name(" ".join(variety_tokens).title())
    if not variety:
        variety = _clean_variety_name(" ".join(slug_tokens).title())

    direct_sow = _derive_direct_sow(crop_name, root_segment, "")
    frost_hardy = _derive_frost_hardy(crop_name, root_segment, "")
    row_spacing_in, in_row_spacing_in = spacing_provider.get_row_and_in_row_spacing(
        crop_name, root_segment
    )

    canonical_name = _canonical_crop_name(crop_name, variety)
    return NormalizedCropRecord(
        canonical_name=canonical_name,
        variety=variety,
        source_key=HIGH_MOWING_SOURCE,
        source_url=url,
        image_url="",
        external_product_id=f"high-mowing:{parsed.path}",
        family=_derive_family(crop_name, [], root_segment),
        spacing_in=_derive_spacing_in(crop_name, root_segment),
        row_spacing_in=row_spacing_in,
        in_row_spacing_in=in_row_spacing_in,
        planting_window=_derive_planting_window(direct_sow, frost_hardy, ""),
        days_to_harvest=_derive_days_to_harvest(crop_name, root_segment, {}),
        direct_sow=direct_sow,
        frost_hardy=frost_hardy,
        weeks_to_transplant=_derive_weeks_to_transplant(crop_name, direct_sow),
        notes=(
            "Imported from High Mowing Organic Seeds sitemap metadata. "
            f"Catalog path: {parsed.path}."
        ),
    )


def _clean_variety_name(variety: str) -> str:
    cleaned = variety.strip(" -")
    cleaned = re.sub(r"([A-Za-z])\(", r"\1 (", cleaned)
    return _collapse_whitespace(cleaned)


def _derive_crop_name(breadcrumbs: list[str], root_segment: str) -> str:
    if len(breadcrumbs) >= 2:
        return _singularize(breadcrumbs[1])
    return _singularize(root_segment)


def _derive_variety_name(title: str, crop_name: str) -> str:
    cleaned_title = re.sub(r"\b(seed|seeds|plant|plants)\b", "", title, flags=re.IGNORECASE)
    cleaned_title = _collapse_whitespace(cleaned_title)
    crop_pattern = re.compile(rf"\b{re.escape(crop_name)}\b$", re.IGNORECASE)
    variety = crop_pattern.sub("", cleaned_title).strip(" -")
    if not variety:
        variety = cleaned_title
    return _clean_variety_name(variety)


def _derive_family(crop_name: str, breadcrumbs: list[str], root_segment: str) -> str:
    normalized_crop = _normalized_keyword(crop_name)
    for keyword, family in FAMILY_OVERRIDES.items():
        if keyword in normalized_crop:
            return family
    if len(breadcrumbs) >= 3:
        return _singularize(breadcrumbs[2])
    if len(breadcrumbs) >= 2:
        return _singularize(breadcrumbs[1])
    return _singularize(root_segment)


def _derive_days_to_harvest(crop_name: str, root_segment: str, quick_facts: dict[str, str]) -> int:
    days_value = quick_facts.get("days to maturity", "")
    match = re.search(r"(\d{1,3})", days_value)
    if match:
        return max(1, int(match.group(1)))
    if root_segment == "flowers":
        return 70
    if root_segment == "fruits":
        return 90
    return 60


def _derive_direct_sow(crop_name: str, root_segment: str, life_cycle: str) -> bool:
    normalized_crop = _normalized_keyword(crop_name)
    if any(keyword in normalized_crop for keyword in DIRECT_SOW_FALSE_KEYWORDS):
        return False
    if root_segment == "fruits" and "annual" not in life_cycle.lower():
        return False
    return True


def _derive_frost_hardy(crop_name: str, root_segment: str, life_cycle: str) -> bool:
    normalized_crop = _normalized_keyword(crop_name)
    if any(keyword in normalized_crop for keyword in FROST_TENDER_KEYWORDS):
        return False
    if any(keyword in normalized_crop for keyword in FROST_HARDY_KEYWORDS):
        return True
    if root_segment == "fruits" and "perennial" in life_cycle.lower():
        return True
    return root_segment == "herbs" and "annual" not in life_cycle.lower()


def _derive_weeks_to_transplant(crop_name: str, direct_sow: bool) -> int:
    if direct_sow:
        return 0
    normalized_crop = _normalized_keyword(crop_name)
    for keyword, weeks in TRANSPLANT_WEEKS_OVERRIDES.items():
        if keyword in normalized_crop:
            return weeks
    return 6


def _derive_spacing_in(crop_name: str, root_segment: str) -> int:
    normalized_crop = _normalized_keyword(crop_name)
    for keyword, spacing in SPACING_OVERRIDES.items():
        if keyword in normalized_crop:
            return spacing
    if root_segment == "flowers":
        return 10
    if root_segment == "fruits":
        return 24
    if root_segment == "herbs":
        return 10
    return 12


def _derive_planting_window(direct_sow: bool, frost_hardy: bool, life_cycle: str) -> str:
    lower_life_cycle = life_cycle.lower()
    if "perennial" in lower_life_cycle and frost_hardy:
        return "Plant in spring or fall while weather is mild"
    if frost_hardy and direct_sow:
        return "Direct sow in cool spring or late summer for a fall crop"
    if frost_hardy and not direct_sow:
        return "Start indoors or transplant in early spring; suitable for fall succession"
    if direct_sow:
        return "Direct sow after last frost once soil has warmed"
    return "Start indoors and transplant after last frost"


def _build_notes(
    product_id: str,
    breadcrumbs: list[str],
    quick_facts: dict[str, str],
) -> str:
    details = ["Imported from Johnny's Selected Seeds."]
    if breadcrumbs:
        details.append(f"Category: {' > '.join(breadcrumbs)}.")

    latin_name = quick_facts.get("latin name")
    if latin_name:
        details.append(f"Latin name: {latin_name}.")

    life_cycle = quick_facts.get("life cycle")
    if life_cycle:
        details.append(f"Life cycle: {life_cycle}.")

    hybrid_status = quick_facts.get("hybrid status")
    if hybrid_status:
        details.append(f"Hybrid status: {hybrid_status}.")

    disease_resistance = quick_facts.get("disease resistance codes")
    if disease_resistance:
        details.append(f"Disease resistance: {disease_resistance}.")

    details.append(f"Product ID: {product_id}.")
    return " ".join(details)


def _parse_product_page(url: str, spacing_provider: SpacingProvider) -> JohnnysCropRecord | None:
    page_text = _fetch_text(url)
    title = _extract_product_title(page_text)
    normalized_title = title.lower()
    if any(keyword in normalized_title for keyword in EXCLUDED_TITLE_KEYWORDS):
        return None

    breadcrumbs = _extract_breadcrumbs(page_text)
    root_segment = urlparse(url).path.split("/", 2)[1].lower()
    crop_name = _derive_crop_name(breadcrumbs, root_segment)
    variety = _derive_variety_name(title, crop_name)
    family = _derive_family(crop_name, breadcrumbs, root_segment)
    quick_facts = _extract_quick_facts(page_text)
    life_cycle = quick_facts.get("life cycle", "")
    direct_sow = _derive_direct_sow(crop_name, root_segment, life_cycle)
    frost_hardy = _derive_frost_hardy(crop_name, root_segment, life_cycle)
    product_id = _extract_product_id(page_text)
    image_match = re.search(
        r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
        page_text,
        re.IGNORECASE,
    )
    image_url = unescape(image_match.group(1)).strip() if image_match else ""
    row_spacing_in, in_row_spacing_in = spacing_provider.get_row_and_in_row_spacing(
        crop_name, root_segment
    )

    return JohnnysCropRecord(
        external_product_id=product_id,
        source_url=url,
        image_url=image_url,
        crop_name=crop_name,
        variety=variety,
        family=family,
        spacing_in=_derive_spacing_in(crop_name, root_segment),
        row_spacing_in=row_spacing_in,
        in_row_spacing_in=in_row_spacing_in,
        planting_window=_derive_planting_window(direct_sow, frost_hardy, life_cycle),
        days_to_harvest=_derive_days_to_harvest(crop_name, root_segment, quick_facts),
        direct_sow=direct_sow,
        frost_hardy=frost_hardy,
        weeks_to_transplant=_derive_weeks_to_transplant(crop_name, direct_sow),
        notes=_build_notes(product_id, breadcrumbs, quick_facts),
    )


def _canonical_crop_name(crop_name: str, variety: str) -> str:
    if variety:
        return f"{crop_name} ({variety})"
    return crop_name


def _fetch_johnnys_catalog(
    spacing_provider: SpacingProvider,
) -> tuple[list[JohnnysCropRecord], int]:
    sitemap_text = _fetch_text(JOHNNYS_PRODUCT_SITEMAP)
    product_urls = [url for url in _extract_sitemap_urls(sitemap_text) if _is_importable_url(url)]

    records: list[JohnnysCropRecord] = []
    failed = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_IMPORT_WORKERS) as executor:
        futures = {
            executor.submit(_parse_product_page, url, spacing_provider): url for url in product_urls
        }
        for future in concurrent.futures.as_completed(futures):
            try:
                record = future.result()
            except (HTTPError, URLError, TimeoutError, ValueError) as exc:
                logger.warning("johnnys product parse failed", extra={"error": str(exc)})
                failed += 1
                continue
            if record is not None:
                records.append(record)

    records.sort(
        key=lambda record: (
            _canonical_crop_name(record.crop_name, record.variety),
            record.external_product_id,
        )
    )
    return records, failed


def _fetch_high_mowing_catalog(
    spacing_provider: SpacingProvider,
) -> tuple[list[NormalizedCropRecord], int]:
    sitemap_text = _fetch_text(HIGH_MOWING_PRODUCT_SITEMAP)
    product_urls = [
        url for url in _extract_sitemap_urls(sitemap_text) if _is_high_mowing_product_url(url)
    ]

    records: list[NormalizedCropRecord] = []
    failed = 0
    for url in sorted(set(product_urls)):
        try:
            records.append(_build_high_mowing_record_from_url(url, spacing_provider))
        except ValueError as exc:
            logger.warning("high-mowing product parse failed", extra={"error": str(exc)})
            failed += 1
    return records, failed


class JohnnysSelectedSeedsProvider:
    @property
    def source_key(self) -> str:
        return JOHNNYS_SOURCE

    @property
    def display_name(self) -> str:
        return "Johnny's Selected Seeds"

    def fetch_crops(self, spacing_provider: SpacingProvider) -> list[NormalizedCropRecord]:
        try:
            records, _failed = _fetch_johnnys_catalog(spacing_provider)
        except (HTTPError, URLError, TimeoutError, ValueError) as exc:
            raise RuntimeError(f"Unable to reach Johnny's Selected Seeds catalog: {exc}") from exc

        normalized: list[NormalizedCropRecord] = []
        for record in records:
            normalized.append(
                NormalizedCropRecord(
                    canonical_name=_canonical_crop_name(record.crop_name, record.variety),
                    variety=record.variety,
                    source_key=JOHNNYS_SOURCE,
                    source_url=record.source_url,
                    image_url=record.image_url,
                    external_product_id=record.external_product_id,
                    family=record.family,
                    spacing_in=record.spacing_in,
                    row_spacing_in=record.row_spacing_in,
                    in_row_spacing_in=record.in_row_spacing_in,
                    planting_window=record.planting_window,
                    days_to_harvest=record.days_to_harvest,
                    direct_sow=record.direct_sow,
                    frost_hardy=record.frost_hardy,
                    weeks_to_transplant=record.weeks_to_transplant,
                    notes=record.notes,
                )
            )
        return normalized


class HighMowingSeedsProvider:
    @property
    def source_key(self) -> str:
        return HIGH_MOWING_SOURCE

    @property
    def display_name(self) -> str:
        return "High Mowing Organic Seeds"

    def fetch_crops(self, spacing_provider: SpacingProvider) -> list[NormalizedCropRecord]:
        try:
            records, _failed = _fetch_high_mowing_catalog(spacing_provider)
        except (HTTPError, URLError, TimeoutError, ValueError) as exc:
            raise RuntimeError(f"Unable to reach High Mowing catalog: {exc}") from exc

        if not records:
            raise RuntimeError("High Mowing returned no importable crop offerings")
        return records


def _ensure_default_crop_sources_registered() -> None:
    registered = set(crop_source_registry.registered_keys())
    if JOHNNYS_SOURCE not in registered:
        crop_source_registry.register(JohnnysSelectedSeedsProvider())
    if HIGH_MOWING_SOURCE not in registered:
        crop_source_registry.register(HighMowingSeedsProvider())


def seed_crop_templates(
    db, force_refresh: bool = False, spacing_provider: SpacingProvider | None = None
):
    if spacing_provider is None:
        spacing_provider = get_default_spacing_provider()

    _ensure_default_crop_sources_registered()
    crop_source_registry.ensure_source_configs(db)
    result = crop_source_registry.sync_to_db(
        db,
        force_refresh=force_refresh,
        spacing_provider=spacing_provider,
    )
    result["force_refresh"] = force_refresh
    return result


def cleanup_legacy_starter_templates(db) -> int:
    removed = 0
    candidates = db.query(CropTemplate).filter(CropTemplate.source == MANUAL_SOURCE).all()
    for candidate in candidates:
        signature = (
            candidate.name.strip().lower(),
            candidate.variety.strip().lower(),
            candidate.family,
            int(candidate.spacing_in),
            int(candidate.days_to_harvest),
            candidate.planting_window,
            bool(candidate.direct_sow),
            bool(candidate.frost_hardy),
            int(candidate.weeks_to_transplant),
        )
        if signature not in LEGACY_STARTER_SIGNATURES:
            continue
        db.delete(candidate)
        removed += 1

    if removed:
        db.commit()
    return removed
