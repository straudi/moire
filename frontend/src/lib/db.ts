// IndexedDB storage layer (DATA-MODEL.md). Every write resolves only after the transaction commits,
// so callers never show success for a failed save.
import type { Asset, Garment, HistoryEntry, Outfit, Wear } from "./types";

const DB_NAME = "moire";
const DB_VERSION = 1;
const STORES = ["garments", "assets", "outfits", "history", "meta"] as const;
type StoreName = (typeof STORES)[number];

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((ok, no) => {
    if (typeof indexedDB === "undefined") return no(new Error("이 브라우저는 IndexedDB를 지원하지 않아요."));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: s === "meta" ? "key" : "id" });
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => no(req.error ?? new Error("저장소를 열 수 없어요."));
    req.onblocked = () => no(new Error("다른 탭이 저장소를 사용 중이에요. 다른 moire 탭을 닫아 주세요."));
  });
  dbPromise.catch(() => (dbPromise = null));
  return dbPromise;
}

function done(tx: IDBTransaction) {
  return new Promise<void>((ok, no) => {
    tx.oncomplete = () => ok();
    tx.onerror = () => no(tx.error ?? new Error("저장하지 못했어요."));
    tx.onabort = () => no(tx.error ?? new Error("저장이 취소되었어요."));
  });
}

function request<T>(r: IDBRequest<T>) {
  return new Promise<T>((ok, no) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error);
  });
}

async function run(stores: StoreName[], fn: (tx: IDBTransaction) => void | Promise<void>) {
  const db = await openDB();
  const tx = db.transaction(stores, "readwrite");
  const finished = done(tx);
  try {
    await fn(tx);
  } catch (e) {
    try {
      tx.abort();
    } catch {}
    await finished.catch(() => {});
    throw e;
  }
  await finished;
}

export interface MetaValues {
  wear: Wear;
  hiddenSamples: string[];
  weather: unknown;
}

export interface Snapshot {
  garments: Garment[];
  assets: Asset[];
  outfits: Outfit[];
  history: HistoryEntry[];
  meta: Partial<MetaValues>;
}

export async function loadAll(): Promise<Snapshot> {
  const db = await openDB();
  const tx = db.transaction(STORES, "readonly");
  const all = <T,>(s: StoreName) => request(tx.objectStore(s).getAll()) as Promise<T[]>;
  const [garments, assets, outfits, history, metaRows] = await Promise.all([
    all<Garment>("garments"),
    all<Asset>("assets"),
    all<Outfit>("outfits"),
    all<HistoryEntry>("history"),
    all<{ key: string; value: unknown }>("meta"),
  ]);
  const meta = Object.fromEntries(metaRows.map((r) => [r.key, r.value])) as Partial<MetaValues>;
  return { garments, assets, outfits, history, meta };
}

export function setMeta<K extends keyof MetaValues>(key: K, value: MetaValues[K]) {
  return run(["meta"], (tx) => void tx.objectStore("meta").put({ key, value }));
}

/** Save garment (+ new asset) atomically; drop the replaced asset if nothing else uses it. */
export function saveGarment(g: Garment, asset: Asset | null, replacedAssetId: string | null) {
  return run(["garments", "assets"], async (tx) => {
    if (asset) tx.objectStore("assets").put(asset);
    tx.objectStore("garments").put(g);
    if (replacedAssetId && replacedAssetId !== g.assetId) {
      const others = (await request(tx.objectStore("garments").getAll())) as Garment[];
      if (!others.some((o) => o.assetId === replacedAssetId && o.id !== g.id)) tx.objectStore("assets").delete(replacedAssetId);
    }
  });
}

/** D-008: delete garment, unwear it, clean outfits, hide samples, drop unreferenced asset. */
export function deleteGarment(id: string, assetId: string | null, isSample: boolean, wear: Wear, hiddenSamples: string[]) {
  const nextWear: Wear = Object.fromEntries(Object.entries(wear).filter(([, v]) => v !== id));
  const nextHidden = isSample && !hiddenSamples.includes(id) ? [...hiddenSamples, id] : hiddenSamples;
  return run(["garments", "assets", "outfits", "meta"], async (tx) => {
    tx.objectStore("garments").delete(id);
    const outfits = (await request(tx.objectStore("outfits").getAll())) as Outfit[];
    for (const o of outfits) {
      if (!o.garmentIds.includes(id)) continue;
      const ids = o.garmentIds.filter((x) => x !== id);
      if (ids.length) tx.objectStore("outfits").put({ ...o, garmentIds: ids });
      else tx.objectStore("outfits").delete(o.id);
    }
    if (assetId) {
      const others = (await request(tx.objectStore("garments").getAll())) as Garment[];
      if (!others.some((o) => o.assetId === assetId)) tx.objectStore("assets").delete(assetId);
    }
    tx.objectStore("meta").put({ key: "wear", value: nextWear });
    tx.objectStore("meta").put({ key: "hiddenSamples", value: nextHidden });
  }).then(() => ({ wear: nextWear, hiddenSamples: nextHidden }));
}

export function putOutfit(o: Outfit) {
  return run(["outfits"], (tx) => void tx.objectStore("outfits").put(o));
}

export function putHistory(h: HistoryEntry) {
  return run(["history"], (tx) => void tx.objectStore("history").put(h));
}
