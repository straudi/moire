import io

from fastapi.testclient import TestClient
from PIL import Image

from app import ai, weather
from app.main import app

client = TestClient(app)

ITEM = {"name": "티", "type": "tee", "color": "#ffffff", "style": "미니멀", "season": "여름"}


def items(*ids):
    return [{**ITEM, "id": i} for i in ids]


def test_health():
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["ai"] in ("bedrock", "dummy")


def test_tag_rejects_non_image():  # T-27
    res = client.post("/api/tag", files={"image": ("a.txt", b"hello", "text/plain")})
    assert res.status_code == 415


def test_tag_dummy_returns_vocab_values():
    buf = io.BytesIO()
    Image.new("RGB", (100, 100), (200, 30, 30)).save(buf, "PNG")
    res = client.post("/api/tag", files={"image": ("a.png", buf.getvalue(), "image/png")})
    assert res.status_code == 200
    body = res.json()
    assert body["mode"] == "dummy"
    assert body["type"] == "tee"
    assert body["color"] == "#c81e1e"


def test_recommend_dummy():
    req = {
        "weather": {"temp": 21, "sky": "맑음"}, "style": "미니멀", "mood": "편안한",
        "candidates": [{"id": "c1", "garmentIds": ["a", "b"], "items": items("a", "b")}],
    }
    body = client.post("/api/recommend", json=req).json()
    assert body["picks"][0]["candidateId"] == "c1"


def test_recommend_rejects_bad_mood():
    req = {
        "weather": {"temp": 21, "sky": "맑음"}, "style": "미니멀", "mood": "화난",
        "candidates": [{"id": "c1", "garmentIds": ["a", "b"], "items": items("a", "b")}],
    }
    assert client.post("/api/recommend", json=req).status_code == 422


def test_validate_picks_drops_unknown_ids():  # T-21
    picks = ai.validate_picks(
        [{"candidateId": "ghost", "title": "x", "reason": "y"}, {"candidateId": "c1", "title": "ok", "reason": "r"}, "junk"],
        {"c1", "c2"},
    )
    assert [p["candidateId"] for p in picks] == ["c1"]


def test_clean_tags_drops_out_of_vocab():
    assert ai.clean_tags({"type": "hat", "color": "red", "style": "미니멀", "season": "봄"}) == {
        "type": None, "color": None, "style": "미니멀", "season": None, "name": None,
    }


def test_weather_dummy_and_empty_city():
    assert client.get("/api/weather", params={"city": "Seoul"}).json()["source"] == "dummy"
    assert client.get("/api/weather", params={"city": "  "}).status_code == 422


class FakeResponse:
    def __init__(self, status, body):
        self.status_code, self._body = status, body

    def json(self):
        return self._body


def test_weather_openweathermap_korean_city(monkeypatch):
    from app import config

    def fake_get(url, params, timeout):
        assert params["appid"] == "test-key"
        if "geo" in url:
            assert params["q"] == "서울"
            return FakeResponse(200, [{"name": "Seoul", "lat": 37.5, "lon": 127.0, "local_names": {"ko": "서울"}}])
        return FakeResponse(200, {"weather": [{"main": "Rain"}], "main": {"temp": 12.6}})

    monkeypatch.setattr(config, "USE_OPENWEATHER", True)
    monkeypatch.setattr(config, "OPENWEATHER_API_KEY", "test-key")
    monkeypatch.setattr(weather.httpx, "get", fake_get)
    body = client.get("/api/weather", params={"city": "서울"}).json()
    assert body == {"source": "openweathermap", "city": "서울", "temp": 13, "sky": "비", "precipitation": True}


def test_weather_unknown_city_and_bad_key(monkeypatch):
    from app import config

    monkeypatch.setattr(config, "USE_OPENWEATHER", True)
    monkeypatch.setattr(weather.httpx, "get", lambda url, params, timeout: FakeResponse(200, []))
    assert client.get("/api/weather", params={"city": "없는도시"}).status_code == 404
    monkeypatch.setattr(weather.httpx, "get", lambda url, params, timeout: FakeResponse(401, {}))
    res = client.get("/api/weather", params={"city": "Seoul"})
    assert res.status_code == 502
    assert "키" in res.json()["detail"]
