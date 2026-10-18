"use client";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { categoryOf } from "@/lib/garments";
import { CATEGORIES, STYLES, type Category, type ClosetItem, type Style } from "@/lib/types";
import GarmentCard from "@/components/GarmentCard";
import GarmentModal from "@/components/GarmentModal";

type CatFilter = "전체" | Category;
const UI_KEY = "moire.ui";

function readUi(): CatFilter {
  try {
    const v = JSON.parse(localStorage.getItem(UI_KEY) || "{}").category;
    return ["전체", ...CATEGORIES].includes(v) ? v : "전체";
  } catch {
    return "전체";
  }
}

export default function ClosetPage() {
  const { items } = useStore();
  const [category, setCategory] = useState<CatFilter>("전체");
  const [style, setStyle] = useState<"전체" | Style>("전체");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<ClosetItem | null | undefined>(undefined);

  useEffect(() => setCategory(readUi()), []);

  function pickCategory(c: CatFilter) {
    setCategory(c);
    try {
      localStorage.setItem(UI_KEY, JSON.stringify({ category: c }));
    } catch {}
  }

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (x) =>
        (category === "전체" || categoryOf(x.type) === category) &&
        (style === "전체" || x.style === style) &&
        `${x.name} ${x.brand}`.toLowerCase().includes(q),
    );
  }, [items, category, style, query]);

  function clearFilters() {
    pickCategory("전체");
    setStyle("전체");
    setQuery("");
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">A COLLECTION OF YOU</span>
          <h1 className="mt-2 text-2xl font-medium tracking-tight sm:text-3xl">나의 옷장</h1>
          <p className="mt-1 text-sm text-muted">한 벌 한 벌, 나의 취향이 모이는 공간.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(null)}>＋ 옷 등록하기</button>
      </div>

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="카테고리">
          {(["전체", ...CATEGORIES] as CatFilter[]).map((c) => (
            <button key={c} className="chip" aria-pressed={category === c} onClick={() => pickCategory(c)}>{c}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <input className="field md:w-56" type="search" aria-label="옷 이름 또는 브랜드 검색" placeholder="⌕ 이름 또는 브랜드 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select className="field w-28" aria-label="스타일 필터" value={style} onChange={(e) => setStyle(e.target.value as "전체" | Style)}>
            {["전체", ...STYLES].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-4 flex justify-between text-xs text-muted">
        <span aria-live="polite">{shown.length}벌의 옷</span>
        <span className="eyebrow hidden sm:inline">CLICK A PIECE. MAKE A LOOK.</span>
      </div>

      {shown.length ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {shown.map((x) => <GarmentCard key={x.id} item={x} onEdit={setModal} />)}
        </div>
      ) : items.length ? (
        <div className="py-16 text-center">
          <h3 className="font-medium">이 조건에 맞는 옷이 없어요.</h3>
          <p className="mt-1 text-sm text-muted">다른 카테고리나 스타일로 찾아보세요.</p>
          <button className="btn mt-4" onClick={clearFilters}>필터 초기화</button>
        </div>
      ) : (
        <div className="py-16 text-center">
          <h3 className="font-medium">나의 첫 번째 옷을 등록해보세요.</h3>
          <button className="btn btn-primary mt-4" onClick={() => setModal(null)}>＋ 옷 등록하기</button>
        </div>
      )}

      <p className="mt-8 text-xs text-muted">
        사진과 옷 정보는 이 브라우저(IndexedDB)에만 저장돼요. 다른 브라우저·기기에서는 보이지 않아요.
      </p>

      {modal !== undefined && <GarmentModal item={modal} onClose={() => setModal(undefined)} />}
    </>
  );
}
