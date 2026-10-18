"use client";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { categoryOf, label, safeColor, thumbSVG } from "@/lib/garments";
import type { ClosetItem } from "@/lib/types";
import Svg from "./Svg";

const TINT: Record<string, string> = { 상의: "#edeae8", 하의: "#e9ebe6", 아우터: "#ebe8e0", 신발: "#eeece6" };

export default function GarmentCard({ item, onEdit }: { item: ClosetItem; onEdit: (item: ClosetItem) => void }) {
  const { wear, wearItem, showToast } = useStore();
  const cat = categoryOf(item.type);
  const worn = wear[cat] === item.id;
  const thumb = useMemo(() => thumbSVG(item), [item]);
  const source = item.vector ? "SVG OUTFIT" : item.id.startsWith("sample-") ? "SAMPLE" : "MY CLOSET";

  async function toggle() {
    try {
      await wearItem(item.id);
    } catch {
      showToast("착용 상태를 저장하지 못했어요.");
    }
  }

  return (
    <article className="group">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-line" style={{ background: TINT[cat] }}>
        <div className="absolute inset-x-3 top-3 z-10 flex items-center justify-between">
          <span className="rounded-full bg-white/70 px-2 py-0.5 text-[9px] font-semibold tracking-wider text-muted">{source}</span>
          <button className="grid h-7 w-7 place-items-center rounded-full bg-white/80 text-sm" aria-label={`${item.name} 정보 수정`} onClick={() => onEdit(item)}>
            ↗
          </button>
        </div>
        <Svg markup={thumb} className="absolute inset-6 top-10" />
        <button
          onClick={toggle}
          disabled={worn}
          className={`absolute inset-x-3 bottom-3 rounded-full py-1.5 text-xs font-medium ${worn ? "bg-moss text-white !opacity-100" : "bg-white/85 text-ink hover:bg-white"}`}
        >
          {worn ? "✓ 착용 중" : "＋ 입혀보기"}
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 px-1">
        <span className="truncate text-sm font-medium">{item.name}</span>
        <i className="h-3 w-3 shrink-0 rounded-full border border-black/10" style={{ background: safeColor(item.color) }} aria-hidden />
      </div>
      <p className="px-1 text-[11px] text-muted">
        {label(item.type)} · {item.style} · {item.season}
        {item.brand && ` · ${item.brand}`}
      </p>
    </article>
  );
}
