"use client";
// App state: common sample items (read-only JSON) merged with this browser's IndexedDB data.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import defaults from "@/data/default-items.json";
import * as db from "./db";
import { getHealth, getWeather, type Health } from "./api";
import { categoryOf } from "./garments";
import type { Asset, Category, ClosetItem, Garment, HistoryEntry, Outfit, Weather, Wear } from "./types";

const SAMPLES: Garment[] = (defaults.items as Omit<Garment, "templateId" | "brand" | "assetId" | "createdAt">[]).map((x) => ({
  ...x,
  templateId: x.type,
  brand: "",
  assetId: null,
  sample: true,
  createdAt: 0,
}));
export const DEFAULT_WEAR = defaults.defaultWear as Wear;
// Placeholder until /api/weather answers; source "dummy" means "not chosen by the user", so it is refreshed on start.
const DEFAULT_WEATHER: Weather = { temp: 18, sky: "맑음", city: "서울", source: "dummy" };

export type ServerState = { status: "checking" } | { status: "down" } | ({ status: "up" } & Omit<Health, "status">);

interface Ctx {
  ready: boolean;
  loadError: string | null;
  items: ClosetItem[];
  byId: Map<string, ClosetItem>;
  assets: Map<string, Asset>;
  wear: Wear;
  outfits: Outfit[];
  history: HistoryEntry[];
  weather: Weather;
  weatherLoading: boolean;
  server: ServerState;
  toast: string | null;
  showToast: (t: string) => void;
  saveItem: (g: Garment, asset: Asset | null) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  wearItem: (id: string) => Promise<void>;
  unwear: (c: Category) => Promise<void>;
  setWear: (w: Wear) => Promise<void>;
  resetWear: () => Promise<void>;
  saveOutfit: (title: string, wear: Wear, reason: string) => Promise<void>;
  logToday: () => Promise<void>;
  setManualWeather: (w: Pick<Weather, "temp" | "sky">) => Promise<void>;
  fetchWeather: (city: string) => Promise<boolean>;
}

const StoreContext = createContext<Ctx | null>(null);

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("StoreProvider missing");
  return ctx;
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [garments, setGarments] = useState<Garment[]>([]);
  const [assets, setAssets] = useState<Map<string, Asset>>(new Map());
  const [hidden, setHidden] = useState<string[]>([]);
  const [wear, setWearState] = useState<Wear>(DEFAULT_WEAR);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [weather, setWeather] = useState<Weather>(DEFAULT_WEATHER);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [server, setServer] = useState<ServerState>({ status: "checking" });
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showToast = useCallback((t: string) => {
    setToast(t);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const fetchWeather = useCallback(async (city: string) => {
    setWeatherLoading(true);
    try {
      const w = await getWeather(city);
      const next: Weather = { temp: w.temp, sky: w.sky, city: w.city, source: w.source };
      setWeather(next);
      await db.setMeta("weather", next).catch(() => {});
      return true;
    } catch (e) {
      showToast(`날씨를 불러오지 못했어요. (${msg(e)}) 직접 입력한 날씨를 사용해요.`);
      return false;
    } finally {
      setWeatherLoading(false);
    }
  }, [showToast]);

  // 앱 시작: 공통 데이터 → IndexedDB → 렌더링 (기획안 11장)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const snap = await db.loadAll();
        if (!alive) return;
        setGarments(snap.garments);
        setAssets(new Map(snap.assets.map((a) => [a.id, a])));
        setHidden(snap.meta.hiddenSamples ?? []);
        setWearState(snap.meta.wear ?? DEFAULT_WEAR);
        setOutfits(snap.outfits.sort((a, b) => b.createdAt - a.createdAt));
        setHistory(snap.history.sort((a, b) => b.id.localeCompare(a.id)));
        const savedWeather = snap.meta.weather as Weather | undefined;
        if (savedWeather) setWeather(savedWeather);
      } catch (e) {
        setLoadError(msg(e));
      } finally {
        if (alive) setReady(true);
      }
    })();
    getHealth()
      .then((h) => alive && setServer({ status: "up", ai: h.ai, weather: h.weather }))
      .catch(() => alive && setServer({ status: "down" }));
    return () => {
      alive = false;
    };
  }, []);

  // 직접 입력하지 않았다면 시작할 때 날씨를 불러온다
  const weatherFetched = useRef(false);
  useEffect(() => {
    if (!ready || server.status !== "up" || weatherFetched.current) return;
    weatherFetched.current = true;
    if (weather.source !== "manual") fetchWeather(weather.city);
  }, [ready, server.status, weather.source, weather.city, fetchWeather]);

  const items = useMemo<ClosetItem[]>(() => {
    const own = new Map(garments.map((g) => [g.id, g]));
    const vec = (g: Garment) => (g.assetId ? assets.get(g.assetId)?.vectorData ?? null : null);
    const personal = garments.filter((g) => !g.sample).sort((a, b) => b.createdAt - a.createdAt);
    const samples = SAMPLES.filter((s) => !hidden.includes(s.id)).map((s) => own.get(s.id) ?? s);
    return [...personal, ...samples].map((g) => ({ ...g, vector: vec(g) }));
  }, [garments, assets, hidden]);

  const byId = useMemo(() => new Map(items.map((x) => [x.id, x])), [items]);

  const setWear = useCallback(async (w: Wear) => {
    await db.setMeta("wear", w);
    setWearState(w);
  }, []);

  const saveItem = useCallback(async (g: Garment, asset: Asset | null) => {
    const prev = garments.find((x) => x.id === g.id) ?? SAMPLES.find((x) => x.id === g.id);
    const replaced = prev?.assetId ?? null;
    await db.saveGarment(g, asset, replaced);
    setGarments((list) => [...list.filter((x) => x.id !== g.id), g]);
    setAssets((m) => {
      const next = new Map(m);
      if (asset) next.set(asset.id, asset);
      if (replaced && replaced !== g.assetId && !garments.some((o) => o.assetId === replaced && o.id !== g.id)) next.delete(replaced);
      return next;
    });
  }, [garments]);

  const deleteItem = useCallback(async (id: string) => {
    const item = byId.get(id);
    if (!item) return;
    const res = await db.deleteGarment(id, item.assetId, !!SAMPLES.find((s) => s.id === id), wear, hidden);
    setGarments((list) => list.filter((x) => x.id !== id));
    setHidden(res.hiddenSamples);
    setWearState(res.wear);
    setOutfits((list) => list.map((o) => ({ ...o, garmentIds: o.garmentIds.filter((x) => x !== id) })).filter((o) => o.garmentIds.length));
    if (item.assetId && !garments.some((o) => o.assetId === item.assetId && o.id !== id))
      setAssets((m) => {
        const next = new Map(m);
        next.delete(item.assetId!);
        return next;
      });
  }, [byId, wear, hidden, garments]);

  const wearItem = useCallback(async (id: string) => {
    const item = byId.get(id);
    if (!item) return;
    await setWear({ ...wear, [categoryOf(item.type)]: id });
  }, [byId, wear, setWear]);

  const unwear = useCallback(async (c: Category) => {
    const next = { ...wear };
    delete next[c];
    await setWear(next);
  }, [wear, setWear]);

  const resetWear = useCallback(async () => {
    const w = Object.fromEntries(Object.entries(DEFAULT_WEAR).filter(([, id]) => id && byId.has(id))) as Wear;
    await setWear(w);
  }, [byId, setWear]);

  const saveOutfit = useCallback(async (title: string, w: Wear, reason: string) => {
    const o: Outfit = { id: `o-${crypto.randomUUID()}`, title, garmentIds: Object.values(w).filter(Boolean) as string[], reason, createdAt: Date.now() };
    await db.putOutfit(o);
    setOutfits((list) => [o, ...list]);
  }, []);

  const logToday = useCallback(async () => {
    const ids = Object.values(wear).filter(Boolean) as string[];
    const d = new Date();
    const id = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const h: HistoryEntry = { id, date: id, garmentIds: ids };
    await db.putHistory(h);
    setHistory((list) => [h, ...list.filter((x) => x.id !== id)]);
  }, [wear]);

  const setManualWeather = useCallback(async (w: Pick<Weather, "temp" | "sky">) => {
    const next: Weather = { ...weather, ...w, source: "manual" };
    await db.setMeta("weather", next);
    setWeather(next);
  }, [weather]);

  const value: Ctx = {
    ready, loadError, items, byId, assets, wear, outfits, history, weather, weatherLoading, server, toast,
    showToast, saveItem, deleteItem, wearItem, unwear, setWear, resetWear, saveOutfit, logToday, setManualWeather, fetchWeather,
  };
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
