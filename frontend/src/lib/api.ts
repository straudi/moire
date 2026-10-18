// The only place that knows the API server address (11-4 규칙).
import type { Season, Sky, Style, TemplateId, Weather } from "./types";

export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {}

async function call<T>(path: string, init?: RequestInit, timeoutMs = 25000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(API_BASE + path, { ...init, signal: ctrl.signal });
  } catch {
    throw new ApiError("서버에 연결하지 못했어요.");
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let detail = `서버 오류 (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {}
    throw new ApiError(detail);
  }
  return res.json() as Promise<T>;
}

export type AiMode = "bedrock" | "dummy";

export interface Health {
  status: "ok";
  ai: AiMode;
  weather: "openweathermap" | "dummy";
}

export const getHealth = () => call<Health>("/health", undefined, 5000);

export interface TagResult {
  mode: AiMode;
  type: TemplateId | null;
  color: string | null;
  style: Style | null;
  season: Season | null;
  name: string | null;
}

export function postTag(image: Blob) {
  const form = new FormData();
  form.append("image", image, "garment.jpg");
  return call<TagResult>("/api/tag", { method: "POST", body: form });
}

export interface RecommendCandidate {
  id: string;
  garmentIds: string[];
  items: { id: string; name: string; type: TemplateId; color: string; style: Style; season: Season }[];
}

export interface RecommendResult {
  mode: AiMode;
  picks: { candidateId: string; title: string; reason: string }[];
}

export function postRecommend(body: { weather: { temp: number; sky: Sky }; style: Style; mood: string; candidates: RecommendCandidate[] }) {
  return call<RecommendResult>("/api/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export type WeatherQuery = { city: string } | { lat: number; lon: number };

export function getWeather(q: WeatherQuery) {
  // Coordinates are rounded to ~1km before leaving the browser (D-009).
  const params: Record<string, string> = "city" in q ? { city: q.city } : { lat: q.lat.toFixed(2), lon: q.lon.toFixed(2) };
  return call<Pick<Weather, "temp" | "sky" | "city"> & { source: "openweathermap" | "dummy"; precipitation: boolean }>(
    `/api/weather?${new URLSearchParams(params)}`,
    undefined,
    10000,
  );
}

/** Browser location; rejects with a user-facing message. */
export function locate(): Promise<{ lat: number; lon: number }> {
  return new Promise((ok, no) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return no(new Error("이 브라우저는 위치 확인을 지원하지 않아요"));
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) => no(new Error(e.code === e.PERMISSION_DENIED ? "위치 권한이 없어요" : "위치를 확인하지 못했어요")),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 },
    );
  });
}
