import httpx

from .config import settings


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

    async with httpx.AsyncClient(timeout=10) as client:
        geo_resp = await client.get(f"https://api.zippopotam.us/us/{normalized_zip}")
        if geo_resp.status_code != 200:
            raise ValueError("ZIP code lookup failed")

        geo_payload = geo_resp.json()
        places = geo_payload.get("places") or []
        if not places:
            raise ValueError("ZIP code lookup returned no location data")

        first_place = places[0]
        latitude = float(first_place["latitude"])
        longitude = float(first_place["longitude"])

        zone = "Unknown"
        zone_resp = await client.get(f"https://phzmapi.org/{normalized_zip}.json")
        if zone_resp.status_code == 200:
            zone_payload = zone_resp.json()
            if zone_payload.get("zone"):
                zone = str(zone_payload["zone"])

        return {
            "zip_code": normalized_zip,
            "latitude": latitude,
            "longitude": longitude,
            "growing_zone": zone,
        }
