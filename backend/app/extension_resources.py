"""Curated Cooperative Extension / land-grant portal links by U.S. state.

These are hand-maintained starting points for local planting guides and IPM
resources. There is no single public API that returns extension-office content
by ZIP; we resolve state from the ZIP lookup and link to the state's Extension
network. Content accuracy and availability are the responsibility of those sites.
"""

from __future__ import annotations

# State abbreviation -> primary Extension / ANR portal and topic entry points.
EXTENSION_BY_STATE: dict[str, dict[str, str]] = {
    "CA": {
        "organization": "University of California Agriculture and Natural Resources",
        "home_url": "https://ucanr.edu/",
        "garden_url": "https://ucanr.edu/blogs/UCIG/",
        "ipm_url": "https://www.ipm.ucanr.edu/",
    },
    "CO": {
        "organization": "Colorado State University Extension",
        "home_url": "https://extension.colostate.edu/",
        "garden_url": "https://extension.colostate.edu/topic-areas/yard-garden/",
        "ipm_url": "https://extension.colostate.edu/topic-areas/insects/",
    },
    "NY": {
        "organization": "Cornell Cooperative Extension",
        "home_url": "https://cals.cornell.edu/cornell-cooperative-extension",
        "garden_url": "https://gardening.cals.cornell.edu/",
        "ipm_url": "https://cals.cornell.edu/departments-and-schools/department-natural-resources-environment/ipm/",
    },
    "TX": {
        "organization": "Texas A&M AgriLife Extension",
        "home_url": "https://agrilifeextension.tamu.edu/",
        "garden_url": "https://agrilifeextension.tamu.edu/library/gardening-landscaping/",
        "ipm_url": "https://extensionentomology.tamu.edu/",
    },
    "FL": {
        "organization": "UF/IFAS Extension",
        "home_url": "https://sfyl.ifas.ufl.edu/",
        "garden_url": "https://gardeningsolutions.ifas.ufl.edu/",
        "ipm_url": "https://edis.ifas.ufl.edu/department_entomology-nematology",
    },
    "WA": {
        "organization": "Washington State University Extension",
        "home_url": "https://extension.wsu.edu/",
        "garden_url": "https://extension.wsu.edu/yg/",
        "ipm_url": "https://extension.wsu.edu/ipm/",
    },
    "OR": {
        "organization": "Oregon State University Extension",
        "home_url": "https://extension.oregonstate.edu/",
        "garden_url": "https://extension.oregonstate.edu/gardening",
        "ipm_url": "https://extension.oregonstate.edu/ippc",
    },
    "NC": {
        "organization": "NC State Extension",
        "home_url": "https://www.ces.ncsu.edu/",
        "garden_url": "https://plants.ces.ncsu.edu/",
        "ipm_url": "https://content.ces.ncsu.edu/category/insects-and-diseases",
    },
    "GA": {
        "organization": "UGA Cooperative Extension",
        "home_url": "https://extension.uga.edu/",
        "garden_url": "https://extension.uga.edu/topic-areas/lawn-garden-landscaping.html",
        "ipm_url": "https://extension.uga.edu/topic-areas/trees-forestry/forest-health.html",
    },
    "PA": {
        "organization": "Penn State Extension",
        "home_url": "https://extension.psu.edu/",
        "garden_url": "https://extension.psu.edu/home-gardening",
        "ipm_url": "https://extension.psu.edu/integrated-pest-management",
    },
    "OH": {
        "organization": "Ohio State University Extension",
        "home_url": "https://extension.osu.edu/",
        "garden_url": "https://extension.osu.edu/lawn-and-garden",
        "ipm_url": "https://bygl.osu.edu/",
    },
    "MI": {
        "organization": "MSU Extension",
        "home_url": "https://www.canr.msu.edu/",
        "garden_url": "https://www.canr.msu.edu/home_gardening/",
        "ipm_url": "https://www.canr.msu.edu/ipm/",
    },
    "IL": {
        "organization": "University of Illinois Extension",
        "home_url": "https://extension.illinois.edu/",
        "garden_url": "https://extension.illinois.edu/lawngarden",
        "ipm_url": "https://extension.illinois.edu/ipm",
    },
    "MA": {
        "organization": "UMass Amherst Center for Agriculture, Food, and the Environment",
        "home_url": "https://ag.umass.edu/",
        "garden_url": "https://ag.umass.edu/home-lawn-garden",
        "ipm_url": "https://ag.umass.edu/landscape-fact-sheets",
    },
    "WI": {
        "organization": "UW–Madison Division of Extension",
        "home_url": "https://extension.wisc.edu/",
        "garden_url": "https://hort.extension.wisc.edu/",
        "ipm_url": "https://hort.extension.wisc.edu/articles/insects/",
    },
}

NIFA_FALLBACK = {
    "organization": "USDA National Institute of Food and Agriculture (Extension)",
    "home_url": "https://www.nifa.usda.gov/extension",
    "garden_url": "https://www.nifa.usda.gov/extension/extension-resources",
    "ipm_url": "https://www.nifa.usda.gov/extension/integrated-pest-management-ipm",
}

DISCLAIMER = (
    "Links point to your state’s land-grant Extension network or national Extension "
    "resources. They are starting points for local planting calendars, IPM, and "
    "disease management—not a substitute for site-specific advice. Always verify "
    "recommendations against your microclimate and current pest pressure."
)


def build_extension_resources_payload(*, zip_code: str, state_code: str | None) -> dict:
    code = (state_code or "").strip().upper()[:2]
    row = EXTENSION_BY_STATE.get(code)
    base = row if row is not None else NIFA_FALLBACK
    return {
        "zip_code": zip_code.strip(),
        "state_code": code or None,
        "organization": base["organization"],
        "home_url": base["home_url"],
        "vegetable_gardening_url": base.get("garden_url") or base["home_url"],
        "ipm_url": base.get("ipm_url") or base["home_url"],
        "disclaimer": DISCLAIMER,
        "source": "curated_land_grant_portals",
    }
