"use client";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { characterSVG, resolveWear } from "@/lib/garments";
import type { Wear } from "@/lib/types";
import Svg from "./Svg";

export function useCharacterMarkup(wear: Wear, labelText?: string) {
  const { byId } = useStore();
  return useMemo(() => characterSVG(resolveWear(wear, byId), labelText), [wear, byId, labelText]);
}

export default function Character({ wear, className = "", label }: { wear: Wear; className?: string; label?: string }) {
  const markup = useCharacterMarkup(wear, label);
  return <Svg markup={markup} className={className} />;
}
