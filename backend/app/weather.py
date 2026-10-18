"""Weather adapter: OpenWeatherMap when a key is set, otherwise a labelled dummy."""
import datetime as dt
import zlib

import httpx

from . import config


class WeatherError(Exception):
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


def current(city: str) -> dict:
    if not config.USE_OPENWEATHER:
        today = dt.date.today()
        seed = zlib.crc32(f"{city.lower()}-{today.isoformat()}".encode())
        temp = _MONTHLY_MEAN[today.month - 1] + (seed % 7) - 3
        sky = ["맑음", "맑음", "흐림", "비"][seed % 4]
        return {"source": "dummy", "city": city, "temp": temp, "sky": sky, "precipitation": sky in ("비", "눈")}

    try:
        res = httpx.get(
            "https://api.openweathermap.org/data/2.5/weather",
            params={"q": city, "appid": config.OPENWEATHER_API_KEY, "units": "metric", "lang": "kr"},
            timeout=8,
        )
    except httpx.HTTPError as exc:
        raise WeatherError("날씨 서버에 연결하지 못했어요.") from exc
    if res.status_code == 404:
        raise WeatherError("도시를 찾지 못했어요.")
    if res.status_code != 200:
        raise WeatherError(f"날씨 서버 오류 ({res.status_code})")
    body = res.json()
    sky = _sky(body["weather"][0]["main"])
    return {
        "source": "openweathermap",
        "city": body.get("name", city),
        "temp": round(body["main"]["temp"]),
        "sky": sky,
        "precipitation": sky in ("비", "눈"),
    }
