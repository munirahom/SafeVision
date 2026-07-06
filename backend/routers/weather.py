import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import APIRouter, Depends, HTTPException, Query

from auth import get_current_user
from config import DEFAULT_WEATHER_LOCATION
import models

router = APIRouter(prefix="/api/weather", tags=["weather"])

_WEATHER_CODE_LABELS = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
}

_SEVERE_WEATHER_CODES = {
    65: ("high", "Heavy rain is forecast"),
    67: ("high", "Heavy freezing rain is forecast"),
    75: ("high", "Heavy snow is forecast"),
    82: ("high", "Violent rain showers are forecast"),
    86: ("high", "Heavy snow showers are forecast"),
    95: ("high", "Thunderstorms are forecast"),
    96: ("high", "Thunderstorms with hail are forecast"),
    99: ("high", "Thunderstorms with heavy hail are forecast"),
}


def _fetch_json(base_url: str, params: dict) -> dict:
    url = f"{base_url}?{urlencode(params)}"
    request = Request(url, headers={"User-Agent": "SafeVision/2.0"})

    try:
        with urlopen(request, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Weather service error: {exc.code}") from exc
    except URLError as exc:
        raise HTTPException(status_code=502, detail="Could not reach the weather service") from exc
    except TimeoutError as exc:
        raise HTTPException(status_code=504, detail="Weather lookup timed out") from exc


def _resolve_location(location: str) -> dict:
    geocode_data = _fetch_json(
        "https://geocoding-api.open-meteo.com/v1/search",
        {
            "name": location,
            "count": 1,
            "language": "en",
            "format": "json",
        },
    )

    results = geocode_data.get("results") or []
    if not results:
        raise HTTPException(status_code=404, detail=f"No weather location found for '{location}'")

    return results[0]


def _append_alert(alerts: list[dict], severity: str, title: str, detail: str, starts_at: str | None = None):
    key = (severity, title)
    if any((a["severity"], a["title"]) == key for a in alerts):
        return
    alerts.append({
        "severity": severity,
        "title": title,
        "detail": detail,
        "starts_at": starts_at,
    })


def _build_forecast_alerts(weather_data: dict) -> list[dict]:
    alerts: list[dict] = []

    hourly = weather_data.get("hourly") or {}
    times = hourly.get("time") or []
    codes = hourly.get("weather_code") or []
    temperatures = hourly.get("temperature_2m") or []
    wind_speeds = hourly.get("wind_speed_10m") or []
    precipitation_probabilities = hourly.get("precipitation_probability") or []

    for idx, forecast_time in enumerate(times[:72]):
        code = codes[idx] if idx < len(codes) else None
        if code in _SEVERE_WEATHER_CODES:
            severity, detail = _SEVERE_WEATHER_CODES[code]
            _append_alert(
                alerts,
                severity,
                _WEATHER_CODE_LABELS.get(code, "Severe weather"),
                detail,
                forecast_time,
            )

        temp = temperatures[idx] if idx < len(temperatures) else None
        if temp is not None:
            if temp >= 45:
                _append_alert(alerts, "high", "Extreme heat", f"Temperature may reach {round(temp)}C.", forecast_time)
            elif temp >= 40:
                _append_alert(alerts, "medium", "High heat", f"Temperature may reach {round(temp)}C.", forecast_time)
            elif temp <= 0:
                _append_alert(alerts, "medium", "Freezing conditions", f"Temperature may fall to {round(temp)}C.", forecast_time)

        wind = wind_speeds[idx] if idx < len(wind_speeds) else None
        if wind is not None:
            if wind >= 70:
                _append_alert(alerts, "high", "Severe wind", f"Wind speed may reach {round(wind)} km/h.", forecast_time)
            elif wind >= 50:
                _append_alert(alerts, "medium", "High wind", f"Wind speed may reach {round(wind)} km/h.", forecast_time)

        precip_prob = precipitation_probabilities[idx] if idx < len(precipitation_probabilities) else None
        if precip_prob is not None and precip_prob >= 85:
            _append_alert(
                alerts,
                "medium",
                "High precipitation chance",
                f"Precipitation probability may reach {round(precip_prob)}%.",
                forecast_time,
            )

    severity_order = {"high": 0, "medium": 1, "low": 2}
    return sorted(alerts, key=lambda alert: (severity_order.get(alert["severity"], 9), alert.get("starts_at") or ""))[:8]


def get_weather_summary(location: str = DEFAULT_WEATHER_LOCATION) -> dict:
    place = _resolve_location(location)
    weather_data = _fetch_json(
        "https://api.open-meteo.com/v1/forecast",
        {
            "latitude": place["latitude"],
            "longitude": place["longitude"],
            "current": ",".join([
                "temperature_2m",
                "relative_humidity_2m",
                "wind_speed_10m",
                "weather_code",
                "is_day",
            ]),
            "hourly": ",".join([
                "temperature_2m",
                "precipitation_probability",
                "wind_speed_10m",
                "weather_code",
            ]),
            "forecast_days": 3,
            "timezone": "auto",
        },
    )

    current = weather_data.get("current") or {}
    if not current:
        raise HTTPException(status_code=502, detail="Weather service returned no current conditions")

    weather_code = current.get("weather_code")
    alerts = _build_forecast_alerts(weather_data)
    highest_severity = alerts[0]["severity"] if alerts else None

    return {
        "query": location,
        "location": place["name"],
        "region": place.get("admin1"),
        "country": place.get("country"),
        "latitude": place["latitude"],
        "longitude": place["longitude"],
        "timezone": weather_data.get("timezone") or place.get("timezone"),
        "temperature_c": current.get("temperature_2m"),
        "humidity": current.get("relative_humidity_2m"),
        "wind_speed_kph": current.get("wind_speed_10m"),
        "weather_code": weather_code,
        "condition": _WEATHER_CODE_LABELS.get(weather_code, "Unknown"),
        "is_day": bool(current.get("is_day", 1)),
        "observed_at": current.get("time"),
        "alerts": alerts,
        "alert_count": len(alerts),
        "highest_alert_severity": highest_severity,
    }


@router.get("/current")
def get_current_weather(
    location: str = Query(DEFAULT_WEATHER_LOCATION, min_length=2),
    _current_user: models.User = Depends(get_current_user),
):
    return get_weather_summary(location)
