// SVG template renderer. Coordinates and layer order are fixed by D-007 / DATA-MODEL.md.
import templates from "@/data/templates.json";
import type { Category, ClosetItem, TemplateId, VectorData, Wear } from "./types";

interface Template {
  label: string;
  category: Category;
  box: [number, number, number, number];
  shapes: string[];
  lines: string[];
  extra: string;
}

export const TEMPLATES = templates.templates as Record<TemplateId, Template>;
export const VIEWBOX = templates.viewBox;
export const TEMPLATE_VERSION = templates.version;
const LAYERS = templates.layerOrder as Category[];
const FALLBACK_COLOR = "#aaa69a";

export const label = (t: TemplateId) => TEMPLATES[t]?.label ?? t;
export const categoryOf = (t: TemplateId): Category => TEMPLATES[t]?.category ?? "상의";

export function safeColor(c: string | undefined | null) {
  return c && /^#[0-9a-f]{6}$/i.test(c) ? c : FALLBACK_COLOR;
}

export function esc(v: unknown) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function validVector(v: unknown): v is VectorData {
  const x = v as VectorData | null;
  return (
    !!x &&
    x.version === 1 &&
    Array.isArray(x.palette) &&
    x.palette.length <= 12 &&
    x.palette.every((c) => /^#[a-f0-9]{6}$/i.test(c)) &&
    Array.isArray(x.paths) &&
    x.paths.length === x.palette.length &&
    x.paths.every((p) => typeof p === "string" && p.length < 500000 && /^[0-9MmhHvVlLzZ.\s,-]*$/.test(p))
  );
}

function plain(type: TemplateId, color: string) {
  const t = TEMPLATES[type] ?? TEMPLATES.tee;
  const stroke = 'stroke="#33352b" stroke-opacity=".14" stroke-width="1.2" stroke-linejoin="round"';
  return t.shapes.map((d) => `<path d="${d}" fill="${color}" ${stroke}/>`).join("") + lineLayer(t) + t.extra;
}

function lineLayer(t: Template) {
  return t.lines.map((d) => `<path d="${d}" fill="none" stroke="#303128" stroke-opacity=".18" stroke-width="1.2"/>`).join("");
}

let seq = 0;

/** One garment layer: template silhouette filled with the base colour, vector pattern clipped inside it. */
export function garmentLayer(item: Pick<ClosetItem, "type" | "color" | "vector">) {
  const t = TEMPLATES[item.type] ?? TEMPLATES.tee;
  if (!validVector(item.vector)) return plain(item.type, safeColor(item.color));
  const v = item.vector;
  const id = `moire-clip-${++seq}`;
  const [bx, by, bw, bh] = t.box;
  const clip = t.shapes.map((d) => `<path d="${d}"/>`).join("");
  const pattern = v.paths.map((d, i) => (d ? `<path d="${d}" fill="${v.palette[i]}"/>` : "")).join("");
  return (
    `<defs><clipPath id="${id}">${clip}</clipPath></defs>` +
    plain(item.type, safeColor(v.base)) +
    `<g clip-path="url(#${id})"><g transform="translate(${bx} ${by}) scale(${bw / 100} ${bh / 100})">${pattern}</g></g>` +
    lineLayer(t) +
    t.extra
  );
}

/** Full character with layers: body → 하의 → 상의 → 아우터 → 신발 → face. */
export function characterSVG(worn: Partial<Record<Category, ClosetItem | undefined>>, labelText = "현재 코디를 입은 캐릭터") {
  const layers = LAYERS.map((c) => (worn[c] ? garmentLayer(worn[c]!) : "")).join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}" role="img" aria-label="${esc(labelText)}">` +
    templates.avatar.back +
    layers +
    templates.avatar.front +
    `</svg>`
  );
}

export function resolveWear(wear: Wear, byId: Map<string, ClosetItem>) {
  const out: Partial<Record<Category, ClosetItem>> = {};
  for (const c of LAYERS) {
    const id = wear[c];
    const item = id ? byId.get(id) : undefined;
    if (item) out[c] = item;
  }
  return out;
}

/** Rebuild a wear map from stored garment IDs, skipping deleted ones (history/outfits). */
export function wearFromIds(ids: string[], byId: Map<string, ClosetItem>): Wear {
  const w: Wear = {};
  for (const id of ids) {
    const x = byId.get(id);
    if (x) w[categoryOf(x.type)] = id;
  }
  return w;
}

function thumbBox(type: TemplateId) {
  const c = categoryOf(type);
  if (c === "하의") return "63 177 115 148";
  if (c === "신발") return "62 268 116 71";
  if (type === "coat") return "43 93 154 177";
  return "43 93 154 125";
}

export function thumbSVG(item: Pick<ClosetItem, "type" | "color" | "vector" | "name">) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${thumbBox(item.type)}" role="img" aria-label="${esc(item.name)} 의상">${garmentLayer(item)}</svg>`;
}

/** Standalone garment SVG for download / assets.svgText. Contains only vector paths (no bitmaps). */
export function garmentFileSVG(item: Pick<ClosetItem, "type" | "color" | "vector">) {
  const [x, y, w, h] = (TEMPLATES[item.type] ?? TEMPLATES.tee).box;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x - 3} ${y - 3} ${w + 6} ${h + 6}" width="480" height="480">${garmentLayer(item)}</svg>`;
}

export function downloadText(text: string, filename: string, type = "image/svg+xml") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
