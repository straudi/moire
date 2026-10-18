"""moire API server. No persistent storage (D-004). See API-SPEC.md."""
import time
from collections import defaultdict, deque
from typing import Literal

from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

from . import ai, config, weather
from .vocab import MOODS, SEASONS, SKIES, STYLES, TEMPLATE_IDS

app = FastAPI(title="moire API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

# ---------- rate limit (in-memory, per IP) ----------
_calls: dict[str, deque] = defaultdict(deque)


def rate_limit(request: Request) -> None:
    now = time.monotonic()
    q = _calls[request.client.host if request.client else "?"]
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= config.RATE_LIMIT_PER_MINUTE:
        raise HTTPException(429, "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.")
    q.append(now)


# ---------- schemas ----------
class WeatherIn(BaseModel):
    temp: float = Field(ge=-40, le=50)
    sky: Literal["맑음", "흐림", "비", "눈"]


class ItemIn(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=40)
    type: str
    color: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")
    style: str
    season: str

    @field_validator("type")
    @classmethod
    def _type(cls, v):
        if v not in TEMPLATE_IDS:
            raise ValueError("알 수 없는 옷 종류")
        return v

    @field_validator("style")
    @classmethod
    def _style(cls, v):
        if v not in STYLES:
            raise ValueError("알 수 없는 스타일")
        return v

    @field_validator("season")
    @classmethod
    def _season(cls, v):
        if v not in SEASONS:
            raise ValueError("알 수 없는 계절")
        return v


class CandidateIn(BaseModel):
    id: str = Field(min_length=1, max_length=16)
    garmentIds: list[str] = Field(min_length=2, max_length=4)
    items: list[ItemIn] = Field(min_length=2, max_length=4)


class RecommendIn(BaseModel):
    weather: WeatherIn
    style: str
    mood: str
    candidates: list[CandidateIn] = Field(min_length=1, max_length=8)

    @field_validator("style")
    @classmethod
    def _style(cls, v):
        if v not in STYLES:
            raise ValueError("알 수 없는 스타일")
        return v

    @field_validator("mood")
    @classmethod
    def _mood(cls, v):
        if v not in MOODS:
            raise ValueError("알 수 없는 기분")
        return v


class EvaluateIn(BaseModel):
    items: list[ItemIn] = Field(min_length=1, max_length=4)
    weather: WeatherIn
    occasion: str = Field(default="", max_length=40)


# ---------- routes ----------
@app.get("/health")
def health():
    return {"status": "ok", "ai": ai.mode(), "weather": weather.source()}


ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}


@app.post("/api/tag", dependencies=[Depends(rate_limit)])
def tag(image: UploadFile = File(...)):
    if image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(415, "JPG·PNG·WEBP 이미지만 올릴 수 있어요.")
    data = image.file.read(config.MAX_IMAGE_BYTES + 1)
    if len(data) > config.MAX_IMAGE_BYTES:
        raise HTTPException(413, "이미지가 너무 커요 (5MB 이하).")
    try:
        return ai.tag_image(data, image.content_type)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    except ai.AIError as exc:
        raise HTTPException(502, str(exc)) from exc


@app.post("/api/recommend", dependencies=[Depends(rate_limit)])
def recommend(body: RecommendIn):
    try:
        return ai.recommend(body.model_dump())
    except ai.AIError as exc:
        raise HTTPException(502, str(exc)) from exc


@app.post("/api/evaluate", dependencies=[Depends(rate_limit)])
def evaluate(body: EvaluateIn):
    try:
        return ai.evaluate(body.model_dump())
    except ai.AIError as exc:
        raise HTTPException(502, str(exc)) from exc


@app.get("/api/weather")
def get_weather(city: str = Query("Seoul", max_length=60)):
    city = city.strip()
    if not city:
        raise HTTPException(422, "도시 이름을 입력해 주세요.")
    try:
        return weather.current(city)
    except weather.CityNotFound as exc:
        raise HTTPException(404, str(exc)) from exc
    except weather.WeatherError as exc:
        raise HTTPException(502, str(exc)) from exc


__all__ = ["app", "SKIES"]
