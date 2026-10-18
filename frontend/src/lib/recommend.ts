// Rule-based candidate filter (PRD 업무 규칙). The LLM only explains/chooses among these.
import { categoryOf } from "./garments";
import type { RecommendCandidate } from "./api";
import type { Category, ClosetItem, Mood, Style, Weather, Wear } from "./types";

export function seasonFits(item: ClosetItem, temp: number) {
  switch (item.season) {
    case "여름":
      return temp >= 20;
    case "겨울":
      return temp < 12;
    case "봄·가을":
      return temp >= 8 && temp <= 25;
    default:
      return true;
  }
}

export function suitable(item: ClosetItem, temp: number) {
  if (!seasonFits(item, temp)) return false;
  if (item.type === "coat") return temp < 15;
  if (item.type === "jacket") return temp < 22;
  if (item.type === "boots") return temp < 18;
  if (item.type === "tee") return temp >= 15;
  return true;
}

export function score(item: ClosetItem, style: Style, mood: Mood) {
  let v = item.style === style ? 7 : 0;
  if (mood === "편안한" && ["tee", "longtee", "knit", "jeans", "sneakers"].includes(item.type)) v += 4;
  if (mood === "차분한" && ["미니멀", "댄디"].includes(item.style)) v += 3;
  if (mood === "설레는" && item.style === "로맨틱") v += 5;
  if (mood === "자신 있는" && ["jacket", "boots", "slacks"].includes(item.type)) v += 4;
  return v;
}

export interface Candidate {
  id: string;
  wear: Wear;
  score: number;
}

export type RuleResult =
  | { ok: true; candidates: Candidate[]; needsOuter: boolean; outerMissing: boolean }
  | { ok: false; missing: Category[] };

export function buildCandidates(items: ClosetItem[], weather: Weather, style: Style, mood: Mood): RuleResult {
  const pools = {} as Record<Category, ClosetItem[]>;
  for (const c of ["상의", "하의", "아우터", "신발"] as Category[])
    pools[c] = items
      .filter((x) => categoryOf(x.type) === c && suitable(x, weather.temp))
      .sort((a, b) => score(b, style, mood) - score(a, style, mood));
  const missing = (["상의", "하의", "신발"] as Category[]).filter((c) => !pools[c].length);
  if (missing.length) return { ok: false, missing };

  const needsOuter = weather.temp < 18;
  const outer = pools["아우터"][0];
  const combos: Omit<Candidate, "id">[] = [];
  for (const top of pools["상의"].slice(0, 4))
    for (const bottom of pools["하의"].slice(0, 4))
      for (const shoes of pools["신발"].slice(0, 2)) {
        const wear: Wear = { 상의: top.id, 하의: bottom.id, 신발: shoes.id };
        let s = score(top, style, mood) + score(bottom, style, mood) + score(shoes, style, mood);
        if (needsOuter && outer) {
          wear["아우터"] = outer.id;
          s += score(outer, style, mood);
        }
        combos.push({ wear, score: s });
      }
  combos.sort((a, b) => b.score - a.score);

  // Prefer variety: no two candidates share both top and bottom.
  const picked: Omit<Candidate, "id">[] = [];
  for (const c of combos) {
    if (picked.some((p) => p.wear["상의"] === c.wear["상의"] && p.wear["하의"] === c.wear["하의"])) continue;
    picked.push(c);
    if (picked.length === 8) break;
  }
  return {
    ok: true,
    candidates: picked.map((c, i) => ({ ...c, id: `c${i + 1}` })),
    needsOuter,
    outerMissing: needsOuter && !outer,
  };
}

/** Rule-only fallback: top candidate + the most different second one. */
export function ruleResults(candidates: Candidate[]) {
  const first = candidates[0];
  const second =
    candidates.find((c) => c.wear["상의"] !== first.wear["상의"] && c.wear["하의"] !== first.wear["하의"]) ?? candidates[1];
  return [first, second].filter(Boolean) as Candidate[];
}

export function ruleReason(weather: Weather, style: Style, mood: Mood, needsOuter: boolean, outerMissing: boolean) {
  let r = `${weather.temp}°C에 맞는 옷을 먼저 고르고, ${style} 스타일과 '${mood}' 기분에 어울리는 조합을 골랐어요.`;
  if (needsOuter) r += outerMissing ? " 쌀쌀한 날씨예요. 옷장에 아우터를 추가해 주세요." : " 겉옷으로 따뜻함을 더했어요.";
  if (weather.sky === "비" || weather.sky === "눈") r += " 우산을 챙기세요.";
  return r;
}

export function toApiCandidates(candidates: Candidate[], byId: Map<string, ClosetItem>): RecommendCandidate[] {
  return candidates.map((c) => {
    const ids = Object.values(c.wear).filter(Boolean) as string[];
    return {
      id: c.id,
      garmentIds: ids,
      items: ids.map((id) => {
        const x = byId.get(id)!;
        return { id: x.id, name: x.name, type: x.type, color: x.color, style: x.style, season: x.season };
      }),
    };
  });
}
