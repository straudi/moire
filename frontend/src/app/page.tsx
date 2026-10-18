"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { characterSVG, downloadText, resolveWear, safeColor, thumbSVG, wearFromIds } from "@/lib/garments";
import { CATEGORIES, type ClosetItem } from "@/lib/types";
import Character from "@/components/Character";
import WeatherCard from "@/components/WeatherCard";
import GarmentCard from "@/components/GarmentCard";
import GarmentModal from "@/components/GarmentModal";
import Svg from "@/components/Svg";

function today() {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "long" }).format(new Date());
}

export default function HomePage() {
  const { items, byId, wear, unwear, resetWear, logToday, setWear, history, showToast } = useStore();
  const [modal, setModal] = useState<ClosetItem | null | undefined>(undefined);
  const worn = useMemo(() => resolveWear(wear, byId), [wear, byId]);

  const attempt = (fn: () => Promise<void>, ok: string | null, fail: string) =>
    fn().then(() => ok && showToast(ok), () => showToast(fail));

  function download() {
    downloadText(characterSVG(worn), `moire-${new Date().toISOString().slice(0, 10)}.svg`);
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">YOUR EVERYDAY, REIMAGINED</span>
          <h1 className="mt-2 text-2xl font-medium tracking-tight sm:text-3xl">오늘은, 어떤 나로 입을까요?</h1>
          <p className="mt-1 text-sm text-muted">익숙한 옷에서 발견하는 새로운 조합.</p>
        </div>
        <span className="rounded-full border border-line px-3.5 py-2 text-xs text-muted">{today()}</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <section className="relative overflow-hidden rounded-2xl border border-[#e1dfe5] bg-lilac" aria-label="나의 피팅룸">
          <div className="absolute left-5 top-5 flex items-center gap-2 text-[10px] tracking-[1.6px] text-[#797581]">
            <span className="h-1.5 w-1.5 rounded-full bg-moss" /> MY FITTING ROOM
          </div>
          <div className="absolute right-4 top-4 z-10 flex gap-2">
            <button className="grid h-9 w-9 place-items-center rounded-full bg-white/80" aria-label="기본 코디로 되돌리기" title="기본 코디" onClick={() => attempt(resetWear, "기본 코디로 되돌렸어요.", "저장하지 못했어요.")}>↺</button>
            <button className="grid h-9 w-9 place-items-center rounded-full bg-white/80" aria-label="캐릭터 SVG 다운로드" title="SVG 저장" onClick={download}>↓</button>
          </div>
          <div className="mx-auto mt-12 h-[380px] w-full max-w-[300px] sm:h-[440px]">
            <Character wear={wear} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/60 bg-white/40 px-5 py-4">
            <div>
              <strong className="text-sm">나의 작은 피팅룸</strong>
              <p className="text-xs text-muted">옷을 골라 나만의 조합을 만들어보세요.</p>
            </div>
            <Link href="/closet" className="btn">옷 갈아입기 ↗</Link>
          </div>
        </section>

        <div className="space-y-5">
          <WeatherCard />
          <section className="card p-5" aria-labelledby="now-wearing">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="now-wearing" className="font-medium">지금 입고 있는 옷</h2>
              <span className="eyebrow">TODAY&apos;S LOOK</span>
            </div>
            <ul className="divide-y divide-line">
              {CATEGORIES.map((c) => {
                const x = worn[c];
                if (!x) return null;
                return (
                  <li key={c} className="flex items-center gap-3 py-2">
                    <Svg markup={thumbSVG(x)} className="h-11 w-11 shrink-0 rounded-lg bg-bg p-1" />
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-sm font-medium">{x.name}</strong>
                      <span className="text-xs text-muted">{c} · {x.style}</span>
                    </div>
                    <i className="h-3 w-3 rounded-full border border-black/10" style={{ background: safeColor(x.color) }} aria-hidden />
                    <button className="px-1 text-lg text-muted" aria-label={`${c} 벗기`} onClick={() => attempt(() => unwear(c), null, "저장하지 못했어요.")}>×</button>
                  </li>
                );
              })}
            </ul>
            {!Object.keys(worn).length && <p className="py-3 text-sm text-muted">옷장에서 옷을 골라 입혀보세요.</p>}
            <div className="mt-4 flex gap-2">
              <button className="btn btn-primary flex-1" disabled={!Object.keys(worn).length} onClick={() => attempt(logToday, "오늘의 코디를 기록했어요.", "기록을 저장하지 못했어요.")}>
                ✓ 오늘 입었어요
              </button>
              <Link href="/recommend" className="btn flex-1">새로운 코디 ✧</Link>
            </div>
          </section>
        </div>
      </div>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium">나의 옷장 <span className="text-sm text-muted">{items.length} pieces</span></h2>
          <Link href="/closet" className="text-sm text-muted hover:text-ink">옷장 전체 보기 ↗</Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {items.slice(0, 3).map((x) => <GarmentCard key={x.id} item={x} onEdit={setModal} />)}
          <button onClick={() => setModal(null)} className="flex aspect-[4/5] flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-[#cfd2c4] text-muted hover:text-ink">
            <b className="text-2xl font-normal">＋</b>
            <span className="text-sm">새로운 옷 등록하기</span>
          </button>
        </div>
      </section>

      {history.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-medium">나의 OOTD 기록 <span className="text-sm text-muted">{history.length} days</span></h2>
          <div className="flex flex-wrap gap-2">
            {history.slice(0, 8).map((h) => {
              const ids = h.garmentIds.filter((id) => byId.has(id));
              const w = wearFromIds(ids, byId);
              return (
                <button key={h.id} className="chip" onClick={() => attempt(() => setWear(w), `${h.date} 코디를 입혔어요.`, "저장하지 못했어요.")}>
                  {h.date} · {ids.length}벌 ↗
                </button>
              );
            })}
          </div>
        </section>
      )}

      {modal !== undefined && <GarmentModal item={modal} onClose={() => setModal(undefined)} />}
    </>
  );
}
