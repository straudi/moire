"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { postRecommend, type AiMode } from "@/lib/api";
import { wearFromIds } from "@/lib/garments";
import { buildCandidates, ruleReason, ruleResults, toApiCandidates, type Candidate } from "@/lib/recommend";
import { MOODS, STYLES, type Mood, type Style, type Wear } from "@/lib/types";
import WeatherCard from "@/components/WeatherCard";
import Character from "@/components/Character";

interface Look {
  wear: Wear;
  title: string;
  reason: string;
}

type Result =
  | { kind: "idle" }
  | { kind: "missing"; parts: string[] }
  | { kind: "looks"; looks: Look[]; source: AiMode | "rule"; notice: string | null };

export default function RecommendPage() {
  const { items, byId, weather, server, setWear, saveOutfit, outfits, showToast } = useStore();
  const router = useRouter();
  const [style, setStyle] = useState<Style>("미니멀");
  const [mood, setMood] = useState<Mood>("편안한");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>({ kind: "idle" });

  async function generate() {
    const rule = buildCandidates(items, weather, style, mood);
    if (!rule.ok) {
      setResult({ kind: "missing", parts: rule.missing });
      return;
    }
    const fallback = (notice: string | null): Result => ({
      kind: "looks",
      source: "rule",
      notice,
      looks: ruleResults(rule.candidates).map((c, i) => ({
        wear: c.wear,
        title: i ? "조금 다른 나의 취향" : `${style}, ${mood} 하루`,
        reason: ruleReason(weather, style, mood, rule.needsOuter, rule.outerMissing),
      })),
    });
    if (server.status !== "up") {
      setResult(fallback("서버에 연결되지 않아 규칙 기반으로 추천했어요."));
      return;
    }
    setBusy(true);
    try {
      const res = await postRecommend({
        weather: { temp: weather.temp, sky: weather.sky },
        style,
        mood,
        candidates: toApiCandidates(rule.candidates, byId),
      });
      // 화면에서도 ID를 다시 검증한다 (API-SPEC)
      const byCandidate = new Map<string, Candidate>(rule.candidates.map((c) => [c.id, c]));
      const looks = res.picks
        .filter((p) => byCandidate.has(p.candidateId))
        .map((p) => ({ wear: byCandidate.get(p.candidateId)!.wear, title: p.title, reason: p.reason }));
      setResult(looks.length ? { kind: "looks", looks, source: res.mode, notice: null } : fallback("AI 결과가 올바르지 않아 규칙 기반으로 추천했어요."));
    } catch {
      setResult(fallback("AI 설명을 불러오지 못해 규칙 기반으로 추천했어요."));
    } finally {
      setBusy(false);
    }
  }

  async function tryOn(look: Look) {
    try {
      await setWear(look.wear);
      router.push("/");
    } catch {
      showToast("착용 상태를 저장하지 못했어요.");
    }
  }

  async function save(look: Look) {
    try {
      await saveOutfit(look.title, look.wear, look.reason);
      showToast("코디를 저장했어요.");
    } catch {
      showToast("코디를 저장하지 못했어요.");
    }
  }

  const sourceText = (s: AiMode | "rule") => (s === "bedrock" ? "AI의 참고 의견" : s === "dummy" ? "더미 모드 설명" : "규칙 기반");

  return (
    <>
      <div className="mb-6">
        <span className="eyebrow">DRESS FOR YOUR MOOD</span>
        <h1 className="mt-2 text-2xl font-medium tracking-tight sm:text-3xl">오늘의 코디를 찾아볼까요?</h1>
        <p className="mt-1 text-sm text-muted">날씨에 맞게, 지금의 기분에 맞게. 내 옷만으로 만드는 새로운 조합.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <aside className="space-y-6">
          <div>
            <h3 className="mb-2 text-xs font-semibold text-muted">01. 오늘의 날씨</h3>
            <WeatherCard />
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold text-muted">02. 끌리는 스타일</h3>
            <div className="flex flex-wrap gap-2">
              {STYLES.map((s) => <button key={s} className="chip" aria-pressed={style === s} onClick={() => setStyle(s)}>{s}</button>)}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold text-muted">03. 지금의 기분</h3>
            <div className="flex flex-wrap gap-2">
              {MOODS.map((m) => <button key={m} className="chip" aria-pressed={mood === m} onClick={() => setMood(m)}>{m}</button>)}
            </div>
          </div>
          <button className="btn btn-primary w-full py-3" onClick={generate} disabled={busy}>
            {busy ? "코디를 고르는 중…" : "나에게 맞는 코디 찾기 ✧"}
          </button>
          <p className="text-xs text-muted">날씨·계절 규칙으로 후보를 고른 뒤, AI가 어울리는 조합과 이유를 골라요. AI가 안 되면 규칙 결과를 보여 줘요.</p>
        </aside>

        <section aria-live="polite">
          {result.kind === "idle" && (
            <div className="rounded-2xl border border-dashed border-[#d5d7c9] px-5 py-16 text-center">
              <span className="text-4xl text-[#a5ae97]">✧</span>
              <h3 className="mt-2 font-medium">오늘의 취향을 알려주세요.</h3>
              <p className="mt-1 text-sm text-muted">스타일과 기분을 고르고 나에게 맞는 코디를 찾아보세요.</p>
            </div>
          )}
          {result.kind === "missing" && (
            <div className="rounded-2xl border border-dashed border-[#d5d7c9] px-5 py-16 text-center">
              <h3 className="font-medium">날씨에 맞는 {result.parts.join("·")}이 부족해요.</h3>
              <p className="mt-1 text-sm text-muted">옷을 추가하거나 날씨 설정을 확인해 주세요.</p>
              <Link href="/closet" className="btn mt-4">＋ 옷 등록하러 가기</Link>
            </div>
          )}
          {result.kind === "looks" && (
            <>
              {result.notice && <p role="alert" className="mb-3 rounded-lg bg-[#f3efe1] px-3 py-2 text-xs text-[#7a6a35]">{result.notice}</p>}
              <div className="grid gap-4 sm:grid-cols-2">
                {result.looks.map((look, i) => (
                  <article key={i} className="card overflow-hidden">
                    <div className="relative h-72" style={{ background: i % 2 ? "#e9e6ed" : "#eceee4" }}>
                      <span className="absolute left-4 top-4 text-[10px] tracking-[1.6px] text-muted">LOOK 0{i + 1}</span>
                      <Character wear={look.wear} className="mx-auto h-full w-52 pt-6" label={`추천 코디 ${i + 1}`} />
                    </div>
                    <div className="space-y-2 p-4">
                      <h3 className="font-medium">{look.title}</h3>
                      <p className="text-sm leading-6 text-muted">{look.reason}</p>
                      <p className="text-[11px] text-muted">이유 출처: {sourceText(result.source)}</p>
                      <p className="text-xs">{Object.values(look.wear).map((id) => byId.get(id!)?.name).filter(Boolean).join(" + ")}</p>
                      <div className="flex gap-2 pt-1">
                        <button className="btn btn-primary flex-1" onClick={() => tryOn(look)}>캐릭터에 입혀보기 ↗</button>
                        <button className="btn" aria-label="코디 저장" onClick={() => save(look)}>♡</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          {outfits.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-white px-4 py-3 text-sm">
              <span>♡ 저장한 코디 <b>{outfits.length}</b></span>
              {outfits.slice(0, 3).map((o) => {
                const w = wearFromIds(o.garmentIds, byId);
                return <button key={o.id} className="chip" onClick={() => tryOn({ wear: w, title: o.title, reason: o.reason })}>{o.title} ↗</button>;
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
