import io

from fastapi.testclient import TestClient
from PIL import Image

from app import ai
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
    assert client.get("/api/weather", params={"city": "Seoul"}).json()["source"] in ("dummy", "openweathermap")
    assert client.get("/api/weather", params={"city": "  "}).status_code == 422
