import math
from datetime import date

from ..models import Garden


def _day_of_year(value: date) -> int:
    return int(value.strftime("%j"))


def _declination_radians(day_of_year: int) -> float:
    # Approximate solar declination for spatial planning visuals.
    return math.radians(23.44) * math.sin(math.radians((360 / 365) * (day_of_year - 81)))


def build_garden_sun_path(garden: Garden, target_date: date) -> dict:
    day = _day_of_year(target_date)
    latitude_rad = math.radians(garden.latitude)
    declination_rad = _declination_radians(day)

    ha_sunrise = math.acos(
        max(-1.0, min(1.0, -math.tan(latitude_rad) * math.tan(declination_rad)))
    )
    day_length_hours = (2 * math.degrees(ha_sunrise)) / 15
    sunrise_hour = 12 - (day_length_hours / 2)
    sunset_hour = 12 + (day_length_hours / 2)

    points: list[dict] = []
    for hour in range(5, 21):
        hour_angle = math.radians(15 * (hour - 12))

        sin_altitude = (
            math.sin(latitude_rad) * math.sin(declination_rad)
            + math.cos(latitude_rad) * math.cos(declination_rad) * math.cos(hour_angle)
        )
        sin_altitude = max(-1.0, min(1.0, sin_altitude))
        altitude_rad = math.asin(sin_altitude)
        altitude_deg = max(0.0, math.degrees(altitude_rad))

        if altitude_deg <= 0:
            continue

        azimuth_rad = math.atan2(
            math.sin(hour_angle),
            (math.cos(hour_angle) * math.sin(latitude_rad))
            - (math.tan(declination_rad) * math.cos(latitude_rad)),
        )
        azimuth_deg = (math.degrees(azimuth_rad) + 180) % 360

        points.append(
            {
                "hour_local": hour,
                "azimuth_deg": round(azimuth_deg, 2),
                "altitude_deg": round(altitude_deg, 2),
                "intensity": round(max(0.0, sin_altitude), 3),
            }
        )

    return {
        "generated_on": date.today(),
        "target_date": target_date,
        "latitude": garden.latitude,
        "longitude": garden.longitude,
        "orientation": garden.orientation,
        "sunrise_hour": round(sunrise_hour, 2),
        "sunset_hour": round(sunset_hour, 2),
        "solar_noon_hour": 12.0,
        "day_length_hours": round(day_length_hours, 2),
        "points": points,
    }
