// Colour quantisation and vector paths (기획안 06장 4~5단계). No bitmaps in the output.
import type { VectorData } from "./types";

type RGB = [number, number, number];

function nearest(p: RGB, centers: RGB[]) {
  let best = 0;
  let dist = Infinity;
  for (let k = 0; k < centers.length; k++) {
    const c = centers[k];
    const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
    if (d < dist) {
      dist = d;
      best = k;
    }
  }
  return best;
}

/** K-means colour quantisation, seeded by brightness quantiles. */
function quantize(rgba: Uint8ClampedArray, w: number, h: number, colorCount: number) {
  const samples: RGB[] = [];
  for (let i = 0; i < rgba.length; i += 4) if (rgba[i + 3] > 100) samples.push([rgba[i], rgba[i + 1], rgba[i + 2]]);
  if (!samples.length) return null;
  const sorted = [...samples].sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
  const centers: RGB[] = Array.from({ length: colorCount }, (_, i) => [
    ...sorted[Math.min(sorted.length - 1, Math.floor(((i + 0.5) * sorted.length) / colorCount))],
  ] as RGB);
  for (let iter = 0; iter < 9; iter++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (const p of samples) {
      const k = nearest(p, centers);
      for (let c = 0; c < 3; c++) sums[k][c] += p[c];
      sums[k][3]++;
    }
    for (let k = 0; k < centers.length; k++)
      if (sums[k][3]) centers[k] = sums[k].slice(0, 3).map((v) => v / sums[k][3]) as RGB;
  }
  const palette = centers.map((p) => "#" + p.map((v) => Math.round(v).toString(16).padStart(2, "0")).join(""));
  const labels = new Int16Array(w * h).fill(-1);
  const counts = new Int32Array(colorCount);
  for (let i = 0; i < w * h; i++)
    if (rgba[i * 4 + 3] > 100) {
      const k = nearest([rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]], centers);
      labels[i] = k;
      counts[k]++;
    }
  return { palette, labels, base: palette[counts.indexOf(Math.max(...counts))] };
}

/** Horizontal stripes: the dominant colour of each row's centre band changes often and consistently. */
function detectStripes(labels: Int16Array, w: number, h: number) {
  let agree = 0, total = 0, changes = 0, prior = -1;
  const rows: number[] = [];
  for (let y = 0; y < h; y++) {
    const counts = new Map<number, number>();
    for (let x = Math.floor(w * 0.3); x < Math.ceil(w * 0.7); x++) {
      const k = labels[y * w + x];
      if (k >= 0) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const best = [...counts].sort((a, b) => b[1] - a[1])[0];
    rows.push(best?.[0] ?? -1);
    if (best) {
      agree += best[1];
      total += [...counts.values()].reduce((a, b) => a + b, 0);
      if (prior >= 0 && best[0] !== prior) changes++;
      prior = best[0];
    }
  }
  return { detected: total > 0 && agree / total > 0.48 && changes >= 14, rows };
}

export type VectorMode = "auto" | "stripes" | "detail";

/** Merge same-colour runs across rows into rectangles; emit one path per palette colour (0~100 coordinates). */
export function vectorize(rgba: Uint8ClampedArray, w: number, h: number, mode: VectorMode = "auto", colorCount = 7): VectorData | null {
  const q = quantize(rgba, w, h, colorCount);
  if (!q) return null;
  const stripe = detectStripes(q.labels, w, h);
  const useStripe = mode === "stripes" || (mode === "auto" && stripe.detected);
  const labels = q.labels;
  if (useStripe) {
    let prev = labels.find((k) => k >= 0) ?? 0;
    for (let y = 0; y < h; y++) {
      const k = stripe.rows[y] >= 0 ? stripe.rows[y] : prev;
      for (let x = 0; x < w; x++) labels[y * w + x] = k;
      prev = k;
    }
  }
  const paths: string[][] = q.palette.map(() => []);
  const f = (n: number) => Math.round(n * 1000) / 1000;
  type Run = { x: number; y: number; w: number; h: number; k: number };
  let active = new Map<string, Run>();
  const flush = (r: Run) => {
    const x = f((r.x * 100) / w), y = f((r.y * 100) / h);
    const rw = f((r.w * 100) / w + 0.015), rh = f((r.h * 100) / h + 0.015);
    paths[r.k].push(`M${x} ${y}h${rw}v${rh}h-${rw}Z`);
  };
  for (let y = 0; y < h; y++) {
    const next = new Map<string, Run>();
    let x = 0;
    while (x < w) {
      const k = labels[y * w + x];
      const start = x;
      while (x < w && labels[y * w + x] === k) x++;
      if (k < 0) continue;
      const key = `${start}:${x - start}:${k}`;
      const r = active.get(key);
      if (r) {
        r.h++;
        next.set(key, r);
        active.delete(key);
      } else next.set(key, { x: start, y, w: x - start, h: 1, k });
    }
    for (const r of active.values()) flush(r);
    active = next;
  }
  for (const r of active.values()) flush(r);
  return { version: 1, palette: q.palette, paths: paths.map((p) => p.join("")), base: q.base, mode: useStripe ? "stripes" : "detail", width: w, height: h };
}

/** Resample a cut-out to 128×160 and vectorise it. */
export function vectorFromCanvas(input: HTMLCanvasElement, mode: VectorMode = "auto", colors = 7) {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 160;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(input, 0, 0, c.width, c.height);
  return vectorize(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height, mode, colors);
}
