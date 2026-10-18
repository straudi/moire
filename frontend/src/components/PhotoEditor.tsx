"use client";
// 사진 편집 (기획안 06장 1~5단계): auto background, eraser/restore with Pointer Events, undo, vector preview.
import { useCallback, useEffect, useRef, useState } from "react";
import { applyAutoBackground, copyCanvas, cropCanvas, loadCanvas } from "@/lib/imaging";
import { vectorFromCanvas, type VectorMode } from "@/lib/vectorize";
import type { VectorData } from "@/lib/types";

export interface EditorResult {
  base: HTMLCanvasElement;
  work: HTMLCanvasElement;
  vector: VectorData | null;
  empty: boolean;
}

interface Props {
  original: Blob;
  edited: Blob | null;
  onResult: (r: EditorResult) => void;
  onError: (message: string) => void;
}

type Tool = "erase" | "restore";

export default function PhotoEditor({ original, edited, onResult, onError }: Props) {
  const view = useRef<HTMLCanvasElement>(null);
  const base = useRef<HTMLCanvasElement | null>(null);
  const work = useRef<HTMLCanvasElement | null>(null);
  const undo = useRef<ImageData[]>([]);
  const stroke = useRef<{ x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(true);
  const [tool, setTool] = useState<Tool>("erase");
  const [brush, setBrush] = useState(22);
  const [tolerance, setTolerance] = useState(28);
  const [mode, setMode] = useState<VectorMode>("auto");
  const [colors, setColors] = useState(7);
  const [canUndo, setCanUndo] = useState(false);
  const [empty, setEmpty] = useState(false);

  const redraw = useCallback(() => {
    const c = view.current;
    if (!c || !work.current) return;
    c.width = work.current.width;
    c.height = work.current.height;
    c.getContext("2d")!.drawImage(work.current, 0, 0);
  }, []);

  const emit = useCallback(() => {
    if (!base.current || !work.current) return;
    redraw();
    const crop = cropCanvas(work.current);
    let vector: VectorData | null = null;
    try {
      vector = crop ? vectorFromCanvas(crop, mode, colors) : null;
    } catch {
      vector = null; // D-006: 무늬 변환 실패 → 대표 색상
    }
    setEmpty(!crop);
    onResult({ base: base.current, work: work.current, vector, empty: !crop });
  }, [mode, colors, onResult, redraw]);

  // Load photo (and the saved edit, if any).
  useEffect(() => {
    let alive = true;
    setBusy(true);
    (async () => {
      try {
        const b = await loadCanvas(original);
        if (!alive) return;
        base.current = b;
        if (edited) {
          const e = await loadCanvas(edited, Math.max(b.width, b.height));
          const w = document.createElement("canvas");
          w.width = b.width;
          w.height = b.height;
          w.getContext("2d")!.drawImage(e, 0, 0, b.width, b.height);
          work.current = w;
        } else {
          const w = copyCanvas(b);
          applyAutoBackground(w, 28);
          work.current = w;
        }
        undo.current = [];
        setCanUndo(false);
        if (alive) setBusy(false);
      } catch (e) {
        onError(e instanceof Error ? e.message : "이미지를 읽을 수 없어요.");
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [original, edited]);

  // Re-vectorise whenever the image is ready or the vector options change.
  useEffect(() => {
    if (!busy) emit();
  }, [busy, emit]);

  function snapshot() {
    if (!work.current) return;
    undo.current.push(work.current.getContext("2d")!.getImageData(0, 0, work.current.width, work.current.height));
    if (undo.current.length > 12) undo.current.shift();
    setCanUndo(true);
  }

  function point(e: React.PointerEvent) {
    const c = view.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height };
  }

  function scale() {
    const c = view.current!;
    return c.width / c.getBoundingClientRect().width;
  }

  function paint(p: { x: number; y: number }) {
    const ctx = work.current!.getContext("2d")!;
    const radius = (brush / 2) * scale();
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, 2 * Math.PI);
    if (tool === "restore") {
      ctx.clip();
      ctx.clearRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
      ctx.drawImage(base.current!, 0, 0);
    } else {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fill();
    }
    ctx.restore();
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!work.current || e.button !== 0) return;
    e.preventDefault();
    snapshot();
    stroke.current = point(e);
    paint(stroke.current);
    redraw();
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const last = stroke.current;
    if (!last || !work.current) return;
    const p = point(e);
    const step = Math.max(1, (brush / 5) * scale());
    const n = Math.max(1, Math.ceil(Math.hypot(p.x - last.x, p.y - last.y) / step));
    for (let i = 1; i <= n; i++) paint({ x: last.x + ((p.x - last.x) * i) / n, y: last.y + ((p.y - last.y) * i) / n });
    stroke.current = p;
    redraw();
  }

  function onUp() {
    if (!stroke.current) return;
    stroke.current = null;
    emit();
  }

  function autoBackground() {
    if (!base.current) return;
    snapshot();
    const w = copyCanvas(base.current);
    applyAutoBackground(w, tolerance, true);
    work.current = w;
    emit();
  }

  function showOriginal() {
    if (!base.current) return;
    snapshot();
    work.current = copyCanvas(base.current);
    emit();
  }

  function doUndo() {
    const prev = undo.current.pop();
    if (prev && work.current) {
      work.current.getContext("2d")!.putImageData(prev, 0, 0);
      emit();
    }
    setCanUndo(undo.current.length > 0);
  }

  return (
    <div className="space-y-3">
      <div className="checker relative flex min-h-48 items-center justify-center overflow-hidden rounded-xl border border-line">
        {busy && <p className="absolute text-sm text-muted">사진 정리 중…</p>}
        <canvas
          ref={view}
          aria-label="옷 사진 편집 영역. 지우개나 복원 도구로 칠할 수 있어요."
          className={`max-h-72 w-auto max-w-full touch-none ${tool === "erase" ? "cursor-crosshair" : "cursor-cell"} ${busy ? "invisible" : ""}`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onLostPointerCapture={onUp}
        />
      </div>
      {empty && !busy && <p className="text-xs text-danger">옷 영역이 없어요. 복원 도구나 &lsquo;원본&rsquo;으로 되살리면 무늬가 적용돼요. 지금은 대표 색상으로 저장돼요.</p>}
      <div className="flex flex-wrap gap-2">
        {(["erase", "restore"] as Tool[]).map((t) => (
          <button key={t} type="button" className="chip" aria-pressed={tool === t} onClick={() => setTool(t)}>
            {t === "erase" ? "지우개" : "복원"}
          </button>
        ))}
        <button type="button" className="chip" onClick={autoBackground}>자동 배경</button>
        <button type="button" className="chip" onClick={showOriginal}>원본</button>
        <button type="button" className="chip" onClick={doUndo} disabled={!canUndo}>되돌리기</button>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs text-muted">
        <label>
          붓 크기 {brush}
          <input type="range" min={6} max={60} value={brush} onChange={(e) => setBrush(+e.target.value)} className="w-full accent-moss" />
        </label>
        <label>
          배경 민감도 {tolerance}
          <input type="range" min={8} max={80} value={tolerance} onChange={(e) => setTolerance(+e.target.value)} className="w-full accent-moss" />
        </label>
        <label>
          무늬 방식
          <select className="field mt-1" value={mode} onChange={(e) => setMode(e.target.value as VectorMode)}>
            <option value="auto">자동</option>
            <option value="stripes">가로 줄무늬</option>
            <option value="detail">세부 색상</option>
          </select>
        </label>
        <label>
          색 수 {colors}
          <input type="range" min={2} max={12} value={colors} onChange={(e) => setColors(+e.target.value)} className="w-full accent-moss" />
        </label>
      </div>
    </div>
  );
}
