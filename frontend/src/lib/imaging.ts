// Local image preprocessing (기획안 06장 1~3단계). Ported from the moire prototype (fitting.js).

export const MAX_SIDE = 640;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function checkFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type) || file.size > MAX_UPLOAD_BYTES) {
    return "JPG·PNG·WEBP 10MB 이하만 올릴 수 있어요.";
  }
  return null;
}

/** Step 1: read and shrink to at most 640px. */
export async function loadCanvas(source: Blob, max = MAX_SIDE): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(source);
  try {
    const img = new Image();
    await new Promise<void>((ok, no) => {
      img.onload = () => ok();
      img.onerror = () => no(new Error("이미지를 읽을 수 없어요."));
      img.src = url;
    });
    const s = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * s));
    c.height = Math.max(1, Math.round(img.height * s));
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Step 2: estimate background from the corners, then flood-fill from the border by colour distance. */
export function removeEdgeBackground(data: Uint8ClampedArray, width: number, height: number, tolerance = 28) {
  const n = width * height;
  const visited = new Uint8Array(n);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  const bins = new Map<string, { count: number; sum: number[] }>();
  const r = Math.max(1, Math.round(Math.min(width, height) * 0.04));
  for (const [x0, y0] of [[0, 0], [width - r, 0], [0, height - r], [width - r, height - r]]) {
    for (let y = y0; y < y0 + r; y++)
      for (let x = x0; x < x0 + r; x++) {
        const i = (y * width + x) * 4;
        if (data[i + 3] < 240) continue;
        const key = `${(data[i] / 20) | 0},${(data[i + 1] / 20) | 0},${(data[i + 2] / 20) | 0}`;
        const b = bins.get(key) ?? { count: 0, sum: [0, 0, 0] };
        b.count++;
        for (let k = 0; k < 3; k++) b.sum[k] += data[i + k];
        bins.set(key, b);
      }
  }
  const best = [...bins.values()].sort((a, b) => b.count - a.count)[0];
  if (!best) return 0;
  const bg = best.sum.map((x) => x / best.count);
  const match = (i: number) => {
    const p = i * 4;
    return data[p + 3] < 12 || Math.hypot(data[p] - bg[0], data[p + 1] - bg[1], data[p + 2] - bg[2]) <= tolerance;
  };
  const push = (i: number) => {
    if (!visited[i]) {
      visited[i] = 1;
      if (match(i)) queue[tail++] = i;
    }
  };
  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    push(y * width);
    push(y * width + width - 1);
  }
  while (head < tail) {
    const i = queue[head++];
    const x = i % width;
    const y = (i / width) | 0;
    data[i * 4 + 3] = 0;
    if (x) push(i - 1);
    if (x < width - 1) push(i + 1);
    if (y) push(i - width);
    if (y < height - 1) push(i + width);
  }
  return tail / n;
}

export function alphaBounds(data: Uint8ClampedArray, w: number, h: number) {
  let l = w, t = h, r = -1, b = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (data[(y * w + x) * 4 + 3] > 20) {
        if (x < l) l = x;
        if (x > r) r = x;
        if (y < t) t = y;
        if (y > b) b = y;
      }
  return r < l ? null : { x: l, y: t, width: r - l + 1, height: b - t + 1 };
}

export function copyCanvas(src: HTMLCanvasElement) {
  const c = document.createElement("canvas");
  c.width = src.width;
  c.height = src.height;
  c.getContext("2d")!.drawImage(src, 0, 0);
  return c;
}

export function cropCanvas(c: HTMLCanvasElement) {
  const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
  const b = alphaBounds(d.data, c.width, c.height);
  if (!b) return null;
  const out = document.createElement("canvas");
  out.width = b.width;
  out.height = b.height;
  out.getContext("2d")!.drawImage(c, b.x, b.y, b.width, b.height, 0, 0, b.width, b.height);
  return out;
}

/** Remove the background unless the image already has transparency (e.g. a cut-out PNG). */
export function applyAutoBackground(canvas: HTMLCanvasElement, tolerance = 28, force = false) {
  const ctx = canvas.getContext("2d")!;
  const im = ctx.getImageData(0, 0, canvas.width, canvas.height);
  if (!force) {
    let transparent = 0;
    for (let i = 3; i < im.data.length; i += 4) if (im.data[i] < 240) transparent++;
    if (transparent / (canvas.width * canvas.height) > 0.03) return;
  }
  removeEdgeBackground(im.data, canvas.width, canvas.height, tolerance);
  ctx.putImageData(im, 0, 0);
}

export function canvasToBlob(c: HTMLCanvasElement, type = "image/png", quality?: number): Promise<Blob> {
  return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("이미지 변환 실패"))), type, quality));
}

/** JPEG copy on a white background for AI tagging (smaller upload). */
export async function toTaggingJpeg(c: HTMLCanvasElement) {
  const out = document.createElement("canvas");
  out.width = c.width;
  out.height = c.height;
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(c, 0, 0);
  return canvasToBlob(out, "image/jpeg", 0.85);
}
