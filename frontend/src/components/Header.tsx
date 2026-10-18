"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";

const TABS = [
  { href: "/", label: "내 캐릭터" },
  { href: "/closet", label: "나의 옷장" },
  { href: "/recommend", label: "코디 추천" },
];

function ServerBadge() {
  const { server } = useStore();
  const [text, tone] =
    server.status === "checking"
      ? ["서버 확인 중", "bg-line text-muted"]
      : server.status === "down"
        ? ["서버 연결 안 됨 — AI 없이 동작", "bg-[#f4e3df] text-danger"]
        : server.ai === "bedrock"
          ? ["AI 연결됨", "bg-moss-soft text-moss"]
          : ["AI 더미 모드", "bg-[#f3efe1] text-[#7a6a35]"];
  return (
    <span role="status" className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${tone}`}>
      {text}
    </span>
  );
}

export default function Header() {
  const path = usePathname();
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="font-serif text-3xl italic tracking-tighter">
          moire<span className="ml-0.5 align-top text-xl not-italic text-moss">✳</span>
        </Link>
        <nav className="order-3 flex w-full gap-6 sm:order-none sm:w-auto" aria-label="주요 메뉴">
          {TABS.map((t) => {
            const active = t.href === path;
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`relative py-1 text-sm font-medium ${active ? "text-ink after:absolute after:inset-x-0 after:-bottom-1 after:h-[3px] after:rounded after:bg-moss" : "text-muted hover:text-ink"}`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
        <ServerBadge />
      </div>
    </header>
  );
}
