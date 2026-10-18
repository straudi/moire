"use client";
import { useStore } from "@/lib/store";

export default function Toast() {
  const { toast } = useStore();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      {toast && <div className="max-w-md rounded-full bg-ink px-5 py-3 text-center text-sm text-white shadow-lg">{toast}</div>}
    </div>
  );
}
