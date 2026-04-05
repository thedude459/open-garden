import httpx

from .config import settings
from .core.exceptions import ValidationServiceError
from .core.logging_utils import get_logger


logger = get_logger(__name__)


# Fallback coordinates/zones used when upstream ZIP services are unavailable.
FALLBACK_ZIP_PROFILES: dict[str, dict[str, float | str]] = {
    "94110": {
        "latitude": 37.7486,
        "longitude": -122.4156,
        "growing_zone": "10b",
    },
}


async def fetch_weather(latitude: float, longitude: float) -> dict:
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum",
        "temperature_unit": "fahrenheit",
        "precipitation_unit": "inch",
        "timezone": "auto",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(settings.weather_base_url, params=params)
        response.raise_for_status()
        return response.json()


async def fetch_zip_profile(zip_code: str) -> dict:
    normalized_zip = zip_code.strip()
    if not normalized_zip:
        raise ValueError("ZIP code is required")

    def fallback_profile() -> dict | None:
        fallback = FALLBACK_ZIP_PROFILES.get(normalized_zip)
        if not fallback:
            return None
        return {
            "zip_code": normalized_zip,
            "latitude": float(fallback["latitude"]),
            "longitude": float(fallback["longitude"]),
            "growing_zone": str(fallback["growing_zone"]),
        }

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            geo_resp = await client.get(f"https://api.zippopotam.us/us/{normalized_zip}")
        except (httpx.RequestError, httpx.TimeoutException) as exc:
            logger.warning(
                "zip lookup request failed", extra={"zip_code": normalized_zip, "error": str(exc)}
            )
            fallback = fallback_profile()
            if fallback:
                return fallback
            raise ValidationServiceError(
                "ZIP code lookup service is temporarily unavailable"
            ) from exc

        if geo_resp.status_code != 200:
            fallback = fallback_profile()
            if fallback:
                return fallback
            raise ValidationServiceError("ZIP code lookup failed")

        geo_payload = geo_resp.json()
        places = geo_payload.get("places") or []
        if not places:
            raise ValidationServiceError("ZIP code lookup returned no location data")

        first_place = places[0]
        latitude = float(first_place["latitude"])
        longitude = float(first_place["longitude"])

        zone = "Unknown"
        try:
            zone_resp = await client.get(f"https://phzmapi.org/{normalized_zip}.json")
            if zone_resp.status_code == 200:
                zone_payload = zone_resp.json()
                if zone_payload.get("zone"):
                    zone = str(zone_payload["zone"])
        except (httpx.RequestError, httpx.TimeoutException):
            # Zone enrichment is optional; return location data even if this API is unavailable.
            pass

        return {
            "zip_code": normalized_zip,
            "latitude": latitude,
            "longitude": longitude,
            "growing_zone": zone,
        }


async def fetch_address_geocode(address: str) -> dict:
    """Use Nominatim (OpenStreetMap) to get precise lat/lon for a street address."""
    if not address.strip():
        raise ValidationServiceError("Address is required")

    headers = {"User-Agent": "open-garden-app/1.0 (garden planning application)"}
    params = {"q": address.strip(), "format": "json", "limit": 1}

    async with httpx.AsyncClient(timeout=10, headers=headers) as client:
        resp = await client.get("https://nominatim.openstreetmap.org/search", params=params)
        if resp.status_code != 200:
            raise ValidationServiceError("Address geocoding service unavailable")

        results = resp.json()
        if not results:
            raise ValidationServiceError(
                "Address not found. Try including a city, state, or ZIP code."
            )

        first = results[0]
        return {
            "latitude": float(first["lat"]),
            "longitude": float(first["lon"]),
            "display_name": first.get("display_name", ""),
        }


async def _fetch_elevation_usgs(client: httpx.AsyncClient, lat: float, lon: float) -> float | None:
    """Query the USGS Elevation Point Query Service (US only, free, no key)."""
    try:
        resp = await client.get(
            "https://epqs.nationalmap.gov/v1/json",
            params={"x": lon, "y": lat, "wkid": 4326, "includeDate": "false"},
            timeout=6,
        )
        if resp.status_code == 200:
            data = resp.json()
            val = data.get("value")
            if val and str(val).upper() not in ("", "-1000000", "NODATA"):
                return float(val)  # feet
    except (httpx.RequestError, httpx.TimeoutException, ValueError):
        pass
    return None


async def fetch_microclimate_signals(latitude: float, longitude: float) -> dict:
    """
    Derive microclimate field suggestions from free, keyless APIs:
    - Open-Meteo: sunshine_duration + wind_speed_10m_max → sun_exposure, wind_exposure
    - USGS EPQS:  elevation at garden + 4 surrounding points → slope_position, frost_pocket_risk
    Returns a dict of suggested values and explanatory notes for each field.
    """
    suggestions: dict[str, str | None] = {
        "sun_exposure": None,
        "wind_exposure": None,
        "slope_position": None,
        "frost_pocket_risk": None,
    }
    notes: dict[str, str] = {}

    async with httpx.AsyncClient(timeout=12) as client:
        # ── 1. Open-Meteo: 14-day forecast with sunshine + wind ──────────
        try:
            om_resp = await client.get(
                settings.weather_base_url,
                params={
                    "latitude": latitude,
                    "longitude": longitude,
                    "daily": "sunshine_duration,wind_speed_10m_max",
                    "timezone": "auto",
                    "forecast_days": 14,
                },
            )
            if om_resp.status_code == 200:
                om = om_resp.json()
                daily = om.get("daily", {})

                # Sunshine: seconds per day → average hours per day
                sunshine_vals = [s for s in (daily.get("sunshine_duration") or []) if s is not None]
                if sunshine_vals:
                    avg_sunshine_hrs = sum(sunshine_vals) / len(sunshine_vals) / 3600.0
                    if avg_sunshine_hrs >= 6:
                        suggestions["sun_exposure"] = "full_sun"
                        notes["sun_exposure"] = (
                            f"14-day average of {avg_sunshine_hrs:.1f} hrs sunshine/day → Full sun (6+ hrs)."
                        )
                    elif avg_sunshine_hrs >= 4:
                        suggestions["sun_exposure"] = "part_sun"
                        notes["sun_exposure"] = (
                            f"14-day average of {avg_sunshine_hrs:.1f} hrs sunshine/day → Part sun (4–6 hrs)."
                        )
                    elif avg_sunshine_hrs >= 2:
                        suggestions["sun_exposure"] = "part_shade"
                        notes["sun_exposure"] = (
                            f"14-day average of {avg_sunshine_hrs:.1f} hrs sunshine/day → Part shade (2–4 hrs)."
                        )
                    else:
                        suggestions["sun_exposure"] = "full_shade"
                        notes["sun_exposure"] = (
                            f"14-day average of {avg_sunshine_hrs:.1f} hrs sunshine/day → Full shade (<2 hrs)."
                        )

                # Wind: daily max wind speed km/h → average
                wind_vals = [w for w in (daily.get("wind_speed_10m_max") or []) if w is not None]
                if wind_vals:
                    avg_wind = sum(wind_vals) / len(wind_vals)
                    if avg_wind < 15:
                        suggestions["wind_exposure"] = "sheltered"
                        notes["wind_exposure"] = (
                            f"14-day average max wind of {avg_wind:.0f} km/h → Sheltered."
                        )
                    elif avg_wind < 30:
                        suggestions["wind_exposure"] = "moderate"
                        notes["wind_exposure"] = (
                            f"14-day average max wind of {avg_wind:.0f} km/h → Moderate."
                        )
                    else:
                        suggestions["wind_exposure"] = "exposed"
                        notes["wind_exposure"] = (
                            f"14-day average max wind of {avg_wind:.0f} km/h → Exposed."
                        )
        except (httpx.RequestError, httpx.TimeoutException, ValueError) as exc:
            logger.warning("microclimate weather signal fetch failed", extra={"error": str(exc)})

        # ── 2. USGS EPQS: elevation at garden + 4 points ~400 m away ───
        # ~0.0036° ≈ 400 m at mid-latitudes (rough but sufficient)
        delta = 0.004
        surrounding_coords = [
            (latitude + delta, longitude),
            (latitude - delta, longitude),
            (latitude, longitude + delta),
            (latitude, longitude - delta),
        ]
        garden_elev = await _fetch_elevation_usgs(client, latitude, longitude)
        if garden_elev is not None:
            surrounding_elevs = []
            for slat, slon in surrounding_coords:
                e = await _fetch_elevation_usgs(client, slat, slon)
                if e is not None:
                    surrounding_elevs.append(e)

            if surrounding_elevs:
                avg_surrounding = sum(surrounding_elevs) / len(surrounding_elevs)
                diff = garden_elev - avg_surrounding  # positive = garden is higher

                if diff <= -3:
                    suggestions["slope_position"] = "low"
                    suggestions["frost_pocket_risk"] = "high"
                    notes["slope_position"] = (
                        f"Garden is {abs(diff):.0f} ft below surrounding terrain — low spot."
                    )
                    notes["frost_pocket_risk"] = (
                        f"Low spot by {abs(diff):.0f} ft — cold air pools here, raising frost risk."
                    )
                elif diff >= 3:
                    suggestions["slope_position"] = "high"
                    suggestions["frost_pocket_risk"] = "low"
                    notes["slope_position"] = (
                        f"Garden is {diff:.0f} ft above surrounding terrain — high ground."
                    )
                    notes["frost_pocket_risk"] = (
                        "High ground sheds cold air — low frost pocket risk."
                    )
                else:
                    suggestions["slope_position"] = "mid"
                    suggestions["frost_pocket_risk"] = "low"
                    notes["slope_position"] = (
                        "Garden elevation is within 3 ft of surrounding terrain — mid-slope."
                    )
                    notes["frost_pocket_risk"] = (
                        "No significant low-spot signature detected — low frost pocket risk."
                    )
            else:
                # USGS returned garden elevation but no surrounding points (edge case)
                suggestions["slope_position"] = "mid"
                suggestions["frost_pocket_risk"] = "low"
                notes["slope_position"] = (
                    "Could not sample nearby terrain — defaulting to mid-slope."
                )
                notes["frost_pocket_risk"] = "Could not confirm; defaulting to low."
        else:
            # USGS unavailable (non-US location or service down)
            notes["slope_position"] = (
                "Elevation data unavailable for this location (USGS covers the US). Check visually using the satellite view."
            )
            notes["frost_pocket_risk"] = (
                "Elevation data unavailable. If your garden is in a valley or at the base of a slope, set this to High."
            )

    # Fields that cannot be derived from coordinates
    notes["orientation"] = (
        "Cannot be determined from your address — look at the satellite view to see which direction your garden faces."
    )
    notes["thermal_mass"] = (
        "Cannot be determined remotely — check whether patios, driveways, brick walls, or stone are adjacent to your garden."
    )

    return {"suggestions": suggestions, "notes": notes}
