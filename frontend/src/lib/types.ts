// Shared types. Field names follow DATA-MODEL.md; vocab must match backend/app/vocab.py.

export const TEMPLATE_IDS = [
  "tee", "longtee", "knit", "jacket", "coat", "jeans", "slacks", "skirt", "sneakers", "boots",
] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export const CATEGORIES = ["상의", "하의", "아우터", "신발"] as const;
export type Category = (typeof CATEGORIES)[number];

export const STYLES = ["미니멀", "캐주얼", "댄디", "로맨틱", "Y2K"] as const;
export type Style = (typeof STYLES)[number];

export const SEASONS = ["봄·가을", "여름", "겨울", "사계절"] as const;
export type Season = (typeof SEASONS)[number];

export const MOODS = ["편안한", "설레는", "차분한", "자신 있는"] as const;
export type Mood = (typeof MOODS)[number];

export const SKIES = ["맑음", "흐림", "비", "눈"] as const;
export type Sky = (typeof SKIES)[number];

export interface Garment {
  id: string;
  name: string;
  type: TemplateId;
  color: string;
  style: Style;
  season: Season;
  brand: string;
  templateId: TemplateId;
  assetId: string | null;
  sample?: boolean;
  createdAt: number;
}

export interface VectorData {
  version: 1;
  palette: string[];
  paths: string[];
  base: string;
  mode: "stripes" | "detail";
  width: number;
  height: number;
}

export interface Asset {
  id: string;
  originalBlob: Blob;
  editedBlob: Blob | null;
  svgText: string;
  vectorData: VectorData | null;
  templateVersion: number;
}

export interface Outfit {
  id: string;
  title: string;
  garmentIds: string[];
  reason: string;
  createdAt: number;
}

export interface HistoryEntry {
  id: string; // YYYY-MM-DD
  date: string;
  garmentIds: string[];
}

export type Wear = Partial<Record<Category, string>>;

export interface Weather {
  temp: number;
  sky: Sky;
  city: string;
  source: "manual" | "dummy" | "openweathermap";
}

/** A garment ready for rendering: metadata plus its vector pattern, if any. */
export interface ClosetItem extends Garment {
  vector: VectorData | null;
}
