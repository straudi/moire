"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { SKIES, type Sky } from "@/lib/types";

const ICON: Record<Sky, string> = { 맑음: "☼", 흐림: "☁", 비: "☂", 눈: "❄" };
const SOURCE = { manual: "직접 입력", dummy: "더미 날씨", openweathermap: "실시간" } as const;

export function weatherAdvice(t: number) {
  return t < 8 ? "따뜻한 니트와 코트를 챙겨요." : t < 18 ? "가벼운 겉옷을 걸쳐보세요." : t < 25 ? "가벼운 상의가 잘 어울려요." : "시원한 반팔을 골라보세요.";
}

export default function WeatherCard() {
  const { weather, weatherLoading, locating, fetchWeather, locateWeather, setManualWeather, server, showToast } = useStore();
  const [open, setOpen] = useState(false);
  const [city, setCity] = useState(weather.city);
  const [temp, setTemp] = useState(String(weather.temp));
  const [sky, setSky] = useState<Sky>(weather.sky);
  const [error, setError] = useState<string | null>(null);

  async function applyManual() {
    const t = Number(temp);
    if (temp.trim() === "" || !Number.isFinite(t) || t < -40 || t > 50) {
      setError("기온은 -40~50 사이 숫자로 입력해 주세요.");
      return;
    }
    try {
      await setManualWeather({ temp: Math.round(t), sky });
      setOpen(false);
    } catch {
      showToast("날씨 설정을 저장하지 못했어요.");
    }
  }

  async function applyCity() {
    if (!city.trim()) {
      setError("도시 이름을 입력해 주세요.");
      return;
    }
    if (await fetchWeather(city.trim())) setOpen(false);
  }

  return (
    <section className="card p-5" aria-label="오늘의 날씨">
      <div className="flex items-start justify-between gap-3 text-sm">
        <span>
          오늘의 날씨{" "}
          <span className="text-muted">
            · {locating ? "위치 확인 중…" : weather.city} · {weather.mode === "geo" && "현재 위치 · "}
            {SOURCE[weather.source]}
          </span>
        </span>
        <div className="flex shrink-0 items-center gap-3">
          {weather.mode !== "geo" && (
            <button
              className="text-xs text-moss underline"
              onClick={async () => {
                if (await locateWeather()) setOpen(false);
              }}
              disabled={locating || weatherLoading || server.status !== "up"}
            >
              📍 현재 위치
            </button>
          )}
          <button className="text-xs text-muted underline" onClick={() => { setOpen(!open); setError(null); }} aria-expanded={open}>
            변경
          </button>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-4">
        <span className="text-4xl text-moss" aria-hidden>{ICON[weather.sky]}</span>
        <strong className="text-4xl font-medium">
          {weatherLoading ? "…" : weather.temp}
          <small className="text-base text-muted">°C</small>
        </strong>
        <p className="text-xs leading-5 text-muted">
          {weather.sky} · {weather.temp >= 18 ? "가볍게, 편안하게" : "포근하게, 따뜻하게"}
          <br />
          {weatherAdvice(weather.temp)}
        </p>
      </div>
      {open && (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <div className="flex gap-2">
            <input className="field" aria-label="도시 이름" placeholder="도시 (예: 서울, 부산, Tokyo)" value={city} onChange={(e) => setCity(e.target.value)} />
            <button className="btn shrink-0" onClick={applyCity} disabled={weatherLoading || server.status !== "up"}>
              {weatherLoading ? "불러오는 중" : "불러오기"}
            </button>
          </div>
          {server.status !== "up" && <p className="text-xs text-muted">서버에 연결되지 않아 직접 입력만 할 수 있어요.</p>}
          <div className="flex flex-wrap items-center gap-2">
            <input className="field w-20" type="number" aria-label="기온 직접 입력" value={temp} onChange={(e) => setTemp(e.target.value)} />
            <span className="text-sm text-muted">°C</span>
            <select className="field w-24" aria-label="하늘 상태" value={sky} onChange={(e) => setSky(e.target.value as Sky)}>
              {SKIES.map((s) => <option key={s}>{s}</option>)}
            </select>
            <button className="btn" onClick={applyManual}>직접 입력</button>
          </div>
          {error && <p role="alert" className="text-xs text-danger">{error}</p>}
        </div>
      )}
    </section>
  );
}
