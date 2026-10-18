"""Weather adapter: OpenWeatherMap when a key is set, otherwise a labelled dummy."""
import datetime as dt
import zlib

import httpx

from . import config


class WeatherError(Exception):
    pass


class CityNotFound(WeatherError):
    pass


# Seoul monthly mean temperatures (°C), used only for the dummy source.
_MONTHLY_MEAN = [-2, 1, 6, 13, 18, 23, 26, 27, 22, 15, 8, 1]


def source() -> str:
    return "openweathermap" if config.USE_OPENWEATHER else "dummy"


def _sky(main: str) -> str:
    if main in ("Rain", "Drizzle", "Thunderstorm"):
        return "비"
    if main == "Snow":
        return "눈"
    if main == "Clear":
        return "맑음"
    return "흐림"


def _dummy(label: str) -> dict:
    today = dt.date.today()
    seed = zlib.crc32(f"{label.lower()}-{today.isoformat()}".encode())
    temp = _MONTHLY_MEAN[today.month - 1] + (seed % 7) - 3
    sky = ["맑음", "맑음", "흐림", "비"][seed % 4]
    return {"source": "dummy", "city": label, "temp": temp, "sky": sky, "precipitation": sky in ("비", "눈")}


def _place_name(place: dict, fallback: str) -> str:
    return (place.get("local_names") or {}).get("ko") or place.get("name") or fallback


def _at(lat: float, lon: float, name: str) -> dict:
    body = _get(
        "https://api.openweathermap.org/data/2.5/weather",
        {"lat": lat, "lon": lon, "units": "metric", "lang": "kr"},
    )
    sky = _sky(body["weather"][0]["main"])
    return {
        "source": "openweathermap",
        "city": name,
        "temp": round(body["main"]["temp"]),
        "sky": sky,
        "precipitation": sky in ("비", "눈"),
    }


def current(city: str) -> dict:
    if not config.USE_OPENWEATHER:
        return _dummy(city)
    # Geocoding first: it understands local names such as "서울" that the weather endpoint's q= does not.
    places = _get("https://api.openweathermap.org/geo/1.0/direct", {"q": city, "limit": 1})
    if not places:
        raise CityNotFound("도시를 찾지 못했어요. 다른 이름으로 입력해 보세요.")
    place = places[0]
    return _at(place["lat"], place["lon"], _place_name(place, city))


def current_at(lat: float, lon: float) -> dict:
    """Weather for browser coordinates (D-009). Coordinates are rounded to ~1km and never stored."""
    lat, lon = round(lat, 2), round(lon, 2)
    if not config.USE_OPENWEATHER:
        return _dummy("현재 위치")
    places = _get("https://api.openweathermap.org/geo/1.0/reverse", {"lat": lat, "lon": lon, "limit": 1})
    name = _place_name(places[0], "현재 위치") if places else "현재 위치"
    return _at(lat, lon, name)


def _get(url: str, params: dict):
    # Error messages never include the URL, which carries the API key.
    try:
        res = httpx.get(url, params={**params, "appid": config.OPENWEATHER_API_KEY}, timeout=8)
    except httpx.HTTPError as exc:
        raise WeatherError("날씨 서버에 연결하지 못했어요.") from exc
    if res.status_code == 401:
        raise WeatherError("날씨 API 키가 올바르지 않거나 아직 활성화되지 않았어요.")
    if res.status_code == 429:
        raise WeatherError("날씨 API 호출 한도를 넘었어요. 잠시 후 다시 시도해 주세요.")
    if res.status_code != 200:
        raise WeatherError(f"날씨 서버 오류 ({res.status_code})")
    return res.json()
