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

export function getWeather(city: string) {
  return call<Omit<Weather, "source"> & { source: "openweathermap" | "dummy"; precipitation: boolean }>(
    `/api/weather?city=${encodeURIComponent(city)}`,
    undefined,
    10000,
  );
}
