"use client";
import type { ReactNode } from "react";
import { useStore } from "@/lib/store";

/** Renders pages only after IndexedDB has been read, so nothing flashes or mismatches on hydration. */
export default function Gate({ children }: { children: ReactNode }) {
  const { ready, loadError } = useStore();
  if (!ready) return <p className="py-24 text-center text-muted">옷장을 여는 중…</p>;
  return (
    <>
      {loadError && (
        <div role="alert" className="mb-4 rounded-xl border border-danger/30 bg-[#f8ebe8] px-4 py-3 text-sm text-danger">
          이 브라우저에 저장할 수 없어요: {loadError} 샘플 옷만 볼 수 있고 변경 사항은 저장되지 않아요.
        </div>
      )}
      {children}
    </>
  );
}
