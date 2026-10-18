"""Bedrock adapter with an explicit dummy mode (D-005, D-006).

The server never stores images or request bodies and never logs them.
"""
import io
import json
import re

from PIL import Image

from . import config
from .vocab import MOODS, SEASONS, STYLES, TEMPLATE_IDS, TEMPLATE_LABELS


class AIError(Exception):
    pass


_client = None


def _bedrock():
    global _client
    if _client is None:
        import boto3
        from botocore.config import Config

        _client = boto3.client(
            "bedrock-runtime",
            region_name=config.AWS_REGION,
            config=Config(read_timeout=20, connect_timeout=5, retries={"max_attempts": 1}),
        )
    return _client


def _converse(content: list, max_tokens: int = 600) -> str:
    try:
        res = _bedrock().converse(
            modelId=config.BEDROCK_MODEL_ID,
            messages=[{"role": "user", "content": content}],
            inferenceConfig={"maxTokens": max_tokens, "temperature": 0.3},
        )
        return "".join(part.get("text", "") for part in res["output"]["message"]["content"])
    except Exception as exc:  # botocore errors, timeouts, permission problems
        raise AIError(f"Bedrock 호출 실패: {type(exc).__name__}") from exc


def _extract_json(text: str):
    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        raise AIError("AI 응답에서 JSON을 찾지 못했어요.")
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError as exc:
        raise AIError("AI 응답 JSON이 올바르지 않아요.") from exc


def mode() -> str:
    return "bedrock" if config.USE_BEDROCK else "dummy"


# ---------- tagging ----------

def clean_tags(raw: dict) -> dict:
    """Keep only values inside the shared vocabulary; anything else becomes None."""
    color = raw.get("color")
    name = raw.get("name")
    return {
        "type": raw.get("type") if raw.get("type") in TEMPLATE_IDS else None,
        "color": color.lower() if isinstance(color, str) and re.fullmatch(r"#[0-9a-fA-F]{6}", color) else None,
        "style": raw.get("style") if raw.get("style") in STYLES else None,
        "season": raw.get("season") if raw.get("season") in SEASONS else None,
        "name": name.strip()[:40] if isinstance(name, str) and name.strip() else None,
    }


def _dummy_tags(image: Image.Image) -> dict:
    w, h = image.size
    center = image.convert("RGB").crop((w // 4, h // 4, w * 3 // 4, h * 3 // 4)).resize((1, 1))
    r, g, b = center.getpixel((0, 0))
    ratio = h / max(1, w)
    kind = "slacks" if ratio > 1.45 else "sneakers" if ratio < 0.6 else "tee"
    return {
        "type": kind,
        "color": f"#{r:02x}{g:02x}{b:02x}",
        "style": "캐주얼",
        "season": "사계절",
        "name": f"새 {TEMPLATE_LABELS[kind]}",
    }


def tag_image(data: bytes, media_type: str) -> dict:
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
    except Exception as exc:
        raise ValueError("이미지를 읽을 수 없어요.") from exc

    if not config.USE_BEDROCK:
        return {"mode": "dummy", **clean_tags(_dummy_tags(image))}

    fmt = {"image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp"}[media_type]
    prompt = (
        "이 옷 사진을 보고 아래 JSON 하나만 답하세요. 설명 문장은 쓰지 마세요.\n"
        f'{{"type": {TEMPLATE_IDS} 중 하나, "color": 대표 색 "#rrggbb", '
        f'"style": {STYLES} 중 하나, "season": {SEASONS} 중 하나, "name": 20자 이내 한국어 옷 이름}}'
    )
    text = _converse([{"image": {"format": fmt, "source": {"bytes": data}}}, {"text": prompt}], 300)
    return {"mode": "bedrock", **clean_tags(_extract_json(text))}


# ---------- recommendation ----------

def validate_picks(raw_picks, candidate_ids: set[str]) -> list[dict]:
    """Drop picks whose candidateId was not sent by the client (API-SPEC, 기획안 12장)."""
    picks = []
    seen = set()
    for p in raw_picks if isinstance(raw_picks, list) else []:
        if not isinstance(p, dict):
            continue
        cid = p.get("candidateId")
        if cid not in candidate_ids or cid in seen:
            continue
        seen.add(cid)
        title = str(p.get("title") or "오늘의 코디")[:40]
        reason = str(p.get("reason") or "")[:400]
        picks.append({"candidateId": cid, "title": title, "reason": reason})
        if len(picks) == 2:
            break
    return picks


def _describe(item: dict) -> str:
    return f"{item['name']}({TEMPLATE_LABELS.get(item['type'], item['type'])}, {item['style']}, {item['season']})"


def _dummy_recommend(req: dict) -> list[dict]:
    weather, style, mood = req["weather"], req["style"], req["mood"]
    cands = req["candidates"]
    first = cands[0]
    # Second look: the candidate sharing the fewest garments with the first (more variety).
    rest = sorted(cands[1:], key=lambda c: len(set(c["garmentIds"]) & set(first["garmentIds"])))
    picks = []
    for i, cand in enumerate([first, *rest[:1]]):
        names = " + ".join(it["name"] for it in cand["items"])
        rain = " 비 소식이 있으니 우산을 챙기세요." if weather["sky"] in ("비", "눈") else ""
        picks.append({
            "candidateId": cand["id"],
            "title": f"{style}, {mood} 하루" if i == 0 else "조금 다른 나의 취향",
            "reason": f"{weather['temp']:g}°C {weather['sky']} 날씨에 맞는 옷 중에서 {style} 스타일과 "
                      f"'{mood}' 기분에 어울리는 {names} 조합을 골랐어요.{rain}",
        })
    return picks


def recommend(req: dict) -> dict:
    ids = {c["id"] for c in req["candidates"]}
    if not config.USE_BEDROCK:
        return {"mode": "dummy", "picks": validate_picks(_dummy_recommend(req), ids)}

    lines = [f"- {c['id']}: " + ", ".join(_describe(it) for it in c["items"]) for c in req["candidates"]]
    prompt = (
        f"날씨: {req['weather']['temp']:g}°C, {req['weather']['sky']}. 원하는 스타일: {req['style']}. 기분: {req['mood']}.\n"
        "아래 후보 코디 중 가장 어울리는 것을 최대 2개 고르고, 한국어로 짧은 제목과 2문장 이내 이유를 쓰세요.\n"
        + "\n".join(lines)
        + '\n반드시 JSON 하나만 답하세요: {"picks":[{"candidateId":"후보 id","title":"...","reason":"..."}]}'
    )
    picks = validate_picks(_extract_json(_converse([{"text": prompt}])).get("picks"), ids)
    if not picks:
        raise AIError("AI가 유효한 후보를 고르지 않았어요.")
    return {"mode": "bedrock", "picks": picks}


def evaluate(req: dict) -> dict:
    if not config.USE_BEDROCK:
        return {"mode": "dummy", "score": 70, "reasons": ["더미 모드의 고정 점수예요."], "suggestions": []}
    items = ", ".join(_describe(it) for it in req["items"])
    prompt = (
        f"착용: {items}. 날씨: {req['weather']['temp']:g}°C {req['weather']['sky']}. 상황: {req.get('occasion') or '일상'}.\n"
        '참고 의견으로 JSON 하나만 답하세요: {"score":0~100 정수,"reasons":["..."],"suggestions":["..."]}'
    )
    raw = _extract_json(_converse([{"text": prompt}], 400))
    try:
        score = max(0, min(100, int(raw.get("score"))))
    except (TypeError, ValueError) as exc:
        raise AIError("AI 점수가 올바르지 않아요.") from exc
    as_list = lambda v: [str(x)[:200] for x in v][:5] if isinstance(v, list) else []
    return {"mode": "bedrock", "score": score, "reasons": as_list(raw.get("reasons")), "suggestions": as_list(raw.get("suggestions"))}


__all__ = ["AIError", "mode", "tag_image", "recommend", "evaluate", "validate_picks", "clean_tags", "MOODS"]
